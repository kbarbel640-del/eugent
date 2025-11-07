/**
 * Shared type definitions for Eugent
 */

export interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: string;
      required: string[];
      properties: Record<string, any>; // Mistral SDK spec - different tools have different properties
    };
  };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface UsageInfo {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface Message {
  id?: string; // Unique ID for React keys (generated client-side)
  role: 'user' | 'assistant' | 'system' | 'tool';
  content?: string;
  toolCalls?: ToolCall[];
  name?: string;
  toolCallId?: string;
  toolArgs?: any; // Tool-specific arguments (for display only, not sent to API)
  usage?: UsageInfo; // Token usage for this message (only on assistant messages)
}
