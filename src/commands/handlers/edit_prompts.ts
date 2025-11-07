/**
 * Edit Prompts Command
 *
 * Exports all default prompts to .eugent/prompts.toml for easy editing
 */

import * as fs from 'fs';
import * as path from 'path';
import { Command, CommandContext } from './registry.js';
import {
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_TOOL_DESCRIPTIONS,
  DEFAULT_PARAMETER_DESCRIPTIONS,
  DEFAULT_COMPACT_SUMMARY_PROMPT,
  DEFAULT_REPROMPT_PROMPT,
} from '../../agent/prompts.js';

export const editPromptsCommand: Command = {
  name: 'edit_prompts',
  description: 'Export default prompts to .eugent/prompts.toml for editing',
  usage: '/edit_prompts',

  execute: async (args: string[], context: CommandContext) => {
    try {
      const eugentDir = path.join(process.cwd(), '.eugent');
      if (!fs.existsSync(eugentDir)) {
        fs.mkdirSync(eugentDir, { recursive: true });
      }

      const promptsPath = path.join(eugentDir, 'prompts.toml');

      if (fs.existsSync(promptsPath)) {
        context.addMessage({
          role: 'assistant',
          content: `File already exists at: \`.eugent/prompts.toml\`\n\nDelete it first if you want to regenerate the template, or edit it directly to customize prompts.\n\nChanges take effect after restarting eugent.`,
        });
        return;
      }

      const tomlContent = generatePromptsToml();

      fs.writeFileSync(promptsPath, tomlContent, 'utf-8');

      context.addMessage({
        role: 'assistant',
        content: `Created prompts template at: \`.eugent/prompts.toml\`\n\nEdit this file to customize prompts. Changes take effect after restarting eugent.`,
      });
    } catch (error: unknown) {
      context.addMessage({
        role: 'assistant',
        content: `Error creating prompts file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  },
};

/**
 * Generate TOML content with all default prompts
 */
function generatePromptsToml(): string {
  let toml = `# Eugent Custom Prompts
#
# This file allows you to customize all prompts used by Eugent.
# Edit any section below and restart the app to apply changes.
#
# See prompts.md for detailed documentation and examples.

# System Prompt
# This is the main instruction given to the AI
[system]
prompt = """
${DEFAULT_SYSTEM_PROMPT}
"""

# Compact Command Prompt
# Used by /compact to summarize conversation history
[compact]
summary_prompt = """
${DEFAULT_COMPACT_SUMMARY_PROMPT}
"""

# Reprompt Command Prompt
# Used by /reprompt to improve user prompts
[reprompt]
improvement_prompt = """
${DEFAULT_REPROMPT_PROMPT}
"""

# Tool Descriptions
# Customize how each tool is described to the AI

`;

  for (const [toolName, description] of Object.entries(DEFAULT_TOOL_DESCRIPTIONS)) {
    toml += `[tools.${toolName}]\n`;
    toml += `description = """${description}"""\n\n`;

    const params = DEFAULT_PARAMETER_DESCRIPTIONS[toolName];
    if (params && Object.keys(params).length > 0) {
      toml += `[tools.${toolName}.parameters]\n`;
      for (const [paramName, paramDesc] of Object.entries(params)) {
        toml += `${paramName} = """${paramDesc}"""\n`;
      }
      toml += '\n';
    }
  }

  return toml;
}
