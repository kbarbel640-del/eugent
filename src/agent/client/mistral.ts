import { Mistral } from '@mistralai/mistralai';
import { Message, ToolCall, Tool, UsageInfo } from '../../lib/core/types.js';
import { logger } from '../../lib/core/logger.js';

export interface ChatResponse {
  content: string | null;
  toolCalls?: ToolCall[];
  usage?: UsageInfo;
}

export interface MistralClientConfig {
  apiKey: string;
  model?: string;
}

export interface ChatOptions {
  signal?: AbortSignal;
}

export class MistralClient {
  private client: Mistral;
  private model: string;

  constructor(config: MistralClientConfig) {
    this.client = new Mistral({ apiKey: config.apiKey });
    this.model = config.model || 'devstral-medium-2507';
  }

  /**
   * Stream a chat completion (no tool support for now)
   * @param messages - Conversation history
   * @param onChunk - Callback for each chunk of the response
   */
  async streamChat(
    messages: Message[],
    onChunk: (text: string) => void
  ): Promise<void> {
    try {
      const stream = await this.client.chat.stream({
        model: this.model,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content || '',
        })),
      });

      for await (const chunk of stream) {
        const delta = chunk.data.choices[0]?.delta?.content;
        if (delta && typeof delta === 'string') {
          onChunk(delta);
        }
      }
    } catch (error: unknown) {
      throw new Error(
        `Mistral API error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get a non-streaming chat completion with optional tool support
   * @param messages - Conversation history
   * @param tools - Optional array of tools
   * @param options - Optional chat options including abort signal
   * @returns The assistant's response
   */
  async chat(
    messages: Message[],
    tools?: Tool[],
    options?: ChatOptions
  ): Promise<ChatResponse> {
    try {
      const apiMessages = messages.map(msg => {
        if (msg.role === 'tool') {
          return {
            role: 'tool' as const,
            name: msg.name!,
            content: msg.content!,
            toolCallId: msg.toolCallId!,
          };
        }
        if (msg.role === 'assistant' && msg.toolCalls) {
          return {
            role: 'assistant' as const,
            content: msg.content || '',
            toolCalls: msg.toolCalls,
          };
        }
        return {
          role: msg.role as 'system' | 'user' | 'assistant',
          content: msg.content || '',
        };
      });

      const response = await this.client.chat.complete(
        {
          model: this.model,
          messages: apiMessages,
          ...(tools && { tools }),
        },
        {
          ...(options?.signal && {
            fetchOptions: { signal: options.signal },
          }),
        }
      );

      const message = response.choices?.[0]?.message;
      const content =
        message?.content && typeof message.content === 'string'
          ? message.content
          : null;
      const toolCalls = message?.toolCalls as ToolCall[] | undefined;

      return {
        content,
        toolCalls,
        usage: response.usage ? {
          promptTokens: response.usage.promptTokens || 0,
          completionTokens: response.usage.completionTokens || 0,
          totalTokens: response.usage.totalTokens || 0,
        } : undefined,
      };
    } catch (error: unknown) {
      logger.error('Mistral API request failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        messageCount: messages.length,
        lastFiveMessages: messages.slice(-5).map((msg, idx) => ({
          index: messages.length - 5 + idx,
          role: msg.role,
          hasContent: !!msg.content,
          contentLength: msg.content?.length || 0,
          hasToolCalls: !!msg.toolCalls,
          toolCallCount: msg.toolCalls?.length || 0,
          toolCallIds: msg.toolCalls?.map(tc => tc.id),
          toolCallId: msg.toolCallId, // For tool messages
          name: msg.name, // For tool messages
        })),
      });

      throw new Error(
        `Mistral API error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
