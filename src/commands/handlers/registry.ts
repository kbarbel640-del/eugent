/**
 * Command Registry
 *
 * Central registry for all chat commands (e.g., /help, /clear, /remember).
 * Follows the same pattern as the tool registry for consistency.
 */

import type { MistralClient } from '../../agent/client/mistral.js';
import type { Message } from '../../lib/core/types.js';

/**
 * Context passed to command execution
 */
export interface CommandContext {
  setMessages: (messages: Message[]) => void;
  messages: Message[];
  addMessage: (message: Message) => void;
  client?: MistralClient;
  buildMessagesForAPI?: (conversationHistory: Message[]) => Promise<Message[]>;
  apiKey?: string;
  repromptModel?: string;
  triggerContextBuilding?: () => Promise<void>;
  setTodos?: (todos: Array<{ task: string; completed: boolean }>) => void;
  setStatusMessage?: (message: string) => void;
  setIsProcessing?: (processing: boolean) => void;
}

/**
 * Command interface - all commands must implement this
 */
export interface Command {
  /** Command name (without the /) */
  name: string;

  /** Short description for help text */
  description: string;

  /** Optional usage example */
  usage?: string;

  /** Execute the command */
  execute: (args: string[], context: CommandContext) => void | Promise<void>;
}

/**
 * All registered commands
 */
const commands: Command[] = [];

/**
 * Register a command
 *
 * @param command - Command to register
 */
export function registerCommand(command: Command): void {
  commands.push(command);
}

/**
 * Get all registered commands
 *
 * @returns Array of all commands
 */
export function getAllCommands(): Command[] {
  return commands;
}

/**
 * Get a command by name
 *
 * @param name - Command name (without the /)
 * @returns Command if found, undefined otherwise
 */
export function getCommand(name: string): Command | undefined {
  return commands.find(cmd => cmd.name === name);
}

/**
 * Execute a command
 *
 * @param input - Full command input (e.g., "/help" or "/remember something")
 * @param context - Command execution context
 * @returns True if command was found and executed, false otherwise
 */
export async function executeCommand(input: string, context: CommandContext): Promise<boolean> {
  if (!input.startsWith('/')) {
    return false;
  }

  const parts = input.slice(1).split(' ');
  const commandName = parts[0];
  const args = parts.slice(1);

  const command = getCommand(commandName);
  if (!command) {
    context.addMessage({
      role: 'assistant',
      content: `Unknown command: /${commandName}\n\nType /help to see available commands.`,
    });
    return false;
  }

  await command.execute(args, context);
  return true;
}
