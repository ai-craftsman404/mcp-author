/**
 * MCP Author - Main Library Exports
 * 
 * Central export file for all MCP Author functionality.
 * Provides clean imports for external usage and testing.
 * 
 * Exported Modules:
 * - types: All TypeScript interfaces and type definitions
 * - generate: MCP server generation functionality
 * - validate: Production readiness validation system
 * - examples: Interactive examples and tutorials
 * 
 * Usage:
 * ```typescript
 * import { generateCommand, QAAnswers } from 'mcp-author';
 * ```
 * 
 * @module index
 * @exports All public MCP Author functionality
 * @author MCP Author CLI
 */

export * from './types';
export * from './cli/commands/generate';
export * from './cli/commands/validate';
export * from './cli/commands/examples';