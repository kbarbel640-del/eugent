import { Tool } from '../../lib/core/types.js';
import { getToolDescription, getParameterDescription } from '../../agent/prompts.js';
import { convertHTMLToMarkdown } from '../../lib/web/htmlProcessor.js';
import { logger } from '../../lib/core/logger.js';
import { httpClient } from '../../lib/http/httpClient.js';

export interface WebFetchArgs {
  url: string;
  timeout?: number;
}

const MAX_CONTENT_SIZE = 200 * 1024; // 200KB final markdown (after stripping)
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const MAX_TIMEOUT = 120000; // 2 minutes

export const webFetchTool: Tool = {
  type: 'function',
  function: {
    name: 'web_fetch',
    description: getToolDescription('web_fetch'),
    parameters: {
      type: 'object',
      required: ['url'],
      properties: {
        url: {
          type: 'string',
          description: getParameterDescription('web_fetch', 'url'),
        },
        timeout: {
          type: 'number',
          description: getParameterDescription('web_fetch', 'timeout'),
        },
      },
    },
  },
};

/**
 * Execute the web_fetch tool
 * Fetches content from a URL and returns it in the requested format
 * @param args - URL, format, and timeout options
 * @returns JSON string with content or error
 */
export async function executeWebFetch(args: WebFetchArgs): Promise<string> {
  try {
    const { url, timeout = DEFAULT_TIMEOUT } = args;

    // Validate URL
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return JSON.stringify({
        error: 'URL must start with http:// or https://',
      });
    }

    // Validate timeout
    const actualTimeout = Math.min(timeout, MAX_TIMEOUT);

    // Set up abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), actualTimeout);

    logger.info('Web fetch started', { url, timeout: actualTimeout });

    // Always prefer HTML for conversion to markdown
    const acceptHeader = 'text/html;q=1.0, application/xhtml+xml;q=0.9, text/plain;q=0.8, */*;q=0.1';

    // Fetch the URL
    const response = await httpClient.fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EugentBot/1.0)',
        'Accept': acceptHeader,
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return JSON.stringify({
        error: `HTTP ${response.status}: ${response.statusText}`,
        url,
        status: response.status,
      });
    }

    // Download content (no size check here - we'll check after stripping)
    const arrayBuffer = await response.arrayBuffer();
    const content = new TextDecoder().decode(arrayBuffer);
    const contentType = response.headers.get('content-type') || '';

    // Convert to markdown (strip aggressively)
    let markdown: string;
    if (contentType.includes('text/html')) {
      markdown = convertHTMLToMarkdown(content);
    } else {
      // Plain text or other formats - use as-is
      markdown = content;
    }

    // Check final markdown size (only size check we need!)
    const markdownSize = Buffer.byteLength(markdown, 'utf8');
    if (markdownSize > MAX_CONTENT_SIZE) {
      const sizeKB = Math.round(markdownSize / 1024);
      return JSON.stringify({
        error: `Content too large after conversion (${sizeKB}KB > 200KB limit). The page has too much content even after aggressive stripping. Try a more specific URL or documentation section.`,
        url,
        original_size_kb: Math.round(arrayBuffer.byteLength / 1024),
        markdown_size_kb: sizeKB,
      });
    }

    logger.info('Web fetch completed', {
      url,
      originalSize: arrayBuffer.byteLength,
      markdownSize,
      contentType,
    });

    return JSON.stringify({
      url,
      content_type: contentType,
      original_size: arrayBuffer.byteLength,
      markdown_size: markdownSize,
      content: markdown,
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return JSON.stringify({
          error: 'Request timeout - the server took too long to respond',
          url: args.url,
        });
      }

      logger.error('Web fetch failed', {
        url: args.url,
        error: error.message,
      });

      return JSON.stringify({
        error: error.message,
        url: args.url,
      });
    }

    return JSON.stringify({
      error: 'Failed to fetch URL: Unknown error',
      url: args.url,
    });
  }
}
