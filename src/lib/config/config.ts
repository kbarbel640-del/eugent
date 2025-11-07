import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface ProjectConfig {
  model: string;
  temperature?: number;
  maxTokens?: number;
  allowed_tools?: string[]; // Tools that don't require permission. Empty = all require permission
  enable_logging?: boolean; // Enable debug logging to .eugent/logs/ (default: false)
  reprompt_model?: string; // Model to use for /reprompt command (defaults to main model)
}

export const DEFAULT_CONFIG: ProjectConfig = {
  model: "devstral-medium-2507",
  temperature: 0.8,
  enable_logging: false, // Logging disabled by default
  reprompt_model: "devstral-medium-2507", // Model for /reprompt command
  // Tools that don't require permission (safe, read-only or low-risk operations)
  // edit_file and execute_command are NOT in this list and will always ask for permission
  allowed_tools: [
    "read_file",
    "list_files",
    "find_files",
    "grep",
    "write_file",
  ],
};

export const GLOBAL_DIR = path.join(os.homedir(), ".eugent");
const GLOBAL_KEY_FILE = path.join(GLOBAL_DIR, "key.txt");
const PROJECT_DIR = ".eugent";
const PROJECT_CONFIG_FILE = path.join(PROJECT_DIR, "config.json");

/**
 * Get the Mistral API key from ~/.eugent/key.txt
 */
export function getApiKey(): string | null {
  try {
    if (fs.existsSync(GLOBAL_KEY_FILE)) {
      return fs.readFileSync(GLOBAL_KEY_FILE, "utf-8").trim();
    }
    return null;
  } catch (error: unknown) {
    return null;
  }
}

/**
 * Save the Mistral API key to ~/.eugent/key.txt
 */
export function saveApiKey(apiKey: string): void {
  if (!fs.existsSync(GLOBAL_DIR)) {
    fs.mkdirSync(GLOBAL_DIR, { recursive: true });
  }
  fs.writeFileSync(GLOBAL_KEY_FILE, apiKey.trim(), "utf-8");
}

/**
 * Check if current directory has a .eugent/ project initialized
 */
export function isProjectInitialized(): boolean {
  return fs.existsSync(PROJECT_DIR) && fs.existsSync(PROJECT_CONFIG_FILE);
}

/**
 * Load project config from .eugent/config.json
 */
export function loadProjectConfig(): ProjectConfig {
  try {
    if (fs.existsSync(PROJECT_CONFIG_FILE)) {
      const data = fs.readFileSync(PROJECT_CONFIG_FILE, "utf-8");
      return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    }
  } catch (error: unknown) {
  }
  return DEFAULT_CONFIG;
}

/**
 * Save project config to .eugent/config.json
 */
export function saveProjectConfig(config: ProjectConfig): void {
  if (!fs.existsSync(PROJECT_DIR)) {
    fs.mkdirSync(PROJECT_DIR, { recursive: true });
  }
  fs.writeFileSync(
    PROJECT_CONFIG_FILE,
    JSON.stringify(config, null, 2),
    "utf-8",
  );
}

/**
 * Initialize a new project with default config
 */
export function initializeProject(): void {
  if (!fs.existsSync(PROJECT_DIR)) {
    fs.mkdirSync(PROJECT_DIR, { recursive: true });
  }
  saveProjectConfig(DEFAULT_CONFIG);
  ensureEugentGitignore();
}

/**
 * Create .eugent/.gitignore to ignore all files in the .eugent directory
 * Called on every startup to ensure git ignores all eugent files
 * This way there's zero trace of eugent in version control
 */
export function ensureEugentGitignore(): void {
  // Ensure .eugent directory exists first
  if (!fs.existsSync(PROJECT_DIR)) {
    return; // Don't create gitignore if .eugent doesn't exist yet
  }

  const gitignorePath = path.join(PROJECT_DIR, '.gitignore');
  const content = '# Ignore everything in .eugent/\n*\n';

  try {
    fs.writeFileSync(gitignorePath, content, 'utf-8');
  } catch (error) {
    // Silently fail if we can't write .gitignore
  }
}

/**
 * Get the current working directory name
 */
export function getCurrentDirName(): string {
  return path.basename(process.cwd());
}
