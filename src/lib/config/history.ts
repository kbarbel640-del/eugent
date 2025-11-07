/**
 * Chat History Management
 *
 * Handles persistent chat history stored in .eugent/history.txt
 * Saves conversation messages (not system prompts) for resuming sessions
 */

import fs from 'fs';
import path from 'path';
import type { Message } from '../core/types.js';
import { logger } from '../core/logger.js';

const HISTORY_FILE = path.join(process.cwd(), '.eugent', 'history.txt');

/**
 * Load chat history from .eugent/history.txt
 *
 * @returns Array of messages, or empty array if file doesn't exist or is invalid
 */
export async function loadHistory(): Promise<Message[]> {
  try {
    if (!fs.existsSync(HISTORY_FILE)) {
      return [];
    }

    const content = fs.readFileSync(HISTORY_FILE, 'utf-8');
    if (!content.trim()) {
      return [];
    }

    const messages = JSON.parse(content);

    // Validate that it's an array
    if (!Array.isArray(messages)) {
      logger.warn('History file contains invalid data (not an array), ignoring');
      return [];
    }

    // Basic validation: ensure messages have required properties
    const validMessages = messages.filter((msg: any) => {
      return msg && typeof msg === 'object' && typeof msg.role === 'string';
    });

    if (validMessages.length !== messages.length) {
      logger.warn(`Filtered out ${messages.length - validMessages.length} invalid messages from history`);
    }

    logger.info(`Loaded ${validMessages.length} messages from history`);
    return validMessages as Message[];
  } catch (error: unknown) {
    logger.error('Failed to load chat history:', error);
    return [];
  }
}

/**
 * Save chat history to .eugent/history.txt
 *
 * @param messages - Array of conversation messages to save
 */
export async function saveHistory(messages: Message[]): Promise<void> {
  try {
    const eugentDir = path.dirname(HISTORY_FILE);
    if (!fs.existsSync(eugentDir)) {
      fs.mkdirSync(eugentDir, { recursive: true });
    }

    // Save as formatted JSON for readability
    const content = JSON.stringify(messages, null, 2);
    fs.writeFileSync(HISTORY_FILE, content, 'utf-8');

    logger.info(`Saved ${messages.length} messages to history`);
  } catch (error: unknown) {
    logger.error('Failed to save chat history:', error);
  }
}

/**
 * Delete chat history file
 * Used by /clear command
 */
export async function deleteHistory(): Promise<void> {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      fs.unlinkSync(HISTORY_FILE);
      logger.info('Deleted chat history');
    }
  } catch (error: unknown) {
    logger.error('Failed to delete chat history:', error);
  }
}
