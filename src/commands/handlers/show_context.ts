/**
 * Show Context Command
 *
 * Displays the current project context from .eugent/context.md
 */

import { Command, CommandContext } from './registry.js';
import { loadContext } from '../../lib/config/context.js';

export const showContextCommand: Command = {
  name: 'show_context',
  description: 'View current project context',
  usage: '/show_context',

  execute: async (args: string[], context: CommandContext) => {
    const projectContext = await loadContext();

    if (!projectContext) {
      context.addMessage({
        role: 'assistant',
        content: 'No project context found.\n\nUse the `/context` command to build project context.',
      });
      return;
    }

    context.addMessage({
      role: 'assistant',
      content: `## Current Project Context\n\n${projectContext}`,
    });
  },
};
