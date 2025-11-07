/**
 * Context Write Tool
 *
 * Writes project context to .eugent/context.md file
 */

import * as fs from 'fs';
import * as path from 'path';
import { Tool } from '../../lib/core/types.js';
import { getToolDescription, getParameterDescription } from '../../agent/prompts.js';

export interface ContextWriteArgs {
  content: string;
}

export const contextWriteTool: Tool = {
  type: 'function',
  function: {
    name: 'context_write',
    description: getToolDescription('context_write'),
    parameters: {
      type: 'object',
      required: ['content'],
      properties: {
        content: {
          type: 'string',
          description: getParameterDescription('context_write', 'content'),
        },
      },
    },
  },
};

/**
 * Execute the context_write tool
 * Writes project context to .eugent/context.md
 * @param args - The content to write
 * @returns JSON string with success message or error
 */
export function executeContextWrite(args: ContextWriteArgs): string {
  try {
    const { content } = args;
    const eugentDir = path.join(process.cwd(), '.eugent');
    const contextFile = path.join(eugentDir, 'context.md');

    if (!fs.existsSync(eugentDir)) {
      fs.mkdirSync(eugentDir, { recursive: true });
    }

    fs.writeFileSync(contextFile, content, 'utf-8');

    const stats = fs.statSync(contextFile);
    const lines = content.split('\n').length;

    return JSON.stringify({
      file: '.eugent/context.md',
      lines: lines,
      size: stats.size,
    });
  } catch (error: unknown) {
    return JSON.stringify({
      error: `Failed to write context file: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}
