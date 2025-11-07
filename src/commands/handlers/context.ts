/**
 * Context Command
 *
 * Triggers the context building agent with a modal UI
 */

import { Command, CommandContext } from './registry.js';

export const contextCommand: Command = {
  name: 'context',
  description: 'Build project context using AI exploration',
  usage: '/context',

  execute: async (args: string[], context: CommandContext) => {
    if (!context.triggerContextBuilding) {
      context.addMessage({
        role: 'assistant',
        content: 'Error: Context building is not available in this environment.',
      });
      return;
    }

    await context.triggerContextBuilding();
  },
};
