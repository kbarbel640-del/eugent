import { useCallback } from "react";
import { Message, ToolCall } from "../lib/core/types.js";
import { executeTool, requiresPermission } from "../tools/registry.js";
import {
  validateToolName,
  parseToolArguments,
  extractToolCallHistory,
} from "../lib/chat/toolCallValidator.js";
import { formatToolStatus } from "../lib/chat/toolStatusFormatter.js";
import { logger } from "../lib/core/logger.js";

interface ToolExecutionResult {
  toolMessage: Message;
  permissionDenied: boolean;
  deniedToolName: string;
  validationFailed: boolean;
  validationErrorMessage?: Message;
}

interface UseToolExecutorOptions {
  allowedTools: string[];
  setStatusMessage: (message: string) => void;
  setTodos: React.Dispatch<
    React.SetStateAction<Array<{ task: string; completed: boolean }>>
  >;
  requestPermission: (
    toolName: string,
    toolArgs: any,
  ) => Promise<boolean>;
}

/**
 * Hook to handle execution of a single tool call with permission checking
 * Extracted from Chat.tsx lines 358-453
 */
export function useToolExecutor(options: UseToolExecutorOptions) {
  const { allowedTools, setStatusMessage, setTodos, requestPermission } =
    options;

  const executeToolCall = useCallback(
    async (
      toolCall: ToolCall,
      conversationHistory: Message[],
      signal: AbortSignal,
    ): Promise<ToolExecutionResult> => {
      // Validate tool name
      const nameValidation = validateToolName(
        toolCall.function.name,
        toolCall.id,
      );
      if (!nameValidation.valid) {
        return {
          toolMessage: {} as Message, // Will not be used
          permissionDenied: false,
          deniedToolName: "",
          validationFailed: true,
          validationErrorMessage: nameValidation.errorMessage!,
        };
      }

      // Parse tool arguments
      const argsValidation = parseToolArguments(
        nameValidation.toolName!,
        toolCall.function.arguments,
        toolCall.id,
      );
      if (!argsValidation.valid) {
        return {
          toolMessage: {} as Message, // Will not be used
          permissionDenied: false,
          deniedToolName: "",
          validationFailed: true,
          validationErrorMessage: argsValidation.errorMessage!,
        };
      }

      const toolName = argsValidation.toolName!;
      const toolArgs = argsValidation.toolArgs!;

      const statusDetails = formatToolStatus(toolName, toolArgs);
      setStatusMessage(`Executing ${toolName}${statusDetails}...`);

      let toolResult: string;
      let permissionDenied = false;

      const { allToolCalls, lastToolCall } =
        extractToolCallHistory(conversationHistory);

      if (requiresPermission(toolName, allowedTools)) {
        const granted = await requestPermission(toolName, toolArgs);

        if (!granted) {
          permissionDenied = true;
          toolResult = JSON.stringify({
            error: "Permission denied by user. STOP IMMEDIATELY.",
          });
        } else {
          toolResult = await executeTool(toolName, toolArgs, {
            allToolCalls,
            lastToolCall,
            signal: signal,
          });
        }
      } else {
        toolResult = await executeTool(toolName, toolArgs, {
          allToolCalls,
          lastToolCall,
          signal: signal,
        });
      }

      // (MUST add for EVERY tool call)
      const toolMessage: Message = {
        role: "tool",
        name: toolName,
        content: toolResult,
        toolCallId: toolCall.id,
        toolArgs: toolArgs,
      };

      // Handle manage_todos special case
      if (toolName === "manage_todos" && !permissionDenied) {
        try {
          const result = JSON.parse(toolResult);
          if (!result.error && toolArgs.todos) {
            setTodos(toolArgs.todos);
          }
        } catch (e) {
          logger.error("Failed to parse manage_todos result", {
            error: e,
          });
        }
      }

      return {
        toolMessage,
        permissionDenied,
        deniedToolName: permissionDenied ? toolName : "",
        validationFailed: false,
      };
    },
    [allowedTools, setStatusMessage, setTodos, requestPermission],
  );

  return { executeToolCall };
}
