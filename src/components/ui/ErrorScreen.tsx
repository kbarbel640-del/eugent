import React from "react";
import { Box, Text } from "ink";

interface ErrorScreenProps {
  error: Error;
}

export const ErrorScreen: React.FC<ErrorScreenProps> = ({ error }) => {
  return (
    <Box flexDirection="column" padding={2}>
      {/* Error Header */}
      <Box
        marginBottom={1}
        borderStyle="round"
        borderColor="red"
        paddingX={2}
        paddingY={1}
      >
        <Text bold color="red">
          Application Error
        </Text>
      </Box>

      {/* Error Message */}
      <Box marginBottom={1} flexDirection="column">
        <Text bold>Error Message:</Text>
        <Text color="red">{error.message}</Text>
      </Box>

      {/* Stack Trace (if available) */}
      {error.stack && (
        <Box marginBottom={1} flexDirection="column">
          <Text bold>Stack Trace:</Text>
          <Text dimColor>{error.stack}</Text>
        </Box>
      )}

      {/* Help Text */}
      <Box
        marginTop={1}
        borderStyle="single"
        borderColor="yellow"
        paddingX={2}
        paddingY={1}
      >
        <Box flexDirection="column">
          <Text color="yellow">What you can do:</Text>
          <Text>
            • Press Ctrl+C to exit
          </Text>
          <Text>
            • Report issues on GitHub
          </Text>
          <Text>
            • Try restarting the application
          </Text>
        </Box>
      </Box>
    </Box>
  );
};
