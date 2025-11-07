![Eugent Logo](logo.png)

## Eugent - Terminal-based AI coding assistant powered by Mistral AI API.

![Eugent Demo](showcase.gif)

CAUTION: This is an early-stage project. Use with caution and review all changes made by the AI. It may delete your filesystem and may burn a trillion tokens. Set the limits in the admin dashboard of Mistral AI.

## Installation

```bash
npm install -g eugent
```

## Prerequisites

- Node.js 18.0.0 or higher
- Mistral API key from [admin.mistral.ai](https://admin.mistral.ai/)

## Quick Start

1. Install globally:
   ```bash
   npm install -g eugent
   ```

2. Run in any project directory:

   ```bash
   eugent
   ```

3. Set up your API key

4. On first run, you'll be prompted to initialize the project. Press `y` to create a `.eugent/` config folder.

## Features

- **Built-in Tools** - Read, write, edit files, search code, execute commands, fetch web content
- **Permission System** - Configurable tool permissions with interactive prompts
- **Custom Prompts** - TOML-based prompt customization without rebuilding
- **Per-Project Config** - Project-specific settings in `.eugent/config.json`

## Built-in Tools

1. `read_file` - Read file contents with pagination
2. `list_files` - List directory contents with pattern filtering
3. `find_files` - Recursively search for files matching glob patterns
4. `grep` - Search for text/regex patterns across files
5. `write_file` - Create new files (fails if file exists)
6. `edit_file` - Modify existing files (requires read-before-write)
7. `delete_file` - Delete files with safety checks
8. `execute_command` - Run shell commands with timeout
9. `web_fetch` - Fetch and convert web content to markdown
10. `github_search` - Search GitHub repositories and issues
11. `npm_search` - Search npm packages

Additional project management tools: `context_write`, `manage_todos`

All tools respect `.gitignore` and have built-in safety checks.

## Configuration

**Global Config:**
- `~/.eugent/key.txt` - Your Mistral API key (required)
- `~/.eugent/github_token.txt` - Optional GitHub token for higher rate limits

**Per-Project Config (`.eugent/` directory):**

`config.json` - Project settings:
```json
{
  "model": "devstral-medium-2507",
  "temperature": 0.7,
  "allowed_tools": ["read_file", "list_files", "find_files", "grep", "write_file"],
  "enable_logging": false
}
```

Tools in `allowed_tools` don't require permission prompts. `edit_file` and `execute_command` always ask.

`.eugent/prompts.toml` (optional) - Customize AI prompts and tool descriptions. Run `/edit_prompts` to generate a template with all defaults.

## Usage

Start the app:
```bash
eugent
```

Ask questions or request changes. The AI will use tools automatically with permission prompts for risky operations.

**Keyboard Shortcuts:**
- `ESC` - Stop current request
- `Ctrl+C` - Exit application
- `Ctrl+Enter` - New line in input
- `ESC ESC` - Clear input

**Slash Commands:**
- `/help` - Show available commands
- `/clear` - Clear conversation history
- `/context` - AI-powered project context building
- `/show_context` - Display current project context
- `/remember <note>` - Save a note to memory
- `/forget` - Clear all memories
- `/compact` - Summarize conversation to save tokens
- `/edit_prompts` - Export customizable prompt template
- `/reprompt` - Improve last AI response

## Safety Features

**Edit protection** - Must read file with `read_for_write=true` before editing
**Path validation** - All file operations restricted to current directory tree
**Size limits** - 256KB max for file reads/edits
**Gitignore respect** - Won't write to or read from gitignored paths
**Tool call limit** - 10 iterations with option to continue

## License

MIT
