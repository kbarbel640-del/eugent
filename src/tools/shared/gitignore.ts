import * as fs from 'fs';
import * as path from 'path';

/**
 * Match a file path against gitignore patterns
 */
export function matchesGitignorePattern(
  filePath: string,
  patterns: string[]
): boolean {
  const fileName = path.basename(filePath);

  for (const pattern of patterns) {
    if (!pattern || pattern.startsWith('#')) continue;

    // Simple pattern matching (not full gitignore spec, but covers common cases)
    if (pattern.endsWith('/')) {
      if (filePath.includes(pattern.slice(0, -1))) return true;
    } else if (pattern.includes('*')) {
      const regex = new RegExp(
        '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
      );
      if (regex.test(fileName) || regex.test(filePath)) return true;
    } else {
      if (fileName === pattern || filePath.includes(pattern)) return true;
    }
  }

  return false;
}

/**
 * Load .gitignore patterns from a directory
 */
export function loadGitignorePatterns(dirPath: string): string[] {
  const gitignorePath = path.join(dirPath, '.gitignore');
  if (!fs.existsSync(gitignorePath)) return [];

  try {
    const content = fs.readFileSync(gitignorePath, 'utf-8');
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));
  } catch (error: unknown) {
    return [];
  }
}
