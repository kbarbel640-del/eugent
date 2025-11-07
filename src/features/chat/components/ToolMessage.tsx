import React from 'react';
import { Box, Text } from 'ink';
import { Message } from '../../../lib/core/types.js';
import { formatToolArgs } from '../../../lib/formatting/toolDisplay.js';

interface ToolMessageProps {
  message: Message;
  parseToolResult: (content: string) => any;
  formatSuccessMessage: (toolName: string, result: any) => string;
}

export const ToolMessage: React.FC<ToolMessageProps> = React.memo(({
  message,
  parseToolResult,
  formatSuccessMessage,
}) => {
  const result = parseToolResult(message.content || "");
  const hasError = "error" in result;
  const argsDisplay = formatToolArgs(message.name || "", message.toolArgs);

  // Check if permission was denied or skipped
  const permissionDenied =
    hasError && result.error === "Permission denied by user";
  const skipped =
    hasError &&
    result.error === "Skipped due to previous permission denial";

  // Special rendering for manage_todos
  if (message.name === "manage_todos" && !hasError && message.toolArgs?.todos) {
    const todoList = message.toolArgs.todos
      .map((todo: { task: string; completed: boolean }) =>
        `- [${todo.completed ? "x" : " "}] ${todo.task}`
      )
      .join("\n");

    return (
      <Box flexDirection="column">
        <Text bold color="yellow">
          {"> Todos Updated"}
        </Text>
        <Box paddingLeft={2} marginBottom={1}>
          <Text>{todoList}</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box flexDirection="row" gap={1} alignItems="center">
        <Text bold color="yellow">{"> Tool:"}</Text>
        <Text color="cyan">{message.name}</Text>
        {argsDisplay && <Text color="gray">({argsDisplay})</Text>}
      </Box>
      <Box paddingLeft={2} marginBottom={1}>
        {permissionDenied ? (
          <Text color="red">Permission denied by user</Text>
        ) : skipped ? (
          <Text color="yellow">⊘ Skipped</Text>
        ) : hasError ? (
          <Text color="red">Error: {result.error}</Text>
        ) : (
          <Text color="green">
            {formatSuccessMessage(message.name || "", result)}
          </Text>
        )}
      </Box>
    </Box>
  );
});
