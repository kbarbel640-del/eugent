import fs from "fs";
import path from "path";
import os from "os";

/**
 * Minimal logging system for debugging
 * Disabled by default, can be enabled via config
 */

enum LogLevel {
  ERROR = "ERROR",
  WARN = "WARN",
  INFO = "INFO",
  DEBUG = "DEBUG",
}

class Logger {
  private enabled: boolean = false;
  private logDir: string;
  private logFile: string;

  constructor() {
    // Log to project's .eugent/logs/ (NOT home directory!)
    this.logDir = path.join(process.cwd(), ".eugent", "logs");
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    this.logFile = path.join(this.logDir, `eugent-${today}.log`);
  }

  /**
   * Enable or disable logging
   */
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (enabled) {
      try {
        fs.mkdirSync(this.logDir, { recursive: true });
      } catch (error) {
      }
    }
  }

  private log(level: LogLevel, message: string, context?: any) {
    if (!this.enabled) return;

    const timestamp = new Date().toISOString();
    const contextStr = context ? ` | ${JSON.stringify(context)}` : "";
    const logLine = `[${timestamp}] [${level}] ${message}${contextStr}\n`;

    try {
      fs.appendFileSync(this.logFile, logLine);
    } catch (error) {
    }
  }

  error(message: string, context?: any) {
    this.log(LogLevel.ERROR, message, context);
  }

  warn(message: string, context?: any) {
    this.log(LogLevel.WARN, message, context);
  }

  info(message: string, context?: any) {
    this.log(LogLevel.INFO, message, context);
  }

  debug(message: string, context?: any) {
    this.log(LogLevel.DEBUG, message, context);
  }
}

export const logger = new Logger();
