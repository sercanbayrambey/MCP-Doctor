import { BaseReporter } from './base.js';

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
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
};

const c = {
  success: (text) => `${colors.green}${text}${colors.reset}`,
  error: (text) => `${colors.red}${text}${colors.reset}`,
  warning: (text) => `${colors.yellow}${text}${colors.reset}`,
  info: (text) => `${colors.cyan}${text}${colors.reset}`,
  dim: (text) => `${colors.dim}${text}${colors.reset}`,
  bold: (text) => `${colors.bold}${text}${colors.reset}`,
  highlight: (text) => `${colors.bold}${colors.cyan}${text}${colors.reset}`,
};

/**
 * Human-readable console output reporter
 */
export class ConsoleReporter extends BaseReporter {
  constructor(options = {}) {
    super(options);
    this.phase = 0;
  }

  onStart(config) {
    console.log('\n' + c.highlight(' MCP Tool Health Checker'));
    console.log(c.dim('='.repeat(50)));
    console.log(`  ${c.bold('Server:')}   ${c.info(config.serverUrl)}`);
    console.log(`  ${c.bold('Protocol:')} ${config.protocol}`);
    console.log(c.dim('='.repeat(50)));
    console.log('\n' + c.info('[1/3]') + ' Fetching tools...');
  }

  onToolsFetched(tools) {
    console.log(`  Found ${c.bold(tools.length)} tools\n`);
    console.log(c.info('[2/3]') + ' Loading test cases...');
  }

  onTestCasesLoaded(testCases) {
    console.log(`  Loaded ${c.bold(testCases.size)} test cases\n`);
    console.log(c.info('[3/3]') + ' Running tests...');
  }

  onTestStart(toolName) {
    // Progress is shown in onTestEnd
  }

  onTestEnd(result) {
    if (result.skipped) {
      console.log(`  ${c.dim('[-]')} ${c.dim(result.toolName)}: ${c.warning('No test case, skipped')}`);
    } else if (!result.success) {
      console.log(`  ${c.error('[✗]')} ${c.error(result.toolName)}: ${c.error(result.error)}`);
    } else {
      const icon = result.matched ? c.success('[✓]') : c.warning('[~]');
      const name = result.matched ? c.success(result.toolName) : result.toolName;
      const time = c.dim(`(${result.responseTime}ms)`);
      console.log(`  ${icon} ${name} ${time}`);
    }
  }

  onComplete(results, summary) {
    console.log('\n' + c.dim('='.repeat(50)));
    console.log(c.bold(' SUMMARY'));
    console.log(c.dim('='.repeat(50)));
    console.log(`  Total Tools    : ${c.bold(summary.total)}`);
    console.log(`  Tested         : ${c.bold(summary.tested)}`);
    console.log(`  Skipped        : ${summary.skipped > 0 ? c.warning(summary.skipped) : c.dim(summary.skipped)}`);
    console.log(`  Successful     : ${summary.successful > 0 ? c.success(summary.successful) : c.dim(summary.successful)}`);
    console.log(`  Response Match : ${summary.matched > 0 ? c.success(summary.matched) : c.dim(summary.matched)}`);
    console.log(`  Failed         : ${summary.failed > 0 ? c.error(summary.failed) : c.success(summary.failed)}`);
    console.log(`  Avg Time       : ${c.dim(summary.avgTime + 'ms')}`);

    const failed = results.filter(r => !r.success && !r.skipped);
    if (failed.length > 0) {
      console.log('\n  ' + c.error('Failed Tools:'));
      failed.forEach(r => console.log(`    ${c.error('•')} ${c.error(r.toolName)}: ${r.error}`));
    }

    console.log(c.dim('='.repeat(50)) + '\n');
  }
}
