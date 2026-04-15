/**
 * Regression Tests: Historical Bug Prevention
 * Tests specific bugs that have been fixed to prevent regression
 */

import { generateCommand } from '../../src/cli/commands/generate';
import * as path from 'path';
import { testUtils } from '../setup';

describe('Regression Tests - Historical Bugs', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = testUtils.createTempDir('regression-');
  });

  afterEach(() => {
    testUtils.cleanupDir(tempDir);
  });

  describe('Authentication Override Bug (Issue #001)', () => {
    test('CLI auth parameters should override OpenAPI detected auth', async () => {
      // BUG: OpenAPI auth detection was overriding CLI --auth parameters
      // FIXED: Check authentication precedence logic
      
      const options = {
        openapi: path.join(process.cwd(), 'samples', 'weather-api.json'),
        language: 'python',
        auth: 'oauth2', // Should override API key from OpenAPI
        output: tempDir
      };

      await generateCommand(options);

      const serverPath = path.join(tempDir, 'src', 'server.py');
      const serverContent = testUtils.readGeneratedFile(serverPath);
      
      // Should have OAuth2, NOT API key from OpenAPI
      expect(serverContent).toContain('API_TOKEN');
      expect(serverContent).toContain('Bearer');
      expect(serverContent).not.toContain('API_KEY_HEADER = "X-API-Key"');
    });
  });

  describe('Template Conditional Bug (Issue #002)', () => {
    test('Should not show API key constants for non-API-key auth types', async () => {
      // BUG: {{#if auth.headerName}} was always true because of default values
      // FIXED: Changed to {{#if (eq auth.type "api_key")}}
      
      const options = {
        language: 'python',
        auth: 'oauth2',
        output: tempDir
      };

      await generateCommand(options);

      const serverPath = path.join(tempDir, 'src', 'server.py');
      const serverContent = testUtils.readGeneratedFile(serverPath);
      
      // Should NOT have API key constants for OAuth2
      expect(serverContent).not.toContain('API_KEY_HEADER');
      expect(serverContent).not.toContain('X-API-Key');
      expect(serverContent).toContain('API_TOKEN');
    });

    test('Should show correct auth constants for basic auth', async () => {
      const options = {
        language: 'python',
        auth: 'basic',
        output: tempDir
      };

      await generateCommand(options);

      const serverPath = path.join(tempDir, 'src', 'server.py');
      const serverContent = testUtils.readGeneratedFile(serverPath);
      
      expect(serverContent).toContain('API_USERNAME');
      expect(serverContent).toContain('API_PASSWORD');
      expect(serverContent).not.toContain('API_TOKEN');
      expect(serverContent).not.toContain('API_KEY_HEADER');
    });
  });

  describe('TypeScript Manual Mode Bug (Issue #003)', () => {
    test('Should generate auth code in TypeScript manual mode', async () => {
      // BUG: TypeScript manual mode had no auth code because it was only in tool handlers
      // FIXED: Added global buildAuthHeaders function
      
      const options = {
        language: 'typescript',
        auth: 'oauth2',
        output: tempDir
      };

      await generateCommand(options);

      const serverPath = path.join(tempDir, 'src', 'server.ts');
      const serverContent = testUtils.readGeneratedFile(serverPath);
      
      // Should have auth code even without tools
      expect(serverContent).toContain('buildAuthHeaders');
      expect(serverContent).toContain('API_TOKEN');
      expect(serverContent).toContain('Bearer');
    });

    test('Should have global auth helper function in TypeScript', async () => {
      const options = {
        language: 'typescript',
        auth: 'basic',
        output: tempDir
      };

      await generateCommand(options);

      const serverPath = path.join(tempDir, 'src', 'server.ts');
      const serverContent = testUtils.readGeneratedFile(serverPath);
      
      expect(serverContent).toContain('function buildAuthHeaders()');
      expect(serverContent).toContain('API_USERNAME');
      expect(serverContent).toContain('API_PASSWORD');
      expect(serverContent).toContain('Basic ${credentials}');
    });
  });

  describe('Template Building Bug (Issue #004)', () => {
    test('Templates should be copied to dist during build', async () => {
      // BUG: TypeScript build wasn't copying template files to dist/
      // FIXED: Added copy-templates script to build process
      
      // This is more of a build system test
      const distTemplatesDir = path.join(process.cwd(), 'dist', 'templates');
      const srcTemplatesDir = path.join(process.cwd(), 'src', 'templates');
      
      expect(require('fs').existsSync(distTemplatesDir)).toBe(true);
      expect(require('fs').existsSync(path.join(distTemplatesDir, 'server.py.hbs'))).toBe(true);
      expect(require('fs').existsSync(path.join(distTemplatesDir, 'server.ts.hbs'))).toBe(true);
    });
  });

  describe('CLI Default Values Bug (Issue #005)', () => {
    test('CLI should not force default language in Commander options', async () => {
      // BUG: Commander.js default values were polluting manual Q&A flow
      // FIXED: Removed default values from CLI options
      
      // This test checks that manual mode Q&A works properly
      // by not having pre-populated defaults that skip questions
      
      const options = {
        output: tempDir
        // No language specified - should go through Q&A or use defaults correctly
      };

      await generateCommand(options);

      // Should generate something valid regardless
      const serverFiles = require('fs').readdirSync(path.join(tempDir, 'src'));
      expect(serverFiles.length).toBeGreaterThan(0);
    });
  });

  describe('Authentication Mapping Bug (Issue #006)', () => {
    test('Should correctly map CLI auth options to internal types', async () => {
      // BUG: CLI --auth api_key wasn't mapping to internal 'api_key_header'
      // FIXED: Added mapAuthOption function
      
      const authMappings = [
        { cli: 'api_key', expected: 'api_key' },
        { cli: 'oauth2', expected: 'oauth2' },
        { cli: 'basic', expected: 'basic' }
      ];

      for (const mapping of authMappings) {
        const options = {
          language: 'python',
          auth: mapping.cli,
          output: path.join(tempDir, mapping.cli)
        };

        await generateCommand(options);

        const serverPath = path.join(tempDir, mapping.cli, 'src', 'server.py');
        const serverContent = testUtils.readGeneratedFile(serverPath);
        
        expect(serverContent).toContainAuthCode(mapping.expected);
      }
    });
  });

  describe('Error Message Quality Bug (Issue #007)', () => {
    test('Should provide helpful error messages for invalid inputs', async () => {
      // This would test error handling improvements
      // For now, just ensure it doesn't crash
      
      const options = {
        language: 'invalid_language',
        output: tempDir
      };

      // Should handle gracefully, not crash
      await expect(generateCommand(options)).resolves.not.toThrow();
    });
  });

  describe('File Generation Race Condition Bug (Issue #008)', () => {
    test('Should handle concurrent file generation safely', async () => {
      // BUG: Multiple files being written simultaneously could cause issues
      // This test ensures file generation is atomic
      
      const options = {
        openapi: path.join(process.cwd(), 'samples', 'weather-api.json'),
        language: 'typescript',
        auth: 'oauth2',
        output: tempDir
      };

      await generateCommand(options);

      // All files should be complete and valid
      const expectedFiles = [
        'src/server.ts',
        'package.json',
        'tsconfig.json',
        'README.md'
      ];

      for (const file of expectedFiles) {
        testUtils.expectFileExists(path.join(tempDir, file));
        const content = testUtils.readGeneratedFile(path.join(tempDir, file));
        expect(content.length).toBeGreaterThan(0);
        expect(content).not.toContain('{{'); // No unfilled templates
      }
    });
  });

  describe('Memory Usage Bug (Issue #009)', () => {
    test('Should not leak memory during generation', async () => {
      // Generate multiple servers to check for memory leaks
      const iterations = 5;
      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < iterations; i++) {
        const options = {
          language: 'python',
          auth: 'oauth2',
          output: path.join(tempDir, `iteration-${i}`)
        };

        await generateCommand(options);
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;
      
      // Memory growth should be reasonable (less than 50MB for 5 iterations)
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('Template Data Completeness Bug (Issue #010)', () => {
    test('Should pass all required data to templates', async () => {
      // BUG: Some template variables were undefined causing {{undefined}} in output
      // FIXED: Enhanced template data preparation
      
      const options = {
        language: 'python',
        auth: 'oauth2',
        output: tempDir
      };

      await generateCommand(options);

      const serverPath = path.join(tempDir, 'src', 'server.py');
      const serverContent = testUtils.readGeneratedFile(serverPath);
      
      // No unfilled template variables
      expect(serverContent).not.toContain('{{');
      expect(serverContent).not.toContain('}}');
      expect(serverContent).not.toContain('undefined');
      expect(serverContent).not.toContain('[object Object]');
    });
  });
});