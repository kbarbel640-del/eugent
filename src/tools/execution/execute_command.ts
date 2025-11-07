import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { Tool } from '../../lib/core/types.js';
import { getToolDescription, getParameterDescription } from '../../agent/prompts.js';
import type { ToolContext } from '../shared/context.js';
import { logger } from '../../lib/core/logger.js';

const execAsync = promisify(exec);

export interface ExecuteCommandArgs {
  command: string;
  timeout?: number;
}

async function findAllDescendants(pid: number): Promise<number[]> {
  const descendants: Set<number> = new Set();
  const toProcess: number[] = [pid];

  while (toProcess.length > 0) {
    const currentPid = toProcess.pop()!;

    if (descendants.has(currentPid)) {
      continue;
    }

    descendants.add(currentPid);

    try {
      const { stdout } = await execAsync(`pgrep -P ${currentPid}`, {
        timeout: 500,
      });

      const children = stdout
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(pid => parseInt(pid, 10))
        .filter(pid => !isNaN(pid));

      toProcess.push(...children);
    } catch {
    }
  }

  return Array.from(descendants);
}

async function killProcessTree(pid: number): Promise<void> {
  try {
    const allPids = await findAllDescendants(pid);
    logger.debug("Abort: Killing process tree", { pid, totalProcesses: allPids.length });

    // Kill in reverse order (children before parents) to avoid zombie processes
    const sortedPids = allPids.reverse();

    for (const pidToKill of sortedPids) {
      try {
        process.kill(pidToKill, 'SIGKILL');
      } catch {
      }
    }
  } catch (error) {
    logger.warn("Abort: Error killing process tree, trying direct kill", {
      pid,
      error: error instanceof Error ? error.message : String(error),
    });
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
    }
  }
}

export const executeCommandTool: Tool = {
  type: 'function',
  function: {
    name: 'execute_command',
    description: getToolDescription('execute_command'),
    parameters: {
      type: 'object',
      required: ['command'],
      properties: {
        command: {
          type: 'string',
          description: getParameterDescription('execute_command', 'command'),
        },
        timeout: {
          type: 'number',
          description: getParameterDescription('execute_command', 'timeout'),
        },
      },
    },
  },
};

/**
 * Execute a shell command
 * Requires user permission via the permission system
 * @param args - The command and optional timeout
 * @param context - Execution context with abort signal
 * @returns JSON string with command output or error
 */
export function executeExecuteCommand(
  args: ExecuteCommandArgs,
  context?: ToolContext
): Promise<string> {
  return new Promise((resolve) => {
    const { command, timeout = 30000 } = args;

    let stdout = '';
    let stderr = '';
    let killed = false;
    let resolved = false;
    let timeoutHandle: NodeJS.Timeout | null = null;

    if (context?.signal?.aborted) {
      resolved = true;
      resolve(
        JSON.stringify({
          error: 'ABORTED: User pressed ESC to stop this command. The command was intentionally cancelled and did not complete.',
          aborted: true,
          command,
          stdout: '',
          stderr: '',
        })
      );
      return;
    }

    // Use detached: false to ensure process is in our process group
    const child = spawn(command, {
      shell: true,
      cwd: process.cwd(),
    });

    if (context?.signal) {
      const abortHandler = async () => {
        killed = true;

        if (child.pid) {
          await killProcessTree(child.pid);

          // This prevents hanging on unkillable processes
          setTimeout(() => {
            if (killed && !resolved) {
              logger.debug("Abort: Force-resolving after 2s timeout");
              resolved = true;
              resolve(
                JSON.stringify({
                  error: 'ABORTED: Process tree killed. The command was terminated forcefully.',
                  aborted: true,
                  command,
                  stdout: stdout.trim(),
                  stderr: stderr.trim(),
                })
              );
            }
          }, 2000);
        }
      };

      if (context.signal.aborted) {
        abortHandler();
      } else {
        context.signal.addEventListener('abort', abortHandler, { once: true });
      }
    }

    if (timeout > 0) {
      timeoutHandle = setTimeout(() => {
        killed = true;
        if (child.pid) {
          try {
            process.kill(-child.pid, 'SIGKILL');
          } catch {
            child.kill('SIGKILL');
          }
        }
      }, timeout);
    }

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
      if (stdout.length > 1024 * 1024 * 10) {
        killed = true;
        child.kill('SIGKILL');
      }
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
      if (stderr.length > 1024 * 1024 * 10) {
        killed = true;
        child.kill('SIGKILL');
      }
    });

    child.on('close', (code) => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }

      if (resolved) {
        return;
      }
      resolved = true;

      if (killed) {
        resolve(
          JSON.stringify({
            error: 'ABORTED: User pressed ESC to stop this command. The command was intentionally cancelled and did not complete.',
            aborted: true,
            command,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
          })
        );
        return;
      }

      resolve(
        JSON.stringify({
          command,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code ?? 0,
        })
      );
    });

    child.on('error', (error) => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }

      if (resolved) {
        return;
      }
      resolved = true;

      logger.error("Command execution failed", {
        command,
        error: error.message,
      });

      resolve(
        JSON.stringify({
          error: error.message || 'Failed to execute command',
          command,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
        })
      );
    });
  });
}
