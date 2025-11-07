import { Tool } from '../../lib/core/types.js';

/**
 * Tool schema for managing todos
 */
export const manageTodosTool: Tool = {
  type: 'function',
  function: {
    name: 'manage_todos',
    description: 'Update the current session todo list. This replaces the entire todo list with the provided array. Use this to add, complete, or modify tasks throughout the conversation.',
    parameters: {
      type: 'object',
      properties: {
        todos: {
          type: 'array',
          description: 'Complete array of current todos. Each todo has a task description and completion status.',
          items: {
            type: 'object',
            properties: {
              task: {
                type: 'string',
                description: 'Description of the task to complete',
              },
              completed: {
                type: 'boolean',
                description: 'Whether the task has been completed',
              },
            },
            required: ['task', 'completed'],
          },
        },
      },
      required: ['todos'],
    },
  },
};

export interface ManageTodosArgs {
  todos: Array<{ task: string; completed: boolean }>;
}

/**
 * Execute the manage_todos tool
 * This doesn't actually do anything except validate and return success.
 * The actual state management happens in Chat.tsx
 */
export async function executeManageTodos(args: ManageTodosArgs): Promise<string> {
  try {
    if (!Array.isArray(args.todos)) {
      return JSON.stringify({
        error: 'todos must be an array',
      });
    }

    for (const todo of args.todos) {
      if (typeof todo.task !== 'string' || typeof todo.completed !== 'boolean') {
        return JSON.stringify({
          error: 'Each todo must have a string "task" and boolean "completed" field',
        });
      }
    }

    return JSON.stringify({
      success: true,
      count: args.todos.length,
    });
  } catch (error: unknown) {
    return JSON.stringify({
      error: `Failed to manage todos: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}
