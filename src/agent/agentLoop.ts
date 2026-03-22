import { KimiClient } from '../api/kimi';
import { ChatMessage, ToolCall, ToolResult } from '../api/types';
import { AGENT_TOOLS, SAFE_TOOLS, DANGEROUS_TOOLS } from './tools';
import { ToolExecutor } from './toolExecutor';

const MAX_TOOL_RESULT_LENGTH = 8000;

export interface AgentLoopCallbacks {
  onTextChunk: (text: string) => void;
  onToolCallStart: (toolName: string, args: any, toolCallId: string) => void;
  onToolCallComplete: (toolCallId: string, result: ToolResult) => void;
  onApprovalRequired: (toolName: string, args: any, toolCallId: string) => Promise<boolean>;
  onComplete: () => void;
  onError: (error: Error) => void;
}

export class AgentLoop {
  private maxIterations: number;

  constructor(
    private client: KimiClient,
    private toolExecutor: ToolExecutor,
    private callbacks: AgentLoopCallbacks,
    maxIterations = 20
  ) {
    this.maxIterations = maxIterations;
  }

  async run(messages: ChatMessage[], signal?: AbortSignal): Promise<ChatMessage[]> {
    let iterations = 0;
    const updatedMessages = [...messages];

    while (iterations < this.maxIterations) {
      if (signal?.aborted) { break; }
      iterations++;

      // Call Kimi API with tools
      const response = await this.client.chatStreamWithTools(
        updatedMessages,
        AGENT_TOOLS,
        signal,
        (chunk) => this.callbacks.onTextChunk(chunk)
      );

      // If no tool calls, this is the final response
      if (!response.toolCalls || response.toolCalls.length === 0) {
        updatedMessages.push(response.assistantMessage);
        break;
      }

      // Add the assistant message (with tool_calls) to conversation
      updatedMessages.push(response.assistantMessage);

      // Process each tool call
      for (const toolCall of response.toolCalls) {
        if (signal?.aborted) { break; }

        const { name, arguments: argsStr } = toolCall.function;
        let parsedArgs: Record<string, any>;
        try {
          parsedArgs = JSON.parse(argsStr);
        } catch {
          parsedArgs = {};
        }

        this.callbacks.onToolCallStart(name, parsedArgs, toolCall.id);

        // Check if approval is needed
        if (DANGEROUS_TOOLS.has(name)) {
          const approved = await this.requestApprovalWithTimeout(
            name, parsedArgs, toolCall.id, 60000
          );

          if (!approved) {
            const result: ToolResult = {
              success: false,
              output: 'User rejected this action.',
            };
            updatedMessages.push({
              role: 'tool',
              content: result.output,
              tool_call_id: toolCall.id,
            });
            this.callbacks.onToolCallComplete(toolCall.id, result);
            continue;
          }
        }

        // Execute the tool
        const result = await this.toolExecutor.execute(name, parsedArgs);

        // Truncate output for API (full output shown in UI)
        const truncatedOutput = result.success
          ? this.truncateForApi(result.output)
          : `Error: ${result.error || result.output}`;

        updatedMessages.push({
          role: 'tool',
          content: truncatedOutput,
          tool_call_id: toolCall.id,
        });

        this.callbacks.onToolCallComplete(toolCall.id, result);
      }

      // Continue the loop — Kimi will process tool results
    }

    if (iterations >= this.maxIterations) {
      this.callbacks.onError(new Error(
        `Agent reached maximum iteration limit (${this.maxIterations}). ` +
        'Unlike Cursor, we tell you when we hit the ceiling.'
      ));
    }

    this.callbacks.onComplete();
    return updatedMessages;
  }

  private async requestApprovalWithTimeout(
    toolName: string,
    args: Record<string, any>,
    toolCallId: string,
    timeoutMs: number
  ): Promise<boolean> {
    return Promise.race([
      this.callbacks.onApprovalRequired(toolName, args, toolCallId),
      new Promise<boolean>((resolve) =>
        setTimeout(() => resolve(false), timeoutMs)
      ),
    ]);
  }

  private truncateForApi(output: string): string {
    if (output.length <= MAX_TOOL_RESULT_LENGTH) { return output; }
    const half = Math.floor(MAX_TOOL_RESULT_LENGTH / 2);
    return output.slice(0, half) +
      `\n\n... (${output.length - MAX_TOOL_RESULT_LENGTH} chars truncated) ...\n\n` +
      output.slice(-half);
  }
}
