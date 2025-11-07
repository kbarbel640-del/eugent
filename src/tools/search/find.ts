import * as path from 'path';
import {
  matchesGitignorePattern,
  loadGitignorePatterns,
} from '../shared/gitignore.js';
import { matchesSimplePattern } from '../../lib/patterns/patternMatching.js';
import { Tool } from '../../lib/core/types.js';
import { getToolDescription, getParameterDescription } from '../../agent/prompts.js';
import { PathValidator } from '../../lib/security/pathValidator.js';
import { ToolResponse } from '../../lib/tools/responses.js';
import { fileSystem } from '../../lib/filesystem/fileSystemInterface.js';

export interface FindArgs {
  pattern?: string; // Glob pattern like "*.ts" or "test*"
  directory_path?: string;
  include_gitignored?: boolean;
}

export const findTool: Tool = {
  type: 'function',
  function: {
    name: 'find_files',
    description: getToolDescription('find_files'),
    parameters: {
      type: 'object',
      required: [],
      properties: {
        pattern: {
          type: 'string',
          description: getParameterDescription('find_files', 'pattern'),
        },
        directory_path: {
          type: 'string',
          description: getParameterDescription('find_files', 'directory_path'),
        },
        include_gitignored: {
          type: 'boolean',
          description: getParameterDescription('find_files', 'include_gitignored'),
        },
      },
    },
  },
};

/**
 * Recursively find files in a directory
 * @param dirPath - Absolute path to directory
 * @param cwd - Current working directory
 * @param pattern - Filename pattern to match
 * @param gitignorePatterns - Gitignore patterns to respect
 * @param results - Accumulator for results
 * @param maxResults - Maximum number of results to collect
 */
function findFilesRecursive(
  dirPath: string,
  cwd: string,
  pattern: string,
  gitignorePatterns: string[],
  results: string[],
  maxResults: number
): void {
  // Stop if we've hit the limit
  if (results.length >= maxResults) return;

  try {
    const entries = fileSystem.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      // Stop if we've hit the limit
      if (results.length >= maxResults) return;

      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(cwd, fullPath);

      // Security: always skip .eugent directory
      if (entry.name === '.eugent' || relativePath.startsWith('.eugent' + path.sep)) {
        continue;
      }

      // Skip gitignored paths
      if (matchesGitignorePattern(relativePath, gitignorePatterns)) {
        continue;
      }

      if (entry.isDirectory()) {
        // Recurse into directory
        findFilesRecursive(
          fullPath,
          cwd,
          pattern,
          gitignorePatterns,
          results,
          maxResults
        );
      } else if (entry.isFile()) {
        // Check if file matches pattern
        if (matchesSimplePattern(entry.name, pattern)) {
          results.push(relativePath);
        }
      }
    }
  } catch (error: unknown) {
    // Skip directories we can't read
  }
}

/**
 * Execute the find tool
 * Recursively searches for files matching a pattern
 * @param args - The search pattern and directory
 * @returns JSON string with matching file paths or error
 */
export function executeFind(args: FindArgs): string {
  try {
    const {
      pattern = '*',
      directory_path = '.',
      include_gitignored = false,
    } = args;

    // Validate directory path
    const validation = PathValidator.validateDirectoryPath(directory_path, 'search');
    if (!validation.valid) {
      return ToolResponse.error(validation.error!);
    }
    const absolutePath = validation.absolutePath!;
    const cwd = process.cwd();

    // Load gitignore patterns if needed
    const gitignorePatterns = include_gitignored ? [] : loadGitignorePatterns(cwd);

    // Security: prevent searching .eugent directory
    const eugentCheck = PathValidator.blockEugentDirectory(absolutePath, 'search');
    if (eugentCheck.blocked) {
      return ToolResponse.error(eugentCheck.error!);
    }

    // Check if the directory itself is gitignored
    if (!include_gitignored && directory_path !== '.') {
      const gitignoreCheck = PathValidator.checkGitignoreAccess(absolutePath, false, 'search');
      if (!gitignoreCheck.allowed) {
        return ToolResponse.error(gitignoreCheck.error!);
      }
    }

    // Find files recursively
    const results: string[] = [];
    const maxResults = 200;
    findFilesRecursive(
      absolutePath,
      cwd,
      pattern,
      gitignorePatterns,
      results,
      maxResults
    );

    return ToolResponse.success({
      pattern,
      directory: directory_path,
      count: results.length,
      ...(results.length >= maxResults && {
        truncated: true,
        message: `Found ${maxResults}+ files, showing first ${maxResults}. Use a more specific pattern.`,
      }),
      files: results,
    });
  } catch (error: unknown) {
    return ToolResponse.error(
      `Failed to search files: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
