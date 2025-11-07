/**
 * Command Index
 *
 * Imports and registers all available commands
 */

import { registerCommand } from './registry.js';
import { helpCommand } from './help.js';
import { clearCommand } from './clear.js';
import { rememberCommand } from './remember.js';
import { forgetCommand } from './forget.js';
import { editPromptsCommand } from './edit_prompts.js';
import { compactCommand } from './compact.js';
import { showContextCommand } from './show_context.js';
import { contextCommand } from './context.js';
import { repromptCommand } from './reprompt.js';

registerCommand(helpCommand);
registerCommand(clearCommand);
registerCommand(rememberCommand);
registerCommand(forgetCommand);
registerCommand(editPromptsCommand);
registerCommand(compactCommand);
registerCommand(showContextCommand);
registerCommand(contextCommand);
registerCommand(repromptCommand);

export { executeCommand, getAllCommands, getCommand } from './registry.js';
export type { Command, CommandContext } from './registry.js';
