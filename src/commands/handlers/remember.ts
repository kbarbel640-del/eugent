/**
 * Remember Command
 *
 * Saves a note to persistent memory (.eugent/memory.md)
 */

import { Command, CommandContext } from './registry.js';
import { saveMemory } from '../../lib/config/memory.js';
import { logger } from '../../lib/core/logger.js';

export const rememberCommand: Command = {
  name: 'remember',
  description: 'Save a note to persistent memory',
  usage: '/remember <text>',

  execute: async (args: string[], context: CommandContext) => {
    const text = args.join(' ').trim();

    if (!text) {
      context.addMessage({
        role: 'assistant',
        content: 'Please provide text to remember.\n\nUsage: `/remember <text>`',
      });
      return;
    }

    // Save to memory file
    await saveMemory(text);

    logger.info("Memory saved", { text: text.substring(0, 100) });

    // Add confirmation message
    context.addMessage({
      role: 'assistant',
      content: `Saved to memory: "${text}"`,
    });
  },
};
