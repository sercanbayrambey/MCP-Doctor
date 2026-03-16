import { BaseProtocol } from './base.js';
import { debug } from '../debug.js';

/**
 * MCP Protocol adapter (JSON-RPC 2.0)
 * Supports streamable HTTP transport
 */
export class McpProtocol extends BaseProtocol {
  constructor(config, baseRequest) {
    super(config, baseRequest);
    this.requestId = 1;
    this.sessionId = null;
    this.initialized = false;
  }

  /**
   * Get next request ID
   */
  getNextId() {
    return this.requestId++;
  }

  /**
   * Get the MCP endpoint URL
   * Priority: mcpEndpoint > fallbackEndpoint > serverUrl directly
   * Empty string means use serverUrl as-is
   */
  getMcpUrl(fallbackEndpoint) {
    // mcpEndpoint takes priority if set (even to empty string)
    const endpoint = this.config.mcpEndpoint !== null 
      ? this.config.mcpEndpoint 
      : fallbackEndpoint;
    return this.buildUrl(endpoint);
  }

  /**
   * Initialize MCP session (required before other operations)
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    const url = this.getMcpUrl(this.config.toolsListEndpoint);
    const headers = await this.buildHeaders();
    headers['Accept'] = 'application/json, text/event-stream';

    const body = {
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'mcp-tool-health-checker',
          version: '1.0.0',
        },
      },
      id: this.getNextId(),
    };

    debug.request('POST', url, headers, body);

    const startTime = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.getTimeout()),
    });
    const duration = Date.now() - startTime;

    // Get session ID from response header
    const mcpSessionId = response.headers.get('mcp-session-id');
    if (mcpSessionId) {
      this.sessionId = mcpSessionId;
      debug.log('Session ID:', this.sessionId);
    }

    const responseText = await response.text();
    debug.response(response.status, response.statusText, response.headers, responseText, duration);

    if (!response.ok) {
      throw new Error(`Initialize failed: ${response.status} ${response.statusText}`);
    }

    // Parse response (may be SSE or JSON)
    let data;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/event-stream')) {
      const lines = responseText.split('\n');
      for (const line of lines) {
        if (line.startsWith('data:')) {
          const jsonStr = line.startsWith('data: ') 
            ? line.slice(6).trim() 
            : line.slice(5).trim();
          if (jsonStr) {
            try {
              data = JSON.parse(jsonStr);
            } catch {}
          }
        }
      }
    } else {
      data = JSON.parse(responseText);
    }

    // Send initialized notification
    await this.sendInitializedNotification();

    this.initialized = true;
    debug.log('MCP session initialized');
    
    return data;
  }

  /**
   * Send initialized notification (required by MCP protocol)
   */
  async sendInitializedNotification() {
    const url = this.getMcpUrl(this.config.toolsListEndpoint);
    const headers = await this.buildHeaders();
    headers['Accept'] = 'application/json, text/event-stream';
    
    if (this.sessionId) {
      headers['Mcp-Session-Id'] = this.sessionId;
    }

    const body = {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    };

    debug.request('POST', url, headers, body);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.getTimeout()),
    });

    debug.log('Initialized notification sent, status:', response.status);
  }

  /**
   * Parse response - handles both streaming and non-streaming
   */
  async parseResponse(response) {
    const contentType = response.headers.get('content-type') || '';
    
    // Handle SSE (Server-Sent Events) for streamable HTTP
    if (contentType.includes('text/event-stream')) {
      return this.parseSSEResponse(response);
    }
    
    // Standard JSON response
    return response.json();
  }

  /**
   * Parse SSE response (streamable HTTP)
   */
  async parseSSEResponse(response) {
    const text = await response.text();
    debug.log('SSE Response text:', text);
    
    const lines = text.split('\n');
    
    let lastData = null;
    for (const line of lines) {
      if (line.startsWith('data:')) {
        const dataStr = line.startsWith('data: ') 
          ? line.slice(6).trim() 
          : line.slice(5).trim();
        if (dataStr) {
          try {
            lastData = JSON.parse(dataStr);
          } catch {
            // Ignore parse errors for intermediate events
          }
        }
      }
    }
    
    return lastData;
  }

  async fetchTools() {
    // Initialize session first if needed
    await this.initialize();

    const url = this.getMcpUrl(this.config.toolsListEndpoint);
    const headers = await this.buildHeaders();
    
    // Add Accept header for streamable HTTP
    headers['Accept'] = 'application/json, text/event-stream';
    
    // Add session ID if we have one
    if (this.sessionId) {
      headers['Mcp-Session-Id'] = this.sessionId;
    }
    
    const body = {
      jsonrpc: '2.0',
      method: 'tools/list',
      params: {
        _meta: {},
      },
      id: this.getNextId(),
    };
    
    debug.request('POST', url, headers, body);
    
    const startTime = Date.now();
    let response;
    
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.getTimeout()),
      });
    } catch (error) {
      debug.error('Fetch failed', error);
      throw error;
    }
    
    const duration = Date.now() - startTime;

    // Read response body for logging
    const responseText = await response.text();
    let data;
    
    try {
      // Check if SSE
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream')) {
        debug.log('SSE Response:', responseText);
        const lines = responseText.split('\n');
        for (const line of lines) {
          // Handle both "data: " and "data:" formats
          if (line.startsWith('data:')) {
            const jsonStr = line.startsWith('data: ') 
              ? line.slice(6).trim() 
              : line.slice(5).trim();
            if (jsonStr) {
              try { data = JSON.parse(jsonStr); } catch {}
            }
          }
        }
      } else {
        data = JSON.parse(responseText);
      }
    } catch (parseError) {
      debug.error('Failed to parse response', parseError);
      debug.log('Raw response:', responseText);
    }
    
    debug.response(response.status, response.statusText, response.headers, data || responseText, duration);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    if (!data) {
      throw new Error('Failed to parse response as JSON');
    }
    
    if (data.error) {
      throw new Error(`RPC Error: ${data.error.message || JSON.stringify(data.error)}`);
    }

    return data.result?.tools || data.tools || [];
  }

  async callTool(toolName, args) {
    // Ensure session is initialized
    await this.initialize();

    const url = this.getMcpUrl(this.config.toolCallEndpoint);
    const headers = await this.buildHeaders();
    
    // Add Accept header for streamable HTTP
    headers['Accept'] = 'application/json, text/event-stream';
    
    // Add session ID if we have one
    if (this.sessionId) {
      headers['Mcp-Session-Id'] = this.sessionId;
    }
    
    const body = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args,
        _meta: {},
      },
      id: this.getNextId(),
    };
    
    debug.request('POST', url, headers, body);
    
    const startTime = Date.now();
    let response;
    
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.getTimeout()),
      });
    } catch (error) {
      debug.error('Fetch failed', error);
      throw error;
    }
    
    const duration = Date.now() - startTime;
    
    // Read response body for logging
    const responseText = await response.text();
    let data;
    
    try {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream')) {
        const lines = responseText.split('\n');
        for (const line of lines) {
          if (line.startsWith('data:')) {
            const jsonStr = line.startsWith('data: ') 
              ? line.slice(6).trim() 
              : line.slice(5).trim();
            if (jsonStr) {
              try { data = JSON.parse(jsonStr); } catch {}
            }
          }
        }
      } else {
        data = JSON.parse(responseText);
      }
    } catch (parseError) {
      debug.error('Failed to parse response', parseError);
    }
    
    debug.response(response.status, response.statusText, response.headers, data || responseText, duration);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    if (!data) {
      throw new Error('Failed to parse response as JSON');
    }

    if (data.error) {
      throw new Error(`RPC Error: ${data.error.message || JSON.stringify(data.error)}`);
    }

    return data.result || data;
  }
}
