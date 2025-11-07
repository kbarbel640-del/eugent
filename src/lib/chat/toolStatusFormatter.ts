/**
 * Tool Status Formatter
 * Generates user-friendly status messages for tool execution
 */

/**
 * Format a status message for tool execution
 * Shows tool name with relevant argument details
 * @param toolName - Name of the tool being executed
 * @param args - Tool arguments
 * @returns Formatted status string (e.g., " (file.ts)" or " (grep pattern)")
 */
export function formatToolStatus(toolName: string, args: any): string {
  const formatters: Record<string, (args: any) => string> = {
    execute_command: (args) => args.command ? ` (${args.command})` : '',
    read_file: (args) => args.file_path ? ` (${args.file_path})` : '',
    write_file: (args) => args.file_path ? ` (${args.file_path})` : '',
    edit_file: (args) => args.file_path ? ` (${args.file_path})` : '',
    delete_file: (args) => args.file_path ? ` (${args.file_path})` : '',
    list_files: (args) => args.directory_path ? ` (${args.directory_path})` : ' (current directory)',
    find_files: (args) => args.pattern ? ` (${args.pattern})` : '',
    grep: (args) => args.pattern ? ` ("${args.pattern}")` : '',
  };

  const formatter = formatters[toolName];
  return formatter ? formatter(args) : '';
}
