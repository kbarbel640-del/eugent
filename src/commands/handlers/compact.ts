/**
 * Compact Command
 *
 * Summarizes the conversation history to reduce token usage
 */

import { Command, CommandContext } from './registry.js';
import { getCompactSummaryPrompt } from '../../agent/prompts.js';
import { logger } from '../../lib/core/logger.js';

export const compactCommand: Command = {
  name: 'compact',
  description: 'Summarize conversation history to reduce tokens',
  usage: '/compact',

  execute: async (args: string[], context: CommandContext) => {
    if (context.messages.length === 0) {
      context.addMessage({
        role: 'assistant',
        content: 'No conversation history to compact.',
      });
      return;
    }

    if (!context.client || !context.buildMessagesForAPI) {
      context.addMessage({
        role: 'assistant',
        content: 'Error: Compact command requires client access.',
      });
      return;
    }

    try {
      const originalMessages = [...context.messages];

      if (context.setIsProcessing && context.setStatusMessage) {
        context.setIsProcessing(true);
        context.setStatusMessage('Compacting conversation history...');
      }

      const summaryRequest = {
        role: 'user' as const,
        content: getCompactSummaryPrompt(),
      };

      const conversationWithRequest = [...originalMessages, summaryRequest];

      const messagesForAPI = await context.buildMessagesForAPI(conversationWithRequest);

      const response = await context.client.chat(messagesForAPI);

      const summary = response.content || '[Failed to generate summary]';

      const originalCount = context.messages.length;
      logger.info("Conversation compacted", {
        originalMessages: originalCount,
        summaryLength: summary.length
      });

      if (context.setIsProcessing && context.setStatusMessage) {
        context.setIsProcessing(false);
        context.setStatusMessage('');
      }

      context.setMessages([
        {
          role: 'assistant',
          content: `**[Conversation Summary]**\n\n${summary}`,
          usage: response.usage,
        },
      ]);
    } catch (error: unknown) {
      if (context.setIsProcessing && context.setStatusMessage) {
        context.setIsProcessing(false);
        context.setStatusMessage('');
      }

      logger.error("Compact command failed", {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      context.addMessage({
        role: 'assistant',
        content: `Error compacting conversation: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  },
};
