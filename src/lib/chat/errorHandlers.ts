import { Message } from "../core/types.js";
import { logger } from "../core/logger.js";

/**
 * Handle abort error by adding appropriate error messages to conversation
 * Extracted from Chat.tsx abort error handling logic
 */
export function handleAbortError(messages: Message[]): Message[] {
  const lastMessage = messages[messages.length - 1];

  if (
    lastMessage?.role === "assistant" &&
    lastMessage.toolCalls &&
    lastMessage.toolCalls.length > 0
  ) {
    const toolErrorMessages: Message[] = lastMessage.toolCalls.map(
      (toolCall) => ({
        role: "tool",
        name: toolCall.function.name,
        content: JSON.stringify({ error: "Operation aborted by user" }),
        toolCallId: toolCall.id,
        toolArgs: {},
      }),
    );

    return [
      ...messages,
      ...toolErrorMessages,
      {
        role: "assistant",
        content: "[Request interrupted by user]\n",
      },
    ];
  }

  return [
    ...messages,
    {
      role: "assistant",
      content: "[Request interrupted by user]\n",
    },
  ];
}

/**
 * Handle general errors by logging and creating error message
 * Extracted from Chat.tsx general error handling logic
 */
export function handleGeneralError(error: unknown): Message {
  logger.error("Chat handleSubmit error", {
    message: error instanceof Error ? error.message : "Unknown error",
    stack: error instanceof Error ? error.stack : undefined,
  });

  return {
    role: "assistant",
    content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
  };
}
