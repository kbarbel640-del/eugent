import { Message } from '../core/types.js';

export interface ToolCallValidationResult {
  valid: boolean;
  toolName?: string;
  toolArgs?: any;
  errorMessage?: Message;
}

/**
 * Validate tool name format
 * Prevents issues like "list_files()" which breaks the API
 */
export function validateToolName(
  toolName: string,
  toolCallId: string
): ToolCallValidationResult {
  if (!/^[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)*$/.test(toolName) || toolName.includes('..')) {
    return {
      valid: false,
      errorMessage: {
        role: "tool",
        name: toolName,
        content: JSON.stringify({
          error: `Invalid tool name format: "${toolName}". Tool names must only contain letters, numbers, underscores, dashes, and non-consecutive dots. Do NOT include parentheses or function call syntax.`,
        }),
        toolCallId,
        toolArgs: {},
      },
    };
  }

  return { valid: true, toolName };
}

/**
 * Parse and validate tool arguments
 */
export function parseToolArguments(
  toolName: string,
  argumentsJson: string,
  toolCallId: string
): ToolCallValidationResult {
  try {
    const toolArgs = JSON.parse(argumentsJson);
    return { valid: true, toolName, toolArgs };
  } catch (parseError) {
    return {
      valid: false,
      errorMessage: {
        role: "tool",
        name: toolName,
        content: JSON.stringify({
          error: `Invalid JSON in tool arguments: ${parseError instanceof Error ? parseError.message : 'Unknown error'}. Raw arguments: ${argumentsJson}`,
        }),
        toolCallId,
        toolArgs: {},
      },
    };
  }
}

/**
 * Extract tool call history from conversation messages
 * Returns all successful tool calls for validation context
 */
export function extractToolCallHistory(messages: Message[]): {
  allToolCalls: Array<{ name: string; args: any }>;
  lastToolCall: { name: string; args: any } | undefined;
} {
  const allToolCalls: Array<{ name: string; args: any }> = [];
  let lastToolCall: { name: string; args: any } | undefined;

  for (const msg of messages) {
    if (msg.role === "tool" && msg.toolArgs) {
      // Skip malformed messages with missing content
      if (!msg.content) {
        continue;
      }

      try {
        const result = JSON.parse(msg.content);
        if (result.error === undefined) {
          const toolCall = { name: msg.name || "", args: msg.toolArgs };
          allToolCalls.push(toolCall);
          lastToolCall = toolCall;
        }
      } catch {
      }
    }
  }

  return { allToolCalls, lastToolCall };
}
