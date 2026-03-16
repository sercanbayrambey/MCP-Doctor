import { ConsoleReporter } from './console.js';
import { JsonReporter } from './json.js';
import { JunitReporter } from './junit.js';

const reporters = {
  console: ConsoleReporter,
  json: JsonReporter,
  junit: JunitReporter,
};

/**
 * Create a reporter instance
 * @param {string} type - Reporter type
 * @param {object} options - Reporter options
 * @returns {BaseReporter} Reporter instance
 */
export function createReporter(type, options = {}) {
  const Reporter = reporters[type];
  
  if (!Reporter) {
    const available = Object.keys(reporters).join(', ');
    throw new Error(`Unknown reporter: "${type}". Available: ${available}`);
  }
  
  return new Reporter(options);
}

export { ConsoleReporter, JsonReporter, JunitReporter };
