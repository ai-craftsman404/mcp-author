/**
 * Global Test Setup
 * Configures Jest environment and shared test utilities
 */

import * as fs from 'fs';
import * as path from 'path';

// Global test timeout
jest.setTimeout(60000);

// Mock console methods to reduce noise in tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  // Suppress console output during tests unless in debug mode
  if (!process.env['JEST_DEBUG']) {
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
  }
  
  // Ensure test-outputs directory exists
  const testOutputDir = path.join(process.cwd(), 'test-outputs');
  if (!fs.existsSync(testOutputDir)) {
    fs.mkdirSync(testOutputDir, { recursive: true });
  }
});

afterAll(() => {
  // Restore console methods
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  
  // Cleanup test outputs unless in debug mode
  if (!process.env['JEST_DEBUG']) {
    const testOutputDir = path.join(process.cwd(), 'test-outputs');
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
  }
});

// Global test utilities
export const testUtils = {
  createTempDir: (prefix: string = 'test-') => {
    const tempDir = path.join(process.cwd(), 'test-outputs', `${prefix}${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    fs.mkdirSync(tempDir, { recursive: true });
    return tempDir;
  },
  
  cleanupDir: (dirPath: string) => {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  },
  
  readGeneratedFile: (filePath: string): string => {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Test file not found: ${filePath}`);
    }
    return fs.readFileSync(filePath, 'utf-8');
  },
  
  expectFileExists: (filePath: string) => {
    expect(fs.existsSync(filePath)).toBe(true);
  },
  
  expectFileContains: (filePath: string, content: string | RegExp) => {
    const fileContent = testUtils.readGeneratedFile(filePath);
    if (typeof content === 'string') {
      expect(fileContent).toContain(content);
    } else {
      expect(fileContent).toMatch(content);
    }
  }
};

// Extend Jest matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toContainAuthCode(authType: string): R;
      toBeValidMCPServer(): R;
    }
  }
}

expect.extend({
  toContainAuthCode(received: string, authType: string) {
    const authPatterns = {
      'oauth2': ['API_TOKEN', 'Bearer', 'Authorization'],
      'basic': ['API_USERNAME', 'API_PASSWORD', 'Basic'],
      'api_key': ['API_KEY', 'X-API-Key']
    };
    
    const patterns = authPatterns[authType as keyof typeof authPatterns];
    if (!patterns) {
      return {
        pass: false,
        message: () => `Unknown auth type: ${authType}`
      };
    }
    
    const missingPatterns = patterns.filter(pattern => !received.includes(pattern));
    const pass = missingPatterns.length === 0;
    
    return {
      pass,
      message: () => pass
        ? `Expected code not to contain ${authType} auth patterns`
        : `Expected code to contain ${authType} auth patterns. Missing: ${missingPatterns.join(', ')}`
    };
  },
  
  toBeValidMCPServer(received: string) {
    const requiredPatterns = [
      /import.*mcp/i,
      /async\s+def\s+main|async\s+function\s+main/,
      /server\.(run|connect)/
    ];
    
    const missingPatterns = requiredPatterns.filter(pattern => !pattern.test(received));
    const pass = missingPatterns.length === 0;
    
    return {
      pass,
      message: () => pass
        ? 'Expected code not to be a valid MCP server'
        : `Expected code to be a valid MCP server. Missing patterns: ${missingPatterns.length}`
    };
  }
});