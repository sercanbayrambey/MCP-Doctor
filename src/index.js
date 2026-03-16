import { ToolTester } from './toolTester.js';
import { enableDebug } from './debug.js';

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    tools: [],
    debug: false,
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--format' || arg === '-f') {
      options.format = args[++i];
    } else if (arg === '--verbose' || arg === '-v' || arg === '--debug') {
      options.debug = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
MCP Tool Health Checker

Usage: npm start -- [options] [tool1] [tool2] ...

Arguments:
  tool1, tool2, ...    Specific tool names to test (optional, runs all if omitted)
                       Can be with or without .json extension

Options:
  -f, --format <type>  Output format: console, json, junit (default: console)
  -v, --verbose        Show detailed request/response logs (debug mode)
  -h, --help           Show this help message

Environment Variables:
  MCP_SERVER_URL       Server URL (default: http://localhost:3000)
  MCP_PROTOCOL         Protocol type: mcp, rest (default: mcp)
  OUTPUT_FORMAT        Default output format (default: console)
  DEBUG=true           Enable debug mode (same as --verbose)

Examples:
  npm start                              # Run all tests
  npm start -- getProviders              # Run single tool
  npm start -- getProviders getCustomerWallet  # Run multiple tools
  npm start -- --format json             # All tests with JSON output
  npm start -- -f junit getProviders     # Single tool with JUnit output
  npm start -- -v getProviders           # With debug output
  DEBUG=true npm start                   # Debug via env var
`);
      process.exit(0);
    } else if (!arg.startsWith('-')) {
      // Tool name - remove .json extension if present
      const toolName = arg.replace(/\.json$/, '');
      options.tools.push(toolName);
    }
  }
  
  return options;
}

/**
 * Main entry point
 */
async function main() {
  try {
    const options = parseArgs();
    
    // Enable debug mode if requested
    if (options.debug) {
      enableDebug();
    }
    
    const tester = await ToolTester.create(options.format);
    
    let summary;
    if (options.tools.length > 0) {
      // Run specific tools
      const result = await tester.runSpecific(options.tools);
      summary = result.summary;
    } else {
      // Run all tools
      const result = await tester.run();
      summary = result.summary;
    }
    
    // Exit code: 1 if any tests failed, 0 otherwise
    process.exit(summary.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
