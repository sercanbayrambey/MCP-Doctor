import fs from 'fs/promises';
import path from 'path';
import { config } from './config.js';
import { getOAuthToken } from './oauth.js';

/**
 * Load base request configuration from JSON file
 * @param {string} filePath - Path to base-request.json
 * @returns {Promise<object>} Base request config
 */
export async function loadBaseRequest(filePath = config.baseRequestPath) {
  const resolvedPath = path.resolve(filePath);
  
  try {
    const content = await fs.readFile(resolvedPath, 'utf-8');
    const baseConfig = JSON.parse(content);
    return normalizeBaseRequest(baseConfig);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, return defaults
      return getDefaultBaseRequest();
    }
    throw new Error(`Failed to load base-request.json: ${error.message}`);
  }
}

/**
 * Get default base request configuration
 */
function getDefaultBaseRequest() {
  return {
    headers: {
      'Content-Type': 'application/json',
    },
    auth: null,
    queryParams: {},
    timeout: null,
  };
}

/**
 * Normalize and validate base request config
 */
function normalizeBaseRequest(config) {
  const defaults = getDefaultBaseRequest();
  
  return {
    headers: {
      ...defaults.headers,
      ...(config.headers || {}),
    },
    auth: parseAuth(config.auth),
    queryParams: config.queryParams || {},
    timeout: config.timeout || null,
  };
}

/**
 * Parse auth configuration
 */
function parseAuth(auth) {
  if (!auth || auth.type === 'none') {
    return null;
  }
  
  switch (auth.type) {
    case 'bearer':
      return {
        type: 'bearer',
        token: auth.token || process.env.AUTH_TOKEN,
      };
    
    case 'basic':
      return {
        type: 'basic',
        username: auth.username || process.env.AUTH_USERNAME,
        password: auth.password || process.env.AUTH_PASSWORD,
      };
    
    case 'api-key':
      return {
        type: 'api-key',
        header: auth.header || 'X-API-Key',
        key: auth.key || process.env.API_KEY,
      };
    
    case 'oauth':
    case 'oauth2':
      return {
        type: 'oauth',
        tokenUrl: auth.tokenUrl || process.env.OAUTH_TOKEN_URL,
        clientId: auth.clientId || process.env.OAUTH_CLIENT_ID,
        clientSecret: auth.clientSecret || process.env.OAUTH_CLIENT_SECRET,
        grantType: auth.grantType || 'client_credentials',
        scope: auth.scope || process.env.OAUTH_SCOPE,
        username: auth.username || process.env.OAUTH_USERNAME,
        password: auth.password || process.env.OAUTH_PASSWORD,
        useBasicAuth: auth.useBasicAuth || false,
        headers: auth.headers,
        timeout: auth.timeout,
      };
    
    default:
      return auth;
  }
}

/**
 * Apply auth to headers (async for OAuth support)
 */
export async function applyAuthAsync(headers, auth) {
  if (!auth) return headers;
  
  const result = { ...headers };
  
  switch (auth.type) {
    case 'bearer':
      result['Authorization'] = `Bearer ${auth.token}`;
      break;
    
    case 'basic':
      const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
      result['Authorization'] = `Basic ${credentials}`;
      break;
    
    case 'api-key':
      result[auth.header] = auth.key;
      break;
    
    case 'oauth':
      const token = await getOAuthToken(auth);
      result['Authorization'] = `Bearer ${token}`;
      break;
  }
  
  return result;
}

/**
 * Apply auth to headers (sync, for backward compatibility)
 * Note: Does not support OAuth - use applyAuthAsync instead
 */
export function applyAuth(headers, auth) {
  if (!auth) return headers;
  if (auth.type === 'oauth') {
    throw new Error('OAuth requires async auth. Use applyAuthAsync instead.');
  }
  
  const result = { ...headers };
  
  switch (auth.type) {
    case 'bearer':
      result['Authorization'] = `Bearer ${auth.token}`;
      break;
    
    case 'basic':
      const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
      result['Authorization'] = `Basic ${credentials}`;
      break;
    
    case 'api-key':
      result[auth.header] = auth.key;
      break;
  }
  
  return result;
}
