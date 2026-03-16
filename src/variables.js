import fs from 'fs/promises';
import path from 'path';
import { config } from './config.js';

/**
 * Variable substitution for test cases
 * Supports ${VAR_NAME} syntax in request bodies
 * 
 * Variables are loaded from:
 * 1. Environment variables (process.env)
 * 2. variables.json file (if exists)
 * 
 * Priority: variables.json > environment variables
 */

let cachedVariables = null;

/**
 * Load variables from variables.json file
 */
async function loadVariablesFile() {
  const variablesPath = path.resolve(config.variablesPath || './variables.json');
  
  try {
    const content = await fs.readFile(variablesPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    // File doesn't exist or is invalid - that's okay
    return {};
  }
}

/**
 * Get all available variables
 */
export async function getVariables() {
  if (cachedVariables) {
    return cachedVariables;
  }

  const fileVars = await loadVariablesFile();
  
  // Merge: file vars take priority over env vars
  cachedVariables = {
    ...process.env,
    ...fileVars,
  };
  
  return cachedVariables;
}

/**
 * Clear cached variables (useful for testing)
 */
export function clearVariablesCache() {
  cachedVariables = null;
}

/**
 * Substitute variables in a string
 * Replaces ${VAR_NAME} with the variable value
 */
function substituteString(str, variables) {
  if (typeof str !== 'string') {
    return str;
  }
  
  return str.replace(/\$\{([^}]+)\}/g, (match, varName) => {
    const value = variables[varName];
    if (value === undefined) {
      // Keep original if variable not found
      return match;
    }
    return value;
  });
}

/**
 * Recursively substitute variables in an object
 */
export function substituteVariables(obj, variables) {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'string') {
    const substituted = substituteString(obj, variables);
    
    // Try to parse as number if the entire string was a variable
    if (substituted !== obj && /^\$\{[^}]+\}$/.test(obj)) {
      const num = Number(substituted);
      if (!isNaN(num)) {
        return num;
      }
      // Try to parse as boolean
      if (substituted === 'true') return true;
      if (substituted === 'false') return false;
    }
    
    return substituted;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => substituteVariables(item, variables));
  }
  
  if (typeof obj === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = substituteVariables(value, variables);
    }
    return result;
  }
  
  return obj;
}

/**
 * Process a test case and substitute all variables
 */
export async function processTestCase(testCase) {
  const variables = await getVariables();
  
  // Only substitute in the request object
  if (testCase.request) {
    testCase.request = substituteVariables(testCase.request, variables);
  }
  
  return testCase;
}
