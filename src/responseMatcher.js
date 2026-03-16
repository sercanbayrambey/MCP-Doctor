/**
 * Response matching utilities
 * Supports exact match, regex, contains, and JSON path matching
 */

/**
 * Match response against test case matchers
 * @param {object} testCase - Test case with matching rules
 * @param {any} response - Actual response to match
 * @returns {object} Match result with success and details
 */
export function matchResponse(testCase, response) {
  const result = {
    matched: true,
    details: [],
  };

  // If no matchers defined, just check success
  if (!testCase.expectedResponse && !testCase.matchers) {
    return result;
  }

  // Legacy: exact expectedResponse matching
  if (testCase.expectedResponse && !testCase.matchers) {
    const exactMatch = matchExact(testCase.expectedResponse, response);
    if (!exactMatch.matched) {
      result.matched = false;
      result.details.push(exactMatch);
    }
    return result;
  }

  // New: matchers array support
  if (testCase.matchers && Array.isArray(testCase.matchers)) {
    for (const matcher of testCase.matchers) {
      const matchResult = applyMatcher(matcher, response);
      result.details.push(matchResult);
      if (!matchResult.matched) {
        result.matched = false;
      }
    }
  }

  return result;
}

/**
 * Apply a single matcher to response
 */
function applyMatcher(matcher, response) {
  const { type, path, value, pattern, flags } = matcher;
  const target = path ? getByPath(response, path) : response;

  switch (type) {
    case 'exact':
      return matchExact(value, target);

    case 'regex':
      return matchRegex(pattern, target, flags);

    case 'contains':
      return matchContains(value, target);

    case 'exists':
      return matchExists(target, value !== false);

    case 'type':
      return matchType(value, target);

    case 'notTrue':
      return matchNotTrue(target);

    default:
      return {
        matched: false,
        type: 'unknown',
        message: `Unknown matcher type: ${type}`,
      };
  }
}

/**
 * Exact value matching
 */
function matchExact(expected, actual) {
  const matched = JSON.stringify(expected) === JSON.stringify(actual);
  return {
    matched,
    type: 'exact',
    expected,
    actual,
    message: matched ? 'Exact match' : 'Values do not match',
  };
}

/**
 * Regex pattern matching
 */
function matchRegex(pattern, target, flags = '') {
  try {
    const stringTarget = typeof target === 'string' 
      ? target 
      : JSON.stringify(target);
    
    const regex = new RegExp(pattern, flags);
    const matched = regex.test(stringTarget);
    
    return {
      matched,
      type: 'regex',
      pattern,
      target: stringTarget.substring(0, 100) + (stringTarget.length > 100 ? '...' : ''),
      message: matched ? 'Pattern matched' : 'Pattern did not match',
    };
  } catch (error) {
    return {
      matched: false,
      type: 'regex',
      pattern,
      message: `Invalid regex: ${error.message}`,
    };
  }
}

/**
 * Contains matching (substring or array includes)
 */
function matchContains(value, target) {
  let matched = false;
  
  if (typeof target === 'string') {
    matched = target.includes(value);
  } else if (Array.isArray(target)) {
    matched = target.some(item => 
      JSON.stringify(item) === JSON.stringify(value)
    );
  } else if (typeof target === 'object' && target !== null) {
    // If value is a string, search in JSON string representation
    if (typeof value === 'string') {
      matched = JSON.stringify(target).includes(value);
    } else {
      // Check if object contains key-value pairs
      matched = Object.entries(value).every(([k, v]) => 
        JSON.stringify(target[k]) === JSON.stringify(v)
      );
    }
  }
  
  return {
    matched,
    type: 'contains',
    value,
    message: matched ? 'Value found' : 'Value not found',
  };
}

/**
 * Check if path exists (or doesn't exist)
 */
function matchExists(target, shouldExist) {
  const exists = target !== undefined;
  const matched = exists === shouldExist;
  
  return {
    matched,
    type: 'exists',
    shouldExist,
    message: matched 
      ? `Path ${shouldExist ? 'exists' : 'does not exist'} as expected`
      : `Path ${exists ? 'exists' : 'does not exist'}, expected ${shouldExist ? 'to exist' : 'to not exist'}`,
  };
}

/**
 * Type checking
 */
function matchType(expectedType, target) {
  const actualType = Array.isArray(target) ? 'array' : typeof target;
  const matched = actualType === expectedType;
  
  return {
    matched,
    type: 'type',
    expectedType,
    actualType,
    message: matched ? `Type is ${expectedType}` : `Expected ${expectedType}, got ${actualType}`,
  };
}

/**
 * NotTrue matching - passes if field doesn't exist OR is false
 * Fails only if field exists AND is true
 * Useful for isError checks where field may not exist in success responses
 */
function matchNotTrue(target) {
  // Field doesn't exist → pass
  if (target === undefined) {
    return {
      matched: true,
      type: 'notTrue',
      actual: undefined,
      message: 'Field does not exist (OK)',
    };
  }
  
  // Field exists and is not true → pass
  if (target !== true) {
    return {
      matched: true,
      type: 'notTrue',
      actual: target,
      message: `Field is ${target} (OK)`,
    };
  }
  
  // Field is true → fail
  return {
    matched: false,
    type: 'notTrue',
    actual: target,
    message: 'Field is true (FAIL)',
  };
}

/**
 * Get value by dot-notation path (supports array indices)
 * Example: "data.items[0].name" or "result.users.0.email"
 */
function getByPath(obj, pathStr) {
  if (!pathStr) return obj;
  
  // Normalize array notation: data.items[0] -> data.items.0
  const normalizedPath = pathStr.replace(/\[(\d+)\]/g, '.$1');
  const parts = normalizedPath.split('.');
  
  let current = obj;
  for (const part of parts) {
    if (current === undefined || current === null) {
      return undefined;
    }
    current = current[part];
  }
  
  return current;
}

export { getByPath };
