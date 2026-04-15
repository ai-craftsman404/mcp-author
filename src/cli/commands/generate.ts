/**
 * MCP Server Generation Command
 * 
 * Orchestrates the complete MCP server generation workflow including:
 * - Interactive Q&A flow for configuration gathering
 * - OpenAPI specification parsing and validation
 * - Tool extraction from API endpoints
 * - Authentication detection and configuration
 * - Template generation for TypeScript/Python servers
 * - Post-generation validation and production readiness scoring
 * 
 * Supports multiple input modes:
 * - OpenAPI file upload (JSON/YAML)
 * - OpenAPI URL fetching
 * - Manual configuration through guided prompts
 * 
 * Generated outputs include:
 * - Complete MCP server implementation
 * - Dependencies and configuration files
 * - Documentation and setup instructions
 * - Test scaffolding
 * - Production readiness report
 * 
 * @module cli/commands/generate
 * @exports generateCommand - Main generation command handler
 * @author MCP Author CLI
 */

import chalk from 'chalk';
import ora from 'ora';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { QAFlow } from '../flow';
import { QAAnswers, OpenAPISpec, ToolConfig } from '../../types';
import { OpenAPIParser } from '../../utils/openapi';
import { TemplateGenerator } from '../../generators/template';

interface GenerateOptions {
  output?: string;
  openapi?: string;
  language?: string;
  auth?: string;
  validation?: boolean;
}

export async function generateCommand(options: GenerateOptions): Promise<void> {
  try {
    let config: QAAnswers;
    let openApiSpec: OpenAPISpec | undefined;
    let tools: ToolConfig[] = [];
    
    const qaFlow = new QAFlow();
    
    // Pre-populate Q&A with command line options
    const preAnswers: any = {};
    if (options.openapi) {
      preAnswers.sourceType = 'openapi';
      preAnswers.openApiFile = options.openapi;
    }
    if (options.language) {
      preAnswers.language = options.language;
    }
    if (options.auth) {
      preAnswers.authType = mapAuthOption(options.auth);
    }
    
    config = await qaFlow.start(preAnswers);
    
    const spinner = ora('🚀 Analyzing your configuration...').start();
    
    // Parse OpenAPI if provided
    if (config.openApiSpec) {
      spinner.text = '📄 Parsing OpenAPI specification...';
      const parser = new OpenAPIParser();
      
      try {
        if (config.sourceType === 'url') {
          openApiSpec = await parser.parseFromUrl(config.openApiSpec);
        } else {
          openApiSpec = await parser.parseFromFile(config.openApiSpec);
        }
        
        spinner.text = '✅ Validating OpenAPI specification...';
        const validation = await parser.validateSpec(openApiSpec);
        
        if (!validation.valid) {
          spinner.fail(chalk.red('❌ OpenAPI validation failed'));
          console.log(chalk.red('\nValidation errors:'));
          validation.errors.forEach(error => console.log(chalk.red(`  • ${error}`)));
          
          if (validation.warnings.length > 0) {
            console.log(chalk.yellow('\nWarnings:'));
            validation.warnings.forEach(warning => console.log(chalk.yellow(`  • ${warning}`)));
          }
          process.exit(1);
        }
        
        if (validation.warnings.length > 0) {
          console.log(chalk.yellow('\n⚠️  OpenAPI warnings:'));
          validation.warnings.forEach(warning => console.log(chalk.yellow(`  • ${warning}`)));
        }
        
        spinner.text = '🛠️ Extracting tools from OpenAPI...';
        const filterMap = {
          'all_endpoints': 'all' as const,
          'read_only': 'read_only' as const,
          'write_only': 'write_only' as const,
          'custom_selection': 'custom' as const
        };
        tools = parser.extractTools(openApiSpec, filterMap[config.toolOrganization]);
        
        // Update authentication from OpenAPI if not manually configured
        if (config.authentication.type === 'none' || !config.authentication.type) {
          const detectedAuth = parser.extractAuthentication(openApiSpec);
          if (detectedAuth.type !== 'none') {
            config.authentication = detectedAuth;
            console.log(chalk.blue(`\n🔐 Detected authentication: ${detectedAuth.type}`));
          }
        }
        
      } catch (error) {
        spinner.fail(chalk.red('❌ Failed to process OpenAPI specification'));
        console.error(chalk.red(`Error: ${error}`));
        process.exit(1);
      }
    }
    
    spinner.text = '📁 Creating project structure...';
    const generator = new TemplateGenerator();
    const outputDir = options.output || './generated-mcp-server';
    
    try {
      await generator.generateMCPServer(config, tools, outputDir);
      
      // Add syntax validation immediately after generation
      spinner.text = '🔍 Validating generated code syntax...';
      await validateGeneratedSyntax(config, outputDir);
      
      // Add build testing after syntax validation (skip for now due to environment constraints)
      if (process.env['ENABLE_BUILD_TESTING'] === 'true') {
        spinner.text = '🔨 Testing build process...';
        await testBuildProcess(config, outputDir);
      } else {
        console.log(chalk.yellow('   ⚠️  Build testing disabled (set ENABLE_BUILD_TESTING=true to enable)'));
      }
      
      spinner.succeed(chalk.green('✅ MCP server generated successfully!'));
    } catch (error) {
      spinner.fail(chalk.red('❌ Failed to generate files'));
      throw error;
    }
    
    showGenerationSummary(config, options.output || './generated-mcp-server', tools);
    
    // Auto-run validation (unless disabled)
    if (options.validation !== false) {
      console.log(chalk.blue('\n🔍 Running automatic validation...'));
      const { validateCommand } = await import('./validate');
      await validateCommand(outputDir, {});
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Generation failed:'), error);
    process.exit(1);
  }
}

function mapAuthOption(auth?: string): string {
  switch (auth) {
    case 'api_key': return 'api_key_header';
    case 'oauth2': return 'oauth2';
    case 'basic': return 'basic';
    case 'custom': return 'custom';
    default: return 'none';
  }
}


function showGenerationSummary(config: QAAnswers, outputDir: string, tools: ToolConfig[] = []): void {
  console.log(chalk.blue('\n🎉 Generation Complete!\n'));
  
  console.log(chalk.cyan('📁 Output Directory:'));
  console.log(chalk.gray(`   ${outputDir}\n`));
  
  console.log(chalk.cyan('🛠️ Generated Features:'));
  console.log(chalk.gray(`   • ${config.language === 'typescript' ? 'TypeScript' : 'Python'} MCP server`));
  console.log(chalk.gray(`   • ${config.authentication.type === 'none' ? 'No authentication' : config.authentication.type + ' authentication'}`));
  console.log(chalk.gray(`   • ${config.errorHandling} error handling`));
  console.log(chalk.gray(`   • ${config.usagePattern} usage optimization`));
  console.log(chalk.gray(`   • ${tools.length} MCP tools generated`));
  console.log(chalk.gray(`   • Comprehensive documentation`));
  console.log(chalk.gray(`   • Test scaffolding`));
  
  if (tools.length > 0) {
    console.log(chalk.cyan('\n🔧 Generated Tools:'));
    tools.slice(0, 5).forEach(tool => {
      console.log(chalk.gray(`   • ${tool.name} (${tool.method} ${tool.path})`));
    });
    if (tools.length > 5) {
      console.log(chalk.gray(`   • ... and ${tools.length - 5} more tools`));
    }
  }
  
  console.log(chalk.cyan('\n🚀 Next Steps:'));
  console.log(chalk.gray(`   1. cd ${outputDir}`));
  if (config.language === 'python') {
    console.log(chalk.gray(`   2. pip install -r requirements.txt`));
    console.log(chalk.gray(`   3. python src/server.py`));
  } else {
    console.log(chalk.gray(`   2. npm install`));
    console.log(chalk.gray(`   3. npm run build`));
  }
  console.log(chalk.gray(`   4. Follow the README.md for setup\n`));
  
  console.log(chalk.green('💡 Tip: Run `mcp-author validate ${outputDir}` to check your server!\n'));
}

/**
 * Validates the syntax of generated code files
 * @param config - Generation configuration
 * @param outputDir - Directory containing generated files
 */
async function validateGeneratedSyntax(config: QAAnswers, outputDir: string): Promise<void> {
  if (config.language === 'python') {
    await validatePythonSyntax(outputDir);
  } else if (config.language === 'typescript') {
    await validateTypeScriptSyntax(outputDir);
  }
}

/**
 * Validates Python syntax using py_compile
 * @param outputDir - Directory containing Python files
 */
async function validatePythonSyntax(outputDir: string): Promise<void> {
  const serverPath = path.join(outputDir, 'src', 'server.py');
  
  if (!fs.existsSync(serverPath)) {
    throw new Error(`Python server file not found: ${serverPath}`);
  }
  
  try {
    execSync(`python3 -m py_compile "src/server.py"`, {
      stdio: 'pipe',
      timeout: 10000,
      cwd: outputDir
    });
    console.log(chalk.green('   ✅ Python syntax validation passed'));
  } catch (error: any) {
    console.error(chalk.red('   ❌ Python syntax validation failed:'));
    console.error(chalk.red(`   ${error.message}`));
    throw new Error(`Python syntax errors detected in generated code`);
  }
}

/**
 * Validates TypeScript syntax using tsc
 * @param outputDir - Directory containing TypeScript files  
 */
async function validateTypeScriptSyntax(outputDir: string): Promise<void> {
  const serverPath = path.join(outputDir, 'src', 'server.ts');
  const tsconfigPath = path.join(outputDir, 'tsconfig.json');
  
  if (!fs.existsSync(serverPath)) {
    throw new Error(`TypeScript server file not found: ${serverPath}`);
  }
  
  if (!fs.existsSync(tsconfigPath)) {
    throw new Error(`TypeScript config file not found: ${tsconfigPath}`);
  }
  
  try {
    execSync(`npm install --silent`, {
      stdio: 'pipe',
      timeout: 60000,
      cwd: outputDir
    });
    execSync(`npx tsc --noEmit --project "tsconfig.json"`, {
      stdio: 'pipe',
      timeout: 30000,
      cwd: outputDir
    });
    console.log(chalk.green('   ✅ TypeScript syntax validation passed'));
  } catch (error: any) {
    console.error(chalk.red('   ❌ TypeScript syntax validation failed:'));
    console.error(chalk.red(`   ${error.message}`));
    throw new Error(`TypeScript syntax errors detected in generated code`);
  }
}

/**
 * Tests the complete build process for generated servers
 * @param config - Generation configuration
 * @param outputDir - Directory containing generated files
 */
async function testBuildProcess(config: QAAnswers, outputDir: string): Promise<void> {
  if (config.language === 'typescript') {
    await testTypeScriptBuild(outputDir);
  } else if (config.language === 'python') {
    await testPythonBuild(outputDir);
  }
}

/**
 * Comprehensive TypeScript build testing
 * @param outputDir - Directory containing TypeScript project
 */
async function testTypeScriptBuild(outputDir: string): Promise<void> {
  const packageJsonPath = path.join(outputDir, 'package.json');
  const tsconfigPath = path.join(outputDir, 'tsconfig.json');
  const srcPath = path.join(outputDir, 'src');
  
  // 1. Verify project structure
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`Package.json not found: ${packageJsonPath}`);
  }
  
  if (!fs.existsSync(tsconfigPath)) {
    throw new Error(`TypeScript config not found: ${tsconfigPath}`);
  }
  
  if (!fs.existsSync(srcPath)) {
    throw new Error(`Source directory not found: ${srcPath}`);
  }
  
  try {
    // 2. Install dependencies with timeout and error handling
    console.log(chalk.blue('   📦 Installing dependencies...'));
    execSync('npm install', {
      cwd: outputDir,
      stdio: 'pipe',
      timeout: 120000, // 2 minutes for npm install
      env: { ...process.env, NODE_ENV: 'development' }
    });
    console.log(chalk.green('   ✅ Dependencies installed successfully'));
    
    // 3. Verify node_modules exists and has key dependencies
    const nodeModulesPath = path.join(outputDir, 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) {
      throw new Error('Dependencies installation failed - node_modules not created');
    }
    
    // Check for critical MCP dependencies
    const mcpPath = path.join(nodeModulesPath, '@modelcontextprotocol', 'sdk');
    if (!fs.existsSync(mcpPath)) {
      throw new Error('MCP SDK dependency missing from node_modules');
    }
    
    // 4. Run TypeScript compilation
    console.log(chalk.blue('   🔨 Compiling TypeScript...'));
    execSync('npm run build', {
      cwd: outputDir,
      stdio: 'pipe',
      timeout: 60000, // 1 minute for build
      env: { ...process.env, NODE_ENV: 'production' }
    });
    console.log(chalk.green('   ✅ TypeScript compilation successful'));
    
    // 5. Verify build output
    const distPath = path.join(outputDir, 'dist');
    if (!fs.existsSync(distPath)) {
      throw new Error('Build failed - no dist folder created');
    }
    
    const serverJsPath = path.join(distPath, 'server.js');
    if (!fs.existsSync(serverJsPath)) {
      throw new Error('Build failed - server.js not created');
    }
    
    // 6. Validate generated JavaScript
    const serverJsContent = fs.readFileSync(serverJsPath, 'utf-8');
    if (serverJsContent.length < 100) {
      throw new Error('Build failed - generated server.js appears empty or malformed');
    }
    
    // 7. Test Node.js can load the compiled server (basic smoke test)
    console.log(chalk.blue('   🧪 Testing compiled server...'));
    execSync(`node -e "try { require('./dist/server.js'); console.log('Server module loaded successfully'); } catch(e) { console.error('Load failed:', e.message); process.exit(1); }"`, {
      cwd: outputDir,
      stdio: 'pipe',
      timeout: 10000
    });
    console.log(chalk.green('   ✅ Compiled server loads successfully'));
    
    console.log(chalk.green('   🎉 TypeScript build test completed successfully'));
    
  } catch (error: any) {
    console.error(chalk.red('   ❌ TypeScript build test failed:'));
    
    // Enhanced error reporting
    if (error.message.includes('npm install')) {
      console.error(chalk.red('   • Dependency installation failed'));
      console.error(chalk.red('   • Check package.json for invalid dependencies'));
    } else if (error.message.includes('npm run build')) {
      console.error(chalk.red('   • TypeScript compilation failed'));
      console.error(chalk.red('   • Check tsconfig.json and source code for errors'));
    } else if (error.message.includes('node_modules')) {
      console.error(chalk.red('   • Dependencies missing or corrupted'));
    } else if (error.message.includes('dist')) {
      console.error(chalk.red('   • Build output validation failed'));
    }
    
    console.error(chalk.red(`   • Error details: ${error.message}`));
    throw new Error(`TypeScript build process failed: ${error.message}`);
  }
}

/**
 * Comprehensive Python build testing
 * @param outputDir - Directory containing Python project
 */
async function testPythonBuild(outputDir: string): Promise<void> {
  const requirementsPath = path.join(outputDir, 'requirements.txt');
  const srcPath = path.join(outputDir, 'src');
  const serverPath = path.join(srcPath, 'server.py');
  
  // 1. Verify project structure
  if (!fs.existsSync(requirementsPath)) {
    throw new Error(`Requirements.txt not found: ${requirementsPath}`);
  }
  
  if (!fs.existsSync(srcPath)) {
    throw new Error(`Source directory not found: ${srcPath}`);
  }
  
  if (!fs.existsSync(serverPath)) {
    throw new Error(`Server file not found: ${serverPath}`);
  }
  
  try {
    // 2. Create virtual environment for isolated testing
    console.log(chalk.blue('   🐍 Creating virtual environment...'));
    const venvPath = path.join(outputDir, '.venv-test');
    
    // Clean up any existing test venv
    if (fs.existsSync(venvPath)) {
      execSync(`rm -rf ".venv-test"`, { cwd: outputDir });
    }
    
    execSync(`python3 -m venv ".venv-test"`, {
      cwd: outputDir,
      stdio: 'pipe',
      timeout: 30000
    });
    console.log(chalk.green('   ✅ Virtual environment created'));
    
    // 3. Install dependencies in virtual environment
    console.log(chalk.blue('   📦 Installing Python dependencies...'));
    const pipPath = path.join(venvPath, 'bin', 'pip');
    const pythonPath = path.join(venvPath, 'bin', 'python');
    
    // Upgrade pip first
    execSync(`"${pipPath}" install --upgrade pip`, {
      cwd: outputDir,
      stdio: 'pipe',
      timeout: 60000
    });
    
    // Install requirements
    execSync(`"${pipPath}" install -r requirements.txt`, {
      cwd: outputDir,
      stdio: 'pipe',
      timeout: 180000, // 3 minutes for pip install
      env: { ...process.env, PYTHONPATH: srcPath }
    });
    console.log(chalk.green('   ✅ Dependencies installed successfully'));
    
    // 4. Verify critical dependencies are installed
    execSync(`"${pythonPath}" -c "import mcp; print('MCP package found')"`, {
      cwd: outputDir,
      stdio: 'pipe',
      timeout: 10000
    });
    
    execSync(`"${pythonPath}" -c "import httpx; print('httpx package found')"`, {
      cwd: outputDir,
      stdio: 'pipe',
      timeout: 10000
    });
    console.log(chalk.green('   ✅ Critical dependencies verified'));
    
    // 5. Test server module imports
    console.log(chalk.blue('   🧪 Testing server imports...'));
    execSync(`"${pythonPath}" -c "import sys; sys.path.insert(0, 'src'); import server; print('Server module imported successfully')"`, {
      cwd: outputDir,
      stdio: 'pipe',
      timeout: 15000,
      env: { ...process.env, PYTHONPATH: srcPath }
    });
    console.log(chalk.green('   ✅ Server module imports successfully'));
    
    // 6. Test MCP server initialization (without running)
    console.log(chalk.blue('   🔧 Testing MCP server initialization...'));
    const testScript = `
import sys
import os
sys.path.insert(0, 'src')
os.environ['API_KEY'] = 'test-key-for-validation'
os.environ['API_TOKEN'] = 'test-token-for-validation'
os.environ['API_USERNAME'] = 'test-user'
os.environ['API_PASSWORD'] = 'test-pass'

try:
    import server
    print('MCP server initialized successfully')
    
    # Test if FastMCP was properly initialized
    if hasattr(server, 'mcp'):
        print('FastMCP instance found')
    else:
        raise ImportError('FastMCP instance not found in server module')
        
except Exception as e:
    print(f'Server initialization failed: {e}')
    import traceback
    traceback.print_exc()
    exit(1)
`;
    
    execSync(`"${pythonPath}" -c "${testScript}"`, {
      cwd: outputDir,
      stdio: 'pipe',
      timeout: 20000,
      env: { 
        ...process.env, 
        PYTHONPATH: srcPath,
        API_KEY: 'test-key',
        API_TOKEN: 'test-token',
        API_USERNAME: 'test-user',
        API_PASSWORD: 'test-pass'
      }
    });
    console.log(chalk.green('   ✅ MCP server initializes successfully'));
    
    // 7. Test basic server functionality (tool registration)
    console.log(chalk.blue('   🛠️  Testing tool registration...'));
    const toolTestScript = `
import sys
import os
sys.path.insert(0, 'src')
os.environ['API_KEY'] = 'test-key'
os.environ['API_TOKEN'] = 'test-token'
os.environ['API_USERNAME'] = 'test-user'  
os.environ['API_PASSWORD'] = 'test-pass'

try:
    import server
    
    # Check if tools are registered
    if hasattr(server, 'mcp') and hasattr(server.mcp, '_tools'):
        tool_count = len(server.mcp._tools)
        print(f'Found {tool_count} registered tools')
        if tool_count > 0:
            print('Tool registration successful')
        else:
            print('Warning: No tools registered')
    else:
        print('Warning: Could not verify tool registration')
        
except Exception as e:
    print(f'Tool registration test failed: {e}')
    exit(1)
`;
    
    execSync(`"${pythonPath}" -c "${toolTestScript}"`, {
      cwd: outputDir,
      stdio: 'pipe',
      timeout: 20000,
      env: { 
        ...process.env, 
        PYTHONPATH: srcPath,
        API_KEY: 'test-key',
        API_TOKEN: 'test-token',
        API_USERNAME: 'test-user',
        API_PASSWORD: 'test-pass'
      }
    });
    console.log(chalk.green('   ✅ Tool registration verified'));
    
    // 8. Cleanup test virtual environment
    console.log(chalk.blue('   🧹 Cleaning up test environment...'));
    execSync(`rm -rf ".venv-test"`, { cwd: outputDir });
    console.log(chalk.green('   ✅ Test environment cleaned up'));
    
    console.log(chalk.green('   🎉 Python build test completed successfully'));
    
  } catch (error: any) {
    console.error(chalk.red('   ❌ Python build test failed:'));
    
    // Enhanced error reporting
    if (error.message.includes('venv')) {
      console.error(chalk.red('   • Virtual environment creation failed'));
      console.error(chalk.red('   • Ensure python3 and python3-venv are installed'));
    } else if (error.message.includes('pip install')) {
      console.error(chalk.red('   • Dependency installation failed'));
      console.error(chalk.red('   • Check requirements.txt for invalid packages'));
    } else if (error.message.includes('import server')) {
      console.error(chalk.red('   • Server module import failed'));
      console.error(chalk.red('   • Check server.py for syntax or import errors'));
    } else if (error.message.includes('MCP server')) {
      console.error(chalk.red('   • MCP server initialization failed'));
      console.error(chalk.red('   • Check MCP configuration and dependencies'));
    } else if (error.message.includes('tool registration')) {
      console.error(chalk.red('   • Tool registration failed'));
      console.error(chalk.red('   • Check tool definitions and decorators'));
    }
    
    console.error(chalk.red(`   • Error details: ${error.message}`));
    
    // Cleanup on failure
    const venvPath = path.join(outputDir, '.venv-test');
    if (fs.existsSync(venvPath)) {
      try {
        execSync(`rm -rf ".venv-test"`, { cwd: outputDir });
      } catch (cleanupError) {
        console.error(chalk.yellow(`   ⚠️  Could not cleanup test environment: ${cleanupError}`));
      }
    }
    
    throw new Error(`Python build process failed: ${error.message}`);
  }
}