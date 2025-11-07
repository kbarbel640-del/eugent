import * as cheerio from 'cheerio';
import TurndownService from 'turndown';

/**
 * HTML Processing Utilities
 * Converts HTML to clean markdown with aggressive content filtering
 */

/**
 * Aggressively strip HTML to only keep main content
 * Removes navigation, ads, footers, headers, sidebars, etc.
 * @param html - Raw HTML string
 * @returns Cleaned HTML containing only main content
 */
export function stripToMainContent(html: string): string {
  const $ = cheerio.load(html);

  $(
    'script, style, noscript, iframe, object, embed, ' +
    'nav, header, footer, aside, ' +
    '[role="navigation"], [role="banner"], [role="complementary"], [role="contentinfo"], ' +
    '.nav, .navbar, .header, .footer, .sidebar, .ads, .advertisement, ' +
    '.social, .share, .comments, .related, .recommended'
  ).remove();

  const mainSelectors = [
    'main',
    'article',
    '[role="main"]',
    '.main-content',
    '.content',
    '#content',
    '.article',
    '.post',
    '.documentation',
  ];

  for (const selector of mainSelectors) {
    const main = $(selector);
    if (main.length > 0) {
      return main.html() || '';
    }
  }

  return $('body').html() || '';
}

/**
 * Convert HTML to Markdown using turndown with aggressive stripping
 * @param html - Raw HTML string
 * @returns Clean markdown text
 */
export function convertHTMLToMarkdown(html: string): string {
  const strippedHtml = stripToMainContent(html);

  const turndownService = new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
  });

  turndownService.remove([
    'script', 'style', 'meta', 'link', 'noscript', 'iframe',
    'nav', 'header', 'footer', 'aside', 'svg', 'canvas'
  ]);

  turndownService.addRule('images', {
    filter: 'img',
    replacement: (content, node: any) => {
      const alt = node.getAttribute('alt');
      return alt ? `[Image: ${alt}]` : '';
    },
  });

  turndownService.addRule('links', {
    filter: 'a',
    replacement: (content, node: any) => {
      const href = node.getAttribute('href');
      if (!href || href.startsWith('#')) {
        return content;
      }
      return `[${content}](${href})`;
    },
  });

  const markdown = turndownService.turndown(strippedHtml);

  return markdown
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}
