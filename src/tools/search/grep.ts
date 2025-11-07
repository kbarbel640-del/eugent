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

export interface GrepArgs {
  pattern: string; // Regex pattern to search for
  directory_path?: string;
  file_pattern?: string; // Optional glob pattern to filter files (e.g., "*.ts")
  include_gitignored?: boolean;
  case_sensitive?: boolean;
}

export interface GrepMatch {
  file: string;
  line: number;
  content: string;
}

export const grepTool: Tool = {
  type: 'function',
  function: {
    name: 'grep',
    description: getToolDescription('grep'),
    parameters: {
      type: 'object',
      required: ['pattern'],
      properties: {
        pattern: {
          type: 'string',
          description: getParameterDescription('grep', 'pattern'),
        },
        directory_path: {
          type: 'string',
          description: getParameterDescription('grep', 'directory_path'),
        },
        file_pattern: {
          type: 'string',
          description: getParameterDescription('grep', 'pattern'),
        },
        include_gitignored: {
          type: 'boolean',
          description: 'Include files that would be ignored by .gitignore. Defaults to false.',
        },
        case_sensitive: {
          type: 'boolean',
          description: getParameterDescription('grep', 'case_sensitive'),
        },
      },
    },
  },
};

function searchFile(
  filePath: string,
  cwd: string,
  pattern: RegExp,
  matches: GrepMatch[],
  maxMatches: number
): void {
  if (matches.length >= maxMatches) return;

  try {
    const stats = fileSystem.statSync(filePath);

    if (stats.size > 5 * 1024 * 1024) return;

    const content = fileSystem.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const relativePath = path.relative(cwd, filePath);

    for (let i = 0; i < lines.length; i++) {
      if (matches.length >= maxMatches) return;

      const line = lines[i];
      if (pattern.test(line)) {
        matches.push({
          file: relativePath,
          line: i + 1,
          content: line.trim(),
        });
      }
    }
  } catch (error: unknown) {
  }
}

function searchDirectory(
  dirPath: string,
  cwd: string,
  pattern: RegExp,
  filePattern: string | undefined,
  gitignorePatterns: string[],
  matches: GrepMatch[],
  maxMatches: number
): void {
  if (matches.length >= maxMatches) return;

  try {
    const entries = fileSystem.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (matches.length >= maxMatches) return;

      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(cwd, fullPath);

      // Security: always skip .eugent directory
      if (entry.name === '.eugent' || relativePath.startsWith('.eugent' + path.sep)) {
        continue;
      }

      if (matchesGitignorePattern(relativePath, gitignorePatterns)) {
        continue;
      }

      if (entry.isDirectory()) {
        searchDirectory(
          fullPath,
          cwd,
          pattern,
          filePattern,
          gitignorePatterns,
          matches,
          maxMatches
        );
      } else if (entry.isFile()) {
        if (filePattern && !matchesSimplePattern(entry.name, filePattern)) {
          continue;
        }

        searchFile(fullPath, cwd, pattern, matches, maxMatches);
      }
    }
  } catch (error: unknown) {
  }
}

export function executeGrep(args: GrepArgs): string {
  try {
    const {
      pattern,
      directory_path = '.',
      file_pattern,
      include_gitignored = false,
      case_sensitive = false,
    } = args;

    // Validate directory path
    const validation = PathValidator.validateDirectoryPath(directory_path, 'search');
    if (!validation.valid) {
      return ToolResponse.error(validation.error!);
    }
    const absolutePath = validation.absolutePath!;
    const cwd = process.cwd();

    const gitignorePatterns = include_gitignored ? [] : loadGitignorePatterns(cwd);

    // Security: prevent searching .eugent directory
    const eugentCheck = PathValidator.blockEugentDirectory(absolutePath, 'search');
    if (eugentCheck.blocked) {
      return ToolResponse.error(eugentCheck.error!);
    }

    if (!include_gitignored && directory_path !== '.') {
      const gitignoreCheck = PathValidator.checkGitignoreAccess(absolutePath, false, 'search');
      if (!gitignoreCheck.allowed) {
        return ToolResponse.error(gitignoreCheck.error!);
      }
    }

    const flags = case_sensitive ? 'g' : 'gi';
    let regex: RegExp;
    try {
      regex = new RegExp(pattern, flags);
    } catch (error: unknown) {
      return ToolResponse.error(
        `Invalid regex pattern: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    const matches: GrepMatch[] = [];
    const maxMatches = 200;
    searchDirectory(
      absolutePath,
      cwd,
      regex,
      file_pattern,
      gitignorePatterns,
      matches,
      maxMatches
    );

    const result = {
      pattern,
      directory: directory_path,
      case_sensitive,
      ...(file_pattern && { file_pattern }),
      count: matches.length,
      ...(matches.length >= maxMatches && {
        truncated: true,
        message: `Found ${maxMatches}+ matches, showing first ${maxMatches}. Use a more specific pattern or file_pattern.`,
      }),
      matches,
    };

    const resultString = JSON.stringify(result);
    const resultSizeKB = Buffer.byteLength(resultString, 'utf8') / 1024;

    if (resultSizeKB > 20) {
      return ToolResponse.error(
        `Search results too large (${Math.round(resultSizeKB)}KB > 20KB limit). Found ${matches.length} matches. Please refine your search with:\n- More specific pattern\n- Use file_pattern to filter file types (e.g., "*.ts")\n- Search a more specific directory_path`,
        {
          pattern,
          directory: directory_path,
          matches_found: matches.length,
          size_kb: Math.round(resultSizeKB),
        }
      );
    }

    return resultString;
  } catch (error: unknown) {
    return ToolResponse.error(
      `Failed to search files: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
