import React from 'react';
import { Box, Text, Static } from 'ink';
import Spinner from 'ink-spinner';
import { Message } from '../../../lib/core/types.js';
import { formatToolArgs } from '../../../lib/formatting/toolDisplay.js';
import { useMessageFormatting } from '../../../hooks/useMessageFormatting.js';

export interface ContextBuildingModalProps {
  messages: Message[];
  oldContext: string | null;
  statusMessage?: string;
}

export const ContextBuildingModal: React.FC<ContextBuildingModalProps> = ({
  messages,
  oldContext,
  statusMessage,
}) => {
  const { parseToolResult, formatSuccessMessage } = useMessageFormatting();

  const toolMessages = messages.filter((msg) => msg.role === 'tool');
  const staticKey = `context-static-${toolMessages.length}-${toolMessages[0]?.id || 'empty'}`;

  return (
    <Box flexDirection="column" padding={1}>
      <Static key={staticKey} items={toolMessages}>
        {(msg) => {
          const argsDisplay = msg.name && msg.toolArgs
            ? formatToolArgs(msg.name, msg.toolArgs)
            : '';
          const result = parseToolResult(msg.content || '');
          const hasError = result.error !== undefined;

          return (
            <Box key={msg.id || `tool-${msg.name}-${msg.toolCallId}`} flexDirection="column" marginBottom={1}>
              <Box flexDirection="row" gap={1}>
                <Text bold color="yellow">{"> Tool:"}</Text>
                <Text color="cyan">{msg.name}</Text>
                {argsDisplay && <Text dimColor>({argsDisplay})</Text>}
              </Box>
              <Box paddingLeft={2}>
                {hasError ? (
                  <Text color="red">Error: {result.error}</Text>
                ) : (
                  <Text color="green">
                    {formatSuccessMessage(msg.name || '', result)}
                  </Text>
                )}
              </Box>
            </Box>
          );
        }}
      </Static>

      <Box marginTop={1} marginBottom={1}>
        <Text dimColor>
          <Spinner type="bouncingBall" />
        </Text>
        <Text> </Text>
        <Text bold color="cyan">Building Project Context</Text>
        <Text dimColor> (Press ESC to cancel)</Text>
      </Box>
    </Box>
  );
};
