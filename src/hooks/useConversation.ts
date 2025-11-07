import { useState, useCallback } from "react";
import { Message } from '../lib/core/types.js';
import { getSystemPrompt } from "../agent/prompts.js";
import { loadMemories } from '../lib/config/memory.js';
import { loadContext } from '../lib/config/context.js';
import { validateMessages, sanitizeMessagesForAPI } from '../lib/validation/messageValidation.js';
import { logger } from '../lib/core/logger.js';

/**
 * Generate a unique ID for a message
 */
function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Ensure a message has a unique ID
 */
function ensureMessageId(message: Message): Message {
  if (message.id) return message;
  return { ...message, id: generateMessageId() };
}

/**
 * Hook for managing conversation state and building messages for the API
 */
export function useConversation() {
  // State contains ONLY conversation history (no system prompts)
  const [messages, setMessages] = useState<Message[]>([]);

  /**
   * Add a message to the conversation (automatically adds unique ID)
   */
  const addMessage = useCallback((message: Message) => {
    const messageWithId = ensureMessageId(message);
    setMessages((prev) => [...prev, messageWithId]);
  }, []);

  /**
   * Set messages array (ensures all have IDs)
   */
  const setMessagesWithIds = useCallback((messages: Message[] | ((prev: Message[]) => Message[])) => {
    if (typeof messages === 'function') {
      setMessages((prev) => messages(prev).map(ensureMessageId));
    } else {
      setMessages(messages.map(ensureMessageId));
    }
  }, []);

  /**
   * Build full message array with base prompts + conversation history
   * Includes validation and sanitization
   */
  const buildMessagesForAPI = useCallback(
    async (
      conversationHistory: Message[],
      todos?: Array<{ task: string; completed: boolean }>
    ): Promise<Message[]> => {
      const messages: Message[] = [];

      // 1. System prompt (always first)
      messages.push({ role: "system", content: getSystemPrompt() });

      // 2. Memories (if any)
      const memories = await loadMemories();
      if (memories) {
        messages.push({
          role: "system",
          content: `## Persistent Memories\n\n${memories}`,
        });
      }

      // 3. Project context (if any)
      const projectContext = await loadContext();
      if (projectContext) {
        messages.push({
          role: "system",
          content: `## Project Context\n\n${projectContext}`,
        });
      }

      // 4. Current todos (if any)
      if (todos && todos.length > 0) {
        const todoList = todos
          .map((todo) => `- [${todo.completed ? "x" : " "}] ${todo.task}`)
          .join("\n");
        messages.push({
          role: "system",
          content: `## Current Tasks\n\n${todoList}`,
        });
      }

      // 5. Conversation history
      messages.push(...conversationHistory);

      const validation = validateMessages(messages);
      if (!validation.valid) {
        logger.error("Message validation failed", { errors: validation.errors });
        throw new Error(
          `Invalid message structure: ${validation.errors.join(", ")}`
        );
      }
      if (validation.warnings.length > 0) {
        logger.warn("Message validation warnings", {
          warnings: validation.warnings,
        });
      }

      return sanitizeMessagesForAPI(messages);
    },
    []
  );

  return {
    messages,
    setMessages: setMessagesWithIds,
    addMessage,
    buildMessagesForAPI,
  };
}
