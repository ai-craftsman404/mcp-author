/**
 * MCP Author Examples Command
 * 
 * Provides interactive examples and tutorials for MCP server generation.
 * Helps users understand different use cases and configuration options.
 * 
 * Example Categories:
 * - Basic API integration examples
 * - Authentication patterns (API key, OAuth2, Basic Auth)
 * - OpenAPI specification examples
 * - Custom tool configuration examples
 * - Advanced error handling patterns
 * 
 * Features:
 * - Interactive CLI examples with step-by-step guidance
 * - Copy-pastable command examples
 * - Sample OpenAPI specifications
 * - Best practices demonstrations
 * 
 * @module cli/commands/examples
 * @exports examplesCommand - Main examples command handler
 * @author MCP Author CLI
 */

import chalk from 'chalk';
import boxen from 'boxen';

interface ExamplesOptions {
  type?: string;
}

export async function examplesCommand(options: ExamplesOptions): Promise<void> {
  console.log(chalk.blue('\n🎯 MCP Author Examples\n'));
  
  const exampleType = options.type || 'all';
  
  if (exampleType === 'openapi' || exampleType === 'all') {
    showOpenAPIExample();
  }
  
  if (exampleType === 'config' || exampleType === 'all') {
    showConfigExample();
  }
  
  if (exampleType === 'generated' || exampleType === 'all') {
    showGeneratedExample();
  }
}

function showOpenAPIExample(): void {
  const example = `{
  "openapi": "3.0.0",
  "info": {
    "title": "Weather API",
    "version": "1.0.0"
  },
  "paths": {
    "/weather": {
      "get": {
        "summary": "Get current weather",
        "parameters": [
          {
            "name": "city",
            "in": "query",
            "required": true,
            "schema": { "type": "string" }
          }
        ]
      }
    }
  }
}`;

  console.log(chalk.yellow('📄 OpenAPI Specification Example:'));
  console.log(boxen(chalk.gray(example), {
    padding: 1,
    borderColor: 'yellow',
    borderStyle: 'round'
  }));
  console.log(chalk.green('Usage: mcp-author generate --openapi weather-api.json\n'));
}

function showConfigExample(): void {
  const example = `# Basic Configuration
mcp-author generate \\
  --language typescript \\
  --auth api_key \\
  --output ./my-mcp-server

# Interactive Mode (Recommended)
mcp-author generate --interactive`;

  console.log(chalk.yellow('⚙️  CLI Configuration Example:'));
  console.log(boxen(chalk.gray(example), {
    padding: 1,
    borderColor: 'yellow',
    borderStyle: 'round'
  }));
  console.log(chalk.green('Tip: Use --interactive for guided Q&A setup\n'));
}

function showGeneratedExample(): void {
  const example = `generated-mcp-server/
├── src/
│   ├── server.ts           # Main MCP server
│   ├── tools/              # Generated tools
│   │   └── weather.ts
│   └── types/              # TypeScript types
├── tests/                  # Test scaffolding
├── package.json            # Dependencies & scripts
├── .env.example            # Environment template
└── README.md               # Setup instructions`;

  console.log(chalk.yellow('📁 Generated Project Structure:'));
  console.log(boxen(chalk.gray(example), {
    padding: 1,
    borderColor: 'yellow',
    borderStyle: 'round'
  }));
  console.log(chalk.green('Ready to run: cd generated-mcp-server && npm install\n'));
}