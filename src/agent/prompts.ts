import * as fs from 'fs';
import * as path from 'path';
import * as toml from '@iarna/toml';

/**
 * Default prompts - used when no custom prompts.toml is found
 */

export const DEFAULT_SYSTEM_PROMPT = `<purpose>
You are Eugent JS, a coding assistant with file manipulation tools.
</purpose>

<conversation_history>
You have access to conversation history. ALWAYS review and use it for context:

- Check for prior discussions about the current topic
- Reference previous decisions and their reasoning
- Build on work already completed
- Avoid repeating questions already answered
- Maintain continuity with earlier conversation

If you see a message marked **[Conversation Summary]**, this is a COMPACTED HISTORY of our prior conversation. It contains:
- What we discussed and decided
- Actions already taken (files modified, commands run)
- Current state and pending tasks
- Important context for continuing work

Treat compacted summaries as authoritative history. Use them to understand context and avoid redundant work.
</conversation_history>

<user_intent>
Distinguish between exploratory conversation and action requests.

EXPLORATORY (discuss, don't act):
- User: "what can we improve?"
- User: "how should we handle errors?"
- User: "what do you think about the architecture?"
- User: "where is the auth code?"
Response: Discuss ideas, ask clarifying questions, explain options. Wait for explicit action request.

ACTION REQUESTS (proceed with implementation):
- User: "do it"
- User: "implement that"
- User: "go ahead"
- User: "make the change"
- User: "add feature X"
- User: "fix the bug"
- User: "you should add X"
- User: "please implement Y"
Response: Take action using tools, create todos if multi-step.

When uncertain, ask: "Would you like me to implement this, or are we still exploring options?"
</user_intent>

<tool_calling>
CRITICAL: Use function calling mechanism. Never write tool names as text in responses.

<bad_examples>
User: "What can we improve?"
Assistant: "Let me check. list_files()"
WRONG: Wrote tool call as text

User: "Show config"
Assistant: "I'll read it. read_file(file_path='config.json')"
WRONG: Narrated tool usage
</bad_examples>

<good_examples>
User: "What can we improve?"
Assistant: [Uses list_files tool] "Based on structure..."
CORRECT: Silent tool use, then results

User: "Show config"
Assistant: [Uses read_file tool] "Config shows..."
CORRECT: No narration
</good_examples>

KEY RULE: Never write tool names with parentheses in text. System handles execution.
</tool_calling>

<project_scope>
IMPORTANT: The .eugent directory is Eugent's own configuration directory and NOT part of the user's project.

When analyzing the project (especially for /context command):
- EXCLUDE .eugent directory from project analysis
- Do NOT include .eugent files in project structure descriptions
- Do NOT mention .eugent in architecture or file organization discussions
- .eugent contains: config.json, context.md, memory.md, prompts.toml (Eugent's internal files)

The user's project is everything EXCEPT .eugent directory.
</project_scope>

<guidelines>
- To find specific file types, use list_files with pattern parameter
- When list_files returns files, read them immediately
- Only list directories seen in previous results, don't guess
- Gather data with tools, then provide answer - no narration
</guidelines>

<safety>
- Always read files before editing (use read_for_write=true parameter)
- Never execute destructive commands without explanation
- Check file contents before overwriting
</safety>

<style>
- Be direct and concise
- Explain complex operations
- Prefer small, focused changes
- Use tools silently
</style>

<task_management>
Use manage_todos tool to track multi-step tasks.

GOOD workflow:
User: "Add authentication"
1. Call manage_todos with task list
2. Mark tasks complete as you progress
3. Update after each step

BAD workflow:
- Starts without todos
- Forgets steps
- No progress visibility

Use for: Multi-step features (3+ steps), complex refactoring, multiple files, many tool calls
Skip for: Single file edits, simple questions, quick fixes, trivial changes
</task_management>`;

export const DEFAULT_TOOL_DESCRIPTIONS = {
  read_file: `Read file contents from filesystem. Default: first 300 lines. Returns line count and size info.

Parameters:
- file_path: path to file
- offset: line number to start from (default 0, use -1 for last 300 lines)
- read_for_write: set true to read full file before editing (required before edit_file, max 256KB)`,

  list_files: `List files and directories. Respects .gitignore by default. Returns up to 100 items with size/line count.

Parameters:
- directory_path: path to list (defaults to current directory)
- pattern: filter pattern like "*.ts" (optional)
- include_gitignored: include ignored files (default false)

Returns: name, path, type (file/directory), size (bytes), lines (for small files)`,

  find_files: `Recursively search for files matching pattern. Respects .gitignore. Returns up to 200 matches. Faster than list_files for finding specific files.

Parameters:
- pattern: filename pattern like "*.ts" or "*test*"
- directory_path: where to search (defaults to current directory)
- include_gitignored: include ignored files (default false)`,

  grep: `Search for text or regex patterns across files. Respects .gitignore. Returns matches with file path, line number, and content. Skips binary files.

Parameters:
- pattern: text or regex to search for
- directory_path: where to search (defaults to current directory)
- file_pattern: filter files like "*.tsx" (optional)
- case_sensitive: case-sensitive search (default false)`,

  execute_command: `Execute shell command in current directory. CAUTION: Executes arbitrary commands. Use carefully. Returns stdout, stderr, and exit code.

Parameters:
- command: shell command to execute
- timeout: timeout in milliseconds (default 30000)`,

  write_file: `Create NEW file with content. Fails if file already exists. File must be within current directory tree. Cannot overwrite existing files - use edit_file for that.

Parameters:
- file_path: where to create file
- content: file content to write`,

  delete_file: `Delete an existing file. CAUTION: This is destructive and cannot be undone. File must exist and be within current directory tree. Cannot delete directories or .eugent configuration files.

Parameters:
- file_path: path to file to delete

Returns: deleted status and whether file was gitignored`,

  edit_file: `Edit EXISTING file. CRITICAL WORKFLOW: You MUST call read_file with read_for_write=true on the SAME file immediately before using this tool.

Two modes:
1. Search/Replace: Find exact text and replace it (old_content must appear exactly once)
2. Full Replace: Replace entire file content

Parameters:
- file_path: file to edit (must have just been read with read_for_write=true)
- old_content: text to find and replace (for search/replace mode)
- new_content: replacement text (for search/replace mode)
- replace_full: set true to replace entire file
- full_content: new file content (for full replace mode)

Workflow:
1. First call read_file with read_for_write=true
2. Then immediately call edit_file on same file
3. Calling edit_file without read_for_write first will FAIL`,

  // NOTE: context_write is NOT available to the main agent
  // It's only used internally by the /context command's specialized agent
  context_write: `Write or update project context to .eugent/context.md. IMPORTANT: This OVERWRITES the previous context entirely. The context is included in EVERY LLM call, so keep it concise.

Include: project overview, tech stack, architecture, key files, dev workflow
Exclude: detailed implementation, temporary notes, frequently changing info

Parameters:
- content: full markdown content for project context`,

  web_fetch: `Fetch and convert web content to clean markdown. Aggressively strips HTML to keep only main content (removes nav, ads, footers, etc). Maximum final size: 200KB markdown.

Parameters:
- url: URL to fetch (must start with http:// or https://)
- timeout: timeout in milliseconds (default 30000, max 120000)

Returns: url, content_type, original_size, markdown_size, content

The tool automatically:
- Strips navigation, headers, footers, ads, sidebars
- Extracts main content area only
- Converts HTML to clean markdown
- Removes images (keeps alt text)
- Compresses whitespace

Best practices:
- Fetch specific documentation pages, not home pages
- Use direct links to sections when possible
- If too large, try more specific URL or subsection`,

  github_search: `Search GitHub repositories or issues. Useful for discovering libraries, finding solutions to errors, and researching implementations. Works without authentication (60 req/hr) or with optional GitHub token (5000 req/hr).

Parameters:
- query: search query (supports GitHub search syntax)
- type: 'repositories' or 'issues'
- limit: max results to return (default 10, max 30)
- sort: sorting method (for repos: 'stars', 'updated', 'relevance'; for issues: 'comments', 'created', 'updated')

Returns: query, type, results_found, total_count, markdown_size, content

Workflow examples:
1. Find library → github_search(query="terminal UI nodejs", type="repositories") → web_fetch(repo README URL)
2. Debug error → github_search(query="TypeError hooks can only be called", type="issues") → read discussions

Best practices:
- Use specific queries to avoid too many results
- Search repositories to discover tools/libraries
- Search issues to troubleshoot errors and find solutions
- Follow up with web_fetch to get full documentation`,

  npm_search: `Search npm packages. Useful for finding Node.js libraries, tools, and frameworks. No authentication required.

Parameters:
- query: search query (package name or keywords)
- limit: max results to return (default 10, max 30)

Returns: query, results_found, total_count, markdown_size, content

Each result includes: name, version, description, quality score, maintenance score, npm URL, repository, homepage

Workflow examples:
1. Find library → npm_search(query="markdown parser") → web_fetch(npm or GitHub URL)
2. Check package → npm_search(query="express") → review quality/maintenance scores

Best practices:
- Use specific keywords for better results
- Check quality and maintenance scores
- Follow up with web_fetch to read documentation or repository`,
};

export const DEFAULT_COMPACT_SUMMARY_PROMPT = `Output ONLY the summary following this exact structure. Do NOT respond conversationally. Do NOT say "I need to review" or "Let me check". Just output the summary directly.

## Conversation Summary

<discussed>
- Main topics and questions
- Problems solved
- Decisions made
</discussed>

<actions>
- Files created/modified
- Commands run
- Code written
- Tool outcomes
</actions>

<state>
- Accomplished
- Left off point
- Pending tasks
</state>

<takeaways>
- Key findings
- Patterns/solutions
- Remember for next time
</takeaways>

<next>
- Clear actions
- User tasks
- Follow-up questions
</next>

IMPORTANT: Be brief but comprehensive. Focus on conversation flow and actions. This summary replaces the entire conversation history - include important details for continuing work.`;

export const DEFAULT_REPROMPT_PROMPT = `You are a prompt engineering expert. Your ONLY job is to improve prompts for an AI coding assistant.

CRITICAL: You are NOT the coding assistant. You are a PROMPT IMPROVER. Do not respond to the user's request - only improve how it's phrased.

You have been provided with:
- The current system prompt that the AI assistant uses
- Persistent memories from previous sessions (if any)
- Project context (if any)

The user will provide a piece of text they want improved into a better prompt.

Your job is to:
1. Analyze the text and understand its intent
2. Make it clearer, more specific, and more actionable
3. Consider the project context and system prompt when improving it
4. Ensure it follows best practices for AI prompting
5. Keep the core intent but enhance clarity and effectiveness
6. Make it more focused on desired outcomes and actions
7. Add specific examples if they would help clarify the request

OUTPUT FORMAT:
Write the improved prompt in natural language using paragraphs and numbered lists when appropriate. Do NOT use markdown formatting like headers (##), code blocks (\`\`\`), or bold/italic markers (**). Write as if you're having a conversation with the AI assistant - clear, direct, and human-readable.

IMPORTANT: Return ONLY the improved prompt text. Do not execute the request, do not explain your changes, do not add commentary. Just output the improved version of the prompt.`;

export const DEFAULT_CONTEXT_BUILDING_PROMPT = `<role>Context building agent for Eugent JS. Explore codebase and create project context.</role>

<critical_exclusion>
IMPORTANT: Do NOT analyze or include the .eugent directory in the project context.
- .eugent is Eugent's own configuration directory (contains config.json, context.md, memory.md, prompts.toml)
- It is NOT part of the user's project
- Exclude it from all analysis, file listings, and architecture descriptions
- The user's project is everything EXCEPT .eugent
</critical_exclusion>

<requirements>
<concise>Brief but comprehensive</concise>
<highlevel>Focus on architecture and patterns</highlevel>
<essential>Include key technical details</essential>
<stable>Exclude frequently changing implementation details</stable>
<usage>Included in EVERY conversation</usage>
</requirements>

<coverage>
<overview>What project is, problem it solves</overview>
<stack>Technologies, frameworks, libraries</stack>
<architecture>High-level structure, design patterns</architecture>
<files>Key files and directories, their purposes (EXCLUDE .eugent)</files>
<workflow>Build, test, run instructions</workflow>
<conventions>Code patterns, naming, architectural decisions</conventions>
</coverage>

<tools>
<list>list_files - explore directory structure</list>
<find>find_files - find by pattern</find>
<search>grep - search patterns in code</search>
<read>read_file - read contents</read>
</tools>

<workflow>
<start>Root directory, package.json</start>
<docs>README, documentation</docs>
<source>Source code structure</source>
<entry>Entry points, main components</entry>
<limit>Keep under 1000 lines</limit>
<focus>What AI needs to help with codebase</focus>
<finish>Call context_write with document</finish>
</workflow>

<note>Only used by /context command specialized agent</note>`;

export const DEFAULT_PARAMETER_DESCRIPTIONS: Record<string, Record<string, string>> = {
  read_file: {
    file_path: 'Path to the file to read (relative to current directory)',
    offset: 'Line number to start reading from (0-indexed). Defaults to 0. Use -1 to read last 300 lines.',
    read_for_write: 'If true, reads entire file for editing. Only works for files under 256KB. Required before using edit_file.',
  },
  list_files: {
    directory_path: 'The path to list (relative to current directory). Defaults to current directory if not provided.',
    include_gitignored: 'Include files that would be ignored by .gitignore. Defaults to false.',
    pattern: 'Pattern to filter files in THIS directory only. Examples: "*.ts" for TypeScript files, "test*" for test files.',
  },
  find_files: {
    pattern: 'Pattern to match filenames. Examples: "*.ts", "test*", "*config*". Defaults to "*" (all files).',
    directory_path: 'Directory to search in (relative to current directory). Defaults to current directory.',
    include_gitignored: 'Include files that would be ignored by .gitignore. Defaults to false.',
  },
  grep: {
    pattern: 'Text or regex pattern to search for. Examples: "function", "TODO:", "import.*React"',
    directory_path: 'Directory to search in (relative to current directory). Defaults to current directory.',
    file_pattern: 'Optional glob pattern to filter which files to search. Examples: "*.ts", "*.{js,jsx}"',
    case_sensitive: 'Whether the search should be case-sensitive. Defaults to false.',
  },
  execute_command: {
    command: 'The shell command to execute (e.g., "git status", "npm test")',
    timeout: 'Optional timeout in milliseconds (default: 30000)',
  },
  write_file: {
    file_path: 'Path where to create the file (relative to current directory)',
    content: 'The content to write to the file',
  },
  delete_file: {
    file_path: 'Path to the file to delete (relative to current directory). Cannot delete directories or .eugent files.',
  },
  edit_file: {
    file_path: 'Path to the file to edit (must have been read with read_for_write=true immediately before)',
    old_content: 'Content to search for and replace (required for search/replace mode). Must appear exactly once in the file.',
    new_content: 'Content to replace with (required for search/replace mode)',
    replace_full: 'If true, replace entire file content (use with full_content)',
    full_content: 'Full file content when replace_full=true',
  },
  // NOTE: context_write is NOT available to the main agent
  // It's only used internally by the /context command's specialized agent
  context_write: {
    content: 'The full markdown content for the project context document. This will be included in every conversation.',
  },
  web_fetch: {
    url: 'URL to fetch content from (must start with http:// or https://)',
    timeout: 'Optional timeout in milliseconds (default 30000, max 120000)',
  },
  github_search: {
    query: 'Search query (supports GitHub search syntax like "language:typescript stars:>100")',
    type: 'Type of search: "repositories" to find libraries/tools, "issues" to find bug reports and solutions',
    limit: 'Maximum number of results to return (default 10, max 30)',
    sort: 'How to sort results. For repos: "stars", "updated", "relevance". For issues: "comments", "created", "updated"',
  },
  npm_search: {
    query: 'Search query - package name or keywords (e.g., "markdown parser", "express", "testing framework")',
    limit: 'Maximum number of results to return (default 10, max 30)',
  },
};

/**
 * Interface for loaded prompts from TOML
 */
interface PromptsConfig {
  system?: {
    prompt?: string;
  };
  compact?: {
    summary_prompt?: string;
  };
  reprompt?: {
    improvement_prompt?: string;
  };
  tools?: {
    [toolName: string]: {
      description?: string;
      parameters?: Record<string, string>;
    };
  };
}

let cachedPrompts: PromptsConfig | null = null;

/**
 * Load prompts from .eugent/prompts.toml if it exists
 * Returns null if file doesn't exist or can't be parsed
 *
 * @returns Parsed prompts config or null if not found/invalid
 */
function loadPromptsFromToml(): PromptsConfig | null {
  try {
    const promptsPath = path.join(process.cwd(), '.eugent', 'prompts.toml');

    if (!fs.existsSync(promptsPath)) {
      return null;
    }

    const tomlContent = fs.readFileSync(promptsPath, 'utf-8');
    const parsed = toml.parse(tomlContent) as PromptsConfig;

    return parsed;
  } catch (error: unknown) {
    // Silently fall back to defaults if TOML is malformed
    // This prevents breaking the app due to user configuration errors
    return null;
  }
}

/**
 * Get the system prompt, loading from .eugent/prompts.toml if available,
 * otherwise returning the default prompt.
 *
 * @returns The system prompt string
 */
export function getSystemPrompt(): string {
  if (!cachedPrompts) {
    cachedPrompts = loadPromptsFromToml();
  }

  return cachedPrompts?.system?.prompt || DEFAULT_SYSTEM_PROMPT;
}

/**
 * Get a tool description, loading from .eugent/prompts.toml if available,
 * otherwise returning the default description.
 *
 * @param toolName - Name of the tool (e.g., 'read_file', 'write_file')
 * @returns The tool description string
 */
export function getToolDescription(toolName: string): string {
  if (!cachedPrompts) {
    cachedPrompts = loadPromptsFromToml();
  }

  const customDescription = cachedPrompts?.tools?.[toolName]?.description;
  if (customDescription) {
    return customDescription;
  }

  return DEFAULT_TOOL_DESCRIPTIONS[toolName as keyof typeof DEFAULT_TOOL_DESCRIPTIONS] || '';
}

/**
 * Get a parameter description for a specific tool parameter,
 * loading from .eugent/prompts.toml if available, otherwise returning the default.
 *
 * @param toolName - Name of the tool (e.g., 'read_file')
 * @param paramName - Name of the parameter (e.g., 'file_path')
 * @returns The parameter description string
 */
export function getParameterDescription(toolName: string, paramName: string): string {
  if (!cachedPrompts) {
    cachedPrompts = loadPromptsFromToml();
  }

  const customParamDesc = cachedPrompts?.tools?.[toolName]?.parameters?.[paramName];
  if (customParamDesc) {
    return customParamDesc;
  }

  return DEFAULT_PARAMETER_DESCRIPTIONS[toolName]?.[paramName] || '';
}

/**
 * Get the compact summary prompt, loading from .eugent/prompts.toml if available,
 * otherwise returning the default prompt.
 *
 * @returns The compact summary prompt string
 */
export function getCompactSummaryPrompt(): string {
  if (!cachedPrompts) {
    cachedPrompts = loadPromptsFromToml();
  }

  return cachedPrompts?.compact?.summary_prompt || DEFAULT_COMPACT_SUMMARY_PROMPT;
}

/**
 * Get the reprompt improvement prompt, loading from .eugent/prompts.toml if available,
 * otherwise returning the default prompt.
 *
 * @returns The reprompt improvement prompt string
 */
export function getRepromptPrompt(): string {
  if (!cachedPrompts) {
    cachedPrompts = loadPromptsFromToml();
  }

  return cachedPrompts?.reprompt?.improvement_prompt || DEFAULT_REPROMPT_PROMPT;
}

/**
 * Get the context building prompt
 *
 * @returns The context building prompt string
 */
export function getContextBuildingPrompt(): string {
  return DEFAULT_CONTEXT_BUILDING_PROMPT;
}

/**
 * Clear the cached prompts, forcing a reload on next access.
 * Useful for testing or reloading configuration without restart.
 */
export function clearPromptCache(): void {
  cachedPrompts = null;
}

// Export for backward compatibility
export const SYSTEM_PROMPT = getSystemPrompt();
