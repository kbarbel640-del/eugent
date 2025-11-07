import * as path from 'path';
import { Tool } from '../../lib/core/types.js';
import { getToolDescription, getParameterDescription } from '../../agent/prompts.js';
import { PathValidator } from '../../lib/security/pathValidator.js';
import { ToolResponse } from '../../lib/tools/responses.js';
import { fileSystem } from '../../lib/filesystem/fileSystemInterface.js';

export interface ReadFileArgs {
  file_path: string;
  offset?: number; // Line number to start reading from (0-indexed). Use -1 for last 300 lines.
  read_for_write?: boolean; // If true, read entire file (only works for files <256KB)
}

export const readFileTool: Tool = {
  type: 'function',
  function: {
    name: 'read_file',
    description: getToolDescription('read_file'),
    parameters: {
      type: 'object',
      required: ['file_path'],
      properties: {
        file_path: {
          type: 'string',
          description: getParameterDescription('read_file', 'file_path'),
        },
        offset: {
          type: 'number',
          description: getParameterDescription('read_file', 'offset'),
        },
        read_for_write: {
          type: 'boolean',
          description: getParameterDescription('read_file', 'read_for_write'),
        },
      },
    },
  },
};

const MAX_FILE_SIZE = 256 * 1024; // 256KB
const DEFAULT_LINE_LIMIT = 300;

/**
 * Execute the read_file tool
 * Reads a file from the filesystem with line limiting and size checks
 * @param args - The file path, offset, and read mode
 * @returns JSON string with file contents, line info, or error
 */
export function executeReadFile(args: ReadFileArgs): string {
  try {
    const { file_path, offset = 0, read_for_write = false } = args;

    const validation = PathValidator.validateFilePath(file_path, 'read files');
    if (!validation.valid) {
      return ToolResponse.error(validation.error!);
    }

    const absolutePath = validation.absolutePath!;
    const stats = validation.stats!;

    const content = fileSystem.readFileSync(absolutePath, 'utf-8');
    // Match cat -n behavior: empty file = 0 lines
    const allLines = content ? content.split('\n') : [];
    const totalLines = allLines.length;

    if (read_for_write) {
      if (stats.size >= MAX_FILE_SIZE) {
        return ToolResponse.error(
          `File too large for editing (${stats.size} bytes, max ${MAX_FILE_SIZE} bytes)`,
          { file_path, size: stats.size, total_lines: totalLines }
        );
      }

      return ToolResponse.success({
        file_path,
        content,
        size: stats.size,
        total_lines: totalLines,
        read_for_write: true,
      });
    }

    let startLine = offset;

    if (offset === -1 || offset >= totalLines) {
      startLine = Math.max(0, totalLines - DEFAULT_LINE_LIMIT);
    }

    const endLine = Math.min(startLine + DEFAULT_LINE_LIMIT, totalLines);

    const selectedLines = allLines.slice(startLine, endLine);
    const partialContent = selectedLines.join('\n');

    const partialSize = Buffer.byteLength(partialContent, 'utf-8');
    if (partialSize >= MAX_FILE_SIZE) {
      return ToolResponse.error(
        `Content exceeds 256KB limit (${partialSize} bytes). Likely a minified file.`,
        {
          file_path,
          total_lines: totalLines,
          attempted_lines: endLine - startLine,
        }
      );
    }

    return ToolResponse.success({
      file_path,
      content: partialContent,
      offset: startLine,
      lines_returned: endLine - startLine,
      total_lines: totalLines,
      size: partialSize,
    });
  } catch (error: unknown) {
    return ToolResponse.error(
      `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
