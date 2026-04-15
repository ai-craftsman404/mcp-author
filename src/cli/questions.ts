/**
 * Q&A Question Definitions
 * 
 * Defines the complete set of interactive questions for MCP server configuration.
 * Each question includes validation, choices, conditional logic, and beautiful styling.
 * 
 * Question Categories:
 * 1. Source Selection: How to create the MCP server (OpenAPI, Manual, URL, Custom)
 * 2. Language Choice: Programming language preference (TypeScript, Python)
 * 3. Authentication: API authentication methods (API Key, OAuth2, Basic, Custom, None)
 * 4. Tool Organization: How to organize API endpoints as MCP tools
 * 5. Error Handling: Error handling and retry strategies
 * 6. Response Optimization: LLM response optimization preferences
 * 7. Usage Patterns: Expected usage and performance requirements
 * 
 * Features:
 * - Rich choice objects with emojis and descriptions
 * - Conditional question logic based on previous answers
 * - Input validation and error messages
 * - Beautiful CLI styling and formatting
 * - Context-aware default values
 * 
 * @module cli/questions
 * @exports mcpQuestions - Complete question collection for inquirer
 * @exports Choice - Choice interface for question options
 * @author MCP Author CLI
 */

import { QuestionCollection } from 'inquirer';
import chalk from 'chalk';

export interface Choice {
  name: string;
  value: string;
  description?: string;
  emoji?: string;
}

export const mcpQuestions: QuestionCollection = [
  {
    type: 'list',
    name: 'sourceType',
    message: chalk.cyan('🚀 How do you want to create your MCP server?'),
    choices: [
      {
        name: '🔗 Upload OpenAPI specification',
        value: 'openapi',
        short: 'OpenAPI'
      },
      {
        name: '📝 Manual configuration',
        value: 'manual', 
        short: 'Manual'
      },
      {
        name: '🌐 Import from URL',
        value: 'url',
        short: 'URL'
      },
      {
        name: '⚙️ Custom setup',
        value: 'custom',
        short: 'Custom'
      }
    ],
    pageSize: 4
  },
  {
    type: 'input',
    name: 'openApiFile',
    message: chalk.cyan('📄 Enter the path to your OpenAPI specification file:'),
    when: (answers) => answers['sourceType'] === 'openapi',
    validate: (input: string) => {
      if (!input.trim()) {
        return chalk.red('Please provide a valid file path');
      }
      return true;
    }
  },
  {
    type: 'input',
    name: 'openApiUrl',
    message: chalk.cyan('🌍 Enter the URL to your OpenAPI specification:'),
    when: (answers) => answers['sourceType'] === 'url',
    validate: (input: string) => {
      const urlRegex = /^https?:\/\/.+/;
      if (!urlRegex.test(input)) {
        return chalk.red('Please provide a valid HTTP/HTTPS URL');
      }
      return true;
    }
  },
  {
    type: 'list',
    name: 'language',
    message: chalk.cyan('🛠️ What programming language do you prefer?'),
    choices: [
      {
        name: '🟦 TypeScript/Node.js',
        value: 'typescript',
        short: 'TypeScript'
      },
      {
        name: '🐍 Python',
        value: 'python',
        short: 'Python'
      }
    ],
    default: 'typescript'
  },
  {
    type: 'list',
    name: 'authType',
    message: chalk.cyan('🔐 What authentication does your data source require?'),
    choices: [
      {
        name: '🔑 API Key in header',
        value: 'api_key_header',
        short: 'API Key (Header)'
      },
      {
        name: '🔐 API Key in query parameter',
        value: 'api_key_query',
        short: 'API Key (Query)'
      },
      {
        name: '👤 Basic Authentication',
        value: 'basic',
        short: 'Basic Auth'
      },
      {
        name: '🎫 OAuth 2.0',
        value: 'oauth2',
        short: 'OAuth 2.0'
      },
      {
        name: '❌ No authentication required',
        value: 'none',
        short: 'None'
      },
      {
        name: '⚙️ Custom authentication',
        value: 'custom',
        short: 'Custom'
      }
    ]
  },
  {
    type: 'input',
    name: 'authHeaderName',
    message: chalk.cyan('🏷️ Enter the header name for the API key:'),
    when: (answers) => answers['authType'] === 'api_key_header',
    default: 'Authorization',
    validate: (input: string) => {
      if (!input.trim()) {
        return chalk.red('Please provide a header name');
      }
      return true;
    }
  },
  {
    type: 'input',
    name: 'authQueryParam',
    message: chalk.cyan('🏷️ Enter the query parameter name for the API key:'),
    when: (answers) => answers['authType'] === 'api_key_query',
    default: 'api_key',
    validate: (input: string) => {
      if (!input.trim()) {
        return chalk.red('Please provide a parameter name');
      }
      return true;
    }
  },
  {
    type: 'list',
    name: 'toolOrganization',
    message: chalk.cyan('🎯 How should we organize your API endpoints as MCP tools?'),
    choices: [
      {
        name: '✅ Include all endpoints',
        value: 'all_endpoints',
        short: 'All endpoints'
      },
      {
        name: '📊 Read-only operations only',
        value: 'read_only',
        short: 'Read-only'
      },
      {
        name: '✏️ Write operations only',
        value: 'write_only',
        short: 'Write-only'
      },
      {
        name: '🎯 Custom selection',
        value: 'custom_selection',
        short: 'Custom'
      }
    ]
  },
  {
    type: 'list',
    name: 'errorHandling',
    message: chalk.cyan('🛡️ How should errors be handled?'),
    choices: [
      {
        name: '🔄 Automatic retry with exponential backoff',
        value: 'retry',
        short: 'Auto retry'
      },
      {
        name: '⚡ Fail fast with immediate error reporting',
        value: 'fail_fast',
        short: 'Fail fast'
      },
      {
        name: '🛡️ Graceful degradation with partial data',
        value: 'graceful',
        short: 'Graceful'
      },
      {
        name: '⚙️ Custom error handling',
        value: 'custom',
        short: 'Custom'
      }
    ]
  },
  {
    type: 'checkbox',
    name: 'responseOptimization',
    message: chalk.cyan('🚀 How should responses be optimized for the LLM?'),
    choices: [
      {
        name: '🗜️ Filter large responses to essential fields',
        value: 'filter_responses',
        checked: true
      },
      {
        name: '📄 Handle pagination automatically',
        value: 'auto_pagination',
        checked: true
      },
      {
        name: '💾 Cache responses for 5 minutes',
        value: 'response_caching',
        checked: false
      },
      {
        name: '🕐 Set 30 second request timeout',
        value: 'request_timeout',
        checked: true
      },
      {
        name: '📏 Truncate large text responses',
        value: 'truncate_responses',
        checked: false
      }
    ],
    validate: (choices: string[]) => {
      if (choices.length === 0) {
        return chalk.red('Please select at least one optimization');
      }
      return true;
    }
  },
  {
    type: 'list',
    name: 'usagePattern',
    message: chalk.cyan('📈 What\'s your expected usage pattern?'),
    choices: [
      {
        name: '🐌 Light usage (< 100 requests/hour)',
        value: 'light',
        short: 'Light'
      },
      {
        name: '📈 Moderate usage (100-1000 requests/hour)',
        value: 'moderate',
        short: 'Moderate'
      },
      {
        name: '🚀 Heavy usage (> 1000 requests/hour)',
        value: 'heavy',
        short: 'Heavy'
      },
      {
        name: '🤷 Not sure (use conservative defaults)',
        value: 'conservative',
        short: 'Conservative'
      }
    ]
  }
];