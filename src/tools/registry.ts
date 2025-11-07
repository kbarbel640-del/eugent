import { readFileTool, executeReadFile, ReadFileArgs } from './file/read_file.js';
import { listFilesTool, executeListFiles, ListFilesArgs } from './search/list_files.js';
import { executeCommandTool, executeExecuteCommand, ExecuteCommandArgs } from './execution/execute_command.js';
import { findTool, executeFind, FindArgs } from './search/find.js';
import { grepTool, executeGrep, GrepArgs } from './search/grep.js';
import { writeFileTool, executeWriteFile, WriteFileArgs } from './file/write_file.js';
import { deleteFileTool, executeDeleteFile, DeleteFileArgs } from './file/delete_file.js';
import { editFileTool, executeEditFile, EditFileArgs } from './file/edit_file.js';
import { manageTodosTool, executeManageTodos, ManageTodosArgs } from './project/manage_todos.js';
import { webFetchTool, executeWebFetch, WebFetchArgs } from './web/fetch.js';
import { githubSearchTool, executeGitHubSearch, GitHubSearchArgs } from './web/github_search.js';
import { npmSearchTool, executeNpmSearch, NpmSearchArgs } from './web/npm_search.js';
import { Tool } from '../lib/core/types.js';
import { ToolContext } from './shared/context.js';

type ToolExecutor = (args: any, context?: ToolContext) => string | Promise<string>;

const toolExecutors: Record<string, ToolExecutor> = {
  read_file: executeReadFile,
  list_files: executeListFiles,
  execute_command: executeExecuteCommand,
  find_files: executeFind,
  grep: executeGrep,
  write_file: executeWriteFile,
  delete_file: executeDeleteFile,
  edit_file: executeEditFile,
  manage_todos: executeManageTodos,
  web_fetch: executeWebFetch,
  github_search: executeGitHubSearch,
  npm_search: executeNpmSearch,
};

export const availableTools: Tool[] = [
  readFileTool,
  listFilesTool,
  executeCommandTool,
  findTool,
  grepTool,
  writeFileTool,
  deleteFileTool,
  editFileTool,
  manageTodosTool,
  webFetchTool,
  githubSearchTool,
  npmSearchTool,
];

/**
 * Execute a tool by name with given arguments
 * @param toolName - The name of the tool to execute
 * @param args - Tool-specific arguments (type varies by tool)
 * @param context - Optional execution context (e.g., last tool call for validation)
 * @returns JSON string with tool result or error
 */
export async function executeTool(toolName: string, args: any, context?: ToolContext): Promise<string> {
  const executor = toolExecutors[toolName];
  if (!executor) {
    return JSON.stringify({
      error: `Unknown tool: ${toolName}`,
    });
  }

  try {
    return await executor(args, context);
  } catch (error: unknown) {
    return JSON.stringify({
      error: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}

/**
 * Check if a tool requires user permission based on config
 * @param toolName - The name of the tool to check
 * @param allowedTools - Array of tools that don't require permission (from config)
 * @returns true if permission is required, false if tool is in allowed list
 */
export function requiresPermission(toolName: string, allowedTools: string[]): boolean {
  return !allowedTools.includes(toolName);
}
