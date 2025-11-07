import { Tool } from '../../lib/core/types.js';
import { getToolDescription, getParameterDescription } from '../../agent/prompts.js';
import { logger } from '../../lib/core/logger.js';
import { httpClient } from '../../lib/http/httpClient.js';

export interface NpmSearchArgs {
  query: string;
  limit?: number;
}

const MAX_CONTENT_SIZE = 200 * 1024; // 200KB markdown output
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 30;
const DEFAULT_TIMEOUT = 30000; // 30 seconds

export const npmSearchTool: Tool = {
  type: 'function',
  function: {
    name: 'npm_search',
    description: getToolDescription('npm_search'),
    parameters: {
      type: 'object',
      required: ['query'],
      properties: {
        query: {
          type: 'string',
          description: getParameterDescription('npm_search', 'query'),
        },
        limit: {
          type: 'number',
          description: getParameterDescription('npm_search', 'limit'),
        },
      },
    },
  },
};

/**
 * Format npm package search result as markdown
 */
function formatPackage(pkg: any): string {
  const name = pkg.package.name;
  const version = pkg.package.version;
  const description = pkg.package.description || 'No description';
  const npmUrl = pkg.package.links.npm;
  const homepage = pkg.package.links.homepage;
  const repository = pkg.package.links.repository;

  // Format download stats
  const downloads = pkg.score?.detail?.popularity
    ? `High popularity (${(pkg.score.detail.popularity * 100).toFixed(0)}%)`
    : 'Unknown';

  // Quality and maintenance scores
  const quality = pkg.score?.detail?.quality
    ? `${(pkg.score.detail.quality * 100).toFixed(0)}%`
    : 'N/A';
  const maintenance = pkg.score?.detail?.maintenance
    ? `${(pkg.score.detail.maintenance * 100).toFixed(0)}%`
    : 'N/A';

  let markdown = `### ${name}\n`;
  markdown += `**Version:** ${version} | **Quality:** ${quality} | **Maintenance:** ${maintenance}\n`;
  markdown += `${description}\n`;
  markdown += `**NPM:** ${npmUrl}`;

  if (repository) {
    markdown += ` | **Repository:** ${repository}`;
  }
  if (homepage && homepage !== repository) {
    markdown += ` | **Homepage:** ${homepage}`;
  }

  return markdown;
}

/**
 * Execute the npm_search tool
 * Searches npm packages and returns formatted results
 * @param args - Query and options
 * @returns JSON string with results or error
 */
export async function executeNpmSearch(args: NpmSearchArgs): Promise<string> {
  try {
    const { query, limit = DEFAULT_LIMIT } = args;

    // Validate limit
    const actualLimit = Math.min(limit, MAX_LIMIT);

    logger.info('NPM search started', { query, limit: actualLimit });

    // Build API URL - using npms.io which has better search
    const params = new URLSearchParams({
      q: query,
      size: actualLimit.toString(),
    });

    const url = `https://api.npms.io/v2/search?${params}`;

    // Set up abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

    // Fetch from NPM API
    const response = await httpClient.fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'EugentBot/1.0',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return JSON.stringify({
        error: `NPM API error: ${response.status} ${response.statusText}`,
      });
    }

    // Parse response
    const data: any = await response.json();
    const results = data.results || [];
    const totalCount = data.total || 0;

    // Format results as markdown
    let markdown = `# NPM Package Search Results\n\n`;
    markdown += `**Query:** ${query}\n`;
    markdown += `**Results:** ${results.length} of ${totalCount.toLocaleString()} total\n\n`;

    if (results.length === 0) {
      markdown += 'No packages found.\n';
    } else {
      markdown += '---\n\n';
      const formattedItems = results.map((result: any) => formatPackage(result));
      markdown += formattedItems.join('\n\n---\n\n');
    }

    // Check size
    const markdownSize = Buffer.byteLength(markdown, 'utf8');
    if (markdownSize > MAX_CONTENT_SIZE) {
      const sizeKB = Math.round(markdownSize / 1024);
      return JSON.stringify({
        error: `Results too large (${sizeKB}KB > 200KB limit). Found ${results.length} results. Try reducing the limit parameter or using a more specific query.`,
        query,
        results_found: results.length,
        size_kb: sizeKB,
      });
    }

    logger.info('NPM search completed', {
      query,
      resultsFound: results.length,
      totalCount,
      markdownSize,
    });

    return JSON.stringify({
      query,
      results_found: results.length,
      total_count: totalCount,
      markdown_size: markdownSize,
      content: markdown,
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return JSON.stringify({
          error: 'Request timeout - NPM API took too long to respond',
          query: args.query,
        });
      }

      logger.error('NPM search failed', {
        query: args.query,
        error: error.message,
      });

      return JSON.stringify({
        error: error.message,
        query: args.query,
      });
    }

    return JSON.stringify({
      error: 'Failed to search NPM: Unknown error',
      query: args.query,
    });
  }
}
