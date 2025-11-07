import * as fs from 'fs';
import * as path from 'path';
import {
  loadGitignorePatterns,
  matchesGitignorePattern,
} from '../../tools/shared/gitignore.js';

export interface PathValidationResult {
  valid: boolean;
  absolutePath?: string;
  error?: string;
}

export interface ResourceValidationResult {
  valid: boolean;
  stats?: fs.Stats;
  error?: string;
}

export interface GitignoreCheckResult {
  allowed: boolean;
  error?: string;
}

/**
 * Centralized path validation and security checks
 * Used by all file/search tools to ensure consistent security policies
 */
export class PathValidator {
  /**
   * Validate that a path doesn't escape the current directory
   * @param inputPath - User-provided path (relative or absolute)
   * @param operation - Description of operation for error messages (e.g., "read", "write")
   * @returns Validation result with absolute path or error
   */
  static validatePath(
    inputPath: string,
    operation: string
  ): PathValidationResult {
    const absolutePath = path.resolve(process.cwd(), inputPath);
    const cwd = process.cwd();

    if (!absolutePath.startsWith(cwd)) {
      return {
        valid: false,
        error: `Access denied: Cannot ${operation} outside the current directory`,
      };
    }

    return { valid: true, absolutePath };
  }

  /**
   * Check if a path is within the .eugent configuration directory and block access
   * @param absolutePath - Absolute path to check
   * @param operation - Description of operation for error messages
   * @returns Result indicating if path is blocked
   */
  static blockEugentDirectory(
    absolutePath: string,
    operation: string
  ): { blocked: boolean; error?: string } {
    const cwd = process.cwd();
    const relativePath = path.relative(cwd, absolutePath);

    if (
      relativePath.startsWith('.eugent' + path.sep) ||
      relativePath === '.eugent'
    ) {
      return {
        blocked: true,
        error: `Access denied: Cannot ${operation} .eugent configuration directory`,
      };
    }

    return { blocked: false };
  }

  /**
   * Validate that a resource exists and is of the expected type
   * @param absolutePath - Absolute path to validate
   * @param expectedType - Expected resource type ('file' or 'directory')
   * @param inputPath - Original user-provided path (for error messages)
   * @returns Validation result with stats or error
   */
  static validateResourceType(
    absolutePath: string,
    expectedType: 'file' | 'directory',
    inputPath: string
  ): ResourceValidationResult {
    if (!fs.existsSync(absolutePath)) {
      const resource = expectedType === 'file' ? 'File' : 'Directory';
      return {
        valid: false,
        error: `${resource} not found: ${inputPath}`,
      };
    }

    const stats = fs.statSync(absolutePath);
    const isValid =
      expectedType === 'file' ? stats.isFile() : stats.isDirectory();

    if (!isValid) {
      return {
        valid: false,
        stats,
        error: `Path is not a ${expectedType}: ${inputPath}`,
      };
    }

    return { valid: true, stats };
  }

  /**
   * Check if a path should be blocked due to gitignore patterns
   * @param absolutePath - Absolute path to check
   * @param includeGitignored - If true, allow gitignored paths
   * @param operation - Description of operation for error messages
   * @returns Result indicating if access is allowed
   */
  static checkGitignoreAccess(
    absolutePath: string,
    includeGitignored: boolean,
    operation: string
  ): GitignoreCheckResult {
    if (includeGitignored) {
      return { allowed: true };
    }

    const cwd = process.cwd();
    const patterns = loadGitignorePatterns(cwd);
    const relativePath = path.relative(cwd, absolutePath);

    if (matchesGitignorePattern(relativePath, patterns)) {
      return {
        allowed: false,
        error: `Access denied: Cannot ${operation} gitignored path: ${relativePath}`,
      };
    }

    return { allowed: true };
  }

  /**
   * Run all standard file validations in sequence
   * Checks: path escape, .eugent access, file existence, gitignore
   * @param inputPath - User-provided path
   * @param operation - Operation description for errors
   * @param includeGitignored - Whether to allow gitignored files
   * @returns Combined validation result with absolute path and stats, or error
   */
  static validateFilePath(
    inputPath: string,
    operation: string,
    includeGitignored: boolean = false
  ): { valid: boolean; absolutePath?: string; stats?: fs.Stats; error?: string } {
    const pathCheck = PathValidator.validatePath(inputPath, operation);
    if (!pathCheck.valid) {
      return pathCheck;
    }

    const absolutePath = pathCheck.absolutePath!;

    const eugentCheck = PathValidator.blockEugentDirectory(absolutePath, operation);
    if (eugentCheck.blocked) {
      return { valid: false, error: eugentCheck.error };
    }

    const resourceCheck = PathValidator.validateResourceType(
      absolutePath,
      'file',
      inputPath
    );
    if (!resourceCheck.valid) {
      return resourceCheck;
    }

    const gitignoreCheck = PathValidator.checkGitignoreAccess(
      absolutePath,
      includeGitignored,
      operation
    );
    if (!gitignoreCheck.allowed) {
      return { valid: false, error: gitignoreCheck.error };
    }

    return {
      valid: true,
      absolutePath,
      stats: resourceCheck.stats,
    };
  }

  /**
   * Run all standard directory validations in sequence
   * Checks: path escape, .eugent access, directory existence, gitignore
   * @param inputPath - User-provided path
   * @param operation - Operation description for errors
   * @param includeGitignored - Whether to allow gitignored directories
   * @returns Combined validation result with absolute path and stats, or error
   */
  static validateDirectoryPath(
    inputPath: string,
    operation: string,
    includeGitignored: boolean = false
  ): { valid: boolean; absolutePath?: string; stats?: fs.Stats; error?: string } {
    const pathCheck = PathValidator.validatePath(inputPath, operation);
    if (!pathCheck.valid) {
      return pathCheck;
    }

    const absolutePath = pathCheck.absolutePath!;

    const eugentCheck = PathValidator.blockEugentDirectory(absolutePath, operation);
    if (eugentCheck.blocked) {
      return { valid: false, error: eugentCheck.error };
    }

    const resourceCheck = PathValidator.validateResourceType(
      absolutePath,
      'directory',
      inputPath
    );
    if (!resourceCheck.valid) {
      return resourceCheck;
    }

    const gitignoreCheck = PathValidator.checkGitignoreAccess(
      absolutePath,
      includeGitignored,
      operation
    );
    if (!gitignoreCheck.allowed) {
      return { valid: false, error: gitignoreCheck.error };
    }

    return {
      valid: true,
      absolutePath,
      stats: resourceCheck.stats,
    };
  }
}
