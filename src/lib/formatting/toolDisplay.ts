/**
 * Utility functions for displaying tool information in the UI
 */

/**
 * Format tool arguments for display in the chat log
 * @param toolName - The name of the tool
 * @param args - Tool-specific arguments
 * @returns Formatted string for display
 */
export function formatToolArgs(toolName: string, args: any): string {
  if (!args) return '';

  switch (toolName) {
    case 'read_file': {
      const parts: string[] = [];
      parts.push(`file: "${args.file_path}"`);

      if (args.read_for_write) {
        parts.push('read_for_write: true');
      } else if (args.offset !== undefined && args.offset !== 0) {
        parts.push(`offset: ${args.offset}`);
      }

      return parts.join(', ');
    }

    case 'list_files': {
      const parts: string[] = [];
      const dir = args.directory_path || '.';
      parts.push(`dir: "${dir}"`);

      if (args.pattern) {
        parts.push(`pattern: "${args.pattern}"`);
      }

      parts.push(`gitignored: ${!!args.include_gitignored}`);
      return parts.join(', ');
    }

    case 'execute_command': {
      const parts: string[] = [];
      parts.push(`command: "${args.command}"`);
      if (args.timeout) {
        parts.push(`timeout: ${args.timeout}ms`);
      }
      return parts.join(', ');
    }

    case 'find_files': {
      const parts: string[] = [];
      const pattern = args.pattern || '*';
      parts.push(`pattern: "${pattern}"`);

      const dir = args.directory_path || '.';
      if (dir !== '.') {
        parts.push(`dir: "${dir}"`);
      }

      if (args.include_gitignored) {
        parts.push('gitignored: true');
      }
      return parts.join(', ');
    }

    case 'grep': {
      const parts: string[] = [];
      parts.push(`pattern: "${args.pattern}"`);

      const dir = args.directory_path || '.';
      if (dir !== '.') {
        parts.push(`dir: "${dir}"`);
      }

      if (args.file_pattern) {
        parts.push(`files: "${args.file_pattern}"`);
      }

      if (args.case_sensitive) {
        parts.push('case-sensitive');
      }
      return parts.join(', ');
    }

    case 'write_file': {
      const parts: string[] = [];
      parts.push(`file: "${args.file_path}"`);

      const lines = args.content ? args.content.split('\n').length : 0;
      parts.push(`${lines} lines`);

      return parts.join(', ');
    }

    case 'edit_file': {
      const parts: string[] = [];
      parts.push(`file: "${args.file_path}"`);

      if (args.replace_full) {
        parts.push('mode: full_replace');
      } else {
        parts.push('mode: search_replace');
      }

      return parts.join(', ');
    }

    case 'continue_execution': {
      return `Tool limit reached (${args.current_count} calls). Allow ${args.additional} more iterations?`;
    }

    default:
      return Object.entries(args)
        .map(([key, val]) => `${key}: ${JSON.stringify(val)}`)
        .join(', ');
  }
}
