import { useCallback } from "react";

/**
 * Hook for message display formatting helpers
 */
export function useMessageFormatting() {
  /**
   * Parse tool result from JSON string
   */
  const parseToolResult = useCallback((content: string) => {
    try {
      return JSON.parse(content);
    } catch {
      return { raw: content };
    }
  }, []);

  /**
   * Format success message with tool-specific details
   */
  const formatSuccessMessage = useCallback(
    (toolName: string, result: any): string => {
      if (!result || typeof result !== "object") {
        return "Success";
      }

      switch (toolName) {
        case "read_file":
          if (result.read_for_write) {
            return `Success (${result.total_lines} lines, full file)`;
          } else if (
            result.lines_returned !== undefined &&
            result.total_lines !== undefined
          ) {
            return `Success (${result.lines_returned}/${result.total_lines} lines)`;
          }
          return "Success";

        case "list_files":
          if (result.count !== undefined) {
            const truncated = result.truncated ? "+" : "";
            return `Success (${result.count}${truncated} items)`;
          }
          return "Success";

        case "find_files":
          if (result.count !== undefined) {
            const truncated = result.truncated ? "+" : "";
            return `Success (${result.count}${truncated} files)`;
          }
          return "Success";

        case "grep":
          if (result.count !== undefined) {
            const truncated = result.truncated ? "+" : "";
            return `Success (${result.count}${truncated} matches)`;
          }
          return "Success";

        case "execute_command":
          if (result.exitCode === 0) {
            return "Success (exit 0)";
          }
          return "Success";

        case "write_file":
          if (result.lines !== undefined && result.size !== undefined) {
            return `Success (${result.lines} lines, ${result.size} bytes)`;
          }
          return "Success";

        case "edit_file":
          if (
            result.mode &&
            result.lines !== undefined &&
            result.size !== undefined
          ) {
            const modeLabel =
              result.mode === "full_replace" ? "full replace" : "search/replace";
            return `Success (${modeLabel}, ${result.lines} lines, ${result.size} bytes)`;
          }
          return "Success";

        default:
          return "Success";
      }
    },
    []
  );

  return {
    parseToolResult,
    formatSuccessMessage,
  };
}
