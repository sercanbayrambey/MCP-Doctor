import { applyAuthAsync } from '../baseRequest.js';

/**
 * Base protocol adapter interface
 */
export class BaseProtocol {
  constructor(config, baseRequest = {}) {
    this.config = config;
    this.baseRequest = baseRequest;
  }

  /**
   * Build headers with base request config and auth (async for OAuth)
   */
  async buildHeaders(extraHeaders = {}) {
    let headers = {
      ...(this.baseRequest.headers || {}),
      ...extraHeaders,
    };
    
    if (this.baseRequest.auth) {
      headers = await applyAuthAsync(headers, this.baseRequest.auth);
    }
    
    return headers;
  }

  /**
   * Build URL with query params from base request
   * If path is empty/null, uses serverUrl directly
   */
  buildUrl(path) {
    // If no path (empty or null), use serverUrl directly
    const baseUrl = path ? new URL(path, this.config.serverUrl) : new URL(this.config.serverUrl);
    
    if (this.baseRequest.queryParams) {
      for (const [key, value] of Object.entries(this.baseRequest.queryParams)) {
        baseUrl.searchParams.set(key, value);
      }
    }
    
    return baseUrl.toString();
  }

  /**
   * Get timeout value
   */
  getTimeout() {
    return this.baseRequest.timeout || this.config.timeout;
  }

  /**
   * Fetch list of available tools
   * @returns {Promise<Array>} List of tools
   */
  async fetchTools() {
    throw new Error('fetchTools() must be implemented');
  }

  /**
   * Call a specific tool with arguments
   * @param {string} toolName - Name of the tool
   * @param {object} args - Tool arguments
   * @returns {Promise<object>} Tool response
   */
  async callTool(toolName, args) {
    throw new Error('callTool() must be implemented');
  }
}
