import React from 'react';
import { Box, Text } from 'ink';
import { Message } from '../../../lib/core/types.js';

interface ChatFooterProps {
  messageCount: number;
  messages: Message[];
}

export const ChatFooter: React.FC<ChatFooterProps> = React.memo(({ messageCount, messages }) => {
  // Find latest usage from last assistant message
  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant' && m.usage);

  return (
    <Box marginTop={1} flexDirection="column" gap={1}>
      {/* Line 1: Keyboard shortcuts */}
      <Box flexDirection="row" gap={1} alignItems="center">
        <Text dimColor>Shortcuts:</Text>
        <Text color="cyan">ESC</Text>
        <Text dimColor>to interrupt</Text>
        <Text dimColor>•</Text>
        <Text color="cyan">Ctrl+C</Text>
        <Text dimColor>to exit</Text>
        <Text dimColor>•</Text>
        <Text color="yellow">/help</Text>
        <Text dimColor>for commands</Text>
      </Box>

      {/* Line 2: Status info */}
      <Box flexDirection="row" justifyContent="space-between" alignItems="center">
        <Box flexDirection="row" gap={1}>
          <Text color="green">Messages:</Text>
          <Text bold color="white">{messageCount}</Text>
        </Box>
        {lastAssistant?.usage && (
          <Box flexDirection="row" gap={1}>
            <Text color="magenta">Tokens:</Text>
            <Text bold color="white">{lastAssistant.usage.promptTokens}</Text>
            <Text dimColor>prompt</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
});
