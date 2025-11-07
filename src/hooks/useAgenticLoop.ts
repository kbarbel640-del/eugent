import { useCallback } from "react";
import { Message } from "../lib/core/types.js";
import { MistralClient } from "../agent/client/mistral.js";
import { availableTools } from "../tools/registry.js";
import { healOrphanedToolCalls } from "../lib/validation/messageValidation.js";
import { CHAT_CONSTANTS } from "../lib/chat/constants.js";

interface UseAgenticLoopOptions {
  client: MistralClient;
  buildMessagesForAPI: (
    conversationHistory: Message[],
    todos: Array<{ task: string; completed: boolean }>,
  ) => Promise<Message[]>;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  todos: Array<{ task: string; completed: boolean }>;
  setStatusMessage: (message: string) => void;
  executeToolCall: (
    toolCall: any,
    conversationHistory: Message[],
    signal: AbortSignal,
  ) => Promise<{
    toolMessage: Message;
    permissionDenied: boolean;
    deniedToolName: string;
    validationFailed: boolean;
    validationErrorMessage?: Message;
  }>;
  requestPermission: (
    toolName: string,
    toolArgs: any,
  ) => Promise<boolean>;
}

/**
 * Hook to handle the main agentic loop logic
 * Extracted from Chat.tsx lines 285-505
 */
export function useAgenticLoop(options: UseAgenticLoopOptions) {
  const {
    client,
    buildMessagesForAPI,
    messages,
    setMessages,
    todos,
    setStatusMessage,
    executeToolCall,
    requestPermission,
  } = options;

  const runAgenticLoop = useCallback(
    async (userMessage: Message, signal: AbortSignal) => {
      // This prevents "Invalid message structure" errors from corrupted state
      const healedMessages = healOrphanedToolCalls(messages);

      if (healedMessages.length !== messages.length) {
        setMessages(healedMessages);
      }

      const conversationHistory: Message[] = [...healedMessages, userMessage];

      setMessages(conversationHistory);
      let continueLoop = true;
      let loopCount = 0;
      let maxLoops = CHAT_CONSTANTS.DEFAULT_LOOP_LIMIT; // Default limit (can be extended with user permission)

      while (continueLoop) {
        if (signal.aborted) {
          const error = new Error("The operation was aborted");
          error.name = "AbortError";
          throw error;
        }

        if (loopCount >= maxLoops) {
          const continueMore = await requestPermission("continue_execution", {
            current_count: loopCount,
            additional: CHAT_CONSTANTS.LOOP_LIMIT_EXTENSION,
          });

          if (continueMore) {
            maxLoops += CHAT_CONSTANTS.LOOP_LIMIT_EXTENSION;
          } else {
            conversationHistory.push({
              role: "assistant",
              content: `[Tool execution limit reached (${loopCount} calls) - stopped by user]`,
            });
            setMessages([...conversationHistory]);
            break;
          }
        }

        loopCount++;

        const messagesWithContext = await buildMessagesForAPI(
          conversationHistory,
          todos,
        );

        const response = await client.chat(
          messagesWithContext,
          availableTools,
          {
            signal: signal,
          },
        );

        if (response.toolCalls && response.toolCalls.length > 0) {
          const assistantMessage: Message = {
            role: "assistant",
            content: response.content || "",
            toolCalls: response.toolCalls,
            usage: response.usage,
          };
          conversationHistory.push(assistantMessage);
          setMessages([...conversationHistory]);

          let permissionDenied = false;
          let deniedToolName = "";

          for (const toolCall of response.toolCalls) {
            if (signal.aborted) {
              const error = new Error("The operation was aborted");
              error.name = "AbortError";
              throw error;
            }

            const result = await executeToolCall(
              toolCall,
              conversationHistory,
              signal,
            );

            // Handle validation failures
            if (result.validationFailed) {
              conversationHistory.push(result.validationErrorMessage!);
              continue;
            }

            // Add tool message to history
            conversationHistory.push(result.toolMessage);

            // Check if permission was denied
            if (result.permissionDenied) {
              permissionDenied = true;
              deniedToolName = result.deniedToolName;
              break;
            }
          }

          setMessages([...conversationHistory]);

          if (signal.aborted) {
            const error = new Error("The operation was aborted");
            error.name = "AbortError";
            throw error;
          }

          // If permission was denied, call model to handle the denial and exit
          if (permissionDenied) {
            setStatusMessage("Processing...");

            const finalMessagesWithContext = await buildMessagesForAPI(
              conversationHistory,
              todos,
            );

            const finalResponse = await client.chat(
              finalMessagesWithContext,
              availableTools,
              {
                signal: signal,
              },
            );

            const finalContent =
              finalResponse.content || "[No response generated]";
            conversationHistory.push({
              role: "assistant",
              content: finalContent,
              usage: finalResponse.usage,
            });
            setMessages([...conversationHistory]);

            continueLoop = false;
            break;
          }

          setStatusMessage("Processing...");
        } else {
          // MUST add assistant message to maintain valid conversation flow (tool → assistant → user)
          const content = response.content || "[No response generated]";
          conversationHistory.push({
            role: "assistant",
            content: content,
            usage: response.usage,
          });
          setMessages([...conversationHistory]);
          continueLoop = false;
        }
      }

      setStatusMessage("");
    },
    [
      client,
      buildMessagesForAPI,
      messages,
      setMessages,
      todos,
      setStatusMessage,
      executeToolCall,
      requestPermission,
    ],
  );

  return { runAgenticLoop };
}
