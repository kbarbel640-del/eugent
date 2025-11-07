import * as fs from 'fs';

/**
 * File System Interface
 * Abstraction layer over Node.js fs module to enable testing
 * Tools should use this interface instead of direct fs calls
 */
export interface IFileSystem {
  existsSync(path: string): boolean;
  statSync(path: string): fs.Stats;
  readFileSync(path: string, encoding: BufferEncoding): string;
  writeFileSync(path: string, content: string, encoding: BufferEncoding): void;
  unlinkSync(path: string): void;
  readdirSync(path: string, options?: { withFileTypes: boolean }): fs.Dirent[];
  mkdirSync(path: string, options?: { recursive: boolean }): void;
}

/**
 * Real File System Implementation
 * Production implementation that uses actual fs module
 */
export class RealFileSystem implements IFileSystem {
  existsSync(path: string): boolean {
    return fs.existsSync(path);
  }

  statSync(path: string): fs.Stats {
    return fs.statSync(path);
  }

  readFileSync(path: string, encoding: BufferEncoding): string {
    return fs.readFileSync(path, encoding);
  }

  writeFileSync(path: string, content: string, encoding: BufferEncoding): void {
    fs.writeFileSync(path, content, encoding);
  }

  unlinkSync(path: string): void {
    fs.unlinkSync(path);
  }

  readdirSync(
    path: string,
    options?: { withFileTypes: boolean }
  ): fs.Dirent[] {
    if (options?.withFileTypes) {
      return fs.readdirSync(path, { withFileTypes: true });
    }
    const entries = fs.readdirSync(path);
    return entries.map((name) => ({
      name,
      isFile: () => false,
      isDirectory: () => false,
      isBlockDevice: () => false,
      isCharacterDevice: () => false,
      isSymbolicLink: () => false,
      isFIFO: () => false,
      isSocket: () => false,
      path: path,
      parentPath: path,
    })) as fs.Dirent[];
  }

  mkdirSync(path: string, options?: { recursive: boolean }): void {
    fs.mkdirSync(path, options);
  }
}

/**
 * Default file system instance
 * Tools should import and use this singleton
 */
export const fileSystem: IFileSystem = new RealFileSystem();
