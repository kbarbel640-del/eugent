import { Tool } from '../../lib/core/types.js';
import { getToolDescription, getParameterDescription } from '../../agent/prompts.js';
import { logger } from '../../lib/core/logger.js';
import { httpClient } from '../../lib/http/httpClient.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface GitHubSearchArgs {
  query: string;
  type: 'repositories' | 'issues';
  limit?: number;
  sort?: string;
}

const MAX_CONTENT_SIZE = 200 * 1024; // 200KB markdown output
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 30;
const DEFAULT_TIMEOUT = 30000; // 30 seconds

export const githubSearchTool: Tool = {
  type: 'function',
  function: {
    name: 'github_search',
    description: getToolDescription('github_search'),
    parameters: {
      type: 'object',
      required: ['query', 'type'],
      properties: {
        query: {
          type: 'string',
          description: getParameterDescription('github_search', 'query'),
        },
        type: {
          type: 'string',
          enum: ['repositories', 'issues'],
          description: getParameterDescription('github_search', 'type'),
        },
        limit: {
          type: 'number',
          description: getParameterDescription('github_search', 'limit'),
        },
        sort: {
          type: 'string',
          description: getParameterDescription('github_search', 'sort'),
        },
      },
    },
  },
};

/**
 * Load GitHub token from ~/.eugent/github_token.txt if it exists
 * Token is optional - API works without it but with lower rate limits
 */
function loadGitHubToken(): string | undefined {
  try {
    const tokenPath = path.join(os.homedir(), '.eugent', 'github_token.txt');
    const token = fs.readFileSync(tokenPath, 'utf-8').trim();
    return token.length > 0 ? token : undefined;
  } catch {
    // No token file - use unauthenticated requests
    return undefined;
  }
}

/**
 * Format repository search result as markdown
 */
function formatRepository(repo: any): string {
  const stars = repo.stargazers_count?.toLocaleString() || '0';
  const language = repo.language || 'Unknown';
  const description = repo.description || 'No description';
  const url = repo.html_url;

  return `### ${repo.full_name}\n${description}\n**Stars:** ${stars} | **Language:** ${language}\n**URL:** ${url}`;
}

/**
 * Format issue search result as markdown
 */
function formatIssue(issue: any): string {
  const state = issue.state; // open or closed
  const comments = issue.comments || 0;
  const title = issue.title;
  const url = issue.html_url;
  const repo = issue.repository_url?.split('/').slice(-2).join('/') || 'Unknown';

  // Get first 200 chars of body
  let body = issue.body || 'No description';
  if (body.length > 200) {
    body = body.substring(0, 200) + '...';
  }

  return `### ${title}\n**Repo:** ${repo} | **State:** ${state} | **Comments:** ${comments}\n${body}\n**URL:** ${url}`;
}

/**
 * Execute the github_search tool
 * Searches GitHub repositories or issues and returns formatted results
 * @param args - Query, type, and options
 * @returns JSON string with results or error
 */
export async function executeGitHubSearch(args: GitHubSearchArgs): Promise<string> {
  try {
    const { query, type, limit = DEFAULT_LIMIT, sort } = args;

    // Validate limit
    const actualLimit = Math.min(limit, MAX_LIMIT);

    // Load optional GitHub token
    const token = loadGitHubToken();
    const authStatus = token ? 'authenticated (5000 req/hr)' : 'unauthenticated (60 req/hr)';

    logger.info('GitHub search started', { query, type, limit: actualLimit, authStatus });

    // Build API URL
    const baseUrl = 'https://api.github.com/search';
    const endpoint = type === 'repositories' ? 'repositories' : 'issues';

    const params = new URLSearchParams({
      q: query,
      per_page: actualLimit.toString(),
      ...(sort && { sort }),
    });

    const url = `${baseUrl}/${endpoint}?${params}`;

    // Set up headers
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'EugentBot/1.0',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Set up abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

    // Fetch from GitHub API
    const response = await httpClient.fetch(url, {
      signal: controller.signal,
      headers,
    });

    clearTimeout(timeoutId);

    // Handle rate limiting
    if (response.status === 403) {
      const resetTime = response.headers.get('x-ratelimit-reset');
      const resetDate = resetTime ? new Date(parseInt(resetTime) * 1000) : null;
      const resetMsg = resetDate ? ` Resets at ${resetDate.toLocaleTimeString()}` : '';

      return JSON.stringify({
        error: `GitHub API rate limit exceeded.${resetMsg}\n\nTo increase limits (60→5000 req/hr), create a GitHub personal access token:\n1. Visit https://github.com/settings/tokens\n2. Generate token (no special permissions needed)\n3. Save to ~/.eugent/github_token.txt`,
      });
    }

    if (!response.ok) {
      return JSON.stringify({
        error: `GitHub API error: ${response.status} ${response.statusText}`,
      });
    }

    // Parse response
    const data: any = await response.json();
    const items = data.items || [];
    const totalCount = data.total_count || 0;

    // Format results as markdown
    let markdown = `# GitHub ${type === 'repositories' ? 'Repository' : 'Issue'} Search Results\n\n`;
    markdown += `**Query:** ${query}\n`;
    markdown += `**Results:** ${items.length} of ${totalCount.toLocaleString()} total\n\n`;

    if (items.length === 0) {
      markdown += 'No results found.\n';
    } else {
      markdown += '---\n\n';

      const formattedItems = items.map((item: any) =>
        type === 'repositories' ? formatRepository(item) : formatIssue(item)
      );

      markdown += formattedItems.join('\n\n---\n\n');
    }

    // Check size
    const markdownSize = Buffer.byteLength(markdown, 'utf8');
    if (markdownSize > MAX_CONTENT_SIZE) {
      const sizeKB = Math.round(markdownSize / 1024);
      return JSON.stringify({
        error: `Results too large (${sizeKB}KB > 200KB limit). Found ${items.length} results. Try reducing the limit parameter or using a more specific query.`,
        query,
        type,
        results_found: items.length,
        size_kb: sizeKB,
      });
    }

    logger.info('GitHub search completed', {
      query,
      type,
      resultsFound: items.length,
      totalCount,
      markdownSize,
    });

    return JSON.stringify({
      query,
      type,
      results_found: items.length,
      total_count: totalCount,
      markdown_size: markdownSize,
      content: markdown,
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return JSON.stringify({
          error: 'Request timeout - GitHub API took too long to respond',
          query: args.query,
        });
      }

      logger.error('GitHub search failed', {
        query: args.query,
        type: args.type,
        error: error.message,
      });

      return JSON.stringify({
        error: error.message,
        query: args.query,
      });
    }

    return JSON.stringify({
      error: 'Failed to search GitHub: Unknown error',
      query: args.query,
    });
  }
}
