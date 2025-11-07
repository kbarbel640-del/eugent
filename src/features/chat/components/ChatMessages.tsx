import React from 'react';
import { Box, Text, Static } from 'ink';
import Spinner from 'ink-spinner';
import { Message } from '../../../lib/core/types.js';
import { ChatMessage } from './ChatMessage.js';

interface ChatMessagesProps {
  messages: Message[];
  isProcessing: boolean;
  statusMessage: string;
  renderMarkdown: (content: string) => string;
  parseToolResult: (content: string) => any;
  formatSuccessMessage: (toolName: string, result: any) => string;
}

export const ChatMessages: React.FC<ChatMessagesProps> = React.memo(({
  messages,
  isProcessing,
  statusMessage,
  renderMarkdown,
  parseToolResult,
  formatSuccessMessage,
}) => {
  const prevLengthRef = React.useRef(messages.length);
  const [staticKey, setStaticKey] = React.useState('static-initial');

  React.useEffect(() => {
    const prevLength = prevLengthRef.current;
    const currentLength = messages.length;

    if (currentLength < prevLength || currentLength === 0) {
      setStaticKey(`static-reset-${Date.now()}`);
    }

    prevLengthRef.current = currentLength;
  }, [messages.length]);

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Static key={staticKey} items={messages}>
        {(msg) => (
          <ChatMessage
            key={msg.id || `fallback-${msg.role}-${msg.content?.slice(0, 20)}`}
            message={msg}
            renderMarkdown={renderMarkdown}
            parseToolResult={parseToolResult}
            formatSuccessMessage={formatSuccessMessage}
          />
        )}
      </Static>

      {isProcessing && statusMessage && (
        <Box marginBottom={1}>
          <Text dimColor>
            <Spinner type="bouncingBall" />
          </Text>
          <Text dimColor> {statusMessage}</Text>
        </Box>
      )}
    </Box>
  );
});
