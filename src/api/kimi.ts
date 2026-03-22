import * as vscode from 'vscode';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import { ChatMessage, KimiResponse, KimiStreamChunk, Tool, ToolCall, StreamWithToolsResponse } from './types';

export class KimiClient {
  private getConfig() {
    const config = vscode.workspace.getConfiguration('kursor');
    return {
      apiKey: config.get<string>('apiKey', ''),
      model: config.get<string>('model', 'moonshot-v1-32k'),
      apiBase: config.get<string>('apiBase', 'https://api.moonshot.ai/v1'),
      temperature: config.get<number>('temperature', 0.7),
    };
  }

  private checkApiKey(apiKey: string) {
    if (!apiKey) {
      throw new Error(
        '🔑 No API Key! Run "Kursor: Set Kimi API Key".\n' +
        'Free models, free spirit. Unlike that $20/month editor.'
      );
    }
  }

  private makeRequest(
    url: URL,
    apiKey: string,
    body: string,
    signal?: AbortSignal
  ): Promise<http.IncomingMessage> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new Error('Request aborted'));
        return;
      }

      const protocol = url.protocol === 'https:' ? https : http;
      const req = protocol.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname + url.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
        },
        (res) => resolve(res)
      );

      signal?.addEventListener('abort', () => {
        req.destroy();
        reject(new Error('Request aborted'));
      });

      req.on('error', (e) => reject(e));
      req.write(body);
      req.end();
    });
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const { apiKey, model, apiBase, temperature } = this.getConfig();
    this.checkApiKey(apiKey);

    const body = JSON.stringify({
      model,
      messages,
      temperature: Math.min(Math.max(temperature, 0), 1),
    });

    const url = new URL(`${apiBase}/chat/completions`);

    return new Promise((resolve, reject) => {
      const protocol = url.protocol === 'https:' ? https : http;
      const req = protocol.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname + url.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              if (res.statusCode && res.statusCode >= 400) {
                const err = JSON.parse(data);
                reject(new Error(
                  `Kimi API Error (${res.statusCode}): ${err.error?.message || data}`
                ));
                return;
              }
              const json: KimiResponse = JSON.parse(data);
              resolve(json.choices[0]?.message?.content || '');
            } catch (e) {
              reject(new Error(`Failed to parse response: ${data}`));
            }
          });
        }
      );

      req.on('error', (e) => reject(new Error(`Network error: ${e.message}`)));
      req.write(body);
      req.end();
    });
  }

  async *chatStream(
    messages: ChatMessage[],
    signal?: AbortSignal
  ): AsyncGenerator<string> {
    const { apiKey, model, apiBase, temperature } = this.getConfig();
    this.checkApiKey(apiKey);

    const body = JSON.stringify({
      model,
      messages,
      temperature: Math.min(Math.max(temperature, 0), 1),
      stream: true,
    });

    const url = new URL(`${apiBase}/chat/completions`);
    const response = await this.makeRequest(url, apiKey, body, signal);

    if (response.statusCode && response.statusCode >= 400) {
      let data = '';
      for await (const chunk of response) {
        data += chunk;
      }
      throw new Error(`Kimi API Error (${response.statusCode}): ${data}`);
    }

    let buffer = '';
    for await (const chunk of response) {
      if (signal?.aborted) { break; }

      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) { continue; }

        const data = trimmed.slice(6);
        if (data === '[DONE]') { return; }

        try {
          const parsed: KimiStreamChunk = JSON.parse(data);
          const content = parsed.choices[0]?.delta?.content;
          if (content) {
            yield content;
          }
        } catch {
          // skip malformed chunks
        }
      }
    }
  }

  /**
   * Stream chat with tool calling support.
   * Accumulates both text content and tool_call deltas from the stream.
   * Tool call arguments arrive incrementally and are concatenated.
   */
  async chatStreamWithTools(
    messages: ChatMessage[],
    tools: Tool[] | undefined,
    signal?: AbortSignal,
    onTextChunk?: (text: string) => void
  ): Promise<StreamWithToolsResponse> {
    const { apiKey, model, apiBase, temperature } = this.getConfig();
    this.checkApiKey(apiKey);

    const requestBody: Record<string, any> = {
      model,
      messages,
      temperature: Math.min(Math.max(temperature, 0), 1),
      stream: true,
    };
    if (tools && tools.length > 0) {
      requestBody.tools = tools;
    }

    const body = JSON.stringify(requestBody);
    const url = new URL(`${apiBase}/chat/completions`);
    const response = await this.makeRequest(url, apiKey, body, signal);

    if (response.statusCode && response.statusCode >= 400) {
      let data = '';
      for await (const chunk of response) {
        data += chunk;
      }
      throw new Error(`Kimi API Error (${response.statusCode}): ${data}`);
    }

    // Accumulators
    let textContent = '';
    let finishReason: string | null = null;
    const toolCallMap: Map<number, { id: string; type: string; name: string; arguments: string }> = new Map();

    let buffer = '';
    for await (const chunk of response) {
      if (signal?.aborted) { break; }

      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) { continue; }

        const data = trimmed.slice(6);
        if (data === '[DONE]') { break; }

        try {
          const parsed: KimiStreamChunk = JSON.parse(data);
          const choice = parsed.choices[0];
          if (!choice) { continue; }

          // Track finish reason
          if (choice.finish_reason) {
            finishReason = choice.finish_reason;
          }

          const delta = choice.delta;

          // Accumulate text content
          if (delta.content) {
            textContent += delta.content;
            onTextChunk?.(delta.content);
          }

          // Accumulate tool calls
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index;
              if (!toolCallMap.has(idx)) {
                toolCallMap.set(idx, {
                  id: tc.id || '',
                  type: tc.type || 'function',
                  name: tc.function?.name || '',
                  arguments: tc.function?.arguments || '',
                });
              } else {
                const existing = toolCallMap.get(idx)!;
                if (tc.id) { existing.id = tc.id; }
                if (tc.function?.name) { existing.name = tc.function.name; }
                if (tc.function?.arguments) {
                  existing.arguments += tc.function.arguments;
                }
              }
            }
          }
        } catch {
          // skip malformed chunks
        }
      }
    }

    // Build tool calls array
    let toolCalls: ToolCall[] | null = null;
    if (toolCallMap.size > 0) {
      toolCalls = [];
      for (const [, tc] of toolCallMap) {
        toolCalls.push({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.name,
            arguments: tc.arguments,
          },
        });
      }
    }

    // Build the complete assistant message
    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: textContent,
    };
    if (toolCalls) {
      assistantMessage.tool_calls = toolCalls;
    }

    return {
      textContent,
      toolCalls,
      assistantMessage,
      finishReason,
    };
  }
}
