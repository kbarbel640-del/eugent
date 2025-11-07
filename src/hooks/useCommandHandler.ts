import { useCallback } from "react";
import { Message } from "../lib/core/types.js";
import { MistralClient } from "../agent/client/mistral.js";
import { executeCommand } from "../commands/index.js";

interface UseCommandHandlerOptions {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setInput: (value: string) => void;
  client: MistralClient;
  buildMessagesForAPI: (
    conversationHistory: Message[],
    todos: Array<{ task: string; completed: boolean }>,
  ) => Promise<Message[]>;
  apiKey: string;
  repromptModel?: string;
  triggerContextBuilding: () => Promise<void>;
  setTodos: React.Dispatch<
    React.SetStateAction<Array<{ task: string; completed: boolean }>>
  >;
  todos: Array<{ task: string; completed: boolean }>;
  setStatusMessage: (message: string) => void;
  setIsProcessing: (processing: boolean) => void;
}

/**
 * Hook to handle slash command execution
 * Extracted from Chat.tsx lines 229-275
 */
export function useCommandHandler(options: UseCommandHandlerOptions) {
  const {
    messages,
    setMessages,
    setInput,
    client,
    buildMessagesForAPI,
    apiKey,
    repromptModel,
    triggerContextBuilding,
    setTodos,
    todos,
    setStatusMessage,
    setIsProcessing,
  } = options;

  const handleCommandSubmit = useCallback(
    async (value: string) => {
      setInput("");

      // Wrapper for buildMessagesForAPI that curries the todos parameter
      const buildMessagesForAPIWrapper = async (
        conversationHistory: Message[],
      ) => {
        return buildMessagesForAPI(conversationHistory, todos);
      };

      // Special handling for commands that don't add to conversation
      if (value.trim() === "/context") {
        await triggerContextBuilding();
        return;
      }

      if (value.trim() === "/compact") {
        await executeCommand(value, {
          messages,
          setMessages,
          addMessage: (msg: Message) => {
            setMessages((prev) => [...prev, msg]);
          },
          client,
          buildMessagesForAPI: buildMessagesForAPIWrapper,
          apiKey,
          repromptModel,
          triggerContextBuilding,
          setTodos,
          setStatusMessage,
          setIsProcessing,
        });
        return;
      }

      const userMessage: Message = { role: "user", content: value };

      const conversationHistory: Message[] = [...messages, userMessage];
      setMessages(conversationHistory);

      const wasExecuted = await executeCommand(value, {
        messages: conversationHistory,
        setMessages,
        addMessage: (msg: Message) => {
          setMessages((prev) => [...prev, msg]);
        },
        client,
        buildMessagesForAPI: buildMessagesForAPIWrapper,
        apiKey,
        repromptModel,
        triggerContextBuilding,
        setTodos,
        setStatusMessage,
        setIsProcessing,
      });
    },
    [
      messages,
      setMessages,
      setInput,
      client,
      buildMessagesForAPI,
      apiKey,
      repromptModel,
      triggerContextBuilding,
      setTodos,
      todos,
    ],
  );

  return { handleCommandSubmit };
}
