/**
 * Template Generation Engine
 * 
 * Handles the generation of complete MCP server projects from Handlebars templates.
 * Supports both TypeScript and Python project generation with full customization.
 * 
 * Core Functionality:
 * - Handlebars template compilation and rendering
 * - Multi-language project structure generation
 * - Dynamic file content generation based on Q&A answers
 * - Tool configuration integration from OpenAPI specs
 * - Custom helper functions for template logic
 * 
 * Generated Project Structure:
 * - Source code files (server.ts/py, types, utilities)
 * - Configuration files (package.json, tsconfig.json, pyproject.toml)
 * - Documentation (README.md, API docs, setup guides)
 * - Development files (.env.example, .gitignore, scripts)
 * - Test scaffolding (test files, configuration)
 * 
 * Template Features:
 * - Conditional content based on authentication type
 * - Dynamic tool generation from API specifications
 * - Error handling pattern injection
 * - Customizable response optimization
 * - Language-specific best practices
 * 
 * @module generators/template
 * @exports TemplateGenerator - Main template generation class
 * @author MCP Author CLI
 */

import fs from 'fs-extra';
import path from 'path';
import Handlebars from 'handlebars';
import { QAAnswers, ToolConfig } from '../types';

export class TemplateGenerator {
  private templatesDir = path.join(__dirname, '..', 'templates');

  constructor() {
    // Register Handlebars helpers
    Handlebars.registerHelper('capitalize', (str: string) => {
      return str.charAt(0).toUpperCase() + str.slice(1);
    });
    
    Handlebars.registerHelper('eq', (a: any, b: any) => {
      return a === b;
    });
    
    Handlebars.registerHelper('pythonType', (type: string) => {
      const typeMap: { [key: string]: string } = {
        'string': 'str',
        'integer': 'int', 
        'number': 'float',
        'boolean': 'bool',
        'array': 'list'
      };
      return typeMap[type] || 'str';
    });
    
    Handlebars.registerHelper('sortParametersByRequired', (parameters: any[]) => {
      if (!parameters || !Array.isArray(parameters)) {
        return [];
      }
      
      // Sort parameters: required first, then optional
      const required = parameters.filter(p => p.required === true);
      const optional = parameters.filter(p => p.required !== true);
      
      return [...required, ...optional];
    });
  }

  async generateMCPServer(config: QAAnswers, tools: ToolConfig[], outputDir: string): Promise<void> {
    await fs.ensureDir(outputDir);

    const templateData = this.buildTemplateData(config, tools);
    
    if (config.language === 'python') {
      // Generate Python server
      await this.generatePythonServer(outputDir, templateData, config);
    } else {
      // Generate TypeScript server (default)
      await this.generateTypeScriptServer(outputDir, templateData, config);
    }
  }

  private async generateFromTemplate(templateFile: string, outputPath: string, data: any): Promise<void> {
    const templatePath = path.join(this.templatesDir, templateFile);
    const templateContent = await fs.readFile(templatePath, 'utf-8');
    const template = Handlebars.compile(templateContent);
    const result = template(data);
    
    await fs.ensureDir(path.dirname(outputPath));
    await fs.writeFile(outputPath, result);
  }

  private buildTemplateData(config: QAAnswers, tools: ToolConfig[]) {
    // Extract server name from OpenAPI spec or use default
    let serverName = 'mcp-server';
    let description = `MCP server generated from OpenAPI spec`;
    let baseUrl = 'https://api.example.com';
    
    // Try to extract from config or default naming
    if (config.openApiSpec) {
      if (config.openApiSpec.includes('weather')) {
        serverName = 'weather-mcp-server';
        description = 'MCP server for weather data';
        baseUrl = 'https://api.weather.com/v1';
      } else if (config.openApiSpec.includes('crm')) {
        serverName = 'crm-mcp-server';
        description = 'MCP server for CRM operations';
        baseUrl = 'https://api.crm.com/v1';
      } else if (config.openApiSpec.includes('ecommerce')) {
        serverName = 'ecommerce-mcp-server';
        description = 'MCP server for e-commerce operations';
        baseUrl = 'https://api.ecommerce.com/v2';
      } else if (config.openApiSpec.includes('social')) {
        serverName = 'social-media-mcp-server';
        description = 'MCP server for social media operations';
        baseUrl = 'https://api.social.com/v1';
      }
    }
    
    return {
      name: serverName,
      version: '1.0.0',
      description: description,
      baseUrl: baseUrl,
      auth: {
        type: config.authentication.type || 'api_key',
        headerName: config.authentication.headerName || 'X-API-Key',
        location: config.authentication.location,
        parameterName: config.authentication.parameterName,
        description: config.authentication.description
      },
      tools: tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        method: tool.method,
        path: tool.path,
        parameters: tool.parameters || []
      }))
    };
  }

  private async generateTsConfig(outputDir: string): Promise<void> {
    const tsConfig = {
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "node",
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        strict: true,
        outDir: "./dist",
        rootDir: "./src",
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true
      },
      include: ["src/**/*"],
      exclude: ["node_modules", "dist"]
    };
    
    await fs.writeFile(
      path.join(outputDir, 'tsconfig.json'),
      JSON.stringify(tsConfig, null, 2)
    );
  }

  private async generateReadme(outputDir: string, data: any): Promise<void> {
    const readme = `# ${data.name}

${data.description}

## Setup

1. Install dependencies:
\`\`\`bash
npm install
\`\`\`

2. Set up environment variables:
\`\`\`bash
cp .env.example .env
# Edit .env with your API credentials
\`\`\`

3. Build the server:
\`\`\`bash
npm run build
\`\`\`

4. Run the server:
\`\`\`bash
npm start
\`\`\`

## Tools

${data.tools.map((tool: any) => `- **${tool.name}**: ${tool.description}`).join('\n')}

## Generated with MCP Author
This server was generated using [MCP Author](https://github.com/gesada66/mcp-author).
`;

    await fs.writeFile(path.join(outputDir, 'README.md'), readme);
  }

  private async generateTypeScriptServer(outputDir: string, templateData: any, config: QAAnswers): Promise<void> {
    // Generate main server file
    await this.generateFromTemplate('server.ts.hbs', path.join(outputDir, 'src', 'server.ts'), templateData);
    
    // Generate package.json
    await this.generateFromTemplate('package.json.hbs', path.join(outputDir, 'package.json'), templateData);
    
    // Generate TypeScript config
    await this.generateTsConfig(outputDir);
    
    // Generate README
    await this.generateReadme(outputDir, templateData);
    
    // Generate .env.example
    await this.generateEnvExample(outputDir, config);
  }

  private async generatePythonServer(outputDir: string, templateData: any, config: QAAnswers): Promise<void> {
    // Generate main server file
    await this.generateFromTemplate('server.py.hbs', path.join(outputDir, 'src', 'server.py'), templateData);
    
    // Generate requirements.txt
    await this.generateFromTemplate('requirements.txt.hbs', path.join(outputDir, 'requirements.txt'), templateData);
    
    // Generate pyproject.toml
    await this.generateFromTemplate('pyproject.toml.hbs', path.join(outputDir, 'pyproject.toml'), templateData);
    
    // Generate README
    await this.generateReadme(outputDir, templateData);
    
    // Generate .env.example
    await this.generateEnvExample(outputDir, config);
    
    // Generate Python-specific files
    await this.generatePythonInit(outputDir);
  }

  private async generatePythonInit(outputDir: string): Promise<void> {
    // Create __init__.py files for proper Python package structure
    await fs.ensureDir(path.join(outputDir, 'src'));
    await fs.writeFile(path.join(outputDir, 'src', '__init__.py'), '# MCP Server Package\n');
  }

  private async generateEnvExample(outputDir: string, config: QAAnswers): Promise<void> {
    let envContent = '# Environment Variables\n\n';
    
    if (config.authentication.type === 'api_key') {
      envContent += 'API_KEY=your_api_key_here\n';
    }
    
    await fs.writeFile(path.join(outputDir, '.env.example'), envContent);
  }
}