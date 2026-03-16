import fs from 'fs/promises';
import path from 'path';
import { config } from './config.js';
import { createProtocol } from './protocols/index.js';
import { loadBaseRequest } from './baseRequest.js';
import { matchResponse } from './responseMatcher.js';
import { createReporter } from './reporters/index.js';
import { processTestCase } from './variables.js';

/**
 * Manages tool health check tests
 */
export class ToolTester {
  constructor(baseRequest = {}, reporter = null) {
    this.results = [];
    this.protocol = createProtocol(config.protocol, config, baseRequest);
    this.reporter = reporter || createReporter(config.outputFormat);
  }

  /**
   * Create and initialize a ToolTester instance
   */
  static async create(outputFormat = null) {
    const baseRequest = await loadBaseRequest();
    const reporter = createReporter(outputFormat || config.outputFormat);
    return new ToolTester(baseRequest, reporter);
  }

  /**
   * Load tool test cases from JSON files
   * Returns array sorted by priority (lower = first)
   * Files starting with "_" are marked as skipped
   */
  async loadTestCases() {
    const toolsDir = path.resolve(config.toolsDir);
    const testCases = [];
    
    try {
      const files = await fs.readdir(toolsDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      for (const file of jsonFiles) {
        const filePath = path.join(toolsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const testCase = JSON.parse(content);
        
        // Files starting with "_" are skipped
        const isSkipped = file.startsWith('_');
        const baseName = isSkipped ? file.slice(1) : file;
        
        testCase.toolName = testCase.toolName || path.basename(baseName, '.json');
        testCase.priority = testCase.priority ?? 100;
        testCase.skip = isSkipped;
        if (isSkipped && !testCase.skipReason) {
          testCase.skipReason = 'Skipped (filename starts with _)';
        }
        testCases.push(testCase);
      }
    } catch (error) {
      // Silently handle - reporter will show count
    }
    
    // Sort by priority
    testCases.sort((a, b) => a.priority - b.priority);
    
    // Convert to Map
    const testCaseMap = new Map();
    for (const tc of testCases) {
      testCaseMap.set(tc.toolName, tc);
    }
    
    return testCaseMap;
  }

  /**
   * Test a single tool
   */
  async testTool(toolName, testCase) {
    // Substitute variables (${VAR_NAME}) in request
    const processedTestCase = await processTestCase({ ...testCase });
    
    const startTime = Date.now();
    
    this.reporter.onTestStart?.(toolName, processedTestCase);
    
    const result = {
      toolName,
      priority: processedTestCase.priority,
      success: false,
      responseTime: 0,
      error: null,
      actualResponse: null,
      matched: false,
      matchDetails: [],
    };
    
    try {
      result.actualResponse = await this.protocol.callTool(
        toolName,
        processedTestCase.request || {}
      );
      result.responseTime = Date.now() - startTime;
      
      const matchResult = matchResponse(processedTestCase, result.actualResponse);
      result.matched = matchResult.matched;
      result.matchDetails = matchResult.details;
      result.success = matchResult.matched;
      
      // Set error message from failed matchers
      if (!matchResult.matched) {
        const failed = matchResult.details.filter(d => !d.matched);
        result.error = failed.map(d => d.message).join('; ');
      }
      
    } catch (error) {
      result.responseTime = Date.now() - startTime;
      result.error = error.message;
    }
    
    this.results.push(result);
    this.reporter.onTestEnd?.(result);
    
    return result;
  }

  /**
   * Run all tool tests
   */
  async run() {
    this.reporter.onStart?.(config);
    
    // Fetch tool list from server
    let tools;
    try {
      tools = await this.protocol.fetchTools();
      this.reporter.onToolsFetched?.(tools);
    } catch (error) {
      // Cannot proceed without tools
      const summary = this.buildSummary();
      this.reporter.onComplete?.(this.results, summary);
      return { results: this.results, summary };
    }
    
    // Load test cases
    const testCases = await this.loadTestCases();
    this.reporter.onTestCasesLoaded?.(testCases);
    
    // Build ordered test list
    const toolNames = new Set(tools.map(t => t.name));
    const orderedTests = [];
    
    for (const [toolName, testCase] of testCases) {
      if (toolNames.has(toolName)) {
        orderedTests.push({ toolName, testCase, hasTestCase: true });
        toolNames.delete(toolName);
      }
    }
    
    for (const toolName of toolNames) {
      orderedTests.push({ toolName, testCase: null, hasTestCase: false });
    }
    
    // Run tests
    for (const { toolName, testCase, hasTestCase } of orderedTests) {
      if (hasTestCase) {
        // Check if test case is marked to skip
        if (testCase.skip) {
          const skipped = {
            toolName,
            priority: testCase.priority,
            success: false,
            error: testCase.skipReason || 'Skipped by configuration',
            skipped: true,
          };
          this.results.push(skipped);
          this.reporter.onTestEnd?.(skipped);
        } else {
          await this.testTool(toolName, testCase);
        }
      } else {
        const skipped = {
          toolName,
          success: false,
          error: 'No test case found',
          skipped: true,
        };
        this.results.push(skipped);
        this.reporter.onTestEnd?.(skipped);
      }
    }
    
    const summary = this.buildSummary();
    this.reporter.onComplete?.(this.results, summary);
    
    return { results: this.results, summary };
  }

  /**
   * Run specific tools by name
   * @param {string[]} toolNames - Array of tool names to test
   */
  async runSpecific(toolNames) {
    this.reporter.onStart?.(config);
    
    // Fetch tool list from server to validate tools exist
    let serverTools;
    try {
      serverTools = await this.protocol.fetchTools();
      this.reporter.onToolsFetched?.(serverTools);
    } catch (error) {
      const summary = this.buildSummary();
      this.reporter.onComplete?.(this.results, summary);
      return { results: this.results, summary };
    }
    
    const serverToolNames = new Set(serverTools.map(t => t.name));
    
    // Load test cases
    const testCases = await this.loadTestCases();
    
    // Filter to only requested tools
    const filteredTestCases = new Map();
    for (const toolName of toolNames) {
      if (testCases.has(toolName)) {
        filteredTestCases.set(toolName, testCases.get(toolName));
      }
    }
    
    this.reporter.onTestCasesLoaded?.(filteredTestCases);
    
    // Run tests for specified tools
    for (const toolName of toolNames) {
      // Check if tool exists on server
      if (!serverToolNames.has(toolName)) {
        const notFound = {
          toolName,
          success: false,
          error: 'Tool not found on server',
          skipped: true,
        };
        this.results.push(notFound);
        this.reporter.onTestEnd?.(notFound);
        continue;
      }
      
      const testCase = testCases.get(toolName);
      
      if (!testCase) {
        const noTestCase = {
          toolName,
          success: false,
          error: 'No test case found',
          skipped: true,
        };
        this.results.push(noTestCase);
        this.reporter.onTestEnd?.(noTestCase);
        continue;
      }
      
      if (testCase.skip) {
        const skipped = {
          toolName,
          priority: testCase.priority,
          success: false,
          error: testCase.skipReason || 'Skipped by configuration',
          skipped: true,
        };
        this.results.push(skipped);
        this.reporter.onTestEnd?.(skipped);
        continue;
      }
      
      await this.testTool(toolName, testCase);
    }
    
    const summary = this.buildSummary();
    this.reporter.onComplete?.(this.results, summary);
    
    return { results: this.results, summary };
  }

  /**
   * Build test summary
   */
  buildSummary() {
    const tested = this.results.filter(r => !r.skipped);
    const skipped = this.results.filter(r => r.skipped);
    const successful = tested.filter(r => r.success);
    const matched = tested.filter(r => r.matched);
    const failed = tested.filter(r => !r.success);
    
    const avgTime = tested.length > 0
      ? Math.round(tested.reduce((sum, r) => sum + (r.responseTime || 0), 0) / tested.length)
      : 0;

    return {
      total: this.results.length,
      tested: tested.length,
      skipped: skipped.length,
      successful: successful.length,
      matched: matched.length,
      failed: failed.length,
      avgTime,
    };
  }
}
