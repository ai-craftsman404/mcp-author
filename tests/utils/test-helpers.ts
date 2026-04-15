/**
 * Test Helper Utilities
 * Shared utilities for testing MCP Author functionality
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

export interface CLIResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface TestServer {
  language: 'python' | 'typescript';
  authType: string;
  hasTools: boolean;
  path: string;
}

export class TestHelpers {
  /**
   * Run CLI command and return results
   */
  static async runCLI(args: string[]): Promise<CLIResult> {
    return new Promise((resolve) => {
      const child = spawn('node', ['dist/cli.js', ...args], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // Auto-confirm any prompts
      child.stdin.write('\n');
      child.stdin.end();

      child.on('close', (code) => {
        resolve({ code: code || 0, stdout, stderr });
      });
    });
  }

  /**
   * Generate test server with specific configuration
   */
  static async generateTestServer(config: {
    language: 'python' | 'typescript';
    auth: string;
    openapi?: string;
    output: string;
  }): Promise<TestServer> {
    const args = [
      'generate',
      '--language', config.language,
      '--auth', config.auth,
      '--output', config.output
    ];

    if (config.openapi) {
      args.push('--openapi', config.openapi);
    }

    const result = await this.runCLI(args);
    
    if (result.code !== 0) {
      throw new Error(`Server generation failed: ${result.stderr}`);
    }

    return {
      language: config.language,
      authType: config.auth,
      hasTools: !!config.openapi,
      path: config.output
    };
  }

  /**
   * Validate generated server structure
   */
  static validateServerStructure(serverPath: string, language: 'python' | 'typescript'): void {
    const srcDir = path.join(serverPath, 'src');
    expect(fs.existsSync(srcDir)).toBe(true);

    if (language === 'python') {
      expect(fs.existsSync(path.join(srcDir, 'server.py'))).toBe(true);
      expect(fs.existsSync(path.join(serverPath, 'requirements.txt'))).toBe(true);
      expect(fs.existsSync(path.join(serverPath, 'pyproject.toml'))).toBe(true);
    } else {
      expect(fs.existsSync(path.join(srcDir, 'server.ts'))).toBe(true);
      expect(fs.existsSync(path.join(serverPath, 'package.json'))).toBe(true);
      expect(fs.existsSync(path.join(serverPath, 'tsconfig.json'))).toBe(true);
    }

    expect(fs.existsSync(path.join(serverPath, 'README.md'))).toBe(true);
  }

  /**
   * Extract authentication patterns from generated code
   */
  static extractAuthPatterns(serverCode: string): string[] {
    const patterns = [];
    
    // Common auth patterns
    if (serverCode.includes('API_TOKEN')) patterns.push('API_TOKEN');
    if (serverCode.includes('API_KEY')) patterns.push('API_KEY');
    if (serverCode.includes('API_USERNAME')) patterns.push('API_USERNAME');
    if (serverCode.includes('API_PASSWORD')) patterns.push('API_PASSWORD');
    if (serverCode.includes('Bearer')) patterns.push('Bearer');
    if (serverCode.includes('Basic')) patterns.push('Basic');
    if (serverCode.includes('Authorization')) patterns.push('Authorization');
    
    return patterns;
  }

  /**
   * Validate MCP server code quality
   */
  static validateMCPServer(serverCode: string, language: 'python' | 'typescript'): void {
    // Common MCP patterns
    expect(serverCode).toMatch(/mcp/i);
    
    if (language === 'python') {
      expect(serverCode).toContain('FastMCP');
      expect(serverCode).toContain('async def main');
      expect(serverCode).toContain('@mcp.tool()');
      expect(serverCode).toContain('await mcp.run()');
    } else {
      expect(serverCode).toContain('Server');
      expect(serverCode).toContain('async function main');
      expect(serverCode).toContain('server.setRequestHandler');
      expect(serverCode).toContain('server.connect');
    }

    // No template artifacts
    expect(serverCode).not.toContain('{{');
    expect(serverCode).not.toContain('}}');
    expect(serverCode).not.toContain('undefined');
  }

  /**
   * Create test OpenAPI specification
   */
  static createTestOpenAPI(options: {
    authType?: 'apiKey' | 'bearer' | 'basic';
    endpoints?: string[];
  } = {}): object {
    const spec = {
      openapi: '3.0.0',
      info: {
        title: 'Test API',
        version: '1.0.0'
      },
      servers: [{
        url: 'https://api.test.com/v1'
      }],
      paths: {},
      components: {
        securitySchemes: {}
      }
    };

    // Add authentication
    if (options.authType === 'apiKey') {
      spec.components.securitySchemes['ApiKeyAuth'] = {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key'
      };
    } else if (options.authType === 'bearer') {
      spec.components.securitySchemes['BearerAuth'] = {
        type: 'http',
        scheme: 'bearer'
      };
    } else if (options.authType === 'basic') {
      spec.components.securitySchemes['BasicAuth'] = {
        type: 'http',
        scheme: 'basic'
      };
    }

    // Add endpoints
    const endpoints = options.endpoints || ['/test'];
    endpoints.forEach(endpoint => {
      (spec.paths as any)[endpoint] = {
        get: {
          summary: `Get ${endpoint}`,
          operationId: `get${endpoint.replace('/', '').replace(/\W/g, '')}`,
          responses: {
            '200': {
              description: 'Success'
            }
          }
        }
      };
    });

    return spec;
  }

  /**
   * Performance measurement utilities
   */
  static async measurePerformance<T>(
    operation: () => Promise<T>,
    name: string
  ): Promise<{ result: T; duration: number }> {
    const start = Date.now();
    const result = await operation();
    const duration = Date.now() - start;
    
    console.log(`Performance: ${name} took ${duration}ms`);
    
    return { result, duration };
  }

  /**
   * Memory usage tracking
   */
  static getMemoryUsage(): NodeJS.MemoryUsage {
    return process.memoryUsage();
  }

  /**
   * Compare memory usage and detect leaks
   */
  static detectMemoryLeak(
    before: NodeJS.MemoryUsage,
    after: NodeJS.MemoryUsage,
    threshold: number = 50 * 1024 * 1024 // 50MB
  ): boolean {
    const heapGrowth = after.heapUsed - before.heapUsed;
    return heapGrowth > threshold;
  }

  /**
   * File content validation utilities
   */
  static validateFileContent(filePath: string, validators: {
    contains?: string[];
    notContains?: string[];
    matches?: RegExp[];
    notMatches?: RegExp[];
  }): void {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    validators.contains?.forEach(text => {
      expect(content).toContain(text);
    });
    
    validators.notContains?.forEach(text => {
      expect(content).not.toContain(text);
    });
    
    validators.matches?.forEach(pattern => {
      expect(content).toMatch(pattern);
    });
    
    validators.notMatches?.forEach(pattern => {
      expect(content).not.toMatch(pattern);
    });
  }

  /**
   * Async timeout utility for tests
   */
  static timeout(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create temporary test environment
   */
  static createTestEnvironment(name: string): {
    tempDir: string;
    cleanup: () => void;
  } {
    const tempDir = path.join(process.cwd(), 'test-outputs', `${name}-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    
    return {
      tempDir,
      cleanup: () => {
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      }
    };
  }
}