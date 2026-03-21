export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface KimiRequestOptions {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
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

export interface KimiStreamDelta {
  role?: string;
  content?: string;
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
