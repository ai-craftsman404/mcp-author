/**
 * Component Tests: Authentication Integration
 * Tests the full authentication flow from CLI parameters to generated code
 */

import { generateCommand } from '../../src/cli/commands/generate';
import * as path from 'path';
import { testUtils } from '../setup';

describe('Authentication Component Tests', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = testUtils.createTempDir('auth-component-');
  });

  afterEach(() => {
    testUtils.cleanupDir(tempDir);
  });

  describe('CLI to Code Generation Integration', () => {
    test('should generate OAuth2 authentication from CLI parameters', async () => {
      const options = {
        language: 'python',
        auth: 'oauth2',
        output: tempDir
      };

      await generateCommand(options);

      const serverPath = path.join(tempDir, 'src', 'server.py');
      testUtils.expectFileExists(serverPath);
      
      const serverContent = testUtils.readGeneratedFile(serverPath);
      expect(serverContent).toContainAuthCode('oauth2');
    });

    test('should generate Basic auth authentication from CLI parameters', async () => {
      const options = {
        language: 'typescript',
        auth: 'basic',
        output: tempDir
      };

      await generateCommand(options);

      const serverPath = path.join(tempDir, 'src', 'server.ts');
      testUtils.expectFileExists(serverPath);
      
      const serverContent = testUtils.readGeneratedFile(serverPath);
      expect(serverContent).toContainAuthCode('basic');
    });

    test('should generate API key authentication from CLI parameters', async () => {
      const options = {
        language: 'python',
        auth: 'api_key',
        output: tempDir
      };

      await generateCommand(options);

      const serverPath = path.join(tempDir, 'src', 'server.py');
      testUtils.expectFileExists(serverPath);
      
      const serverContent = testUtils.readGeneratedFile(serverPath);
      expect(serverContent).toContainAuthCode('api_key');
    });
  });

  describe('OpenAPI Integration with CLI Auth Override', () => {
    test('should respect CLI auth parameter over OpenAPI detection', async () => {
      const options = {
        openapi: path.join(process.cwd(), 'samples', 'weather-api.json'),
        language: 'python',
        auth: 'oauth2', // Override OpenAPI detected auth
        output: tempDir
      };

      await generateCommand(options);

      const serverPath = path.join(tempDir, 'src', 'server.py');
      const serverContent = testUtils.readGeneratedFile(serverPath);
      
      // Should have OAuth2, not the API key from OpenAPI
      expect(serverContent).toContainAuthCode('oauth2');
      expect(serverContent).not.toContain('X-API-Key');
    });

    test('should use OpenAPI authentication when no CLI auth provided', async () => {
      const options = {
        openapi: path.join(process.cwd(), 'samples', 'weather-api.json'),
        language: 'typescript',
        output: tempDir
      };

      await generateCommand(options);

      const serverPath = path.join(tempDir, 'src', 'server.ts');
      const serverContent = testUtils.readGeneratedFile(serverPath);
      
      // Should detect and use API key from OpenAPI
      expect(serverContent).toContainAuthCode('api_key');
    });
  });

  describe('Language-Specific Authentication Implementation', () => {
    const authTypes = ['oauth2', 'basic', 'api_key'];
    const languages = ['python', 'typescript'];

    authTypes.forEach(authType => {
      languages.forEach(language => {
        test(`should generate correct ${authType} auth for ${language}`, async () => {
          const options = {
            language,
            auth: authType,
            output: tempDir
          };

          await generateCommand(options);

          const serverFile = language === 'python' ? 'server.py' : 'server.ts';
          const serverPath = path.join(tempDir, 'src', serverFile);
          
          testUtils.expectFileExists(serverPath);
          
          const serverContent = testUtils.readGeneratedFile(serverPath);
          expect(serverContent).toContainAuthCode(authType);
          expect(serverContent).toBeValidMCPServer();
        });
      });
    });
  });

  describe('Manual Mode vs OpenAPI Mode', () => {
    test('should generate auth code in manual mode without OpenAPI', async () => {
      const options = {
        language: 'typescript',
        auth: 'oauth2',
        output: tempDir
      };

      await generateCommand(options);

      const serverPath = path.join(tempDir, 'src', 'server.ts');
      const serverContent = testUtils.readGeneratedFile(serverPath);
      
      // Should have OAuth2 auth even without tools
      expect(serverContent).toContainAuthCode('oauth2');
      expect(serverContent).toContain('buildAuthHeaders');
    });

    test('should generate auth code with OpenAPI tools', async () => {
      const options = {
        openapi: path.join(process.cwd(), 'samples', 'weather-api.json'),
        language: 'python',
        auth: 'basic',
        output: tempDir
      };

      await generateCommand(options);

      const serverPath = path.join(tempDir, 'src', 'server.py');
      const serverContent = testUtils.readGeneratedFile(serverPath);
      
      // Should have Basic auth with tools
      expect(serverContent).toContainAuthCode('basic');
      expect(serverContent).toContain('getCurrentWeather');
      expect(serverContent).toContain('getWeatherForecast');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle invalid authentication type gracefully', async () => {
      const options = {
        language: 'python',
        auth: 'invalid_auth_type',
        output: tempDir
      };

      // Should not throw, should default to 'none' or handle gracefully
      await expect(generateCommand(options)).resolves.not.toThrow();
    });

    test('should handle missing output directory creation', async () => {
      const nonExistentDir = path.join(tempDir, 'deeply', 'nested', 'path');
      const options = {
        language: 'typescript',
        auth: 'oauth2',
        output: nonExistentDir
      };

      await generateCommand(options);

      // Should create the directory and generate files
      testUtils.expectFileExists(path.join(nonExistentDir, 'src', 'server.ts'));
    });

    test('should generate valid code even with minimal configuration', async () => {
      const options = {
        language: 'python',
        output: tempDir
      };

      await generateCommand(options);

      const serverPath = path.join(tempDir, 'src', 'server.py');
      const serverContent = testUtils.readGeneratedFile(serverPath);
      
      expect(serverContent).toBeValidMCPServer();
    });
  });
});