import { useState, useCallback } from "react";
import { marked } from "marked";
import { markedTerminal } from "marked-terminal";
import chalk from "chalk";
import { highlight } from "cli-highlight";

/**
 * Hook for markdown rendering with terminal formatting
 */
export function useMarkdownRenderer() {
  useState(() => {
    const terminalWidth = process.stdout.columns || 100;

    marked.use(markedTerminal({
      width: Math.min(terminalWidth - 4, 120),
      emoji: true,
      reflowText: true,
      tab: 2,

      code: (code: string) => chalk.bgBlack.yellow(code),
      blockquote: chalk.gray.italic,

      heading: chalk.green.bold,
      firstHeading: chalk.magenta.bold.underline,

      list: (body: string) => body.trimEnd(),
      listitem: (text: string) => chalk.white(text.trim()),

      strong: chalk.bold.white,
      em: chalk.italic.white,
      codespan: chalk.cyan.bold,

      link: chalk.blue,
      href: chalk.blue.underline,

      tableOptions: {
        chars: {
          'top': '─',
          'top-mid': '┬',
          'top-left': '┌',
          'top-right': '┐',
          'bottom': '─',
          'bottom-mid': '┴',
          'bottom-left': '└',
          'bottom-right': '┘',
          'left': '│',
          'left-mid': '├',
          'mid': '─',
          'mid-mid': '┼',
          'right': '│',
          'right-mid': '┤',
          'middle': '│'
        },
        style: {
          head: ['cyan', 'bold'],
          border: ['gray']
        }
      },

      highlight: (code: string, lang?: string) => {
        try {
          if (lang && lang !== 'text') {
            return highlight(code, {
              language: lang,
              theme: {
                keyword: chalk.magenta,
                built_in: chalk.cyan,
                string: chalk.green,
                number: chalk.yellow,
                comment: chalk.gray,
                function: chalk.blue,
                class: chalk.yellow.bold,
              }
            });
          }
        } catch (e) {
        }
        return code;
      }
    }));
  });

  /**
   * Render markdown content to terminal-formatted ANSI
   */
  const render = useCallback(
    (content: string): string => {
      const rendered = marked.parse(content) as string;

      // Reduce excessive spacing: marked-terminal adds \n\n after every section
      // Replace multiple consecutive newlines with single newlines
      return rendered
        .replace(/\n{3,}/g, '\n\n')  // 3+ newlines → 2 newlines
        .replace(/\n\s+\n/g, '\n')   // Lines with only whitespace → single newline
        .trimEnd();
    },
    []
  );

  return { render };
}
