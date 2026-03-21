import * as vscode from 'vscode';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import { ChatMessage, KimiResponse, KimiStreamChunk } from './types';

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

  async chat(messages: ChatMessage[]): Promise<string> {
    const { apiKey, model, apiBase, temperature } = this.getConfig();

    if (!apiKey) {
      throw new Error(
        '🔑 No API Key found! Run "Kursor: Set Kimi API Key" command.\n\n' +
        'Unlike Cursor, we don\'t hide the pricing behind a paywall.'
      );
    }

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
                  `Kimi API Error (${res.statusCode}): ${err.error?.message || data}\n\n` +
                  'At least our errors are more honest than Cursor\'s "something went wrong".'
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

    if (!apiKey) {
      throw new Error(
        '🔑 No API Key! Run "Kursor: Set Kimi API Key".\n' +
        'Free models, free spirit. Unlike that $20/month editor.'
      );
    }

    const body = JSON.stringify({
      model,
      messages,
      temperature: Math.min(Math.max(temperature, 0), 1),
      stream: true,
    });

    const url = new URL(`${apiBase}/chat/completions`);

    const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
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
}
