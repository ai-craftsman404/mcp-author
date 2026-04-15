/**
 * Unit Tests: Template Generator
 * Tests template data preparation and generation logic
 */

import { TemplateGenerator } from '../../../src/generators/template';
import { QAAnswers, ToolConfig } from '../../../src/types';
import * as path from 'path';
import { testUtils } from '../../setup';

describe('TemplateGenerator Unit Tests', () => {
  let generator: TemplateGenerator;
  let tempDir: string;

  beforeEach(() => {
    generator = new TemplateGenerator();
    tempDir = testUtils.createTempDir('template-test-');
  });

  afterEach(() => {
    testUtils.cleanupDir(tempDir);
  });

  describe('Template Data Preparation', () => {
    test('should prepare correct template data for OAuth2 authentication', () => {
      const config: QAAnswers = {
        sourceType: 'openapi',
        language: 'python',
        authentication: {
          type: 'oauth2',
          description: 'OAuth 2.0'
        },
        toolOrganization: 'all_endpoints',
        errorHandling: 'retry',
        optimization: {
          caching: { enabled: false, duration: 300 },
          pagination: { enabled: true, defaultLimit: 100 },
          timeouts: { request: 30000, server: 120000 },
          responseTruncation: { enabled: false, maxLength: 1000 },
          responseFiltering: { enabled: true, includeFields: [], excludeFields: [] }
        },
        usagePattern: 'moderate',
        openApiSpec: 'test.json'
      };

      const tools: ToolConfig[] = [
        {
          name: 'testTool',
          description: 'Test tool',
          method: 'GET',
          path: '/test',
          parameters: []
        }
      ];

      // Test the private method through reflection or create a public wrapper
      const templateData = (generator as any).prepareTemplateData(config, tools);
      
      expect(templateData.auth.type).toBe('oauth2');
      expect(templateData.auth.description).toBe('OAuth 2.0');
      expect(templateData.tools).toHaveLength(1);
      expect(templateData.baseUrl).toBeDefined();
    });

    test('should prepare correct template data for API key authentication', () => {
      const config: QAAnswers = {
        sourceType: 'manual',
        language: 'typescript',
        authentication: {
          type: 'api_key',
          headerName: 'X-API-Key',
          location: 'header'
        },
        toolOrganization: 'all_endpoints',
        errorHandling: 'retry',
        optimization: {
          caching: { enabled: false, duration: 300 },
          pagination: { enabled: false, defaultLimit: 100 },
          timeouts: { request: 60000, server: 120000 },
          responseTruncation: { enabled: false, maxLength: 1000 },
          responseFiltering: { enabled: false, includeFields: [], excludeFields: [] }
        },
        usagePattern: 'conservative'
      };

      const templateData = (generator as any).prepareTemplateData(config, []);
      
      expect(templateData.auth.type).toBe('api_key');
      expect(templateData.auth.headerName).toBe('X-API-Key');
      expect(templateData.auth.location).toBe('header');
    });

    test('should prepare correct template data for basic authentication', () => {
      const config: QAAnswers = {
        sourceType: 'manual',
        language: 'python',
        authentication: {
          type: 'basic',
          description: 'Basic Authentication'
        },
        toolOrganization: 'all_endpoints',
        errorHandling: 'graceful',
        optimization: {
          caching: { enabled: true, duration: 600 },
          pagination: { enabled: true, defaultLimit: 50 },
          timeouts: { request: 45000, server: 180000 },
          responseTruncation: { enabled: true, maxLength: 500 },
          responseFiltering: { enabled: true, includeFields: ['id', 'name'], excludeFields: ['internal'] }
        },
        usagePattern: 'heavy'
      };

      const templateData = (generator as any).prepareTemplateData(config, []);
      
      expect(templateData.auth.type).toBe('basic');
      expect(templateData.auth.description).toBe('Basic Authentication');
    });
  });

  describe('File Generation', () => {
    test('should generate Python server with correct structure', async () => {
      const config: QAAnswers = {
        sourceType: 'manual',
        language: 'python',
        authentication: { type: 'oauth2' },
        toolOrganization: 'all_endpoints',
        errorHandling: 'retry',
        optimization: {
          caching: { enabled: false, duration: 300 },
          pagination: { enabled: false, defaultLimit: 100 },
          timeouts: { request: 60000, server: 120000 },
          responseTruncation: { enabled: false, maxLength: 1000 },
          responseFiltering: { enabled: false, includeFields: [], excludeFields: [] }
        },
        usagePattern: 'conservative'
      };

      await generator.generateMCPServer(config, [], tempDir);

      // Check that required files were created
      testUtils.expectFileExists(path.join(tempDir, 'src', 'server.py'));
      testUtils.expectFileExists(path.join(tempDir, 'requirements.txt'));
      testUtils.expectFileExists(path.join(tempDir, 'README.md'));
      testUtils.expectFileExists(path.join(tempDir, 'pyproject.toml'));
    });

    test('should generate TypeScript server with correct structure', async () => {
      const config: QAAnswers = {
        sourceType: 'manual',
        language: 'typescript',
        authentication: { type: 'api_key', headerName: 'Authorization' },
        toolOrganization: 'all_endpoints',
        errorHandling: 'fail_fast',
        optimization: {
          caching: { enabled: true, duration: 300 },
          pagination: { enabled: true, defaultLimit: 100 },
          timeouts: { request: 30000, server: 120000 },
          responseTruncation: { enabled: false, maxLength: 1000 },
          responseFiltering: { enabled: true, includeFields: [], excludeFields: [] }
        },
        usagePattern: 'moderate'
      };

      await generator.generateMCPServer(config, [], tempDir);

      // Check that required files were created
      testUtils.expectFileExists(path.join(tempDir, 'src', 'server.ts'));
      testUtils.expectFileExists(path.join(tempDir, 'package.json'));
      testUtils.expectFileExists(path.join(tempDir, 'tsconfig.json'));
      testUtils.expectFileExists(path.join(tempDir, 'README.md'));
    });
  });

  describe('Authentication Code Generation', () => {
    test('should generate OAuth2 authentication code in Python', async () => {
      const config: QAAnswers = {
        sourceType: 'manual',
        language: 'python',
        authentication: { type: 'oauth2' },
        toolOrganization: 'all_endpoints',
        errorHandling: 'retry',
        optimization: {
          caching: { enabled: false, duration: 300 },
          pagination: { enabled: false, defaultLimit: 100 },
          timeouts: { request: 60000, server: 120000 },
          responseTruncation: { enabled: false, maxLength: 1000 },
          responseFiltering: { enabled: false, includeFields: [], excludeFields: [] }
        },
        usagePattern: 'conservative'
      };

      await generator.generateMCPServer(config, [], tempDir);

      const serverPath = path.join(tempDir, 'src', 'server.py');
      const serverContent = testUtils.readGeneratedFile(serverPath);
      
      expect(serverContent).toContainAuthCode('oauth2');
      expect(serverContent).toBeValidMCPServer();
    });

    test('should generate API key authentication code in TypeScript', async () => {
      const config: QAAnswers = {
        sourceType: 'manual',
        language: 'typescript',
        authentication: { type: 'api_key', headerName: 'X-API-Key' },
        toolOrganization: 'all_endpoints',
        errorHandling: 'retry',
        optimization: {
          caching: { enabled: false, duration: 300 },
          pagination: { enabled: false, defaultLimit: 100 },
          timeouts: { request: 60000, server: 120000 },
          responseTruncation: { enabled: false, maxLength: 1000 },
          responseFiltering: { enabled: false, includeFields: [], excludeFields: [] }
        },
        usagePattern: 'conservative'
      };

      await generator.generateMCPServer(config, [], tempDir);

      const serverPath = path.join(tempDir, 'src', 'server.ts');
      const serverContent = testUtils.readGeneratedFile(serverPath);
      
      expect(serverContent).toContainAuthCode('api_key');
      expect(serverContent).toBeValidMCPServer();
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid output directory gracefully', async () => {
      const config: QAAnswers = {
        sourceType: 'manual',
        language: 'python',
        authentication: { type: 'none' },
        toolOrganization: 'all_endpoints',
        errorHandling: 'retry',
        optimization: {
          caching: { enabled: false, duration: 300 },
          pagination: { enabled: false, defaultLimit: 100 },
          timeouts: { request: 60000, server: 120000 },
          responseTruncation: { enabled: false, maxLength: 1000 },
          responseFiltering: { enabled: false, includeFields: [], excludeFields: [] }
        },
        usagePattern: 'conservative'
      };

      const invalidPath = '/invalid/path/that/does/not/exist';
      
      await expect(generator.generateMCPServer(config, [], invalidPath))
        .rejects.toThrow();
    });

    test('should validate required configuration parameters', async () => {
      const invalidConfig = {} as QAAnswers;
      
      await expect(generator.generateMCPServer(invalidConfig, [], tempDir))
        .rejects.toThrow();
    });
  });
});