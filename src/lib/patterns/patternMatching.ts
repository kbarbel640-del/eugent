/**
 * Pattern Matching Utilities
 *
 * Centralized glob pattern matching logic used across tool modules.
 * Converts glob patterns (*, ?, **) to regex patterns.
 */

import * as path from 'path';

/**
 * Simple pattern matching for filenames.
 * Used by find_files and grep tools.
 *
 * Patterns:
 * - * matches any characters
 * - ? matches single character
 * - . is escaped (literal dot)
 *
 * @param filename - Filename to test
 * @param pattern - Glob pattern (e.g., "*.ts", "test*")
 * @returns True if filename matches pattern
 */
export function matchesSimplePattern(filename: string, pattern: string): boolean {
  // Convert glob pattern to regex
  let regexPattern = pattern
    .replace(/\./g, '\\.') // Escape dots
    .replace(/\*/g, '.*') // * matches any chars
    .replace(/\?/g, '.'); // ? matches single char

  // Add anchors
  regexPattern = '^' + regexPattern + '$';

  const regex = new RegExp(regexPattern);
  return regex.test(filename);
}

/**
 * Path-aware pattern matching for file paths.
 * Used by list_files tool.
 *
 * Patterns:
 * - ** matches any number of directories (including /)
 * - * matches any characters except /
 * - ? matches single character
 * - . is escaped (literal dot)
 *
 * Tests against both full path and basename.
 *
 * @param filePath - File path to test
 * @param pattern - Glob pattern (e.g., "**\/*.ts", "src\/*")
 * @returns True if path matches pattern
 */
export function matchesPathPattern(filePath: string, pattern: string): boolean {
  // Convert glob pattern to regex
  // ** matches any number of directories
  // * matches any characters except /
  // ? matches single character

  let regexPattern = pattern
    .replace(/\./g, '\\.') // Escape dots
    .replace(/\*\*/g, '<<<DOUBLESTAR>>>') // Temporarily replace **
    .replace(/\*/g, '[^/]*') // * matches anything except /
    .replace(/<<<DOUBLESTAR>>>/g, '.*') // ** matches anything including /
    .replace(/\?/g, '.'); // ? matches single char

  // Add anchors
  regexPattern = '^' + regexPattern + '$';

  const regex = new RegExp(regexPattern);
  const fileName = path.basename(filePath);

  // Match against both full path and just filename
  return regex.test(filePath) || regex.test(fileName);
}
