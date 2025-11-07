/**
 * Tool execution context
 * Provides metadata and control mechanisms for tool execution
 */
export interface ToolContext {
  /**
   * All successful tool calls from conversation history (for validation)
   * Used by edit_file to check if file was read with read_for_write=true
   */
  allToolCalls?: Array<{
    name: string;
    args: any;
  }>;

  /**
   * Last successful tool call (for quick access)
   */
  lastToolCall?: {
    name: string;
    args: any;
  };

  /**
   * Abort signal for cancelling long-running operations
   */
  signal?: AbortSignal;
}
