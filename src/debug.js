import { config } from './config.js';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const c = {
  success: (text) => `${colors.green}${text}${colors.reset}`,
  error: (text) => `${colors.red}${text}${colors.reset}`,
  warning: (text) => `${colors.yellow}${text}${colors.reset}`,
  info: (text) => `${colors.cyan}${text}${colors.reset}`,
  dim: (text) => `${colors.dim}${text}${colors.reset}`,
  bold: (text) => `${colors.bold}${text}${colors.reset}`,
  method: (text) => `${colors.bold}${colors.magenta}${text}${colors.reset}`,
};

/**
 * Debug logger - only logs when DEBUG=true
 */
export const debug = {
  enabled: config.debug,
  
  log(...args) {
    if (this.enabled) {
      console.log(c.dim('[DEBUG]'), ...args);
    }
  },
  
  request(method, url, headers, body) {
    if (!this.enabled) return;
    
    console.log('\n' + c.info('┌─────────────────────────────────────────'));
    console.log(c.info('│') + c.bold(' REQUEST'));
    console.log(c.info('├─────────────────────────────────────────'));
    console.log(c.info('│') + ` ${c.method(method)} ${c.info(url)}`);
    console.log(c.info('│') + c.dim(' Headers:'));
    for (const [key, value] of Object.entries(headers)) {
      // Mask sensitive headers
      const displayValue = key.toLowerCase() === 'authorization' 
        ? value.substring(0, 15) + '...' 
        : value;
      console.log(c.info('│') + `   ${c.dim(key + ':')} ${displayValue}`);
    }
    if (body) {
      console.log(c.info('│') + c.dim(' Body:'));
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
      bodyStr.split('\n').forEach(line => console.log(c.info('│') + `   ${line}`));
    }
    console.log(c.info('└─────────────────────────────────────────') + '\n');
  },
  
  response(status, statusText, headers, body, duration) {
    if (!this.enabled) return;
    
    const isSuccess = status >= 200 && status < 300;
    const statusIcon = isSuccess ? c.success('✓') : c.error('✗');
    const statusLine = isSuccess 
      ? c.success(`${status} ${statusText}`) 
      : c.error(`${status} ${statusText}`);
    const borderColor = isSuccess ? c.success : c.error;
    
    console.log('\n' + borderColor('┌─────────────────────────────────────────'));
    console.log(borderColor('│') + c.bold(' RESPONSE'));
    console.log(borderColor('├─────────────────────────────────────────'));
    console.log(borderColor('│') + ` ${statusIcon} ${statusLine} ${c.dim(`(${duration}ms)`)}`);
    console.log(borderColor('│') + c.dim(' Headers:'));
    if (headers) {
      for (const [key, value] of headers.entries ? headers.entries() : Object.entries(headers)) {
        console.log(borderColor('│') + `   ${c.dim(key + ':')} ${value}`);
      }
    }
    if (body) {
      console.log(borderColor('│') + c.dim(' Body:'));
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
      const lines = bodyStr.split('\n');
      const maxLines = 50;
      lines.slice(0, maxLines).forEach(line => console.log(borderColor('│') + `   ${line}`));
      if (lines.length > maxLines) {
        console.log(borderColor('│') + c.dim(`   ... (${lines.length - maxLines} more lines)`));
      }
    }
    console.log(borderColor('└─────────────────────────────────────────') + '\n');
  },
  
  error(message, error) {
    if (!this.enabled) return;
    
    console.log('\n' + c.error('┌─────────────────────────────────────────'));
    console.log(c.error('│') + c.bold(c.error(' ERROR')));
    console.log(c.error('├─────────────────────────────────────────'));
    console.log(c.error('│') + ` ${message}`);
    if (error) {
      console.log(c.error('│') + ` ${error.message || error}`);
      if (error.stack) {
        error.stack.split('\n').slice(0, 5).forEach(line => console.log(c.error('│') + `   ${c.dim(line)}`));
      }
    }
    console.log(c.error('└─────────────────────────────────────────') + '\n');
  },
};

/**
 * Enable debug mode programmatically
 */
export function enableDebug() {
  debug.enabled = true;
}

/**
 * Disable debug mode programmatically
 */
export function disableDebug() {
  debug.enabled = false;
}
