/**
 * Type definitions for marked-terminal@7.3.0
 *
 * The @types/marked-terminal package is outdated and based on marked@11.x.
 * This file provides correct types for marked-terminal@7.3.0 which uses marked@15.x.
 */

declare module 'marked-terminal' {
  import { MarkedExtension } from 'marked';

  export interface TerminalRendererOptions {
    // Typography
    width?: number;
    emoji?: boolean;

    // Code blocks
    code?: (code: string) => string;
    blockquote?: (text: string) => string;

    // Headers
    heading?: (text: string) => string;
    firstHeading?: (text: string) => string;

    // Lists
    list?: (body: string, ordered?: boolean) => string;
    listitem?: (text: string) => string;

    // Emphasis
    strong?: (text: string) => string;
    em?: (text: string) => string;
    codespan?: (code: string) => string;

    // Links
    link?: (href: string, title: string | null | undefined, text: string) => string;
    href?: (href: string) => string;

    // Tables
    tableOptions?: {
      chars?: Record<string, string>;
      style?: {
        head?: string[];
        border?: string[];
      };
    };

    // Other
    html?: (html: string) => string;
    text?: (text: string) => string;
    unescape?: boolean;
    showSectionPrefix?: boolean;
    reflowText?: boolean;
    tab?: number | string;

    // Syntax highlighting
    highlight?: (code: string, lang?: string) => string;
  }

  export function markedTerminal(
    options?: TerminalRendererOptions,
    highlightOptions?: any
  ): MarkedExtension;

  export default markedTerminal;
}
