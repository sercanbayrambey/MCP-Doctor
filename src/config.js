import 'dotenv/config';

/**
 * Get env value with proper handling of empty strings
 * Empty string is valid (means "no path"), undefined uses default
 */
function getEnv(key, defaultValue) {
  const value = process.env[key];
  // If explicitly set (even to empty string), use it; otherwise use default
  return value !== undefined ? value : defaultValue;
}

/**
 * Application configuration loaded from environment variables
 */
export const config = {
  // MCP Server base URL (can include full endpoint path)
  serverUrl: process.env.MCP_SERVER_URL || 'http://localhost:3000',
  
  // Protocol type: 'mcp' (JSON-RPC) or 'rest'
  protocol: process.env.MCP_PROTOCOL || 'mcp',
  
  // API endpoints
  // For MCP: set MCP_ENDPOINT for single endpoint, or use separate endpoints
  // If MCP_SERVER_URL includes full path, set endpoints to empty string
  mcpEndpoint: getEnv('MCP_ENDPOINT', null),
  toolsListEndpoint: getEnv('TOOLS_LIST_ENDPOINT', '/tools/list'),
  toolCallEndpoint: getEnv('TOOLS_CALL_ENDPOINT', '/tools/call'),
  
  // Directory containing tool test case JSON files
  toolsDir: process.env.TOOLS_DIR || './tools',
  
  // Base request configuration file path
  baseRequestPath: process.env.BASE_REQUEST_PATH || './base-request.json',
  
  // Variables file path for ${VAR_NAME} substitution
  variablesPath: process.env.VARIABLES_PATH || './variables.json',
  
  // Request timeout in milliseconds
  timeout: parseInt(process.env.REQUEST_TIMEOUT, 10) || 30000,
  
  // Output format: 'console', 'json', 'junit'
  outputFormat: process.env.OUTPUT_FORMAT || 'console',
  
  // Debug mode - shows detailed request/response logs
  debug: process.env.DEBUG === 'true' || process.env.DEBUG === '1',
};
