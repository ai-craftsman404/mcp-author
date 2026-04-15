/**
 * OpenAPI Specification Parser and Tool Extractor
 * 
 * Handles parsing, validation, and tool extraction from OpenAPI specifications.
 * Supports both JSON and YAML formats with comprehensive validation.
 * 
 * @module utils/openapi
 * @exports OpenAPIParser - Main OpenAPI processing class
 * @author MCP Author CLI
 */

import fs from 'fs-extra';
import yaml from 'js-yaml';
// import * as SwaggerParser from 'swagger-parser';
import { OpenAPISpec, ToolConfig, AuthenticationConfig, ValidationResult } from '../types';

export class OpenAPIParser {
  async parseFromFile(filePath: string): Promise<OpenAPISpec> {
    try {
      if (!await fs.pathExists(filePath)) {
        throw new Error(`OpenAPI file not found: ${filePath}`);
      }

      const content = await fs.readFile(filePath, 'utf-8');
      return this.parseFromString(content, filePath);
    } catch (error) {
      throw new Error(`Failed to parse OpenAPI file: ${error}`);
    }
  }

  async parseFromUrl(url: string): Promise<OpenAPISpec> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const content = await response.text();
      return this.parseFromString(content, url);
    } catch (error) {
      throw new Error(`Failed to fetch OpenAPI from URL: ${error}`);
    }
  }

  private async parseFromString(content: string, source: string): Promise<OpenAPISpec> {
    try {
      let parsedContent: any;
      
      if (source.endsWith('.yaml') || source.endsWith('.yml')) {
        parsedContent = yaml.load(content);
      } else {
        parsedContent = JSON.parse(content);
      }

      // Basic validation - check for required OpenAPI fields
      if (!parsedContent.openapi && !parsedContent.swagger) {
        throw new Error('Missing OpenAPI or Swagger version field');
      }
      
      if (!parsedContent.info) {
        throw new Error('Missing info object');
      }
      
      if (!parsedContent.paths) {
        throw new Error('Missing paths object');
      }
      
      return parsedContent as OpenAPISpec;
    } catch (error) {
      throw new Error(`Invalid OpenAPI specification: ${error}`);
    }
  }

  async validateSpec(spec: OpenAPISpec): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Basic structure validation
      if (!spec.openapi) {
        errors.push('Missing required field: openapi');
      }

      if (!spec.info) {
        errors.push('Missing required field: info');
      } else {
        if (!spec.info.title) {
          errors.push('Missing required field: info.title');
        }
        if (!spec.info.version) {
          errors.push('Missing required field: info.version');
        }
      }

      if (!spec.paths || Object.keys(spec.paths).length === 0) {
        errors.push('No paths defined in the specification');
      }

      // Check for common issues
      if (spec.servers && spec.servers.length === 0) {
        warnings.push('No servers defined - consider adding a servers array');
      }

      if (spec.components?.securitySchemes && !spec.security) {
        warnings.push('Security schemes defined but no global security applied');
      }

      // Validate paths
      for (const [path, pathItem] of Object.entries(spec.paths)) {
        if (!pathItem || typeof pathItem !== 'object') {
          errors.push(`Invalid path item for ${path}`);
          continue;
        }

        for (const [method, operation] of Object.entries(pathItem)) {
          if (['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace'].includes(method)) {
            const op = operation as any;
            if (!op?.summary && !op?.description) {
              warnings.push(`${method.toUpperCase()} ${path}: Missing summary or description`);
            }
          }
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings
      };
    } catch (error) {
      return {
        valid: false,
        errors: [`Validation error: ${error}`],
        warnings
      };
    }
  }

  extractTools(spec: OpenAPISpec, filter: 'all' | 'read_only' | 'write_only' | 'custom' = 'all'): ToolConfig[] {
    const tools: ToolConfig[] = [];

    for (const [path, pathItem] of Object.entries(spec.paths)) {
      if (!pathItem || typeof pathItem !== 'object') continue;

      for (const [method, operation] of Object.entries(pathItem)) {
        if (typeof operation !== 'object' || !operation) continue;
        
        const httpMethod = method.toUpperCase() as any;
        
        if (!['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(httpMethod)) {
          continue;
        }

        // Apply filtering
        if (filter === 'read_only' && !['GET'].includes(httpMethod)) {
          continue;
        }
        if (filter === 'write_only' && ['GET'].includes(httpMethod)) {
          continue;
        }

        const operationObj = operation as any;
        
        const tool: ToolConfig = {
          name: this.generateToolName(httpMethod, path, operationObj),
          description: operationObj.summary || operationObj.description || `${httpMethod} ${path}`,
          method: httpMethod,
          path: path,
          parameters: this.extractParameters(operationObj, pathItem.parameters),
          requestBody: this.extractRequestBody(operationObj.requestBody),
          responses: this.extractResponses(operationObj.responses)
        };

        tools.push(tool);
      }
    }

    return tools;
  }

  extractAuthentication(spec: OpenAPISpec): AuthenticationConfig {
    // Check security schemes
    if (spec.components?.securitySchemes) {
      const schemes = spec.components.securitySchemes;
      const firstScheme = Object.values(schemes)[0];

      if (firstScheme?.type === 'apiKey') {
        return {
          type: 'api_key',
          location: firstScheme.in === 'header' ? 'header' : 'query',
          headerName: firstScheme.in === 'header' ? firstScheme.name : undefined,
          parameterName: firstScheme.in === 'query' ? firstScheme.name : undefined,
          description: firstScheme.description || 'API Key authentication'
        };
      }

      if (firstScheme?.type === 'http' && firstScheme.scheme === 'basic') {
        return {
          type: 'basic',
          description: 'Basic HTTP authentication'
        };
      }

      if (firstScheme?.type === 'oauth2') {
        return {
          type: 'oauth2',
          description: 'OAuth 2.0 authentication'
        };
      }
    }

    return {
      type: 'none',
      description: 'No authentication required'
    };
  }

  private generateToolName(method: string, path: string, operation: any): string {
    // Use operationId if available
    if (operation.operationId) {
      return this.camelCase(operation.operationId);
    }

    // Generate from method and path
    const pathParts = path.split('/').filter(part => part && !part.startsWith('{'));
    const lastPart = pathParts[pathParts.length - 1] || 'resource';
    
    const methodPrefix = method.toLowerCase();
    return this.camelCase(`${methodPrefix}_${lastPart}`);
  }

  private extractParameters(operation: any, pathParameters?: any[]): any[] {
    const params: any[] = [];
    
    // Path parameters
    if (pathParameters) {
      params.push(...pathParameters);
    }
    
    // Operation parameters
    if (operation.parameters) {
      params.push(...operation.parameters);
    }

    return params.map(param => ({
      name: param.name,
      type: param.schema?.type || 'string',
      location: param.in,
      required: param.required || param.in === 'path',
      description: param.description,
      example: param.example || param.schema?.example
    }));
  }

  private extractRequestBody(requestBody: any): any {
    if (!requestBody?.content) return undefined;

    const jsonContent = requestBody.content['application/json'];
    if (!jsonContent?.schema) return undefined;

    return {
      type: 'object',
      properties: jsonContent.schema.properties || {},
      required: jsonContent.schema.required || []
    };
  }

  private extractResponses(responses: any): any[] {
    if (!responses) return [];

    return Object.entries(responses).map(([statusCode, response]: [string, any]) => ({
      statusCode,
      description: response.description || 'No description',
      schema: response.content?.['application/json']?.schema
    }));
  }

  private camelCase(str: string): string {
    return str
      .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
      .replace(/^[A-Z]/, match => match.toLowerCase());
  }
}