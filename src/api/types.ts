// ===== Chat Message Types =====

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

// ===== Tool Calling Types (OpenAI-compatible) =====

export interface ToolFunction {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface Tool {
  type: 'function';
  function: ToolFunction;
}

export interface ToolCallFunction {
  name: string;
  arguments: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: ToolCallFunction;
}

// ===== Tool Execution =====

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

// ===== API Request/Response =====

export interface KimiRequestOptions {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  tools?: Tool[];
}

export interface KimiChoice {
  index: number;
  message: ChatMessage;
  finish_reason: string | null;
}

export interface KimiResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: KimiChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ===== Streaming Types =====

export interface KimiStreamDelta {
  role?: string;
  content?: string;
  tool_calls?: Array<{
    index: number;
    id?: string;
    type?: string;
    function?: {
      name?: string;
      arguments?: string;
    };
  }>;
}

export interface KimiStreamChoice {
  index: number;
  delta: KimiStreamDelta;
  finish_reason: string | null;
}

export interface KimiStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: KimiStreamChoice[];
}

// ===== Agent Loop Types =====

export interface StreamWithToolsResponse {
  textContent: string;
  toolCalls: ToolCall[] | null;
  assistantMessage: ChatMessage;
  finishReason: string | null;
}
