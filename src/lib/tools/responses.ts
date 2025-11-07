/**
 * Tool Response Helpers
 * Standardizes JSON response format for all tool executors
 * Replaces 100+ direct JSON.stringify() calls across tool files
 */
export class ToolResponse {
  /**
   * Create an error response
   * @param message - Error message
   * @param context - Optional additional error context
   * @returns JSON string with error
   */
  static error(message: string, context?: Record<string, any>): string {
    return JSON.stringify({
      error: message,
      ...context,
    });
  }

  /**
   * Create a success response
   * @param data - Success data to return
   * @returns JSON string with success data
   */
  static success(data: Record<string, any>): string {
    return JSON.stringify(data);
  }
}
