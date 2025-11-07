/**
 * Constants used throughout the chat system
 */
export const CHAT_CONSTANTS = {
  /** Default maximum number of agentic loop iterations before asking for permission */
  DEFAULT_LOOP_LIMIT: 10,

  /** Number of additional iterations granted when user allows continuation */
  LOOP_LIMIT_EXTENSION: 10,

  /** Delay in milliseconds before closing context building modal */
  CONTEXT_MODAL_DELAY_MS: 500,

  /** Delay in milliseconds before clearing screen after modal unmount */
  SCREEN_CLEAR_DELAY_MS: 150,
} as const;
