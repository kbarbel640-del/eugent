import * as path from 'path';
import { Tool } from '../../lib/core/types.js';
import { getToolDescription, getParameterDescription } from '../../agent/prompts.js';
import { logger } from '../../lib/core/logger.js';
import { PathValidator } from '../../lib/security/pathValidator.js';
import { ToolResponse } from '../../lib/tools/responses.js';
import { fileSystem } from '../../lib/filesystem/fileSystemInterface.js';

export interface WriteFileArgs {
  file_path: string;
  content: string;
}

export const writeFileTool: Tool = {
  type: 'function',
  function: {
    name: 'write_file',
    description: getToolDescription('write_file'),
    parameters: {
      type: 'object',
      required: ['file_path', 'content'],
      properties: {
        file_path: {
          type: 'string',
          description: getParameterDescription('write_file', 'file_path'),
        },
        content: {
          type: 'string',
          description: getParameterDescription('write_file', 'content'),
        },
      },
    },
  },
};

/**
 * Execute the write_file tool
 * Creates a new file with content (fails if file already exists)
 * @param args - The file path and content
 * @returns JSON string with success message or error
 */
export function executeWriteFile(args: WriteFileArgs): string {
  try {
    const { file_path, content } = args;

    const pathCheck = PathValidator.validatePath(file_path, 'write files');
    if (!pathCheck.valid) {
      return ToolResponse.error(pathCheck.error!);
    }

    const absolutePath = pathCheck.absolutePath!;

    if (fileSystem.existsSync(absolutePath)) {
      return ToolResponse.error(
        `File already exists: ${file_path}. Use edit_file to modify existing files.`
      );
    }

    const eugentCheck = PathValidator.blockEugentDirectory(absolutePath, 'write to');
    if (eugentCheck.blocked) {
      return ToolResponse.error(eugentCheck.error!);
    }

    const gitignoreCheck = PathValidator.checkGitignoreAccess(
      absolutePath,
      false,
      'write to'
    );
    if (!gitignoreCheck.allowed) {
      return ToolResponse.error(gitignoreCheck.error!);
    }

    const parentDir = path.dirname(absolutePath);
    if (!fileSystem.existsSync(parentDir)) {
      fileSystem.mkdirSync(parentDir, { recursive: true });
    }

    fileSystem.writeFileSync(absolutePath, content, 'utf-8');

    const stats = fileSystem.statSync(absolutePath);

    logger.info("File created", {
      path: file_path,
      size: stats.size,
      lines: content.split('\n').length
    });

    return ToolResponse.success({
      file_path,
      size: stats.size,
      lines: content.split('\n').length,
    });
  } catch (error: unknown) {
    return ToolResponse.error(
      `Failed to write file: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
