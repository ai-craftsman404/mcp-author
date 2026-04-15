/**
 * Interactive Q&A Flow Engine
 * 
 * Orchestrates the interactive question-and-answer workflow for MCP server configuration.
 * Provides a beautiful CLI experience with progressive disclosure and intelligent defaults.
 * 
 * Core Features:
 * - Progressive question flow with conditional logic
 * - Beautiful CLI styling with colors, gradients, and spinners
 * - Smart default detection and pre-population
 * - Input validation and error handling
 * - Context-aware question filtering
 * 
 * Q&A Flow Structure:
 * 1. Source Selection (OpenAPI vs Manual)
 * 2. Language Choice (TypeScript vs Python)
 * 3. Authentication Configuration
 * 4. Tool Organization Preferences
 * 5. Error Handling Strategy
 * 6. Response Optimization Settings
 * 7. Usage Pattern Configuration
 * 
 * State Management:
 * - Maintains session state across questions
 * - Supports pre-populated answers from CLI flags
 * - Validates and transforms answers for generation
 * 
 * @module cli/flow
 * @exports QAFlow - Main Q&A flow orchestration class
 * @author MCP Author CLI
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import boxen from 'boxen';
import gradient from 'gradient-string';
import ora from 'ora';
import { mcpQuestions } from './questions';
import { QAAnswers, QAInternalAnswers } from '../types';

export class QAFlow {
  private answers: Partial<QAInternalAnswers> = {};

  async start(preAnswers: any = {}): Promise<QAAnswers> {
    // Check if we have enough info to skip interactive mode
    if (this.canSkipInteractive(preAnswers)) {
      console.log(chalk.blue('🚀 Using provided configuration, skipping interactive mode...'));
      this.answers = this.buildFromPreAnswers(preAnswers);
      return this.transformAnswers();
    }
    
    let restartRequested = true;
    
    while (restartRequested) {
      try {
        this.showWelcome();
        
        const spinner = ora('Initializing interactive Q&A...').start();
        await new Promise(resolve => setTimeout(resolve, 1000));
        spinner.succeed(chalk.green('Ready for configuration!'));
        
        console.log(chalk.blue('\n🎯 Let\'s configure your MCP server step by step...\n'));
        console.log(chalk.gray('💡 Tip: Type "abort" or "restart" at any prompt to start over\n'));
        
        this.answers = await this.runInteractiveSession(preAnswers);
        
        this.showSummary();
        
        const action = await this.getConfirmationAction();
        
        switch (action) {
          case 'confirm':
            restartRequested = false;
            break;
          case 'restart':
            console.log(chalk.yellow('\n🔄 Restarting configuration...\n'));
            this.answers = {};
            restartRequested = true;
            break;
          case 'abort':
            console.log(chalk.yellow('\n❌ Configuration cancelled. Run the command again when ready.'));
            process.exit(0);
        }
        
      } catch (error: any) {
        if (error.message === 'RESTART_REQUESTED') {
          console.log(chalk.yellow('\n🔄 Restarting configuration...\n'));
          this.answers = {};
          restartRequested = true;
        } else if (error.message === 'ABORT_REQUESTED') {
          console.log(chalk.yellow('\n❌ Configuration aborted. Run the command again when ready.'));
          process.exit(0);
        } else {
          throw error;
        }
      }
    }
    
    return this.processAnswers();
  }

  private showWelcome(): void {
    const welcomeText = gradient.rainbow('Welcome to MCP Author Interactive Setup!');
    
    console.log(boxen(
      `${welcomeText}\n\n` +
      `${chalk.cyan('🚀 We\'ll ask you 7 questions to generate your perfect MCP server')}\n` +
      `${chalk.gray('⏱️  This should take about 2-3 minutes')}\n` +
      `${chalk.gray('💡 You can always edit the generated code afterwards')}`,
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'cyan',
        backgroundColor: 'black'
      }
    ));
  }

  private showSummary(): void {
    console.log(chalk.blue('\n📋 Configuration Summary:\n'));
    
    const summaryItems = [
      `Source: ${this.getSourceDescription()}`,
      `Language: ${this.answers.language === 'typescript' ? '🟦 TypeScript' : '🐍 Python'}`,
      `Authentication: ${this.getAuthDescription()}`,
      `Tools: ${this.getToolsDescription()}`,
      `Error Handling: ${this.getErrorHandlingDescription()}`,
      `Optimizations: ${this.getOptimizationsDescription()}`,
      `Usage Pattern: ${this.getUsageDescription()}`
    ];
    
    summaryItems.forEach((item, index) => {
      console.log(chalk.gray(`  ${index + 1}. ${item}`));
    });
    
    console.log();
  }

  private async runInteractiveSession(preAnswers: any = {}): Promise<Partial<QAInternalAnswers>> {
    const answers: Partial<QAInternalAnswers> = { ...preAnswers };
    
    // Check if we have enough pre-answers to skip most of Q&A
    const hasOpenApiFile = answers.sourceType && answers.openApiFile;
    const hasLanguage = answers.language;
    
    // If we have OpenAPI file AND language, provide defaults and skip Q&A entirely
    if (hasOpenApiFile && hasLanguage) {
      if (!answers.authType) answers.authType = 'api_key_header';
      if (!answers.toolOrganization) answers.toolOrganization = 'all_endpoints';
      if (!answers.errorHandling) answers.errorHandling = 'retry';
      if (!answers.responseOptimization) answers.responseOptimization = ['filter_responses', 'auto_pagination'];
      if (!answers.usagePattern) answers.usagePattern = 'moderate';
      
      return answers;
    }
    
    // For manual mode with some CLI parameters, set reasonable defaults
    if (hasLanguage && !hasOpenApiFile) {
      if (!answers.sourceType) answers.sourceType = 'manual';
      if (!answers.authType) answers.authType = 'api_key_header';
      if (!answers.toolOrganization) answers.toolOrganization = 'all_endpoints';
      if (!answers.errorHandling) answers.errorHandling = 'retry';
      if (!answers.responseOptimization) answers.responseOptimization = ['filter_responses', 'auto_pagination'];
      if (!answers.usagePattern) answers.usagePattern = 'moderate';
      
      return answers;
    }
    
    const questions = mcpQuestions as any[];
    
    for (const question of questions) {
      try {
        // Skip if already answered via command line
        if ((answers as any)[question.name] !== undefined) {
          continue;
        }
        
        // Check if question should be shown based on previous answers
        if (question.when && !question.when(answers)) {
          continue;
        }
        
        const result = await inquirer.prompt([{
          ...question,
          validate: (input: any) => {
            // Check for abort/restart commands
            if (typeof input === 'string') {
              const normalizedInput = input.toLowerCase().trim();
              if (normalizedInput === 'abort' || normalizedInput === 'exit' || normalizedInput === 'quit') {
                throw new Error('ABORT_REQUESTED');
              }
              if (normalizedInput === 'restart' || normalizedInput === 'start over') {
                throw new Error('RESTART_REQUESTED');
              }
            }
            
            // Run original validation if it exists
            if (question.validate) {
              return question.validate(input);
            }
            return true;
          }
        }]);
        
        // Merge the result into answers
        Object.assign(answers, result);
        
      } catch (error: any) {
        if (error.message === 'ABORT_REQUESTED' || error.message === 'RESTART_REQUESTED') {
          throw error;
        }
        // For other errors, continue to next question
        console.log(chalk.red(`Error: ${error.message}`));
      }
    }
    
    return answers;
  }

  private async getConfirmationAction(): Promise<'confirm' | 'restart' | 'abort'> {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: chalk.cyan('🎯 What would you like to do?'),
        choices: [
          {
            name: '✅ Confirm and generate MCP server',
            value: 'confirm',
            short: 'Confirm'
          },
          {
            name: '🔄 Start over with new configuration',
            value: 'restart',
            short: 'Restart'
          },
          {
            name: '❌ Cancel and exit',
            value: 'abort',
            short: 'Cancel'
          }
        ],
        default: 'confirm'
      }
    ]);
    
    return action;
  }

  private processAnswers(): QAAnswers {
    const config: QAAnswers = {
      sourceType: this.answers.sourceType || 'manual',
      language: this.answers.language || 'typescript',
      authentication: this.buildAuthConfig(),
      toolOrganization: this.answers.toolOrganization || 'all_endpoints',
      errorHandling: this.answers.errorHandling || 'retry',
      optimization: {
        caching: {
          enabled: this.answers.responseOptimization?.includes('response_caching') || false,
          duration: 300
        },
        pagination: {
          enabled: this.answers.responseOptimization?.includes('auto_pagination') || false,
          defaultLimit: 100
        },
        timeouts: {
          request: this.answers.responseOptimization?.includes('request_timeout') ? 30000 : 60000,
          server: 120000
        },
        responseTruncation: {
          enabled: this.answers.responseOptimization?.includes('truncate_responses') || false,
          maxLength: 1000
        },
        responseFiltering: {
          enabled: this.answers.responseOptimization?.includes('filter_responses') || false,
          includeFields: [],
          excludeFields: []
        }
      },
      usagePattern: this.answers.usagePattern || 'conservative'
    };
    
    // Only add openApiSpec if it exists
    const openApiSpec = this.answers.openApiFile || this.answers.openApiUrl;
    if (openApiSpec) {
      config.openApiSpec = openApiSpec;
    }
    
    return config;
  }

  private getSourceDescription(): string {
    switch (this.answers.sourceType) {
      case 'openapi': return `🔗 OpenAPI file: ${this.answers.openApiFile}`;
      case 'url': return `🌐 OpenAPI URL: ${this.answers.openApiUrl}`;
      case 'manual': return '📝 Manual configuration';
      case 'custom': return '⚙️ Custom setup';
      default: return 'Unknown';
    }
  }

  private getAuthDescription(): string {
    switch (this.answers.authType) {
      case 'api_key_header': return `🔑 API Key in header (${this.answers.authHeaderName})`;
      case 'api_key_query': return `🔐 API Key in query (${this.answers.authQueryParam})`;
      case 'basic': return '👤 Basic Authentication';
      case 'oauth2': return '🎫 OAuth 2.0';
      case 'none': return '❌ No authentication';
      case 'custom': return '⚙️ Custom authentication';
      default: return 'Unknown';
    }
  }

  private getToolsDescription(): string {
    switch (this.answers.toolOrganization) {
      case 'all_endpoints': return '✅ All endpoints';
      case 'read_only': return '📊 Read-only operations';
      case 'write_only': return '✏️ Write operations';
      case 'custom_selection': return '🎯 Custom selection';
      default: return 'Unknown';
    }
  }

  private getErrorHandlingDescription(): string {
    switch (this.answers.errorHandling) {
      case 'retry': return '🔄 Automatic retry';
      case 'fail_fast': return '⚡ Fail fast';
      case 'graceful': return '🛡️ Graceful degradation';
      case 'custom': return '⚙️ Custom handling';
      default: return 'Unknown';
    }
  }

  private getOptimizationsDescription(): string {
    const opts = this.answers.responseOptimization || [];
    if (opts.length === 0) return 'None selected';
    
    const descriptions = {
      filter_responses: 'Filter responses',
      auto_pagination: 'Auto pagination',
      response_caching: 'Response caching',
      request_timeout: 'Request timeout',
      truncate_responses: 'Truncate responses'
    };
    
    return opts.map((opt: string) => descriptions[opt as keyof typeof descriptions]).join(', ');
  }

  private getUsageDescription(): string {
    switch (this.answers.usagePattern) {
      case 'light': return '🐌 Light usage';
      case 'moderate': return '📈 Moderate usage';
      case 'heavy': return '🚀 Heavy usage';
      case 'conservative': return '🤷 Conservative defaults';
      default: return 'Unknown';
    }
  }

  private mapAuthType(): 'none' | 'api_key' | 'oauth2' | 'basic' | 'custom' {
    switch (this.answers.authType) {
      case 'api_key_header':
      case 'api_key_query':
        return 'api_key';
      case 'basic':
        return 'basic';
      case 'oauth2':
        return 'oauth2';
      case 'custom':
        return 'custom';
      default:
        return 'none';
    }
  }

  private getAuthLocation(): 'header' | 'query' | undefined {
    switch (this.answers.authType) {
      case 'api_key_header':
        return 'header';
      case 'api_key_query':
        return 'query';
      default:
        return undefined;
    }
  }

  private buildAuthConfig() {
    const authType = this.mapAuthType();
    const location = this.getAuthLocation();
    
    const config: any = {
      type: authType,
      description: this.getAuthDescription()
    };
    
    if (location) {
      config.location = location;
    }
    
    if (this.answers.authHeaderName) {
      config.headerName = this.answers.authHeaderName;
    }
    
    if (this.answers.authQueryParam) {
      config.parameterName = this.answers.authQueryParam;
    }
    
    return config;
  }

  /**
   * Check if we can skip interactive mode based on provided options
   */
  private canSkipInteractive(preAnswers: any): boolean {
    // Required: language
    if (!preAnswers.language) return false;
    
    // If we have OpenAPI file, we can auto-configure most things
    if (preAnswers.sourceType === 'openapi' && preAnswers.openApiFile) {
      return true;
    }
    
    // For manual mode, we need more options
    if (!preAnswers.sourceType || preAnswers.sourceType === 'manual') {
      // Need at least language and auth type
      return preAnswers.language && preAnswers.authType;
    }
    
    return false;
  }

  /**
   * Build answers from pre-provided options
   */
  private buildFromPreAnswers(preAnswers: any): Partial<QAInternalAnswers> {
    const answers: Partial<QAInternalAnswers> = {
      sourceType: preAnswers.sourceType || 'manual',
      language: preAnswers.language || 'typescript',
      authType: preAnswers.authType || 'none',
      toolOrganization: 'all_endpoints',
      errorHandling: 'retry',
      responseOptimization: ['filter_responses', 'handle_pagination'],
      usagePattern: 'moderate'
    };

    // Add OpenAPI file if provided
    if (preAnswers.openApiFile) {
      answers.openApiFile = preAnswers.openApiFile;
    }

    return answers;
  }

  /**
   * Transform internal answers to external format
   */
  private transformAnswers(): QAAnswers {
    return this.processAnswers();
  }
}