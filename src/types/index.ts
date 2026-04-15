/**
 * Core Type Definitions
 * 
 * Defines the complete type system for MCP Author including:
 * - Configuration interfaces for Q&A answers and server settings
 * - OpenAPI specification types and tool extraction
 * - Authentication configuration and patterns
 * - Template generation context types
 * - Validation and scoring interfaces
 * 
 * Key Type Categories:
 * - MCPServerConfig: Complete server configuration
 * - QAAnswers: User responses from interactive Q&A flow
 * - AuthenticationConfig: API authentication settings
 * - ToolConfig: Individual MCP tool definitions
 * - OpenAPISpec: OpenAPI specification representation
 * - ValidationScore: Production readiness scoring
 * 
 * Features:
 * - Strict TypeScript typing for all components
 * - Comprehensive interface documentation
 * - Union types for configuration options
 * - Optional property handling
 * - Type guards and validation helpers
 * 
 * @module types
 * @exports All core interfaces and types for MCP Author
 * @author MCP Author CLI
 */

// Core types for MCP Author

export interface MCPServerConfig {
  name: string;
  description: string;
  version: string;
  language: 'typescript' | 'python';
  authentication: AuthenticationConfig;
  tools: ToolConfig[];
  optimization: OptimizationConfig;
  features: FeatureConfig;
}

export interface AuthenticationConfig {
  type: 'none' | 'api_key' | 'oauth2' | 'basic' | 'custom';
  location?: 'header' | 'query';
  headerName?: string;
  parameterName?: string;
  description?: string;
  customConfig?: string;
}

export interface ToolConfig {
  name: string;
  description: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  parameters?: ParameterConfig[];
  requestBody?: RequestBodyConfig;
  responses?: ResponseConfig[];
}

export interface ParameterConfig {
  name: string;
  type: string;
  location: 'path' | 'query' | 'header';
  required: boolean;
  description?: string;
  example?: any;
}

export interface RequestBodyConfig {
  type: string;
  properties: Record<string, PropertyConfig>;
  required: string[];
}

export interface PropertyConfig {
  type: string;
  description?: string;
  format?: string;
  example?: any;
}

export interface ResponseConfig {
  statusCode: string;
  description: string;
  schema?: any;
}

export interface OptimizationConfig {
  caching: {
    enabled: boolean;
    duration?: number;
  };
  pagination: {
    enabled: boolean;
    defaultLimit?: number;
  };
  timeouts: {
    request: number;
    server: number;
  };
  responseTruncation: {
    enabled: boolean;
    maxLength?: number;
  };
  responseFiltering: {
    enabled: boolean;
    includeFields?: string[];
    excludeFields?: string[];
  };
}

export interface FeatureConfig {
  documentation: {
    generateReadme: boolean;
    includeExamples: boolean;
    includeSetupGuide: boolean;
  };
  testing: {
    includeUnitTests: boolean;
    includeMCPValidation: boolean;
  };
  development: {
    includeDevDependencies: boolean;
    includeScripts: boolean;
    includeLinting: boolean;
  };
}

export interface QAAnswers {
  sourceType: 'manual' | 'openapi' | 'url' | 'custom';
  openApiSpec?: string;
  language: 'typescript' | 'python';
  authentication: AuthenticationConfig;
  toolOrganization: 'all_endpoints' | 'read_only' | 'write_only' | 'custom_selection';
  selectedEndpoints?: string[];
  errorHandling: 'retry' | 'fail_fast' | 'graceful' | 'custom';
  optimization: OptimizationConfig;
  usagePattern: 'light' | 'moderate' | 'heavy' | 'custom' | 'conservative';
  customUsageDescription?: string;
}

export interface QAInternalAnswers {
  sourceType: 'manual' | 'openapi' | 'url' | 'custom';
  openApiFile?: string;
  openApiUrl?: string;
  language: 'typescript' | 'python';
  authType: 'api_key_header' | 'api_key_query' | 'basic' | 'oauth2' | 'none' | 'custom';
  authHeaderName?: string;
  authQueryParam?: string;
  toolOrganization: 'all_endpoints' | 'read_only' | 'write_only' | 'custom_selection';
  errorHandling: 'retry' | 'fail_fast' | 'graceful' | 'custom';
  responseOptimization: string[];
  usagePattern: 'light' | 'moderate' | 'heavy' | 'custom' | 'conservative';
}

export interface GenerationResult {
  success: boolean;
  serverPath: string;
  files: GeneratedFile[];
  productionScore: ProductionScore;
  warnings: string[];
  errors: string[];
}

export interface GeneratedFile {
  path: string;
  content: string;
  type: 'typescript' | 'python' | 'json' | 'markdown' | 'yaml' | 'text';
}

export interface ProductionScore {
  overall: number;
  maxScore: number;
  grade: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F';
  categories: {
    security: CategoryScore;
    errorHandling: CategoryScore;
    documentation: CategoryScore;
    testing: CategoryScore;
    performance: CategoryScore;
    configuration: CategoryScore;
    codeQuality: CategoryScore;
  };
  recommendations: string[];
}

export interface CategoryScore {
  score: number;
  maxScore: number;
  description: string;
  improvements: string[];
}

export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers?: Array<{
    url: string;
    description?: string;
  }>;
  paths: Record<string, any>;
  components?: {
    schemas?: Record<string, any>;
    securitySchemes?: Record<string, any>;
  };
  security?: Array<Record<string, string[]>>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface MCPInspectorResult {
  success: boolean;
  tools: Array<{
    name: string;
    description: string;
    schema: any;
  }>;
  errors: string[];
  warnings: string[];
}