/**
 * Reprompt Command
 *
 * Uses AI to improve a prompt text by considering project context
 */

import { Command, CommandContext } from './registry.js';
import { getRepromptPrompt, getSystemPrompt } from '../../agent/prompts.js';
import { loadMemories } from '../../lib/config/memory.js';
import { loadContext } from '../../lib/config/context.js';
import { MistralClient } from '../../agent/client/mistral.js';

export const repromptCommand: Command = {
  name: 'reprompt',
  description: 'Improve a prompt using AI',
  usage: '/reprompt <text>',

  execute: async (args: string[], context: CommandContext) => {
    const text = args.join(' ').trim();

    if (!text) {
      context.addMessage({
        role: 'assistant',
        content: 'Please provide text to improve.\n\nUsage: `/reprompt <text>`',
      });
      return;
    }

    // Check if we have the required context
    if (!context.apiKey) {
      context.addMessage({
        role: 'assistant',
        content: 'Error: Reprompt command requires API key.',
      });
      return;
    }

    try {
      if (context.setIsProcessing && context.setStatusMessage) {
        context.setIsProcessing(true);
        context.setStatusMessage('Improving prompt with AI...');
      }

      const model = context.repromptModel;
      const client = new MistralClient({ apiKey: context.apiKey, model });

      const messages = [];

      messages.push({
        role: 'system' as const,
        content: getRepromptPrompt(),
      });

      const systemPrompt = getSystemPrompt();
      messages.push({
        role: 'system' as const,
        content: `## Current System Prompt\n\n${systemPrompt}`,
      });

      const memories = await loadMemories();
      if (memories) {
        messages.push({
          role: 'system' as const,
          content: `## Persistent Memories\n\n${memories}`,
        });
      }

      const projectContext = await loadContext();
      if (projectContext) {
        messages.push({
          role: 'system' as const,
          content: `## Project Context\n\n${projectContext}`,
        });
      }

      messages.push({
        role: 'user' as const,
        content: `Please improve this prompt:\n\n${text}`,
      });

      const response = await client.chat(messages);

      const improvedPrompt = response.content || '[Failed to generate improved prompt]';

      if (context.setIsProcessing && context.setStatusMessage) {
        context.setIsProcessing(false);
        context.setStatusMessage('');
      }

      context.addMessage({
        role: 'assistant',
        content: `**[Improved Prompt]**\n\n${improvedPrompt}`,
        usage: response.usage,
      });
    } catch (error: unknown) {
      if (context.setIsProcessing && context.setStatusMessage) {
        context.setIsProcessing(false);
        context.setStatusMessage('');
      }

      context.addMessage({
        role: 'assistant',
        content: `Error improving prompt: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  },
};
