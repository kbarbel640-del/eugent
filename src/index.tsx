#!/usr/bin/env node
import React, { useState } from 'react';
import { render } from 'ink';
import { Chat } from './app/Chat.js';
import { Setup } from './app/Setup.js';
import { ErrorBoundary } from './components/ui/ErrorBoundary.js';
import {
  getApiKey,
  isProjectInitialized,
  loadProjectConfig,
  ensureEugentGitignore,
} from './lib/config/config.js';
import { logger } from './lib/core/logger.js';
import { printLogo, clearAndPrintHeader } from './lib/ui/terminal.js';

if (process.stdout.isTTY) {
  process.stdout.write('\x1Bc');
}

printLogo();

// Early logger initialization - check if project has logging enabled
try {
  const config = loadProjectConfig();
  logger.setEnabled(config.enable_logging ?? false);
  if (config.enable_logging) {
    logger.info("Application starting", { cwd: process.cwd() });
  }
} catch {
  // If project not initialized, logger stays disabled
}

// Ensure .eugent/.gitignore exists on every startup (zero trace in version control)
ensureEugentGitignore();

type AppState = 'missing-key' | 'need-init' | 'ready';

function App() {
  const [state, setState] = useState<AppState>(() => {
    const apiKey = getApiKey();
    if (!apiKey) {
      return 'missing-key';
    }

    if (!isProjectInitialized()) {
      return 'need-init';
    }

    return 'ready';
  });

  if (state === 'missing-key') {
    return <Setup mode="missing-key" onComplete={() => setState('ready')} />;
  }

  if (state === 'need-init') {
    return <Setup mode="need-init" onComplete={() => setState('ready')} />;
  }

  const apiKey = getApiKey()!;
  const config = loadProjectConfig();

  logger.setEnabled(config.enable_logging ?? false);

  console.log('  \x1b[2mvibe coding cli powered by Mistral API\x1b[0m');
  console.log(`  \x1b[2mmodel: ${config.model || 'devstral-medium-2507'}\x1b[0m`);
  console.log('');

  return (
    <ErrorBoundary>
      <Chat
        apiKey={apiKey}
        model={config.model}
        allowedTools={config.allowed_tools}
        repromptModel={config.reprompt_model}
      />
    </ErrorBoundary>
  );
}

const { waitUntilExit } = render(<App />);

// Ensure cursor is hidden
if (process.stdin.isTTY) {
  process.stdout.write('\x1B[?25l'); // Hide cursor
}

waitUntilExit().then(() => {
  // Show cursor on exit
  if (process.stdin.isTTY) {
    process.stdout.write('\x1B[?25h');
  }
});
