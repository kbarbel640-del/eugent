/**
 * Help Command
 *
 * Displays all available commands with descriptions
 */

import { Command, CommandContext, getAllCommands } from './registry.js';

export const helpCommand: Command = {
  name: 'help',
  description: 'Show all available commands',
  usage: '/help',

  execute: async (args: string[], context: CommandContext) => {
    const commands = getAllCommands();

    // Build help message
    let helpText = '## Available Commands\n\n';

    commands.forEach(cmd => {
      helpText += `**/${cmd.name}**`;
      if (cmd.usage && cmd.usage !== `/${cmd.name}`) {
        helpText += ` - ${cmd.usage}`;
      }
      helpText += `\n${cmd.description}\n\n`;
    });

    // Add the help message to conversation
    context.addMessage({
      role: 'assistant',
      content: helpText,
    });
  },
};
