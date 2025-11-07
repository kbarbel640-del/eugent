/**
 * Memory Management
 *
 * Handles persistent memories stored in .eugent/memory.md
 */

import fs from 'fs';
import path from 'path';

const MEMORY_FILE = path.join(process.cwd(), '.eugent', 'memory.md');

/**
 * Load memories from .eugent/memory.md
 *
 * @returns The memory content, or null if file doesn't exist
 */
export async function loadMemories(): Promise<string | null> {
  try {
    if (!fs.existsSync(MEMORY_FILE)) {
      return null;
    }

    const content = fs.readFileSync(MEMORY_FILE, 'utf-8');
    return content.trim() || null;
  } catch (error: unknown) {
    return null;
  }
}

/**
 * Save a memory to .eugent/memory.md (appends)
 *
 * @param text - Text to save
 */
export async function saveMemory(text: string): Promise<void> {
  const eugentDir = path.dirname(MEMORY_FILE);
  if (!fs.existsSync(eugentDir)) {
    fs.mkdirSync(eugentDir, { recursive: true });
  }

  const timestamp = new Date().toISOString();
  const entry = `- [${timestamp}] ${text}\n`;

  fs.appendFileSync(MEMORY_FILE, entry, 'utf-8');
}

/**
 * Clear all memories (delete memory.md)
 */
export async function clearMemories(): Promise<void> {
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      fs.unlinkSync(MEMORY_FILE);
    }
  } catch (error: unknown) {
  }
}
