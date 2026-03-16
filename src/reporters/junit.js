import { BaseReporter } from './base.js';

/**
 * JUnit XML output reporter
 * Ideal for: GitHub Actions, Jenkins, GitLab CI, CircleCI, Azure DevOps
 */
export class JunitReporter extends BaseReporter {
  constructor(options = {}) {
    super(options);
    this.output = null;
    this.startTime = null;
  }

  onStart() {
    this.startTime = Date.now();
  }

  onComplete(results, summary) {
    const duration = (Date.now() - this.startTime) / 1000;
    const timestamp = new Date().toISOString();
    
    const testcases = results.map(r => this.buildTestCase(r)).join('\n');
    
    this.output = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="MCP Tool Health Check" tests="${summary.total}" failures="${summary.failed}" skipped="${summary.skipped}" time="${duration.toFixed(3)}" timestamp="${timestamp}">
  <testsuite name="tools" tests="${summary.total}" failures="${summary.failed}" skipped="${summary.skipped}" time="${duration.toFixed(3)}">
${testcases}
  </testsuite>
</testsuites>`;

    console.log(this.output);
  }

  buildTestCase(result) {
    const time = ((result.responseTime || 0) / 1000).toFixed(3);
    const name = this.escapeXml(result.toolName);
    
    if (result.skipped) {
      return `    <testcase name="${name}" classname="mcp.tools" time="0">
      <skipped message="No test case found"/>
    </testcase>`;
    }
    
    if (!result.success) {
      const error = this.escapeXml(result.error || 'Unknown error');
      return `    <testcase name="${name}" classname="mcp.tools" time="${time}">
      <failure message="${error}" type="Error">${error}</failure>
    </testcase>`;
    }
    
    if (!result.matched) {
      const details = result.matchDetails
        ?.filter(d => !d.matched)
        .map(d => d.message)
        .join('; ') || 'Response mismatch';
      return `    <testcase name="${name}" classname="mcp.tools" time="${time}">
      <failure message="Response mismatch" type="AssertionError">${this.escapeXml(details)}</failure>
    </testcase>`;
    }
    
    return `    <testcase name="${name}" classname="mcp.tools" time="${time}"/>`;
  }

  escapeXml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  getOutput() {
    return this.output;
  }
}
