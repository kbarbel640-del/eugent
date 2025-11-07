import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PathValidator } from './pathValidator.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * PathValidator Security Tests
 *
 * Critical security boundary - prevents:
 * 1. Directory traversal attacks (../, absolute paths)
 * 2. Access to .eugent configuration directory
 * 3. Access to gitignored files (optional)
 * 4. File/directory type mismatches
 */

describe('PathValidator - Security Boundary', () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    testDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'eugent-test-')));
    process.chdir(testDir);

    // Create test files
    fs.writeFileSync(path.join(testDir, 'test.txt'), 'test content');
    fs.mkdirSync(path.join(testDir, 'subdir'));
    fs.writeFileSync(path.join(testDir, 'subdir', 'nested.txt'), 'nested');

    // Create .eugent directory (should be blocked)
    fs.mkdirSync(path.join(testDir, '.eugent'));
    fs.writeFileSync(path.join(testDir, '.eugent', 'config.json'), '{}');
  });

  afterEach(() => {
    process.chdir(originalCwd);
    // Clean up temp directory
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('validatePath - Path Traversal Prevention', () => {
    it('should allow relative path within cwd', () => {
      const result = PathValidator.validatePath('test.txt', 'read');
      expect(result.valid).toBe(true);
      expect(result.absolutePath).toBe(path.join(testDir, 'test.txt'));
    });

    it('should allow ./relative path within cwd', () => {
      const result = PathValidator.validatePath('./test.txt', 'read');
      expect(result.valid).toBe(true);
    });

    it('should allow nested path within cwd', () => {
      const result = PathValidator.validatePath('subdir/nested.txt', 'read');
      expect(result.valid).toBe(true);
      expect(result.absolutePath).toBe(path.join(testDir, 'subdir', 'nested.txt'));
    });

    it('should block ../ traversal attempt', () => {
      const result = PathValidator.validatePath('../etc/passwd', 'read');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Access denied');
      expect(result.error).toContain('outside the current directory');
    });

    it('should block absolute path outside cwd', () => {
      const result = PathValidator.validatePath('/etc/passwd', 'read');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('outside the current directory');
    });

    it('should block subtle traversal with valid prefix', () => {
      const result = PathValidator.validatePath('subdir/../../etc/passwd', 'read');
      expect(result.valid).toBe(false);
    });
  });

  describe('blockEugentDirectory - Configuration Protection', () => {
    it('should block .eugent directory access', () => {
      const absolutePath = fs.realpathSync(path.join(testDir, '.eugent'));
      const result = PathValidator.blockEugentDirectory(absolutePath, 'read');
      expect(result.blocked).toBe(true);
      expect(result.error).toContain('.eugent configuration directory');
    });

    it('should block .eugent file access', () => {
      const absolutePath = fs.realpathSync(path.join(testDir, '.eugent', 'config.json'));
      const result = PathValidator.blockEugentDirectory(absolutePath, 'write');
      expect(result.blocked).toBe(true);
    });

    it('should allow non-.eugent directory', () => {
      const absolutePath = path.join(testDir, 'subdir');
      const result = PathValidator.blockEugentDirectory(absolutePath, 'read');
      expect(result.blocked).toBe(false);
    });

    it('should allow file with .eugent in name but not directory', () => {
      // Create a file that contains ".eugent" in the name but isn't in the .eugent dir
      const testFile = path.join(testDir, 'my.eugent.backup.txt');
      fs.writeFileSync(testFile, 'test');

      const result = PathValidator.blockEugentDirectory(testFile, 'read');
      expect(result.blocked).toBe(false);
    });
  });

  describe('validateResourceType - File vs Directory', () => {
    it('should validate existing file', () => {
      const absolutePath = path.join(testDir, 'test.txt');
      const result = PathValidator.validateResourceType(absolutePath, 'file', 'test.txt');
      expect(result.valid).toBe(true);
      expect(result.stats).toBeDefined();
      expect(result.stats?.isFile()).toBe(true);
    });

    it('should validate existing directory', () => {
      const absolutePath = path.join(testDir, 'subdir');
      const result = PathValidator.validateResourceType(absolutePath, 'directory', 'subdir');
      expect(result.valid).toBe(true);
      expect(result.stats?.isDirectory()).toBe(true);
    });

    it('should reject non-existent file', () => {
      const absolutePath = path.join(testDir, 'nonexistent.txt');
      const result = PathValidator.validateResourceType(absolutePath, 'file', 'nonexistent.txt');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('File not found');
    });

    it('should reject directory when expecting file', () => {
      const absolutePath = path.join(testDir, 'subdir');
      const result = PathValidator.validateResourceType(absolutePath, 'file', 'subdir');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Path is not a file');
    });

    it('should reject file when expecting directory', () => {
      const absolutePath = path.join(testDir, 'test.txt');
      const result = PathValidator.validateResourceType(absolutePath, 'directory', 'test.txt');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Path is not a directory');
    });
  });

  describe('validateFilePath - Complete File Validation', () => {
    it('should pass all validations for normal file', () => {
      const result = PathValidator.validateFilePath('test.txt', 'read');
      expect(result.valid).toBe(true);
      expect(result.absolutePath).toBeDefined();
      expect(result.stats).toBeDefined();
    });

    it('should fail on traversal attempt', () => {
      const result = PathValidator.validateFilePath('../etc/passwd', 'read');
      expect(result.valid).toBe(false);
    });

    it('should fail on .eugent file access', () => {
      const result = PathValidator.validateFilePath('.eugent/config.json', 'read');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('.eugent');
    });

    it('should fail when file does not exist', () => {
      const result = PathValidator.validateFilePath('nonexistent.txt', 'read');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should fail when path is directory', () => {
      const result = PathValidator.validateFilePath('subdir', 'read');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not a file');
    });
  });

  describe('validateDirectoryPath - Complete Directory Validation', () => {
    it('should pass all validations for normal directory', () => {
      const result = PathValidator.validateDirectoryPath('subdir', 'list');
      expect(result.valid).toBe(true);
      expect(result.absolutePath).toBeDefined();
      expect(result.stats?.isDirectory()).toBe(true);
    });

    it('should fail on .eugent directory access', () => {
      const result = PathValidator.validateDirectoryPath('.eugent', 'list');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('.eugent');
    });

    it('should fail when directory does not exist', () => {
      const result = PathValidator.validateDirectoryPath('nonexistent', 'list');
      expect(result.valid).toBe(false);
    });

    it('should fail when path is file', () => {
      const result = PathValidator.validateDirectoryPath('test.txt', 'list');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not a directory');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string path', () => {
      const result = PathValidator.validateFilePath('', 'read');
      // Empty string resolves to cwd, which is a directory not a file
      expect(result.valid).toBe(false);
    });

    it('should handle path with spaces', () => {
      const filename = 'file with spaces.txt';
      fs.writeFileSync(path.join(testDir, filename), 'content');

      const result = PathValidator.validateFilePath(filename, 'read');
      expect(result.valid).toBe(true);
    });

    it('should handle unicode filename', () => {
      const filename = '文件.txt';
      fs.writeFileSync(path.join(testDir, filename), 'content');

      const result = PathValidator.validateFilePath(filename, 'read');
      expect(result.valid).toBe(true);
    });
  });
});
