import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { executeEditFile } from './edit_file.js';
import type { ToolContext } from '../shared/context.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * edit_file Tool Tests
 *
 * Critical safety tests for:
 * 1. Read-before-write validation
 * 2. Ambiguous replacement detection
 * 3. Search string not found
 * 4. Full file replacement mode
 * 5. Parameter validation
 */

describe('edit_file tool', () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    testDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'eugent-edit-test-')));
    process.chdir(testDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('Read-before-write validation (CRITICAL)', () => {
    beforeEach(() => {
      fs.writeFileSync('test.txt', 'Original content\nLine 2');
    });

    it('should reject edit without any prior tool calls', () => {
      const result = JSON.parse(executeEditFile({
        file_path: 'test.txt',
        old_content: 'Original',
        new_content: 'Modified'
      }));

      expect(result.error).toBeDefined();
      expect(result.error).toContain('No tool calls found');
      expect(result.error).toContain('read_for_write=true');
    });

    it('should reject edit without read_for_write=true', () => {
      const context: ToolContext = {
        allToolCalls: [
          {
            name: 'read_file',
            args: {
              file_path: 'test.txt',
              read_for_write: false // Missing read_for_write=true!
            }
          }
        ]
      };

      const result = JSON.parse(executeEditFile({
        file_path: 'test.txt',
        old_content: 'Original',
        new_content: 'Modified'
      }, context));

      expect(result.error).toBeDefined();
      expect(result.error).toContain('has not been read with read_for_write=true');
    });

    it('should reject edit of different file', () => {
      fs.writeFileSync('other.txt', 'Other content');

      const context: ToolContext = {
        allToolCalls: [
          {
            name: 'read_file',
            args: {
              file_path: 'other.txt', // Read different file
              read_for_write: true
            }
          }
        ]
      };

      const result = JSON.parse(executeEditFile({
        file_path: 'test.txt', // Trying to edit this file
        old_content: 'Original',
        new_content: 'Modified'
      }, context));

      expect(result.error).toBeDefined();
      expect(result.error).toContain('has not been read');
    });

    it('should allow edit after reading with read_for_write=true', () => {
      const context: ToolContext = {
        allToolCalls: [
          {
            name: 'read_file',
            args: {
              file_path: 'test.txt',
              read_for_write: true
            }
          }
        ]
      };

      const result = JSON.parse(executeEditFile({
        file_path: 'test.txt',
        old_content: 'Original content',
        new_content: 'Modified content'
      }, context));

      expect(result.error).toBeUndefined();
      expect(result.mode).toBe('search_replace');

      // Verify file was actually modified
      const fileContent = fs.readFileSync('test.txt', 'utf-8');
      expect(fileContent).toBe('Modified content\nLine 2');
    });

    it('should allow edit even if file was read much earlier in conversation', () => {
      const context: ToolContext = {
        allToolCalls: [
          { name: 'list_files', args: {} },
          { name: 'read_file', args: { file_path: 'test.txt', read_for_write: true } },
          { name: 'write_file', args: { file_path: 'other.txt', content: 'foo' } },
          { name: 'list_files', args: {} }
        ]
      };

      const result = JSON.parse(executeEditFile({
        file_path: 'test.txt',
        old_content: 'Original',
        new_content: 'Modified'
      }, context));

      expect(result.error).toBeUndefined();
    });
  });

  describe('Search and replace mode', () => {
    beforeEach(() => {
      fs.writeFileSync('edit.txt', 'Hello world\nGoodbye world\nHello again');
    });

    const validContext: ToolContext = {
      allToolCalls: [{
        name: 'read_file',
        args: { file_path: 'edit.txt', read_for_write: true }
      }]
    };

    it('should perform simple search and replace', () => {
      const result = JSON.parse(executeEditFile({
        file_path: 'edit.txt',
        old_content: 'Hello world',
        new_content: 'Hi there'
      }, validContext));

      expect(result.error).toBeUndefined();
      expect(result.mode).toBe('search_replace');

      const content = fs.readFileSync('edit.txt', 'utf-8');
      expect(content).toBe('Hi there\nGoodbye world\nHello again');
    });

    it('should reject ambiguous replacement (multiple occurrences)', () => {
      const result = JSON.parse(executeEditFile({
        file_path: 'edit.txt',
        old_content: 'world', // Appears twice
        new_content: 'universe'
      }, validContext));

      expect(result.error).toBeDefined();
      expect(result.error).toContain('Ambiguous replacement');
      expect(result.error).toContain('2 times');
    });

    it('should reject when search string not found', () => {
      const result = JSON.parse(executeEditFile({
        file_path: 'edit.txt',
        old_content: 'does not exist',
        new_content: 'something'
      }, validContext));

      expect(result.error).toBeDefined();
      expect(result.error).toContain('Search string not found');
    });

    it('should handle multiline search and replace', () => {
      const result = JSON.parse(executeEditFile({
        file_path: 'edit.txt',
        old_content: 'Hello world\nGoodbye world',
        new_content: 'Hi\nBye'
      }, validContext));

      expect(result.error).toBeUndefined();

      const content = fs.readFileSync('edit.txt', 'utf-8');
      expect(content).toBe('Hi\nBye\nHello again');
    });

    it('should allow replacing with empty string (deletion)', () => {
      const result = JSON.parse(executeEditFile({
        file_path: 'edit.txt',
        old_content: 'Hello world\n',
        new_content: ''
      }, validContext));

      expect(result.error).toBeUndefined();
      expect(result.mode).toBe('search_replace');

      const content = fs.readFileSync('edit.txt', 'utf-8');
      expect(content).toBe('Goodbye world\nHello again');
    });
  });

  describe('Full file replacement mode', () => {
    beforeEach(() => {
      fs.writeFileSync('replace.txt', 'Old content\nto be replaced');
    });

    const validContext: ToolContext = {
      allToolCalls: [{
        name: 'read_file',
        args: { file_path: 'replace.txt', read_for_write: true }
      }]
    };

    it('should replace entire file content', () => {
      const newContent = 'Completely new content\nMultiple lines\nAll new';

      const result = JSON.parse(executeEditFile({
        file_path: 'replace.txt',
        replace_full: true,
        full_content: newContent
      }, validContext));

      expect(result.error).toBeUndefined();
      expect(result.mode).toBe('full_replace');

      const fileContent = fs.readFileSync('replace.txt', 'utf-8');
      expect(fileContent).toBe(newContent);
    });

    it('should reject full replace without full_content', () => {
      const result = JSON.parse(executeEditFile({
        file_path: 'replace.txt',
        replace_full: true
        // Missing full_content
      }, validContext));

      expect(result.error).toBeDefined();
      expect(result.error).toContain('replace_full=true requires full_content');
    });

    it('should reject full replace with old_content/new_content', () => {
      const result = JSON.parse(executeEditFile({
        file_path: 'replace.txt',
        replace_full: true,
        full_content: 'New content',
        old_content: 'should not be here',
        new_content: 'neither should this'
      }, validContext));

      expect(result.error).toBeDefined();
      expect(result.error).toContain('old_content and new_content must be empty');
    });
  });

  describe('Parameter validation', () => {
    const validContext: ToolContext = {
      allToolCalls: [{
        name: 'read_file',
        args: { file_path: 'test.txt', read_for_write: true }
      }]
    };

    beforeEach(() => {
      fs.writeFileSync('test.txt', 'Content');
    });

    it('should reject search/replace without old_content', () => {
      const result = JSON.parse(executeEditFile({
        file_path: 'test.txt',
        new_content: 'New'
        // Missing old_content
      }, validContext));

      expect(result.error).toBeDefined();
      expect(result.error).toContain('requires both old_content and new_content');
    });

    it('should reject search/replace without new_content', () => {
      const result = JSON.parse(executeEditFile({
        file_path: 'test.txt',
        old_content: 'Old'
        // Missing new_content
      }, validContext));

      expect(result.error).toBeDefined();
      expect(result.error).toContain('requires both old_content and new_content');
    });

    it('should reject full_content without replace_full (checked after other params)', () => {
      // When replace_full is false/undefined, it checks old_content/new_content first
      const result = JSON.parse(executeEditFile({
        file_path: 'test.txt',
        full_content: 'Some content',
        old_content: 'old',
        new_content: 'new'
        // Missing replace_full=true
      }, validContext));

      expect(result.error).toBeDefined();
      expect(result.error).toContain('full_content should only be used with replace_full=true');
    });
  });

  describe('Error handling', () => {
    const validContext: ToolContext = {
      allToolCalls: [{
        name: 'read_file',
        args: { file_path: 'test.txt', read_for_write: true }
      }]
    };

    it('should return error for non-existent file', () => {
      const result = JSON.parse(executeEditFile({
        file_path: 'nonexistent.txt',
        old_content: 'old',
        new_content: 'new'
      }, validContext));

      expect(result.error).toBeDefined();
      expect(result.error).toContain('not found');
    });

    it('should return error for path traversal attempt', () => {
      const result = JSON.parse(executeEditFile({
        file_path: '../etc/passwd',
        old_content: 'root',
        new_content: 'hacked'
      }, validContext));

      expect(result.error).toBeDefined();
      expect(result.error).toContain('Access denied');
    });
  });
});
