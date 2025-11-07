import * as path from 'path';
import { Tool } from '../../lib/core/types.js';
import { getToolDescription, getParameterDescription } from '../../agent/prompts.js';
import type { ToolContext } from '../shared/context.js';
import { logger } from '../../lib/core/logger.js';
import { PathValidator } from '../../lib/security/pathValidator.js';
import { ToolResponse } from '../../lib/tools/responses.js';
import { fileSystem } from '../../lib/filesystem/fileSystemInterface.js';

export interface EditFileArgs {
  file_path: string;
  old_content?: string;
  new_content?: string;
  replace_full?: boolean;
  full_content?: string;
}

export const editFileTool: Tool = {
  type: 'function',
  function: {
    name: 'edit_file',
    description: getToolDescription('edit_file'),
    parameters: {
      type: 'object',
      required: ['file_path'],
      properties: {
        file_path: {
          type: 'string',
          description: getParameterDescription('edit_file', 'file_path'),
        },
        old_content: {
          type: 'string',
          description: getParameterDescription('edit_file', 'old_content'),
        },
        new_content: {
          type: 'string',
          description: getParameterDescription('edit_file', 'new_content'),
        },
        replace_full: {
          type: 'boolean',
          description: getParameterDescription('edit_file', 'replace_full'),
        },
        full_content: {
          type: 'string',
          description: getParameterDescription('edit_file', 'full_content'),
        },
      },
    },
  },
};

/**
 * Execute the edit_file tool
 * Edits an existing file with validation that it was read with read_for_write at any point in the conversation
 * @param args - The file path and edit parameters
 * @param context - Tool execution context including all tool calls from the conversation
 * @returns JSON string with success message or error
 */
export function executeEditFile(args: EditFileArgs, context?: ToolContext): string {
  try {
    const { file_path, old_content, new_content, replace_full, full_content } = args;

    const validation = PathValidator.validateFilePath(file_path, 'edit files');
    if (!validation.valid) {
      return ToolResponse.error(validation.error!);
    }

    const absolutePath = validation.absolutePath!;
    const stats = validation.stats!;
    const cwd = process.cwd();

    // CRITICAL: Validate that the file was read with read_for_write at any point in the conversation
    if (!context || !context.allToolCalls || context.allToolCalls.length === 0) {
      return ToolResponse.error(
        'Cannot edit file: No tool calls found in conversation. You must read the file with read_for_write=true before editing.'
      );
    }

    // Check if this file was read with read_for_write=true at any point in the conversation
    const fileWasRead = context.allToolCalls.some(call => {
      if (call.name !== 'read_file') return false;
      if (!call.args.read_for_write) return false;

      // Normalize path for comparison
      const readFilePath = path.resolve(cwd, call.args.file_path);
      return readFilePath === absolutePath;
    });

    if (!fileWasRead) {
      return ToolResponse.error(
        `Cannot edit file: "${file_path}" has not been read with read_for_write=true in this conversation. You must read the file before editing it.`
      );
    }

    // Validate mode parameters
    if (replace_full) {
      // Full replace mode
      if (full_content === undefined) {
        return ToolResponse.error(
          'Invalid parameters: replace_full=true requires full_content to be provided.'
        );
      }
      if (old_content || new_content) {
        return ToolResponse.error(
          'Invalid parameters: When replace_full=true, old_content and new_content must be empty.'
        );
      }

      // Replace entire file
      fileSystem.writeFileSync(absolutePath, full_content, 'utf-8');
      const newStats = fileSystem.statSync(absolutePath);

      logger.info("File edited (full replace)", {
        path: file_path,
        size: newStats.size,
        lines: full_content.split('\n').length
      });

      return ToolResponse.success({
        file_path,
        mode: 'full_replace',
        size: newStats.size,
        lines: full_content.split('\n').length,
      });
    } else {
      // Search and replace mode
      if (old_content === undefined || new_content === undefined) {
        return ToolResponse.error(
          'Invalid parameters: Search/replace mode requires both old_content and new_content.'
        );
      }
      if (full_content) {
        return ToolResponse.error(
          'Invalid parameters: full_content should only be used with replace_full=true.'
        );
      }

      // Read current file content
      const currentContent = fileSystem.readFileSync(absolutePath, 'utf-8');

      // Check if old_content exists in the file
      if (!currentContent.includes(old_content)) {
        return ToolResponse.error(
          'Search string not found in file. Make sure old_content exactly matches the text you want to replace.'
        );
      }

      // Count occurrences
      const occurrences = currentContent.split(old_content).length - 1;
      if (occurrences > 1) {
        return ToolResponse.error(
          `Ambiguous replacement: old_content appears ${occurrences} times in the file. Please make old_content more specific to match exactly once.`
        );
      }

      // Perform replacement
      const newContent = currentContent.replace(old_content, new_content);
      fileSystem.writeFileSync(absolutePath, newContent, 'utf-8');
      const newStats = fileSystem.statSync(absolutePath);

      logger.info("File edited (search & replace)", {
        path: file_path,
        oldLength: old_content.length,
        newLength: new_content.length,
        finalSize: newStats.size
      });

      return ToolResponse.success({
        file_path,
        mode: 'search_replace',
        size: newStats.size,
        lines: newContent.split('\n').length,
      });
    }
  } catch (error: unknown) {
    return ToolResponse.error(
      `Failed to edit file: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
