import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { formatToolArgs } from '../../../lib/formatting/toolDisplay.js';

interface PermissionPromptProps {
  toolName: string;
  toolArgs: any; // Tool-specific arguments (type varies by tool)
  onResponse: (granted: boolean) => void;
}

/**
 * Permission prompt component for dangerous operations
 * Shows the tool name and arguments, waits for y/n response
 */
export const PermissionPrompt: React.FC<PermissionPromptProps> = ({
  toolName,
  toolArgs,
  onResponse,
}) => {
  const [responded, setResponded] = useState(false);

  useInput((input) => {
    if (responded) return;

    if (input.toLowerCase() === 'y') {
      setResponded(true);
      onResponse(true);
    } else if (input.toLowerCase() === 'n') {
      setResponded(true);
      onResponse(false);
    }
  });

  const isContinueExecution = toolName === 'continue_execution';
  const argsDisplay = formatToolArgs(toolName, toolArgs);

  return (
    <Box
      flexDirection="column"
      marginY={1}
      borderStyle="round"
      borderColor="yellow"
      paddingX={2}
      paddingY={1}
      minWidth={60}
    >
      <Box flexDirection="row" justifyContent="space-between" alignItems="center">
        <Text bold color="yellow">
          {isContinueExecution ? 'Tool Limit Reached' : 'Permission Required'}
        </Text>
        {!responded && (
          <Box flexDirection="row" gap={2}>
            <Text color="green" bold>
              [y] {isContinueExecution ? 'Continue' : 'Allow'}
            </Text>
            <Text color="red" bold>
              [n] {isContinueExecution ? 'Stop' : 'Deny'}
            </Text>
          </Box>
        )}
      </Box>

      <Box flexDirection="column" marginTop={1}>
        {isContinueExecution ? (
          <Text>{argsDisplay}</Text>
        ) : (
          <>
            <Box flexDirection="row" gap={1}>
              <Text dimColor>Tool:</Text>
              <Text bold color="cyan">{toolName}</Text>
            </Box>
            {argsDisplay && (
              <Box flexDirection="row" gap={1}>
                <Text dimColor>Args:</Text>
                <Text>{argsDisplay}</Text>
              </Box>
            )}
          </>
        )}
      </Box>

      {!responded && !isContinueExecution && (
        <Box marginTop={1}>
          <Text dimColor>
            Tip: Add "{toolName}" to allowed_tools in .eugent/config.json
          </Text>
        </Box>
      )}
    </Box>
  );
};
