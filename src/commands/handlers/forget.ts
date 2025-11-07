/**
 * Forget Command
 *
 * Clears all persistent memories from .eugent/memory.md
 */

import { Command, CommandContext } from './registry.js';
import { clearMemories } from '../../lib/config/memory.js';
import { logger } from '../../lib/core/logger.js';

export const forgetCommand: Command = {
  name: 'forget',
  description: 'Clear all persistent memories',
  usage: '/forget',

  execute: async (args: string[], context: CommandContext) => {
    await clearMemories();

    logger.warn("All memories cleared");

    context.addMessage({
      role: 'assistant',
      content: 'All memories have been cleared. Restart the app to apply changes.',
    });
  },
};
