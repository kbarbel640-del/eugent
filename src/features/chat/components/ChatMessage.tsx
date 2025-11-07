import React from 'react';
import { Box, Text } from 'ink';
import { Message } from '../../../lib/core/types.js';
import { ToolMessage } from './ToolMessage.js';

interface ChatMessageProps {
  message: Message;
  renderMarkdown: (content: string) => string;
  parseToolResult: (content: string) => any;
  formatSuccessMessage: (toolName: string, result: any) => string;
}

export const ChatMessage: React.FC<ChatMessageProps> = React.memo(({
  message,
  renderMarkdown,
  parseToolResult,
  formatSuccessMessage,
}) => {
  // User messages
  if (message.role === "user") {
    return (
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="magenta">
          {"> You"}
        </Text>
        <Box paddingLeft={2}>
          <Text>{message.content}</Text>
        </Box>
      </Box>
    );
  }

  // Assistant messages
  if (message.role === "assistant") {
    // Skip empty assistant messages (tool-only responses)
    if (!message.content || !message.content.trim()) return null;

    // Render markdown to terminal-formatted ANSI
    const renderedContent = renderMarkdown(message.content);

    return (
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="#FA520F">
          {"> Assistant"}
        </Text>
        <Box paddingLeft={2} flexDirection="column">
          <Text>{renderedContent}</Text>
        </Box>
        {message.usage && (
          <Box paddingLeft={2}>
            <Text dimColor color="gray">
              {message.usage.promptTokens} prompt · {message.usage.completionTokens} completion
            </Text>
          </Box>
        )}
      </Box>
    );
  }

  // Tool execution messages
  if (message.role === "tool") {
    return (
      <ToolMessage
        message={message}
        parseToolResult={parseToolResult}
        formatSuccessMessage={formatSuccessMessage}
      />
    );
  }

  return null;
});
