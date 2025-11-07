import { describe, it, expect } from 'vitest';
import {
  validateToolName,
  parseToolArguments,
  extractToolCallHistory,
} from './toolCallValidator.js';
import { Message } from '../core/types.js';

/**
 * ToolCallValidator Tests
 *
 * Critical for API stability - prevents:
 * 1. Malformed tool names (with parentheses, special chars)
 * 2. Invalid JSON in tool arguments
 * 3. Crashes from unexpected tool call data
 */

describe('ToolCallValidator - API Safety', () => {
  describe('validateToolName', () => {
    describe('Valid tool names', () => {
      it('should accept simple underscore name', () => {
        const result = validateToolName('read_file', 'call-123');
        expect(result.valid).toBe(true);
        expect(result.toolName).toBe('read_file');
        expect(result.errorMessage).toBeUndefined();
      });

      it('should accept name with dashes', () => {
        const result = validateToolName('my-custom-tool', 'call-123');
        expect(result.valid).toBe(true);
        expect(result.toolName).toBe('my-custom-tool');
      });

      it('should accept name with single dots (namespaced)', () => {
        const result = validateToolName('web.fetch', 'call-123');
        expect(result.valid).toBe(true);
        expect(result.toolName).toBe('web.fetch');
      });

      it('should accept alphanumeric name', () => {
        const result = validateToolName('tool123', 'call-123');
        expect(result.valid).toBe(true);
      });
    });

    describe('Invalid tool names', () => {
      it('should reject name with parentheses (function call syntax)', () => {
        const result = validateToolName('list_files()', 'call-123');
        expect(result.valid).toBe(false);
        expect(result.errorMessage).toBeDefined();
        expect(result.errorMessage?.content).toContain('Invalid tool name format');
        expect(result.errorMessage?.content).toContain('parentheses');
      });

      it('should reject name with consecutive dots', () => {
        const result = validateToolName('bad..tool', 'call-123');
        expect(result.valid).toBe(false);
      });

      it('should reject name with path traversal attempt', () => {
        const result = validateToolName('../etc/passwd', 'call-123');
        expect(result.valid).toBe(false);
      });

      it('should reject name with special characters', () => {
        const result = validateToolName('tool$injection', 'call-123');
        expect(result.valid).toBe(false);
      });

      it('should reject name with spaces', () => {
        const result = validateToolName('read file', 'call-123');
        expect(result.valid).toBe(false);
      });

      it('should reject empty name', () => {
        const result = validateToolName('', 'call-123');
        expect(result.valid).toBe(false);
      });
    });

    describe('Error message structure', () => {
      it('should include toolCallId in error message', () => {
        const toolCallId = 'unique-id-456';
        const result = validateToolName('bad()', toolCallId);
        expect(result.errorMessage?.toolCallId).toBe(toolCallId);
        expect(result.errorMessage?.role).toBe('tool');
      });

      it('should include tool name in error message', () => {
        const badName = 'bad()';
        const result = validateToolName(badName, 'call-123');
        expect(result.errorMessage?.name).toBe(badName);
      });
    });
  });

  describe('parseToolArguments', () => {
    describe('Valid JSON', () => {
      it('should parse simple object', () => {
        const json = '{"file_path": "test.txt"}';
        const result = parseToolArguments('read_file', json, 'call-123');
        expect(result.valid).toBe(true);
        expect(result.toolArgs).toEqual({ file_path: 'test.txt' });
      });

      it('should parse nested object', () => {
        const json = '{"config": {"enabled": true, "count": 42}}';
        const result = parseToolArguments('tool', json, 'call-123');
        expect(result.valid).toBe(true);
        expect(result.toolArgs.config.enabled).toBe(true);
      });

      it('should parse empty object', () => {
        const json = '{}';
        const result = parseToolArguments('tool', json, 'call-123');
        expect(result.valid).toBe(true);
        expect(result.toolArgs).toEqual({});
      });

      it('should parse array values', () => {
        const json = '{"items": [1, 2, 3]}';
        const result = parseToolArguments('tool', json, 'call-123');
        expect(result.valid).toBe(true);
        expect(result.toolArgs.items).toEqual([1, 2, 3]);
      });

      it('should preserve null values', () => {
        const json = '{"value": null}';
        const result = parseToolArguments('tool', json, 'call-123');
        expect(result.valid).toBe(true);
        expect(result.toolArgs.value).toBe(null);
      });
    });

    describe('Invalid JSON', () => {
      it('should reject malformed JSON (missing bracket)', () => {
        const json = '{"file_path": "test.txt"';
        const result = parseToolArguments('read_file', json, 'call-123');
        expect(result.valid).toBe(false);
        expect(result.errorMessage?.content).toContain('Invalid JSON');
      });

      it('should reject malformed JSON (trailing comma)', () => {
        const json = '{"key": "value",}';
        const result = parseToolArguments('tool', json, 'call-123');
        expect(result.valid).toBe(false);
      });

      it('should reject non-JSON primitive', () => {
        const json = 'undefined';
        const result = parseToolArguments('tool', json, 'call-123');
        expect(result.valid).toBe(false);
      });

      it('should reject empty string', () => {
        const json = '';
        const result = parseToolArguments('tool', json, 'call-123');
        expect(result.valid).toBe(false);
      });

      it('should include raw arguments in error message', () => {
        const badJson = '{broken';
        const result = parseToolArguments('tool', badJson, 'call-123');
        expect(result.errorMessage?.content).toContain('Raw arguments');
        expect(result.errorMessage?.content).toContain(badJson);
      });
    });
  });

  describe('extractToolCallHistory', () => {
    it('should extract successful tool calls from messages', () => {
      const messages: Message[] = [
        {
          role: 'tool',
          name: 'read_file',
          content: JSON.stringify({ content: 'file data', success: true }),
          toolCallId: 'call-1',
          toolArgs: { file_path: 'test.txt' },
        },
        {
          role: 'tool',
          name: 'write_file',
          content: JSON.stringify({ written: true }),
          toolCallId: 'call-2',
          toolArgs: { file_path: 'output.txt' },
        },
      ];

      const result = extractToolCallHistory(messages);
      expect(result.allToolCalls).toHaveLength(2);
      expect(result.allToolCalls[0].name).toBe('read_file');
      expect(result.allToolCalls[1].name).toBe('write_file');
      expect(result.lastToolCall?.name).toBe('write_file');
    });

    it('should exclude tool calls with errors', () => {
      const messages: Message[] = [
        {
          role: 'tool',
          name: 'read_file',
          content: JSON.stringify({ content: 'data' }),
          toolCallId: 'call-1',
          toolArgs: { file_path: 'test.txt' },
        },
        {
          role: 'tool',
          name: 'bad_tool',
          content: JSON.stringify({ error: 'Failed' }),
          toolCallId: 'call-2',
          toolArgs: {},
        },
      ];

      const result = extractToolCallHistory(messages);
      expect(result.allToolCalls).toHaveLength(1);
      expect(result.allToolCalls[0].name).toBe('read_file');
      expect(result.lastToolCall?.name).toBe('read_file');
    });

    it('should exclude tool with empty string error (falsy but still error)', () => {
      const messages: Message[] = [
        {
          role: 'tool',
          name: 'bad_tool',
          content: JSON.stringify({ error: '' }),
          toolCallId: 'call-1',
          toolArgs: {},
        },
      ];

      const result = extractToolCallHistory(messages);
      expect(result.allToolCalls).toHaveLength(0);
      expect(result.lastToolCall).toBeUndefined();
    });

    it('should exclude tool with null error (falsy but still error)', () => {
      const messages: Message[] = [
        {
          role: 'tool',
          name: 'bad_tool',
          content: JSON.stringify({ error: null }),
          toolCallId: 'call-1',
          toolArgs: {},
        },
      ];

      const result = extractToolCallHistory(messages);
      expect(result.allToolCalls).toHaveLength(0);
      expect(result.lastToolCall).toBeUndefined();
    });

    it('should exclude tool with zero error (falsy but still error)', () => {
      const messages: Message[] = [
        {
          role: 'tool',
          name: 'bad_tool',
          content: JSON.stringify({ error: 0 }),
          toolCallId: 'call-1',
          toolArgs: {},
        },
      ];

      const result = extractToolCallHistory(messages);
      expect(result.allToolCalls).toHaveLength(0);
      expect(result.lastToolCall).toBeUndefined();
    });

    it('should handle empty messages array', () => {
      const result = extractToolCallHistory([]);
      expect(result.allToolCalls).toEqual([]);
      expect(result.lastToolCall).toBeUndefined();
    });

    it('should ignore non-tool messages', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
        {
          role: 'tool',
          name: 'read_file',
          content: JSON.stringify({ data: 'test' }),
          toolCallId: 'call-1',
          toolArgs: { file_path: 'test.txt' },
        },
      ];

      const result = extractToolCallHistory(messages);
      expect(result.allToolCalls).toHaveLength(1);
    });

    it('should handle malformed tool message content gracefully', () => {
      const messages: Message[] = [
        {
          role: 'tool',
          name: 'read_file',
          content: '{invalid json',
          toolCallId: 'call-1',
          toolArgs: { file_path: 'test.txt' },
        },
      ];

      // Should not crash, just skip the malformed message
      const result = extractToolCallHistory(messages);
      expect(result.allToolCalls).toEqual([]);
      expect(result.lastToolCall).toBeUndefined();
    });

    it('should exclude messages with missing content field (malformed)', () => {
      const messages: Message[] = [
        {
          role: 'tool',
          name: 'read_file',
          toolCallId: 'call-1',
          toolArgs: { file_path: 'test.txt' },
        },
      ];

      const result = extractToolCallHistory(messages);
      expect(result.allToolCalls).toHaveLength(0);
      expect(result.lastToolCall).toBeUndefined();
    });

    it('should exclude messages with empty string content (malformed)', () => {
      const messages: Message[] = [
        {
          role: 'tool',
          name: 'read_file',
          content: '',
          toolCallId: 'call-1',
          toolArgs: { file_path: 'test.txt' },
        },
      ];

      const result = extractToolCallHistory(messages);
      expect(result.allToolCalls).toHaveLength(0);
      expect(result.lastToolCall).toBeUndefined();
    });

    it('should handle missing toolArgs field', () => {
      const messages: Message[] = [
        {
          role: 'tool',
          name: 'read_file',
          content: JSON.stringify({ data: 'test' }),
          toolCallId: 'call-1',
        },
      ];

      const result = extractToolCallHistory(messages);
      expect(result.allToolCalls).toEqual([]);
    });

    it('should track last successful tool call correctly', () => {
      const messages: Message[] = [
        {
          role: 'tool',
          name: 'first',
          content: JSON.stringify({ ok: true }),
          toolCallId: 'call-1',
          toolArgs: {},
        },
        {
          role: 'tool',
          name: 'second',
          content: JSON.stringify({ error: 'failed' }),
          toolCallId: 'call-2',
          toolArgs: {},
        },
        {
          role: 'tool',
          name: 'third',
          content: JSON.stringify({ ok: true }),
          toolCallId: 'call-3',
          toolArgs: {},
        },
      ];

      const result = extractToolCallHistory(messages);
      expect(result.allToolCalls).toHaveLength(2);
      expect(result.lastToolCall?.name).toBe('third');
    });
  });
});
