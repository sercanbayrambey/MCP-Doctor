/**
 * OAuth client for token management
 * Supports: Client Credentials, Password Grant, Refresh Token
 */

// Token cache
let tokenCache = {
  accessToken: null,
  refreshToken: null,
  expiresAt: null,
  tokenType: 'Bearer',
};

/**
 * Get a valid OAuth token, fetching or refreshing if needed
 * @param {object} oauthConfig - OAuth configuration
 * @returns {Promise<string>} Access token
 */
export async function getOAuthToken(oauthConfig) {
  // Check if cached token is still valid (with 30s buffer)
  if (tokenCache.accessToken && tokenCache.expiresAt) {
    const now = Date.now();
    if (now < tokenCache.expiresAt - 30000) {
      return tokenCache.accessToken;
    }
  }

  // Try refresh token first if available
  if (tokenCache.refreshToken && oauthConfig.refreshToken !== false) {
    try {
      await refreshAccessToken(oauthConfig);
      return tokenCache.accessToken;
    } catch (error) {
      // Refresh failed, get new token
      console.error('Token refresh failed, fetching new token...');
    }
  }

  // Get new token based on grant type
  await fetchNewToken(oauthConfig);
  return tokenCache.accessToken;
}

/**
 * Fetch a new token from OAuth server
 */
async function fetchNewToken(config) {
  const grantType = config.grantType || 'client_credentials';
  
  let body;
  switch (grantType) {
    case 'client_credentials':
      body = buildClientCredentialsBody(config);
      break;
    case 'password':
      body = buildPasswordGrantBody(config);
      break;
    default:
      throw new Error(`Unsupported grant type: ${grantType}`);
  }

  await requestToken(config, body);
}

/**
 * Refresh access token using refresh token
 */
async function refreshAccessToken(config) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: tokenCache.refreshToken,
    client_id: config.clientId || process.env.OAUTH_CLIENT_ID,
  });

  if (config.clientSecret || process.env.OAUTH_CLIENT_SECRET) {
    body.set('client_secret', config.clientSecret || process.env.OAUTH_CLIENT_SECRET);
  }

  await requestToken(config, body);
}

/**
 * Build client credentials grant body
 */
function buildClientCredentialsBody(config) {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.clientId || process.env.OAUTH_CLIENT_ID,
    client_secret: config.clientSecret || process.env.OAUTH_CLIENT_SECRET,
  });

  if (config.scope) {
    body.set('scope', config.scope);
  }

  return body;
}

/**
 * Build password grant body
 */
function buildPasswordGrantBody(config) {
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: config.clientId || process.env.OAUTH_CLIENT_ID,
    username: config.username || process.env.OAUTH_USERNAME,
    password: config.password || process.env.OAUTH_PASSWORD,
  });

  if (config.clientSecret || process.env.OAUTH_CLIENT_SECRET) {
    body.set('client_secret', config.clientSecret || process.env.OAUTH_CLIENT_SECRET);
  }

  if (config.scope) {
    body.set('scope', config.scope);
  }

  return body;
}

/**
 * Make token request to OAuth server
 */
async function requestToken(config, body) {
  const tokenUrl = config.tokenUrl || process.env.OAUTH_TOKEN_URL;
  
  if (!tokenUrl) {
    throw new Error('OAuth token URL is required (tokenUrl or OAUTH_TOKEN_URL)');
  }

  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  // Some OAuth servers require Basic auth for client credentials
  if (config.useBasicAuth) {
    const clientId = config.clientId || process.env.OAUTH_CLIENT_ID;
    const clientSecret = config.clientSecret || process.env.OAUTH_CLIENT_SECRET;
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    headers['Authorization'] = `Basic ${credentials}`;
    body.delete('client_secret');
  }

  // Add any custom headers
  if (config.headers) {
    Object.assign(headers, config.headers);
  }

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers,
    body: body.toString(),
    signal: AbortSignal.timeout(config.timeout || 10000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OAuth token request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  
  // Update cache
  tokenCache.accessToken = data.access_token;
  tokenCache.tokenType = data.token_type || 'Bearer';
  
  if (data.refresh_token) {
    tokenCache.refreshToken = data.refresh_token;
  }
  
  if (data.expires_in) {
    tokenCache.expiresAt = Date.now() + (data.expires_in * 1000);
  } else {
    // Default to 1 hour if not specified
    tokenCache.expiresAt = Date.now() + 3600000;
  }
}

/**
 * Clear the token cache (useful for testing or forced re-auth)
 */
export function clearTokenCache() {
  tokenCache = {
    accessToken: null,
    refreshToken: null,
    expiresAt: null,
    tokenType: 'Bearer',
  };
}

/**
 * Get current token info (for debugging)
 */
export function getTokenInfo() {
  return {
    hasToken: !!tokenCache.accessToken,
    hasRefreshToken: !!tokenCache.refreshToken,
    expiresAt: tokenCache.expiresAt ? new Date(tokenCache.expiresAt).toISOString() : null,
    tokenType: tokenCache.tokenType,
  };
}
