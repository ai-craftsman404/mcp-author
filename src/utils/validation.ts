/**
 * Configuration Validation Utilities
 * 
 * Provides JSON schema validation for MCP server configurations and user inputs.
 * Uses AJV for comprehensive validation with custom error reporting.
 * 
 * @module utils/validation
 * @exports ConfigValidator - Configuration validation class
 * @author MCP Author CLI
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { ValidationResult, MCPServerConfig } from '../types';

export class ConfigValidator {
  private ajv: Ajv;

  constructor() {
    this.ajv = new Ajv({ allErrors: true });
    addFormats(this.ajv);
  }

  validateMCPConfig(config: MCPServerConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate required fields
      if (!config.name) {
        errors.push('Server name is required');
      }

      if (!config.description) {
        errors.push('Server description is required');
      }

      if (!config.version) {
        errors.push('Server version is required');
      }

      if (!config.language || !['typescript', 'python'].includes(config.language)) {
        errors.push('Language must be either "typescript" or "python"');
      }

      // Validate authentication
      if (!config.authentication || !config.authentication.type) {
        errors.push('Authentication configuration is required');
      } else {
        const auth = config.authentication;
        const validAuthTypes = ['none', 'api_key', 'oauth2', 'basic', 'custom'];
        
        if (!validAuthTypes.includes(auth.type)) {
          errors.push(`Invalid authentication type: ${auth.type}`);
        }

        if (auth.type === 'api_key') {
          if (!auth.location || !['header', 'query'].includes(auth.location)) {
            errors.push('API key authentication requires location (header or query)');
          }
          
          if (auth.location === 'header' && !auth.headerName) {
            warnings.push('Header name not specified for API key authentication');
          }
          
          if (auth.location === 'query' && !auth.parameterName) {
            warnings.push('Parameter name not specified for API key authentication');
          }
        }
      }

      // Validate tools
      if (!config.tools || config.tools.length === 0) {
        warnings.push('No tools defined - server will have limited functionality');
      } else {
        config.tools.forEach((tool, index) => {
          if (!tool.name) {
            errors.push(`Tool ${index}: name is required`);
          }
          
          if (!tool.description) {
            warnings.push(`Tool ${tool.name || index}: description is recommended`);
          }
          
          if (!tool.method || !['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(tool.method)) {
            errors.push(`Tool ${tool.name || index}: invalid HTTP method`);
          }
          
          if (!tool.path) {
            errors.push(`Tool ${tool.name || index}: path is required`);
          } else if (!tool.path.startsWith('/')) {
            warnings.push(`Tool ${tool.name || index}: path should start with /`);
          }
        });
      }

      // Validate optimization settings
      if (config.optimization) {
        const opt = config.optimization;
        
        if (opt.timeouts) {
          if (opt.timeouts.request <= 0) {
            errors.push('Request timeout must be positive');
          }
          if (opt.timeouts.server <= 0) {
            errors.push('Server timeout must be positive');
          }
          if (opt.timeouts.request > opt.timeouts.server) {
            warnings.push('Request timeout should not exceed server timeout');
          }
        }

        if (opt.pagination && opt.pagination.enabled && (!opt.pagination.defaultLimit || opt.pagination.defaultLimit <= 0)) {
          warnings.push('Pagination enabled but no valid default limit specified');
        }

        if (opt.responseTruncation && opt.responseTruncation.enabled && (!opt.responseTruncation.maxLength || opt.responseTruncation.maxLength <= 0)) {
          warnings.push('Response truncation enabled but no valid max length specified');
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
        errors: [`Validation failed: ${error}`],
        warnings
      };
    }
  }

  validateToolName(name: string): { valid: boolean; message?: string } {
    if (!name) {
      return { valid: false, message: 'Tool name cannot be empty' };
    }

    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) {
      return { 
        valid: false, 
        message: 'Tool name must start with a letter and contain only letters, numbers, and underscores' 
      };
    }

    if (name.length > 64) {
      return { valid: false, message: 'Tool name must be 64 characters or less' };
    }

    // Check against reserved words
    const reserved = [
      'function', 'return', 'if', 'else', 'for', 'while', 'try', 'catch',
      'class', 'interface', 'type', 'import', 'export', 'default',
      'async', 'await', 'promise', 'error', 'throw'
    ];

    if (reserved.includes(name.toLowerCase())) {
      return { valid: false, message: `Tool name "${name}" is a reserved word` };
    }

    return { valid: true };
  }

  validateServerPath(path: string): { valid: boolean; message?: string } {
    if (!path) {
      return { valid: false, message: 'Path cannot be empty' };
    }

    if (!path.startsWith('/')) {
      return { valid: false, message: 'Path must start with /' };
    }

    // Check for invalid characters
    if (!/^[a-zA-Z0-9\/_\-{}]+$/.test(path)) {
      return { 
        valid: false, 
        message: 'Path contains invalid characters. Use only letters, numbers, /, -, _, and {}' 
      };
    }

    // Check for proper parameter syntax
    const paramMatches = path.match(/{[^}]*}/g);
    if (paramMatches) {
      for (const param of paramMatches) {
        const paramName = param.slice(1, -1);
        if (!paramName || !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(paramName)) {
          return { 
            valid: false, 
            message: `Invalid parameter name in path: ${param}` 
          };
        }
      }
    }

    return { valid: true };
  }

  sanitizeToolName(name: string): string {
    // Remove invalid characters and convert to camelCase
    return name
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/^[0-9]+/, '')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
      .replace(/^[A-Z]/, match => match.toLowerCase()) || 'tool';
  }

  generateValidationReport(validations: ValidationResult[]): string {
    const totalErrors = validations.reduce((sum, v) => sum + v.errors.length, 0);
    const totalWarnings = validations.reduce((sum, v) => sum + v.warnings.length, 0);
    const allValid = validations.every(v => v.valid);

    let report = `\n=== Validation Report ===\n`;
    report += `Status: ${allValid ? '✅ PASSED' : '❌ FAILED'}\n`;
    report += `Errors: ${totalErrors}\n`;
    report += `Warnings: ${totalWarnings}\n\n`;

    validations.forEach((validation, index) => {
      if (validation.errors.length > 0 || validation.warnings.length > 0) {
        report += `--- Validation ${index + 1} ---\n`;
        
        validation.errors.forEach(error => {
          report += `❌ ERROR: ${error}\n`;
        });
        
        validation.warnings.forEach(warning => {
          report += `⚠️  WARNING: ${warning}\n`;
        });
        
        report += '\n';
      }
    });

    return report;
  }
}