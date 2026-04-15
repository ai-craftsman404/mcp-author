#!/usr/bin/env node

/**
 * MCP Author CLI - Main Entry Point
 * 
 * The primary command-line interface for the MCP Author tool.
 * Provides beautiful ASCII art, command routing, and global CLI configuration.
 * 
 * Available Commands:
 * - generate: Create new MCP servers from OpenAPI specs or manual configuration
 * - validate: Assess production readiness of generated MCP servers
 * - examples: Show interactive examples and tutorials
 * 
 * Features:
 * - Beautiful ASCII art welcome screen
 * - Commander.js-based command parsing
 * - Global error handling and graceful exits
 * - Consistent styling and branding
 * - Version management and help text
 * 
 * Usage Examples:
 * - `mcp-author generate --openapi api.json --language python`
 * - `mcp-author validate ./my-server`
 * - `mcp-author examples --type authentication`
 * 
 * @module cli
 * @exports main - CLI application entry point
 * @author MCP Author CLI
 */

import { Command } from 'commander';
import chalk from 'chalk';
import figlet from 'figlet';
import boxen from 'boxen';
import { generateCommand } from './cli/commands/generate';
import { validateCommand } from './cli/commands/validate';
import { examplesCommand } from './cli/commands/examples';

const program = new Command();

// ASCII Art Header
function showHeader(): void {
  const title = figlet.textSync('MCP Author', {
    font: 'ANSI Shadow',
    horizontalLayout: 'default',
    verticalLayout: 'default',
  });

  const subtitle = chalk.cyan('Smart MCP Server Template Generator');
  const description = chalk.gray('Generate production-ready MCP servers in 60 seconds');

  console.log(
    boxen(
      `${chalk.blue(title)}\n\n${subtitle}\n${description}`,
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'blue',
        backgroundColor: 'black',
      }
    )
  );
}

// Main CLI Program
program
  .name('mcp-author')
  .description('Smart MCP Server Template Generator')
  .version('0.1.0')
  .option('-v, --verbose', 'Enable verbose output')
  .option('--no-header', 'Skip the ASCII art header')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts['header'] !== false) {
      showHeader();
    }
  });

// Commands
program
  .command('generate')
  .description('Generate a new MCP server')
  .option('-o, --output <dir>', 'Output directory', './generated-mcp-server')
  .option('--openapi <file>', 'OpenAPI specification file')
  .option('-l, --language <lang>', 'Target language (typescript|python)')
  .option('--no-validation', 'Skip automatic validation')
  .option('--auth <type>', 'Authentication type (none|api_key|oauth2|basic)')
  .action(generateCommand);

program
  .command('validate')
  .description('Validate a generated MCP server')
  .argument('<server-path>', 'Path to the MCP server directory')
  .option('--fix', 'Attempt to fix validation issues')
  .action(validateCommand);

program
  .command('examples')
  .description('Show example configurations and usage')
  .option('-t, --type <type>', 'Example type (openapi|config|generated)')
  .action(examplesCommand);

// Help customization
program.configureHelp({
  sortSubcommands: true,
  subcommandTerm: (cmd) => cmd.name(),
});

// Error handling
program.exitOverride();

try {
  program.parse();
} catch (err: any) {
  if (err.code === 'commander.help') {
    process.exit(0);
  }
  if (err.code === 'commander.version') {
    process.exit(0);
  }
  
  console.error(chalk.red('❌ Error:'), err.message);
  process.exit(1);
}

// Show help if no command provided
if (!process.argv.slice(2).length) {
  showHeader();
  program.outputHelp();
}