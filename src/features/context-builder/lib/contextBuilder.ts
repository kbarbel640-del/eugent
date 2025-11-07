import { MistralClient } from '../../../agent/client/mistral.js';
import { Message, Tool } from '../../../lib/core/types.js';
import { executeTool, availableTools } from '../../../tools/registry.js';
import { contextWriteTool, executeContextWrite } from '../../../tools/project/context_write.js';
import { ToolContext } from '../../../tools/shared/context.js';
import { getSystemPrompt, getContextBuildingPrompt } from '../../../agent/prompts.js';
import { loadMemories } from '../../../lib/config/memory.js';
import { loadContext } from '../../../lib/config/context.js';
import { logger } from '../../../lib/core/logger.js';

const EXPLORATORY_TOOL_NAMES = [
  'read_file',
  'list_files',
  'find_files',
  'grep',
];

export interface ContextBuilderProgress {
  messages: Message[];
  completed: boolean;
  error?: string;
}

export type ProgressCallback = (progress: ContextBuilderProgress) => void;

export async function runContextBuilder(
  client: MistralClient,
  onProgress: ProgressCallback,
  abortSignal?: AbortSignal
): Promise<Message[]> {
  logger.info("Context building started");
  const conversationHistory: Message[] = [];

  const exploratoryTools = [
    ...availableTools.filter(
      (tool: Tool) => EXPLORATORY_TOOL_NAMES.includes(tool.function.name)
    ),
    contextWriteTool,
  ];

  try {
    const messages: Message[] = [];

    messages.push({ role: 'system', content: getSystemPrompt() });

    const memories = await loadMemories();
    if (memories) {
      messages.push({
        role: 'system',
        content: `## Persistent Memories\n\n${memories}`,
      });
    }

    const oldContext = await loadContext();
    if (oldContext) {
      messages.push({
        role: 'system',
        content: `## Old Project Context\n\nThe following is the PREVIOUS context. You should review it and create an UPDATED context.\n\n${oldContext}`,
      });
    }

    messages.push({
      role: 'system',
      content: getContextBuildingPrompt(),
    });

    conversationHistory.push({
      role: 'user',
      content: 'Please explore the codebase and build a comprehensive project context document.',
    });

    onProgress({
      messages: [...conversationHistory],
      completed: false,
    });

    let continueLoop = true;
    let loopCount = 0;
    const maxLoops = 50;

    while (continueLoop && loopCount < maxLoops) {
      if (abortSignal?.aborted) {
        throw new Error('Context building cancelled by user');
      }

      loopCount++;

      const fullMessages = [...messages, ...conversationHistory];

      const response = await client.chat(fullMessages, exploratoryTools, {
        signal: abortSignal,
      });

      if (response.toolCalls && response.toolCalls.length > 0) {
        const assistantMessage: Message = {
          role: 'assistant',
          content: response.content || '',
          toolCalls: response.toolCalls,
          usage: response.usage,
        };
        conversationHistory.push(assistantMessage);

        for (const toolCall of response.toolCalls) {
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments);

          const allToolCalls: Array<{ name: string; args: any }> = [];
          for (const msg of conversationHistory) {
            if (msg.role === 'tool' && msg.toolArgs) {
              try {
                const result = JSON.parse(msg.content || '{}');
                if (!result.error) {
                  allToolCalls.push({ name: msg.name || '', args: msg.toolArgs });
                }
              } catch {
              }
            }
          }

          let toolResult: string;
          if (toolName === 'context_write') {
            toolResult = executeContextWrite(toolArgs);
          } else {
            toolResult = await executeTool(toolName, toolArgs, {
              allToolCalls,
            });
          }

          const toolMessage: Message = {
            role: 'tool',
            name: toolName,
            content: toolResult,
            toolCallId: toolCall.id,
            toolArgs: toolArgs,
          };
          conversationHistory.push(toolMessage);

          if (toolName === 'context_write') {
            try {
              const result = JSON.parse(toolResult);
              if (!result.error) {
                continueLoop = false;
                break;
              }
            } catch {
            }
          }
        }

        onProgress({
          messages: [...conversationHistory],
          completed: false,
        });
      } else {
        const assistantMessage: Message = {
          role: 'assistant',
          content: response.content || '',
          usage: response.usage,
        };
        conversationHistory.push(assistantMessage);

        const contextWriteCalled = conversationHistory.some(
          (msg) => msg.role === 'tool' && msg.name === 'context_write'
        );

        if (contextWriteCalled) {
          continueLoop = false;
        } else {
          throw new Error(
            'Context building completed without writing context. The AI may need more guidance.'
          );
        }
      }
    }

    if (loopCount >= maxLoops) {
      throw new Error('Context building exceeded maximum iterations');
    }

    onProgress({
      messages: [...conversationHistory],
      completed: true,
    });

    logger.info("Context building completed", {
      iterations: conversationHistory.filter(m => m.role === 'assistant').length,
      toolCalls: conversationHistory.filter(m => m.role === 'tool').length
    });

    return conversationHistory;
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.error("Context building failed", { error: errorMsg });

    onProgress({
      messages: [...conversationHistory],
      completed: true,
      error: errorMsg,
    });

    throw error;
  }
}
