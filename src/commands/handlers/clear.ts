/**
 * Clear Command
 *
 * Clears the conversation history (keeps system prompt with memories)
 */

import { Command, CommandContext } from './registry.js';
import { deleteHistory } from '../../lib/config/history.js';
import { clearAndPrintHeader } from '../../lib/ui/terminal.js';

export const clearCommand: Command = {
  name: 'clear',
  description: 'Clear conversation history (keeps memories)',
  usage: '/clear',

  execute: async (args: string[], context: CommandContext) => {
    await deleteHistory();
    clearAndPrintHeader();
    context.setMessages([]);

    if (context.setTodos) {
      context.setTodos([]);
    }

    context.addMessage({
      role: 'assistant',
      content: 'Conversation history cleared. Memories are preserved.',
    });
  },
};
