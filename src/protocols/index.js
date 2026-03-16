import { McpProtocol } from './mcp.js';
import { RestProtocol } from './rest.js';

const protocols = {
  mcp: McpProtocol,
  rest: RestProtocol,
};

/**
 * Create a protocol adapter based on type
 * @param {string} type - Protocol type ('mcp' or 'rest')
 * @param {object} config - Protocol configuration
 * @param {object} baseRequest - Base request configuration
 * @returns {BaseProtocol} Protocol adapter instance
 */
export function createProtocol(type, config, baseRequest = {}) {
  const Protocol = protocols[type];
  
  if (!Protocol) {
    const available = Object.keys(protocols).join(', ');
    throw new Error(`Unknown protocol: "${type}". Available: ${available}`);
  }
  
  return new Protocol(config, baseRequest);
}

export { McpProtocol, RestProtocol };
