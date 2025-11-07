import * as path from 'path';
import {
  matchesGitignorePattern,
  loadGitignorePatterns,
} from '../shared/gitignore.js';
import { matchesPathPattern } from '../../lib/patterns/patternMatching.js';
import { Tool } from '../../lib/core/types.js';
import { getToolDescription, getParameterDescription } from '../../agent/prompts.js';
import { PathValidator } from '../../lib/security/pathValidator.js';
import { ToolResponse } from '../../lib/tools/responses.js';
import { fileSystem } from '../../lib/filesystem/fileSystemInterface.js';

export interface ListFilesArgs {
  directory_path?: string;
  include_gitignored?: boolean;
  pattern?: string;
}

export const listFilesTool: Tool = {
  type: 'function',
  function: {
    name: 'list_files',
    description: getToolDescription('list_files'),
    parameters: {
      type: 'object',
      required: [],
      properties: {
        directory_path: {
          type: 'string',
          description: getParameterDescription('list_files', 'directory_path'),
        },
        include_gitignored: {
          type: 'boolean',
          description: getParameterDescription('list_files', 'include_gitignored'),
        },
        pattern: {
          type: 'string',
          description: getParameterDescription('list_files', 'pattern'),
        },
      },
    },
  },
};

/**
 * Execute the list_files tool
 * Lists files in a directory with optional pattern filtering and gitignore support
 * @param args - The directory path, pattern, and gitignore settings
 * @returns JSON string with file list or error
 */
// Size limit for line counting (skip line counting for files larger than 1MB)
const LINE_COUNT_SIZE_LIMIT = 1024 * 1024; // 1MB

/**
 * Count lines in a file efficiently
 * Returns null if file is too large or can't be read
 */
function countLinesInFile(filePath: string, fileSize: number): number | null {
  // Skip line counting for very large files
  if (fileSize > LINE_COUNT_SIZE_LIMIT) {
    return null;
  }

  try {
    const content = fileSystem.readFileSync(filePath, 'utf-8');
    // Count newlines + 1 (for last line if it doesn't end with newline)
    const lineCount = content.split('\n').length;
    return lineCount;
  } catch {
    // If we can't read it, return null
    return null;
  }
}

export function executeListFiles(args: ListFilesArgs): string {
  try {
    const {
      directory_path = '.',
      include_gitignored = false,
      pattern,
    } = args;

    // Validate directory path
    const validation = PathValidator.validateDirectoryPath(directory_path, 'list');
    if (!validation.valid) {
      return ToolResponse.error(validation.error!);
    }
    const absolutePath = validation.absolutePath!;
    const cwd = process.cwd();

    // Security: prevent listing .eugent directory
    const relativePath = path.relative(cwd, absolutePath);
    const eugentCheck = PathValidator.blockEugentDirectory(absolutePath, 'list');
    if (eugentCheck.blocked) {
      return ToolResponse.error(eugentCheck.error!);
    }

    // If gitignored files are not included, check if the directory itself is gitignored
    if (!include_gitignored && directory_path !== '.') {
      const gitignoreCheck = PathValidator.checkGitignoreAccess(absolutePath, false, 'list');
      if (!gitignoreCheck.allowed) {
        return ToolResponse.error(gitignoreCheck.error!);
      }
    }

    // Read directory contents
    let entries = fileSystem.readdirSync(absolutePath, { withFileTypes: true });

    // Filter gitignored files if not included
    let gitignorePatterns: string[] = [];
    if (!include_gitignored) {
      gitignorePatterns = loadGitignorePatterns(absolutePath);
    }

    let files = entries
      .filter(entry => {
        // Security: always exclude .eugent directory
        if (entry.name === '.eugent') {
          return false;
        }

        // If we're not including gitignored files, check patterns
        if (!include_gitignored && gitignorePatterns.length > 0) {
          const relativePath = path.relative(cwd, path.join(absolutePath, entry.name));
          return !matchesGitignorePattern(relativePath, gitignorePatterns);
        }
        return true;
      })
      .map(entry => {
        const fullPath = path.join(absolutePath, entry.name);
        const relPath = path.relative(cwd, fullPath);
        const stats = fileSystem.statSync(fullPath);

        // For files, add size and line count (if applicable)
        if (entry.isFile()) {
          const lineCount = countLinesInFile(fullPath, stats.size);
          return {
            name: entry.name,
            path: relPath,
            type: 'file' as const,
            size: stats.size,
            lines: lineCount,
          };
        }

        // For directories
        return {
          name: entry.name,
          path: relPath,
          type: 'directory' as const,
          size: null,
          lines: null,
        };
      });

    // Apply pattern filter AFTER hidden and gitignore filters
    // IMPORTANT: Pattern only filters FILES, not directories (so agent can see where to search next)
    if (pattern) {
      files = files.filter(file =>
        file.type === 'directory' || matchesPathPattern(file.path, pattern)
      );
    }

    // Check if we have more than 100 files
    const totalCount = files.length;
    const hasMore = totalCount > 100;
    const limitedFiles = files.slice(0, 100);

    return ToolResponse.success({
      directory: directory_path,
      absolute_path: absolutePath,
      count: limitedFiles.length,
      total_found: totalCount,
      ...(hasMore && {
        truncated: true,
        message: `Found ${totalCount} files, showing first 100. Use a more specific pattern to narrow results.`,
      }),
      files: limitedFiles,
    });
  } catch (error: unknown) {
    return ToolResponse.error(
      `Failed to list files: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
