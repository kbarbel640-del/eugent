import { Message } from "../core/types.js";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates a message array before sending to the API
 * Ensures proper structure, sequencing, and completeness
 */
export function validateMessages(messages: Message[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Empty messages array is technically valid (will just get system prompt)
  if (messages.length === 0) {
    return { valid: true, errors: [], warnings: [] };
  }

  const pendingToolCalls = new Set<string>();

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const prevMsg = i > 0 ? messages[i - 1] : null;

    if (!msg.role) {
      errors.push(`Message at index ${i} is missing a role`);
      continue;
    }

    switch (msg.role) {
      case "system":
        if (i > 0 && prevMsg?.role !== "system") {
          warnings.push(
            `System message at index ${i} appears after non-system messages`
          );
        }
        if (!msg.content) {
          errors.push(`System message at index ${i} is missing content`);
        }
        break;

      case "user":
        if (!msg.content || msg.content.trim() === "") {
          errors.push(`User message at index ${i} has empty content`);
        }
        if (prevMsg?.role === "user") {
          errors.push(
            `User message at index ${i} follows another user message (index ${i - 1})`
          );
        }
        break;

      case "assistant":
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          for (const toolCall of msg.toolCalls) {
            if (!toolCall.id) {
              errors.push(
                `Tool call in message ${i} is missing an id`
              );
            } else {
              pendingToolCalls.add(toolCall.id);
            }
            if (!toolCall.function?.name) {
              errors.push(
                `Tool call in message ${i} is missing function name`
              );
            }
          }
        }
        break;

      case "tool":
        if (!msg.name) {
          errors.push(`Tool message at index ${i} is missing name`);
        }
        if (!msg.toolCallId) {
          errors.push(`Tool message at index ${i} is missing toolCallId`);
        } else {
          if (!pendingToolCalls.has(msg.toolCallId)) {
            warnings.push(
              `Tool message at index ${i} has toolCallId "${msg.toolCallId}" which was not found in previous assistant message`
            );
          } else {
            pendingToolCalls.delete(msg.toolCallId);
          }
        }
        break;

      default:
        errors.push(`Message at index ${i} has invalid role: ${msg.role}`);
    }
  }

  if (pendingToolCalls.size > 0) {
    errors.push(
      `${pendingToolCalls.size} tool call(s) have no corresponding tool response. Tool call IDs: ${Array.from(pendingToolCalls).join(', ')}`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Heals conversation state by injecting error responses for orphaned tool calls
 * Returns a new message array with injected tool responses
 */
export function healOrphanedToolCalls(messages: Message[]): Message[] {
  const pendingToolCalls = new Map<string, { name: string; index: number }>();

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    if (msg.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0) {
      for (const toolCall of msg.toolCalls) {
        if (toolCall.id && toolCall.function?.name) {
          pendingToolCalls.set(toolCall.id, {
            name: toolCall.function.name,
            index: i,
          });
        }
      }
    }

    if (msg.role === "tool" && msg.toolCallId) {
      pendingToolCalls.delete(msg.toolCallId);
    }
  }

  if (pendingToolCalls.size === 0) {
    return messages;
  }

  const healedMessages: Message[] = [...messages];

  const orphansByIndex = new Map<number, Array<{ id: string; name: string }>>();
  for (const [id, { name, index }] of pendingToolCalls) {
    if (!orphansByIndex.has(index)) {
      orphansByIndex.set(index, []);
    }
    orphansByIndex.get(index)!.push({ id, name });
  }

  // Process in reverse order to maintain correct indices
  const sortedIndices = Array.from(orphansByIndex.keys()).sort((a, b) => b - a);

  for (const assistantIndex of sortedIndices) {
    const orphans = orphansByIndex.get(assistantIndex)!;
    const errorMessages: Message[] = orphans.map(({ id, name }) => ({
      role: "tool" as const,
      name,
      content: JSON.stringify({
        error: "Tool call was orphaned (no response was recorded). This has been automatically resolved.",
      }),
      toolCallId: id,
      toolArgs: {},
    }));

    healedMessages.splice(assistantIndex + 1, 0, ...errorMessages);
  }

  return healedMessages;
}

/**
 * Sanitizes messages by removing validation-specific fields
 * (like toolArgs which are for display only)
 */
export function sanitizeMessagesForAPI(messages: Message[]): Message[] {
  return messages.map((msg) => {
    // Create a copy without toolArgs and usage (not needed for API)
    const { toolArgs, usage, ...rest } = msg;
    return rest;
  });
}
