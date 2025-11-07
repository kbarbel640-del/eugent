import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { executeReadFile } from './read_file.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * read_file Tool Tests
 *
 * Tests file reading with:
 * 1. Basic reading with pagination
 * 2. read_for_write mode for editing
 * 3. Size limit enforcement (256KB)
 * 4. Edge cases (empty files, large files, etc.)
 */

describe('read_file tool', () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    testDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'eugent-read-test-')));
    process.chdir(testDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('Basic reading', () => {
    it('should read small file content', () => {
      const content = 'Hello, world!\nLine 2\nLine 3';
      fs.writeFileSync('test.txt', content);

      const result = JSON.parse(executeReadFile({ file_path: 'test.txt' }));
      expect(result.error).toBeUndefined();
      expect(result.content).toBe(content);
      expect(result.total_lines).toBe(3);
    });

    it('should read file with 300 lines (default limit)', () => {
      const lines = Array.from({ length: 500 }, (_, i) => `Line ${i + 1}`);
      fs.writeFileSync('large.txt', lines.join('\n'));

      const result = JSON.parse(executeReadFile({ file_path: 'large.txt' }));
      expect(result.error).toBeUndefined();
      expect(result.lines_returned).toBe(300);
      expect(result.total_lines).toBe(500);
      expect(result.offset).toBe(0);
    });

    it('should read empty file', () => {
      fs.writeFileSync('empty.txt', '');

      const result = JSON.parse(executeReadFile({ file_path: 'empty.txt' }));
      expect(result.error).toBeUndefined();
      expect(result.content).toBe('');
      expect(result.total_lines).toBe(0);
    });
  });

  describe('Pagination with offset', () => {
    beforeEach(() => {
      const lines = Array.from({ length: 1000 }, (_, i) => `Line ${i + 1}`);
      fs.writeFileSync('paginated.txt', lines.join('\n'));
    });

    it('should read from offset 0 (first 300 lines)', () => {
      const result = JSON.parse(executeReadFile({
        file_path: 'paginated.txt',
        offset: 0
      }));
      expect(result.error).toBeUndefined();
      expect(result.offset).toBe(0);
      expect(result.lines_returned).toBe(300);
      expect(result.content).toContain('Line 1');
      expect(result.content).toContain('Line 300');
    });

    it('should read from offset 200', () => {
      const result = JSON.parse(executeReadFile({
        file_path: 'paginated.txt',
        offset: 200
      }));
      expect(result.error).toBeUndefined();
      expect(result.offset).toBe(200);
      expect(result.lines_returned).toBe(300);
      expect(result.content).toContain('Line 201'); // 0-indexed, so offset 200 is line 201
      expect(result.content).toContain('Line 500');
    });

    it('should read last 300 lines when offset=-1', () => {
      const result = JSON.parse(executeReadFile({
        file_path: 'paginated.txt',
        offset: -1
      }));
      expect(result.error).toBeUndefined();
      expect(result.offset).toBe(700); // 1000 - 300 = 700
      expect(result.lines_returned).toBe(300);
      expect(result.content).toContain('Line 701');
      expect(result.content).toContain('Line 1000');
    });

    it('should read last 300 lines when offset > total_lines', () => {
      const result = JSON.parse(executeReadFile({
        file_path: 'paginated.txt',
        offset: 9999
      }));
      expect(result.error).toBeUndefined();
      expect(result.offset).toBe(700);
      expect(result.lines_returned).toBe(300);
    });

    it('should read remaining lines when offset + 300 > total_lines', () => {
      const result = JSON.parse(executeReadFile({
        file_path: 'paginated.txt',
        offset: 900
      }));
      expect(result.error).toBeUndefined();
      expect(result.offset).toBe(900);
      expect(result.lines_returned).toBe(100); // Only 100 lines left
      expect(result.total_lines).toBe(1000);
    });
  });

  describe('read_for_write mode', () => {
    it('should read entire small file in read_for_write mode', () => {
      const content = 'This is a test file\nWith multiple lines\nFor editing';
      fs.writeFileSync('edit.txt', content);

      const result = JSON.parse(executeReadFile({
        file_path: 'edit.txt',
        read_for_write: true
      }));
      expect(result.error).toBeUndefined();
      expect(result.content).toBe(content);
      expect(result.read_for_write).toBe(true);
      expect(result.size).toBeLessThan(256 * 1024);
    });

    it('should read entire large file if under 256KB in read_for_write mode', () => {
      // Create file with ~100KB (well under 256KB)
      const lines = Array.from({ length: 1000 }, (_, i) => `Line ${i + 1} with some padding text to increase size`);
      const content = lines.join('\n');
      fs.writeFileSync('medium.txt', content);

      const size = fs.statSync('medium.txt').size;
      expect(size).toBeLessThan(256 * 1024); // Verify it's under limit

      const result = JSON.parse(executeReadFile({
        file_path: 'medium.txt',
        read_for_write: true
      }));
      expect(result.error).toBeUndefined();
      expect(result.content).toBe(content);
      expect(result.total_lines).toBe(1000);
    });

    it('should reject files >= 256KB in read_for_write mode', () => {
      // Create file > 256KB
      const largeContent = 'x'.repeat(257 * 1024);
      fs.writeFileSync('toolarge.txt', largeContent);

      const result = JSON.parse(executeReadFile({
        file_path: 'toolarge.txt',
        read_for_write: true
      }));
      expect(result.error).toBeDefined();
      expect(result.error).toContain('File too large for editing');
      expect(result.error).toContain('262144'); // 256 * 1024 bytes
      expect(result.size).toBeGreaterThanOrEqual(256 * 1024);
    });
  });

  describe('Size limit for paginated content', () => {
    it('should reject minified file that exceeds 256KB in 300 lines', () => {
      // Create a "minified" file where a single line is > 256KB
      const hugeLine = 'x'.repeat(257 * 1024);
      fs.writeFileSync('minified.txt', hugeLine);

      const result = JSON.parse(executeReadFile({ file_path: 'minified.txt' }));
      expect(result.error).toBeDefined();
      expect(result.error).toContain('exceeds 256KB limit');
      expect(result.error).toContain('minified');
    });
  });

  describe('Edge cases', () => {
    it('should handle file with single line', () => {
      fs.writeFileSync('single.txt', 'Single line without newline');

      const result = JSON.parse(executeReadFile({ file_path: 'single.txt' }));
      expect(result.error).toBeUndefined();
      expect(result.total_lines).toBe(1);
      expect(result.content).toBe('Single line without newline');
    });

    it('should handle file with trailing newline', () => {
      const content = 'Line 1\nLine 2\n';
      fs.writeFileSync('trailing.txt', content);

      const result = JSON.parse(executeReadFile({ file_path: 'trailing.txt' }));
      expect(result.error).toBeUndefined();
      // "Line 1\nLine 2\n".split('\n') = ["Line 1", "Line 2", ""]
      expect(result.total_lines).toBe(3);
    });

    it('should handle unicode content', () => {
      const content = '你好世界\nこんにちは\n🎉 Emoji test';
      fs.writeFileSync('unicode.txt', content);

      const result = JSON.parse(executeReadFile({ file_path: 'unicode.txt' }));
      expect(result.error).toBeUndefined();
      expect(result.content).toBe(content);
    });

    it('should handle file with spaces in name', () => {
      const content = 'Test content';
      fs.writeFileSync('file with spaces.txt', content);

      const result = JSON.parse(executeReadFile({ file_path: 'file with spaces.txt' }));
      expect(result.error).toBeUndefined();
      expect(result.content).toBe(content);
    });
  });

  describe('Error handling', () => {
    it('should return error for non-existent file', () => {
      const result = JSON.parse(executeReadFile({ file_path: 'nonexistent.txt' }));
      expect(result.error).toBeDefined();
      expect(result.error).toContain('not found');
    });

    it('should return error for directory', () => {
      fs.mkdirSync('somedir');

      const result = JSON.parse(executeReadFile({ file_path: 'somedir' }));
      expect(result.error).toBeDefined();
      expect(result.error).toContain('not a file');
    });

    it('should return error for path traversal attempt', () => {
      const result = JSON.parse(executeReadFile({ file_path: '../etc/passwd' }));
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Access denied');
    });
  });
});
