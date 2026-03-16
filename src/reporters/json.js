import { BaseReporter } from './base.js';

/**
 * JSON output reporter
 * Ideal for: Slack webhooks, APIs, custom integrations, logging systems
 */
export class JsonReporter extends BaseReporter {
  constructor(options = {}) {
    super(options);
    this.output = null;
    this.startTime = null;
  }

  onStart(config) {
    this.startTime = Date.now();
    this.config = {
      serverUrl: config.serverUrl,
      protocol: config.protocol,
    };
  }

  onComplete(results, summary) {
    const endTime = Date.now();
    
    this.output = {
      timestamp: new Date().toISOString(),
      duration: endTime - this.startTime,
      config: this.config,
      summary: {
        total: summary.total,
        tested: summary.tested,
        skipped: summary.skipped,
        successful: summary.successful,
        matched: summary.matched,
        failed: summary.failed,
        avgResponseTime: summary.avgTime,
        status: summary.failed === 0 ? 'pass' : 'fail',
      },
      results: results.map(r => ({
        tool: r.toolName,
        status: r.skipped ? 'skipped' : (r.success ? 'pass' : 'fail'),
        matched: r.matched ?? null,
        responseTime: r.responseTime ?? null,
        error: r.error ?? null,
        matchDetails: r.matchDetails ?? [],
      })),
    };

    // Pretty print if not piped
    const jsonString = this.options.pretty !== false
      ? JSON.stringify(this.output, null, 2)
      : JSON.stringify(this.output);

    console.log(jsonString);
  }

  getOutput() {
    return this.output;
  }
}
