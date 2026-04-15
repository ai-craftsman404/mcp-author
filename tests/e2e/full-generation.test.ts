/**
 * E2E Tests: Full Generation Flow
 * Tests complete user workflows from CLI invocation to working MCP server
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { testUtils } from '../setup';

describe('E2E Full Generation Tests', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = testUtils.createTempDir('e2e-');
  });

  afterEach(() => {
    testUtils.cleanupDir(tempDir);
  });

  const runCLI = async (args: string[]): Promise<{ code: number; stdout: string; stderr: string }> => {
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
  };

  describe('Complete Authentication Matrix', () => {
    const testMatrix = [
      { language: 'python', auth: 'oauth2', mode: 'openapi' },
      { language: 'python', auth: 'basic', mode: 'openapi' },
      { language: 'python', auth: 'api_key', mode: 'openapi' },
      { language: 'typescript', auth: 'oauth2', mode: 'openapi' },
      { language: 'typescript', auth: 'basic', mode: 'openapi' },
      { language: 'typescript', auth: 'api_key', mode: 'openapi' },
      { language: 'python', auth: 'oauth2', mode: 'manual' },
      { language: 'typescript', auth: 'oauth2', mode: 'manual' }
    ];

    testMatrix.forEach(({ language, auth, mode }) => {
      test(`should generate working ${language} server with ${auth} auth in ${mode} mode`, async () => {
        const outputDir = path.join(tempDir, `${language}-${auth}-${mode}`);
        
        const args = [
          'generate',
          '--language', language,
          '--auth', auth,
          '--output', outputDir
        ];

        if (mode === 'openapi') {
          args.push('--openapi', path.join(process.cwd(), 'samples', 'weather-api.json'));
        }

        const result = await runCLI(args);
        
        // Check CLI execution success
        expect(result.code).toBe(0);
        expect(result.stdout).toContain('Generation Complete');
        
        // Check file structure
        const serverFile = language === 'python' ? 'server.py' : 'server.ts';
        const serverPath = path.join(outputDir, 'src', serverFile);
        
        testUtils.expectFileExists(serverPath);
        testUtils.expectFileExists(path.join(outputDir, 'README.md'));
        
        if (language === 'python') {
          testUtils.expectFileExists(path.join(outputDir, 'requirements.txt'));
          testUtils.expectFileExists(path.join(outputDir, 'pyproject.toml'));
        } else {
          testUtils.expectFileExists(path.join(outputDir, 'package.json'));
          testUtils.expectFileExists(path.join(outputDir, 'tsconfig.json'));
        }
        
        // Check authentication implementation
        const serverContent = testUtils.readGeneratedFile(serverPath);
        expect(serverContent).toContainAuthCode(auth);
        expect(serverContent).toBeValidMCPServer();
        
        // Check for tools in OpenAPI mode
        if (mode === 'openapi') {
          expect(serverContent).toContain('getCurrentWeather');
          expect(serverContent).toContain('getWeatherForecast');
        }
      }, 60000);
    });
  });

  describe('OpenAPI File Processing', () => {
    test('should handle valid OpenAPI file', async () => {
      const outputDir = path.join(tempDir, 'openapi-valid');
      
      const result = await runCLI([
        'generate',
        '--openapi', path.join(process.cwd(), 'samples', 'weather-api.json'),
        '--language', 'python',
        '--output', outputDir
      ]);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('✅ Validating OpenAPI specification');
      
      const serverPath = path.join(outputDir, 'src', 'server.py');
      const serverContent = testUtils.readGeneratedFile(serverPath);
      
      expect(serverContent).toContain('getCurrentWeather');
      expect(serverContent).toContain('getWeatherForecast');
      expect(serverContent).toContain('https://api.weather.com/v1');
    });

    test('should handle invalid OpenAPI file gracefully', async () => {
      // Create invalid OpenAPI file
      const invalidApiFile = path.join(tempDir, 'invalid-api.json');
      fs.writeFileSync(invalidApiFile, '{ "invalid": "json structure" }');
      
      const result = await runCLI([
        'generate',
        '--openapi', invalidApiFile,
        '--language', 'python',
        '--output', path.join(tempDir, 'invalid-output')
      ]);

      expect(result.code).not.toBe(0);
      expect(result.stdout).toContain('❌ OpenAPI validation failed');
    });

    test('should handle non-existent OpenAPI file', async () => {
      const result = await runCLI([
        'generate',
        '--openapi', '/non/existent/file.json',
        '--language', 'python',
        '--output', path.join(tempDir, 'nonexistent-output')
      ]);

      expect(result.code).not.toBe(0);
      expect(result.stderr).toContain('ENOENT');
    });
  });

  describe('Validation Integration', () => {
    test('should run validation automatically and show results', async () => {
      const outputDir = path.join(tempDir, 'validation-test');
      
      const result = await runCLI([
        'generate',
        '--language', 'typescript',
        '--auth', 'oauth2',
        '--output', outputDir
      ]);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('🔍 Running automatic validation');
      expect(result.stdout).toContain('Overall Grade:');
      expect(result.stdout).toContain('Category Breakdown:');
      
      // Check validation report was created
      testUtils.expectFileExists(path.join(outputDir, 'PRODUCTION-REPORT.md'));
    });

    test('should generate high-quality TypeScript servers', async () => {
      const outputDir = path.join(tempDir, 'quality-test');
      
      const result = await runCLI([
        'generate',
        '--openapi', path.join(process.cwd(), 'samples', 'weather-api.json'),
        '--language', 'typescript',
        '--auth', 'oauth2',
        '--output', outputDir
      ]);

      expect(result.code).toBe(0);
      
      // TypeScript servers typically get A grade (94%)
      expect(result.stdout).toMatch(/Grade:\s+A\s+\(9[0-9]%\)/);
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    test('should handle write permission errors gracefully', async () => {
      // Try to write to root directory (should fail gracefully)
      const result = await runCLI([
        'generate',
        '--language', 'python',
        '--output', '/root/should-fail'
      ]);

      expect(result.code).not.toBe(0);
      expect(result.stdout).toContain('❌');
    });

    test('should handle interrupted generation gracefully', async () => {
      // This test might be complex to implement reliably
      // Could involve sending SIGINT to the process
    });

    test('should handle very large OpenAPI files', async () => {
      // Test with a large OpenAPI file if available
      // For now, test with the existing file
      const outputDir = path.join(tempDir, 'large-api-test');
      
      const result = await runCLI([
        'generate',
        '--openapi', path.join(process.cwd(), 'samples', 'weather-api.json'),
        '--language', 'python',
        '--output', outputDir
      ]);

      expect(result.code).toBe(0);
      
      // Should complete within reasonable time
    }, 30000);
  });

  describe('Output Quality Validation', () => {
    test('should generate syntactically valid Python code', async () => {
      const outputDir = path.join(tempDir, 'python-syntax');
      
      await runCLI([
        'generate',
        '--language', 'python',
        '--auth', 'oauth2',
        '--output', outputDir
      ]);

      const serverPath = path.join(outputDir, 'src', 'server.py');
      const serverContent = testUtils.readGeneratedFile(serverPath);
      
      // Basic Python syntax checks
      expect(serverContent).toMatch(/^#!/); // Shebang
      expect(serverContent).toContain('import');
      expect(serverContent).toContain('async def main():');
      expect(serverContent).toContain('if __name__ == "__main__":');
      
      // No obvious syntax errors
      expect(serverContent).not.toContain('{{');
      expect(serverContent).not.toContain('}}');
      expect(serverContent).not.toContain('undefined');
    });

    test('should generate syntactically valid TypeScript code', async () => {
      const outputDir = path.join(tempDir, 'typescript-syntax');
      
      await runCLI([
        'generate',
        '--language', 'typescript',
        '--auth', 'api_key',
        '--output', outputDir
      ]);

      const serverPath = path.join(outputDir, 'src', 'server.ts');
      const serverContent = testUtils.readGeneratedFile(serverPath);
      
      // Basic TypeScript syntax checks
      expect(serverContent).toMatch(/^#!/); // Shebang
      expect(serverContent).toContain('import');
      expect(serverContent).toContain('async function main()');
      expect(serverContent).toContain('Record<string, string>');
      
      // No obvious syntax errors
      expect(serverContent).not.toContain('{{');
      expect(serverContent).not.toContain('}}');
      expect(serverContent).not.toContain('undefined');
    });

    test('should generate complete dependency manifests', async () => {
      const outputDir = path.join(tempDir, 'dependencies');
      
      await runCLI([
        'generate',
        '--language', 'python',
        '--output', outputDir
      ]);

      const requirementsPath = path.join(outputDir, 'requirements.txt');
      const requirements = testUtils.readGeneratedFile(requirementsPath);
      
      expect(requirements).toContain('httpx');
      expect(requirements).toContain('mcp');
      
      const pyprojectPath = path.join(outputDir, 'pyproject.toml');
      const pyproject = testUtils.readGeneratedFile(pyprojectPath);
      
      expect(pyproject).toContain('[project]');
      expect(pyproject).toContain('dependencies');
    });
  });
});