import React, { useState } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import {
  getCurrentDirName,
  initializeProject,
  saveApiKey,
  GLOBAL_DIR,
} from '../lib/config/config.js';

interface SetupProps {
  mode: 'missing-key' | 'need-init';
  onComplete: () => void;
}

export const Setup: React.FC<SetupProps> = ({ mode, onComplete }) => {
  const [waitingForInput, setWaitingForInput] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const { exit } = useApp();

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit();
      return;
    }

    if (mode === 'need-init' && waitingForInput) {
      if (input.toLowerCase() === 'y') {
        try {
          initializeProject();
          setWaitingForInput(false);
          // Give a moment to show success message, then continue
          setTimeout(() => onComplete(), 1000);
        } catch (error: unknown) {
          // Error will be shown in the component
        }
      } else if (input.toLowerCase() === 'n') {
        exit();
      }
    }
  });

  const handleApiKeySubmit = (value: string) => {
    if (!value.trim()) {
      return;
    }

    setSaving(true);
    try {
      saveApiKey(value.trim());
      setWaitingForInput(false);
      // Give a moment to show success message, then continue
      setTimeout(() => onComplete(), 1000);
    } catch (error: unknown) {
      setSaving(false);
      // Error will be shown in the component
    }
  };

  if (mode === 'missing-key') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box
          borderStyle="round"
          borderColor="yellow"
          paddingX={2}
          marginBottom={1}
        >
          <Text bold color="yellow">
            Mistral API Key Required
          </Text>
        </Box>

        {waitingForInput && !saving ? (
          <>
            <Box
              borderStyle="single"
              borderColor="red"
              paddingX={2}
              paddingY={1}
              marginBottom={1}
            >
              <Box flexDirection="column">
                <Text bold color="red">⚠ CAUTION: ALPHA SOFTWARE</Text>
                <Text color="red">This may consume tokens rapidly. Set API usage limits at:</Text>
                <Text color="red">https://admin.mistral.ai/</Text>
              </Box>
            </Box>

            <Box flexDirection="column" marginBottom={1}>
              <Text>Enter your Mistral API key:</Text>
              <Text dimColor>Get your key from: https://admin.mistral.ai/</Text>
            </Box>

            <Box marginBottom={1}>
              <Text bold>API Key: </Text>
              <TextInput
                value={apiKey}
                onChange={setApiKey}
                onSubmit={handleApiKeySubmit}
                placeholder="Enter your API key"
                mask="*"
              />
            </Box>

            <Box flexDirection="column">
              <Text dimColor>Your key will be stored in: {GLOBAL_DIR}/key.txt</Text>
              <Text dimColor>Press Enter to save • Ctrl+C to exit</Text>
            </Box>
          </>
        ) : saving ? (
          <Box flexDirection="column">
            <Text color="cyan">Saving API key...</Text>
          </Box>
        ) : (
          <Box flexDirection="column">
            <Text color="green">API key saved successfully!</Text>
            <Text dimColor>Starting Eugent...</Text>
          </Box>
        )}
      </Box>
    );
  }

  if (mode === 'need-init') {
    const dirName = getCurrentDirName();

    return (
      <Box flexDirection="column" padding={1}>
        <Box
          borderStyle="round"
          borderColor="yellow"
          paddingX={2}
          marginBottom={1}
        >
          <Text bold color="yellow">
            Project Not Initialized
          </Text>
        </Box>

        {waitingForInput ? (
          <>
            <Box flexDirection="column" marginBottom={1}>
              <Text>
                Initialize Eugent in <Text bold color="cyan">{dirName}</Text>?
              </Text>
              <Text dimColor>This will create a .eugent/ directory with default config</Text>
            </Box>

            <Box marginBottom={1}>
              <Text>
                <Text color="green" bold>[y]</Text> Yes
                <Text dimColor> | </Text>
                <Text color="red" bold>[n]</Text> No
              </Text>
            </Box>

            <Box>
              <Text dimColor>Type 'y' or 'n' and press Enter</Text>
            </Box>
          </>
        ) : (
          <Box flexDirection="column">
            <Text color="green">Project initialized successfully!</Text>
            <Text dimColor>Starting chat...</Text>
          </Box>
        )}
      </Box>
    );
  }

  return null;
};
