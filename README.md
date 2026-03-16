# mcp-doctor

Automated testing and validation framework for MCP server tools.

## How It Works

1. Fetches tool list from server via configured endpoint
2. Loads test cases from JSON files in `tools/` directory
3. Calls each tool with the provided request data
4. Compares responses with expected values

## Setup

```bash
npm install
cp .env.example .env
cp base-request.example.json base-request.json
cp variables.example.json variables.json
```

## Configuration

### Environment Variables (`.env`)

```env
MCP_SERVER_URL=http://localhost:3000
MCP_PROTOCOL=mcp                    # "mcp" (JSON-RPC) or "rest"

# Single endpoint (MCP spec standard - streamable HTTP)
MCP_ENDPOINT=/mcp

# Or separate endpoints (legacy/custom setups)
# TOOLS_LIST_ENDPOINT=/tools/list
# TOOLS_CALL_ENDPOINT=/tools/call

REQUEST_TIMEOUT=30000
TOOLS_DIR=./tools
BASE_REQUEST_PATH=./base-request.json
VARIABLES_PATH=./variables.json     # Variables for test cases
OUTPUT_FORMAT=console               # "console", "json", "junit"
```

> **Note:** If `MCP_ENDPOINT` is set, it will be used for all MCP calls (tools/list, tools/call).
> The `method` field in JSON-RPC determines the operation. This is the standard MCP approach.
> Streamable HTTP (SSE) responses are automatically handled.

### Variables (`variables.json`)

Define variables for use in test cases with `${VAR_NAME}` syntax:

```json
{
  "ADDRESS_ID": 231231,
  "PRODUCT_ID": 123
}
```

Then use in test cases:
```json
{
  "toolName": "addToGroceryCart",
  "request": {
    "addressId": "${ADDRESS_ID}",
    "items": [{ "productId": "${PRODUCT_ID}", "quantity": 1 }]
  }
}
```

**Variable sources (in priority order):**
1. `variables.json` file
2. Environment variables (`.env`)

This allows sensitive values to be kept in `.env` while test-specific values go in `variables.json`.

### Base Request (`base-request.json`)

Configure headers, auth, and query params for all requests:

```json
{
  "headers": {
    "Content-Type": "application/json",
    "X-Custom-Header": "value"
  },
  "auth": {
    "type": "bearer",
    "token": "your-token"
  },
  "queryParams": {
    "version": "v1"
  },
  "timeout": 5000
}
```

**Auth types supported:**
- `none` - No authentication
- `bearer` - Bearer token (`Authorization: Bearer <token>`)
- `basic` - Basic auth (`Authorization: Basic <base64>`)
- `api-key` - API key header
- `oauth` / `oauth2` - OAuth 2.0 (client_credentials, password grant)

Auth tokens can reference env vars:
```json
{
  "auth": {
    "type": "bearer"
  }
}
```
Then set `AUTH_TOKEN` in `.env`.

### OAuth 2.0 Configuration

For OAuth authentication, configure the `oauth` section:

**Client Credentials Grant:**
```json
{
  "auth": {
    "type": "oauth"
  },
  "oauth": {
    "tokenUrl": "https://auth.example.com/oauth/token",
    "clientId": "your-client-id",
    "clientSecret": "your-client-secret",
    "grantType": "client_credentials",
    "scope": "read write"
  }
}
```

**Password Grant:**
```json
{
  "auth": {
    "type": "oauth"
  },
  "oauth": {
    "tokenUrl": "https://auth.example.com/oauth/token",
    "clientId": "your-client-id",
    "clientSecret": "your-client-secret",
    "grantType": "password",
    "username": "user@example.com",
    "password": "secret",
    "scope": "read write"
  }
}
```

**Using Environment Variables:**
```json
{
  "auth": {
    "type": "oauth"
  },
  "oauth": {
    "tokenUrl": "https://auth.example.com/oauth/token",
    "grantType": "client_credentials"
  }
}
```
Set in `.env`:
```env
OAUTH_CLIENT_ID=your-client-id
OAUTH_CLIENT_SECRET=your-client-secret
OAUTH_SCOPE=read write
```

**Features:**
- Automatic token caching (avoids redundant token requests)
- Token refresh before expiry (with 60s buffer)
- Refresh token support (when provided by server)
- Falls back to env vars for sensitive credentials

## Usage

```bash
# Run all tests (default console output)
npm start

# Run specific tool(s)
npm start -- getProviders
npm start -- getProviders getDeliveryAddresses
npm start -- getProviders.json          # .json extension is optional

# With specific output format
npm start -- --format json
npm start -- --format junit

# Combine: specific tools with format
npm start -- -f json getProviders getCustomerWallet

# Save to file
npm start -- -f junit > test-results.xml
npm start -- -f json > results.json

# Using environment variable
OUTPUT_FORMAT=json npm start
```

### CLI Options

| Option | Description |
|--------|-------------|
| `tool1 tool2 ...` | Specific tool names to test (optional) |
| `-f, --format <type>` | Output format: `console`, `json`, `junit` |
| `-h, --help` | Show help message |

## Output Formats

### Console (default)
Human-readable output for terminal use.

### JSON
Machine-readable format for integrations:
- Slack webhooks
- Custom monitoring dashboards
- API consumers
- Logging systems (ELK, Datadog, etc.)

```json
{
  "timestamp": "2026-03-11T10:30:00.000Z",
  "duration": 1234,
  "summary": {
    "total": 5,
    "tested": 4,
    "failed": 0,
    "status": "pass"
  },
  "results": [...]
}
```

### JUnit XML
Standard test format for CI/CD systems:
- GitHub Actions
- Jenkins
- GitLab CI
- CircleCI
- Azure DevOps

```yaml
# .github/workflows/health-check.yml
- name: Run MCP Health Check
  run: npm start -- --format junit > test-results.xml

- name: Upload Test Results
  uses: actions/upload-artifact@v3
  with:
    name: test-results
    path: test-results.xml
```

## Tool Test Case Format

Create a JSON file in `tools/` for each tool you want to test.

### Skipping Tests

To skip a test, prefix the filename with `_` (underscore):
```
tools/
├── getProviders.json          # Will be executed
├── searchProducts.json        # Will be executed
└── _placeOrder.json           # SKIPPED (starts with _)
```

This is useful for:
- Dangerous operations (e.g., placing real orders)
- Tests requiring manual setup
- Temporarily disabling tests

### Basic Example (Exact Matching)

```json
{
  "toolName": "my_tool",
  "description": "Optional description",
  "priority": 10,
  "request": {
    "param1": "value1",
    "param2": 123
  },
  "expectedResponse": {
    "success": true,
    "data": "expected"
  }
}
```

### Advanced Example (With Matchers)

Use `matchers` array for flexible response validation including regex:

```json
{
  "toolName": "create_user",
  "priority": 5,
  "request": {
    "name": "John"
  },
  "matchers": [
    {
      "type": "exact",
      "path": "status",
      "value": "success"
    },
    {
      "type": "regex",
      "path": "data.id",
      "pattern": "^[a-f0-9-]{36}$",
      "flags": "i"
    },
    {
      "type": "contains",
      "path": "message",
      "value": "created"
    },
    {
      "type": "exists",
      "path": "data.createdAt"
    },
    {
      "type": "type",
      "path": "data.tags",
      "value": "array"
    }
  ]
}
```

### Fields Reference

| Field | Required | Description |
|-------|----------|-------------|
| `toolName` | Yes | Tool name (must match server) |
| `description` | No | Test case description |
| `priority` | No | Execution order (lower = first, default: 100) |
| `request` | Yes | Arguments to send to the tool |
| `expectedResponse` | No | Exact response matching (legacy) |
| `matchers` | No | Array of flexible matchers (see below) |

### Matcher Types

| Type | Description | Fields |
|------|-------------|--------|
| `exact` | Exact value match | `path` (optional), `value` |
| `regex` | Regular expression match | `path` (optional), `pattern`, `flags` (optional) |
| `contains` | String/array contains | `path` (optional), `value` |
| `exists` | Check path exists | `path`, `value` (true/false, default: true) |
| `type` | Check value type | `path` (optional), `value` (string/number/boolean/array/object) |
| `notTrue` | Pass if field doesn't exist or is not `true` | `path` |

#### notTrue Matcher

The `notTrue` matcher is useful for checking error flags like `isError`. It passes if:
- The field doesn't exist, OR
- The field exists but is not `true` (e.g., `false`, `null`, etc.)

It only fails when the field exists AND equals `true`.

```json
{
  "matchers": [
    {
      "type": "notTrue",
      "path": "isError"
    }
  ]
}
```

This is particularly useful for MCP responses where `isError` may not be present in success responses but is `true` in error responses.

> **Note:** When `path` is omitted, the matcher applies to the **entire response**. For `regex` and `contains`, the full response is converted to a JSON string before matching.

### Examples Without Path (Full Response Matching)

```json
{
  "matchers": [
    {
      "type": "regex",
      "pattern": "success|completed",
      "flags": "i"
    },
    {
      "type": "contains",
      "value": "\"status\":\"ok\""
    }
  ]
}
```

### Path Syntax

Use dot notation to access nested values. Array indices supported:

- `status` - Root level field
- `data.user.name` - Nested object
- `data.items[0].id` - Array index
- `result.users.0.email` - Alternative array syntax

### Priority

Tools are tested in priority order (lower number = runs first):
- Priority `1-10`: Critical tools (auth, health checks)
- Priority `11-50`: Core functionality
- Priority `51-100`: Standard tools (default)
- Priority `100+`: Low priority / optional

## Project Structure

```
mcp-tool-health-checker/
├── src/
│   ├── index.js           # Entry point
│   ├── config.js          # Configuration
│   ├── toolTester.js      # Test runner
│   ├── baseRequest.js     # Base request loader
│   ├── responseMatcher.js # Response matching utilities
│   ├── variables.js       # Variable substitution (${VAR})
│   ├── oauth.js           # OAuth 2.0 token management
│   ├── protocols/
│   │   ├── index.js       # Protocol factory
│   │   ├── base.js        # Base protocol class
│   │   ├── mcp.js         # MCP (JSON-RPC) protocol
│   │   └── rest.js        # REST protocol
│   └── reporters/
│       ├── index.js       # Reporter factory
│       ├── base.js        # Base reporter class
│       ├── console.js     # Human-readable output
│       ├── json.js        # JSON output (APIs, Slack)
│       └── junit.js       # JUnit XML (CI/CD)
├── tools/                 # Tool test cases
├── variables.json         # Test case variables
├── base-request.json      # Base request config
├── .env                   # Environment config
└── package.json
```

## Output

```
 MCP Tool Health Checker
==================================================
  Server:   http://localhost:3000
  Protocol: mcp
==================================================

[1/3] Fetching tools...
  Found 5 tools

[2/3] Loading test cases...
  Loaded: auth_check (priority: 1)
  Loaded: create_user (priority: 10)
  Loaded: list_items (priority: 50)
  Loaded 3 test cases

[3/3] Running tests...
  [✓] auth_check (12ms)
  [✓] create_user (45ms)
  [~] list_items (38ms)        # Success but response mismatch
  [-] other_tool: No test case, skipped

==================================================
 SUMMARY
==================================================
  Total Tools    : 4
  Tested         : 3
  Skipped        : 1
  Successful     : 3
  Response Match : 2
  Failed         : 0
  Avg Time       : 32ms
==================================================
```
