import { useState } from "react";
import { useInput, useApp } from "ink";
import { logger } from "../lib/core/logger.js";

interface UseChatInputOptions {
  isProcessing: boolean;
  abortController: AbortController | null;
  onAbort: () => void;
}

/**
 * Hook for managing chat input and keyboard shortcuts
 */
export function useChatInput({
  isProcessing,
  abortController,
  onAbort,
}: UseChatInputOptions) {
  const [input, setInput] = useState("");
  const { exit } = useApp();

  useInput((input, key) => {
    if (input === "c" && key.ctrl) {
      exit();
    }

    if (key.escape) {
      if (isProcessing && abortController) {
        logger.debug("Abort: ESC pressed, aborting current operation");
        onAbort();
      }
    }
  }, { isActive: true });

  return {
    input,
    setInput,
  };
}
