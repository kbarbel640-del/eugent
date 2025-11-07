/**
 * Project Context Management
 *
 * Handles loading project context from .eugent/context.md
 */

import fs from 'fs';
import path from 'path';

const CONTEXT_FILE = path.join(process.cwd(), '.eugent', 'context.md');

/**
 * Load project context from .eugent/context.md
 *
 * @returns The context content, or null if file doesn't exist
 */
export async function loadContext(): Promise<string | null> {
  try {
    if (!fs.existsSync(CONTEXT_FILE)) {
      return null;
    }

    const content = fs.readFileSync(CONTEXT_FILE, 'utf-8');
    return content.trim() || null;
  } catch (error: unknown) {
    // Silently fail if can't read context
    return null;
  }
}

/**
 * Check if context file exists
 *
 * @returns true if .eugent/context.md exists, false otherwise
 */
export function contextExists(): boolean {
  try {
    return fs.existsSync(CONTEXT_FILE);
  } catch (error: unknown) {
    return false;
  }
}
