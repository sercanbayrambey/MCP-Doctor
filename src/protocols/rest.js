import { BaseProtocol } from './base.js';

/**
 * REST Protocol adapter
 */
export class RestProtocol extends BaseProtocol {
  async fetchTools() {
    const url = this.buildUrl(this.config.toolsListEndpoint);
    const headers = await this.buildHeaders();
    
    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(this.getTimeout()),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.tools || data || [];
  }

  async callTool(toolName, args) {
    const baseUrl = this.buildUrl(this.config.toolCallEndpoint);
    const url = `${baseUrl}/${toolName}`;
    const headers = await this.buildHeaders();
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(this.getTimeout()),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }
}
