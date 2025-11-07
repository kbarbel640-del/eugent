import React, { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { MistralClient } from "../agent/client/mistral.js";
import { Message } from "../lib/core/types.js";
import { PermissionPrompt } from "../features/permissions/index.js";
import { ContextBuildingModal } from "../features/context-builder/index.js";
import { contextExists, loadContext } from "../lib/config/context.js";
import { loadHistory, saveHistory } from "../lib/config/history.js";
import { runContextBuilder } from "../features/context-builder/index.js";
import { logger } from "../lib/core/logger.js";
import { clearAndPrintHeader } from "../lib/ui/terminal.js";
import { useConversation } from "../hooks/useConversation.js";
import { useMarkdownRenderer } from "../hooks/useMarkdownRenderer.js";
import { useChatInput } from "../hooks/useChatInput.js";
import { useMessageFormatting } from "../hooks/useMessageFormatting.js";
import { useCommandHandler } from "../hooks/useCommandHandler.js";
import { useToolExecutor } from "../hooks/useToolExecutor.js";
import { useAgenticLoop } from "../hooks/useAgenticLoop.js";
import { ChatMessages } from "../features/chat/components/ChatMessages.js";
import { ChatInput } from "../features/chat/components/ChatInput.js";
import { ChatFooter } from "../features/chat/components/ChatFooter.js";
import { CHAT_CONSTANTS } from "../lib/chat/constants.js";
import {
  handleAbortError,
  handleGeneralError,
} from "../lib/chat/errorHandlers.js";

interface ChatProps {
  apiKey: string;
  model?: string;
  allowedTools?: string[];
  repromptModel?: string;
}

interface PendingPermission {
  toolName: string;
  toolArgs: any;
  resolve: (granted: boolean) => void;
}

export const Chat: React.FC<ChatProps> = ({
  apiKey,
  model,
  allowedTools = [],
  repromptModel,
}) => {
  const { messages, setMessages, addMessage, buildMessagesForAPI } =
    useConversation();
  const { render: renderMarkdown } = useMarkdownRenderer();
  const { parseToolResult, formatSuccessMessage } = useMessageFormatting();

  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [client] = useState(() => new MistralClient({ apiKey, model }));
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);
  const [pendingPermission, setPendingPermission] =
    useState<PendingPermission | null>(null);
  const [hasContext, setHasContext] = useState<boolean>(true);
  const [todos, setTodos] = useState<
    Array<{ task: string; completed: boolean }>
  >([]);

  const [isContextBuilding, setIsContextBuilding] = useState(false);
  const [contextBuildingMessages, setContextBuildingMessages] = useState<
    Message[]
  >([]);
  const [contextBuildingOldContext, setContextBuildingOldContext] = useState<
    string | null
  >(null);
  const [contextBuildingStatus, setContextBuildingStatus] =
    useState<string>("");
  const [contextBuildingAbortController, setContextBuildingAbortController] =
    useState<AbortController | null>(null);

  const { input, setInput } = useChatInput({
    isProcessing,
    abortController,
    onAbort: () => {
      logger.debug("Abort: Triggering abort signal");
      abortController?.abort();
      setStatusMessage("Aborting...");
    },
  });

  // Permission request helper - wraps the setPendingPermission pattern
  const requestPermission = useCallback(
    async (toolName: string, toolArgs: any): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        setPendingPermission({
          toolName,
          toolArgs,
          resolve,
        });
      }).finally(() => {
        setPendingPermission(null);
      });
    },
    [],
  );

  // Tool execution hook
  const { executeToolCall } = useToolExecutor({
    allowedTools,
    setStatusMessage,
    setTodos,
    requestPermission,
  });

  // Agentic loop hook
  const { runAgenticLoop } = useAgenticLoop({
    client,
    buildMessagesForAPI,
    messages,
    setMessages,
    todos,
    setStatusMessage,
    executeToolCall,
    requestPermission,
  });

  // Load context status on mount
  React.useEffect(() => {
    setHasContext(contextExists());
  }, []);

  // Load chat history on mount
  const isInitialMount = React.useRef(true);
  React.useEffect(() => {
    async function loadHistoryOnMount() {
      const history = await loadHistory();
      if (history.length > 0) {
        logger.info(`Loaded ${history.length} messages from previous session`);
        setMessages(history);
      }
      // Mark initial mount as complete
      isInitialMount.current = false;
    }
    loadHistoryOnMount();
  }, [setMessages]);

  // Auto-save chat history whenever messages change
  React.useEffect(() => {
    // Skip saving on initial mount (when we're loading history)
    if (isInitialMount.current) {
      return;
    }

    // Save history whenever messages change
    if (messages.length > 0) {
      saveHistory(messages);
    }
  }, [messages]);
  useInput(
    (input, key) => {
      if (key.escape && isContextBuilding && contextBuildingAbortController) {
        contextBuildingAbortController.abort();
        setIsContextBuilding(false);
        setContextBuildingAbortController(null);
        clearAndPrintHeader(model);
        addMessage({
          role: "assistant",
          content: "⊘ Context building cancelled.",
        });
      }
    },
    { isActive: isContextBuilding },
  );

  // Forward declaration of triggerContextBuilding for command handler
  const triggerContextBuilding = useCallback(async () => {
    if (isContextBuilding || isProcessing) {
      return;
    }

    try {
      clearAndPrintHeader(model);
      setIsContextBuilding(true);
      setContextBuildingMessages([]);
      setContextBuildingStatus("Loading existing context...");

      const oldContext = await loadContext();
      setContextBuildingOldContext(oldContext);
      setContextBuildingStatus("Starting exploration...");

      const controller = new AbortController();
      setContextBuildingAbortController(controller);
      let finalMessages: Message[] = [];
      await runContextBuilder(
        client,
        (progress) => {
          finalMessages = progress.messages;
          setContextBuildingMessages(progress.messages);
          if (progress.completed) {
            if (progress.error) {
              setContextBuildingStatus(`Error: ${progress.error}`);
            } else {
              setContextBuildingStatus("Context built successfully!");
            }
          }
        },
        controller.signal,
      );

      // Use finalMessages from callback, not state (state may not be updated yet)
      const contextWritten = finalMessages.some((msg) => {
        if (msg.role !== "tool" || msg.name !== "context_write") return false;
        try {
          return !JSON.parse(msg.content || "{}").error;
        } catch {
          return false; // Treat malformed JSON as error
        }
      });

      // Give the modal a moment to show final state before closing
      await new Promise((resolve) =>
        setTimeout(resolve, CHAT_CONSTANTS.CONTEXT_MODAL_DELAY_MS),
      );

      setIsContextBuilding(false);
      setContextBuildingAbortController(null);

      setHasContext(contextExists());

      // Wait for modal to unmount and clear screen to prevent double-render glitch
      await new Promise((resolve) =>
        setTimeout(resolve, CHAT_CONSTANTS.SCREEN_CLEAR_DELAY_MS),
      );

      // Clear screen and reprint header to prevent Ink rendering artifacts
      clearAndPrintHeader(model);

      if (contextWritten) {
        addMessage({
          role: "assistant",
          content:
            "Project context successfully built and saved to .eugent/context.md",
        });
      } else {
        addMessage({
          role: "assistant",
          content:
            "⚠ Context building completed but context was not saved. Check the exploration results above for errors.",
        });
      }
    } catch (error: unknown) {
      setIsContextBuilding(false);
      setContextBuildingAbortController(null);

      if (error instanceof Error && error.message.includes("cancelled")) {
        addMessage({
          role: "assistant",
          content: "⊘ Context building cancelled.",
        });
      } else {
        addMessage({
          role: "assistant",
          content: `Error building context: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }
  }, [client, isContextBuilding, isProcessing, addMessage]);

  // Command handler hook
  const { handleCommandSubmit } = useCommandHandler({
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
  });

  const handleSubmit = async (value: string) => {
    if (!value.trim() || isProcessing) return;

    // Handle slash commands
    if (value.startsWith("/")) {
      await handleCommandSubmit(value);
      return;
    }

    // Handle regular messages with agentic loop
    const userMessage: Message = { role: "user", content: value };
    setInput("");
    setIsProcessing(true);
    setStatusMessage("Thinking...");

    const controller = new AbortController();
    setAbortController(controller);

    try {
      await runAgenticLoop(userMessage, controller.signal);
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") {
        setMessages((prev) => handleAbortError(prev));
      } else {
        setMessages((prev) => [...prev, handleGeneralError(error)]);
      }
      setStatusMessage("");
    } finally {
      setIsProcessing(false);
      setAbortController(null);
      setHasContext(contextExists());
    }
  };

  // State only contains conversation history (no system messages)
  const displayMessages = messages;

  const handlePermissionResponse = (granted: boolean) => {
    if (pendingPermission) {
      pendingPermission.resolve(granted);
    }
  };

  // If context building is active, show ONLY the modal (full screen takeover)
  if (isContextBuilding) {
    return (
      <ContextBuildingModal
        messages={contextBuildingMessages}
        oldContext={contextBuildingOldContext}
        statusMessage={contextBuildingStatus}
      />
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <ChatMessages
        messages={displayMessages}
        isProcessing={isProcessing}
        statusMessage={statusMessage}
        renderMarkdown={renderMarkdown}
        parseToolResult={parseToolResult}
        formatSuccessMessage={formatSuccessMessage}
      />

      {pendingPermission && (
        <PermissionPrompt
          toolName={pendingPermission.toolName}
          toolArgs={pendingPermission.toolArgs}
          onResponse={handlePermissionResponse}
        />
      )}

      <ChatInput
        input={input}
        setInput={setInput}
        handleSubmit={handleSubmit}
        isProcessing={isProcessing}
        hasContext={hasContext}
        isContextBuilding={isContextBuilding}
      />

      <ChatFooter messageCount={displayMessages.length} messages={messages} />
    </Box>
  );
};
