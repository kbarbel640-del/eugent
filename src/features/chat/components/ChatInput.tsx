import React from 'react';
import { Box, Text } from 'ink';
import { TextArea } from '../../../components/ui/TextArea.js';
import { getAllCommands } from '../../../commands/index.js';

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  handleSubmit: (value: string) => Promise<void>;
  isProcessing: boolean;
  hasContext: boolean;
  isContextBuilding: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = React.memo(({
  input,
  setInput,
  handleSubmit,
  isProcessing,
  hasContext,
  isContextBuilding,
}) => {
  // Show command suggestions when typing a slash command (no spaces)
  const showCommandSuggestions = input.startsWith('/') && !input.includes(' ');
  const commandSuggestions = React.useMemo(() => {
    if (!showCommandSuggestions) return { commands: [], single: null };

    const allCommands = getAllCommands();
    const search = input.toLowerCase();

    const matching = allCommands
      .filter(cmd => `/${cmd.name}`.toLowerCase().startsWith(search))
      .slice(0, 10);

    return {
      commands: matching.map(cmd => `/${cmd.name}`),
      single: matching.length === 1 ? matching[0] : null,
    };
  }, [input, showCommandSuggestions]);

  // Autocomplete handler for Tab key
  const handleTab = React.useCallback(() => {
    if (commandSuggestions.single) {
      setInput(`/${commandSuggestions.single.name} `);
    }
  }, [commandSuggestions.single, setInput]);

  return (
    <>
      {/* Context tip - shown when no context exists */}
      {!hasContext && !isProcessing && !isContextBuilding && (
        <Box marginBottom={1} borderStyle="round" borderColor="yellow" paddingX={2}>
          <Text color="yellow">
            This project has no context. Use /context to build one automatically.
          </Text>
        </Box>
      )}

      {/* Input */}
      <Box
        borderStyle="single"
        borderLeft={false}
        borderRight={false}
        borderColor="gray"
        paddingX={1}
      >
        {isProcessing ? (
          <Text dimColor>Processing...</Text>
        ) : (
          <Box flexDirection="row">
            <Text color="yellow">{"> "}</Text>
            <Box flexGrow={1}>
              <TextArea
                value={input}
                onChange={setInput}
                onSubmit={handleSubmit}
                onTab={commandSuggestions.single ? handleTab : undefined}
                focus={!isProcessing && !isContextBuilding}
                placeholder="Type your message... (Ctrl+Enter: newline, ESC ESC: clear)"
              />
            </Box>
          </Box>
        )}
      </Box>

      {/* Command suggestions */}
      {showCommandSuggestions && commandSuggestions.commands.length > 0 && (
        <Box marginTop={0} paddingX={1}>
          {commandSuggestions.single ? (
            <Text dimColor>
              {commandSuggestions.commands[0]} -- {commandSuggestions.single.description} <Text color="green">(Tab to complete)</Text>
            </Text>
          ) : (
            <Text dimColor>{commandSuggestions.commands.join(', ')}</Text>
          )}
        </Box>
      )}
    </>
  );
});
