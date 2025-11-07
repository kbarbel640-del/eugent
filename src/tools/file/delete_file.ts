import * as path from 'path';
import { Tool } from '../../lib/core/types.js';
import { getToolDescription, getParameterDescription } from '../../agent/prompts.js';
import { logger } from '../../lib/core/logger.js';
import { PathValidator } from '../../lib/security/pathValidator.js';
import { ToolResponse } from '../../lib/tools/responses.js';
import { fileSystem } from '../../lib/filesystem/fileSystemInterface.js';
import {
  matchesGitignorePattern,
  loadGitignorePatterns,
} from '../shared/gitignore.js';

export interface DeleteFileArgs {
  file_path: string;
}

export const deleteFileTool: Tool = {
  type: 'function',
  function: {
    name: 'delete_file',
    description: getToolDescription('delete_file'),
    parameters: {
      type: 'object',
      required: ['file_path'],
      properties: {
        file_path: {
          type: 'string',
          description: getParameterDescription('delete_file', 'file_path'),
        },
      },
    },
  },
};

/**
 * Execute the delete_file tool
 * Deletes an existing file (fails if file doesn't exist or is a directory)
 * @param args - The file path to delete
 * @returns JSON string with success message or error
 */
export function executeDeleteFile(args: DeleteFileArgs): string {
  try {
    const { file_path } = args;

    const validation = PathValidator.validateFilePath(file_path, 'delete files');
    if (!validation.valid) {
      return ToolResponse.error(validation.error!);
    }

    const absolutePath = validation.absolutePath!;
    const stats = validation.stats!;

    // Check if it's a directory
    if (stats.isDirectory()) {
      return ToolResponse.error(
        `Cannot delete directory: ${file_path}. Path is a directory, not a file.`
      );
    }

    const cwd = process.cwd();
    const relativePath = path.relative(cwd, absolutePath);

    // Check if the path is gitignored (warn but allow)
    const gitignorePatterns = loadGitignorePatterns(cwd);
    const isGitignored = matchesGitignorePattern(relativePath, gitignorePatterns);

    // Delete the file
    fileSystem.unlinkSync(absolutePath);

    logger.warn("File deleted", {
      path: file_path,
      wasGitignored: isGitignored
    });

    return ToolResponse.success({
      file_path,
      deleted: true,
      was_gitignored: isGitignored,
    });
  } catch (error: unknown) {
    return ToolResponse.error(
      `Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
