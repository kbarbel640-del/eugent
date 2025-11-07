/**
 * HTTP Client Interface
 * Abstraction layer over fetch API to enable testing and mocking
 */

export interface IHttpClient {
  /**
   * Fetch a URL with optional configuration
   * @param url - URL to fetch
   * @param options - Fetch options (headers, method, etc.)
   * @returns Promise resolving to Response
   */
  fetch(url: string, options?: RequestInit): Promise<Response>;
}

/**
 * Real HTTP Client Implementation
 * Production implementation using native fetch API
 */
export class FetchHttpClient implements IHttpClient {
  async fetch(url: string, options?: RequestInit): Promise<Response> {
    return fetch(url, options);
  }
}

/**
 * Default HTTP client instance
 * Web tools should import and use this singleton
 */
export const httpClient: IHttpClient = new FetchHttpClient();
