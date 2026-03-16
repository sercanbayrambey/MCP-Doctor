/**
 * Base reporter interface
 */
export class BaseReporter {
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * Called when testing starts
   */
  onStart(config) {}

  /**
   * Called when tools are fetched
   */
  onToolsFetched(tools) {}

  /**
   * Called when test cases are loaded
   */
  onTestCasesLoaded(testCases) {}

  /**
   * Called before each test
   */
  onTestStart(toolName, testCase) {}

  /**
   * Called after each test
   */
  onTestEnd(result) {}

  /**
   * Called when all tests complete
   * @returns {string|object} Final output
   */
  onComplete(results, summary) {}

  /**
   * Get the final output to write
   */
  getOutput() {
    return '';
  }
}
