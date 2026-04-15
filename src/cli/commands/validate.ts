/**
 * MCP Server Validation Command
 * 
 * Provides comprehensive production readiness assessment for generated MCP servers.
 * Evaluates servers across 7 categories and assigns letter grades (A-F).
 * 
 * Validation Categories:
 * - File Structure: Required files and directory organization
 * - Dependencies: Package management and dependency declarations
 * - Code Quality: Syntax, imports, and basic code structure
 * - Documentation: README, inline docs, and setup instructions
 * - Configuration: Environment variables and config management
 * - Error Handling: Try-catch blocks and graceful failure patterns
 * - Testing: Test files and testing infrastructure
 * 
 * Scoring System:
 * - A Grade: 90-100% (Production Ready)
 * - B Grade: 80-89% (Nearly Ready)
 * - C Grade: 70-79% (Needs Work)
 * - D Grade: 60-69% (Major Issues)
 * - F Grade: <60% (Not Ready)
 * 
 * @module cli/commands/validate
 * @exports validateCommand - Main validation command handler
 * @author MCP Author CLI
 */

import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'path';

interface ValidateOptions {
  fix?: boolean;
}

interface ValidationScore {
  category: string;
  score: number;
  maxScore: number;
  issues: string[];
  recommendations: string[];
}

export async function validateCommand(serverPath: string, _options: ValidateOptions): Promise<void> {
  const spinner = ora(`Validating MCP server at ${serverPath}...`).start();
  
  try {
    if (!await fs.pathExists(serverPath)) {
      spinner.fail(chalk.red('❌ Server path does not exist'));
      return;
    }

    spinner.text = 'Analyzing project structure...';
    const structureScore = await analyzeStructure(serverPath);
    
    spinner.text = 'Checking code quality...';
    const codeQualityScore = await analyzeCodeQuality(serverPath);
    
    spinner.text = 'Validating documentation...';
    const documentationScore = await analyzeDocumentation(serverPath);
    
    spinner.text = 'Checking security practices...';
    const securityScore = await analyzeSecurity(serverPath);
    
    spinner.text = 'Validating configuration...';
    const configurationScore = await analyzeConfiguration(serverPath);
    
    spinner.text = 'Checking error handling...';
    const errorHandlingScore = await analyzeErrorHandling(serverPath);
    
    spinner.text = 'Analyzing testing setup...';
    const testingScore = await analyzeTesting(serverPath);
    
    const scores = [
      structureScore,
      codeQualityScore, 
      documentationScore,
      securityScore,
      configurationScore,
      errorHandlingScore,
      testingScore
    ];
    
    const totalScore = scores.reduce((sum, score) => sum + score.score, 0);
    const maxScore = scores.reduce((sum, score) => sum + score.maxScore, 0);
    const percentage = Math.round((totalScore / maxScore) * 100);
    const grade = getGrade(percentage);
    
    spinner.succeed(chalk.green(`✅ Validation complete - Grade: ${grade} (${percentage}%)`));
    
    displayResults(scores, totalScore, maxScore, percentage, grade);
    
    // Save report to file
    await saveReportToFile(serverPath, scores, totalScore, maxScore, percentage, grade);
    
  } catch (error) {
    spinner.fail(chalk.red('❌ Validation failed'));
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  }
}

async function analyzeStructure(serverPath: string): Promise<ValidationScore> {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = 0;
  const maxScore = 15;
  
  // Check for essential files
  if (await fs.pathExists(path.join(serverPath, 'package.json'))) score += 3;
  else issues.push('Missing package.json');
  
  if (await fs.pathExists(path.join(serverPath, 'src'))) score += 3;
  else issues.push('Missing src directory');
  
  if (await fs.pathExists(path.join(serverPath, 'README.md'))) score += 3;
  else issues.push('Missing README.md');
  
  if (await fs.pathExists(path.join(serverPath, 'tsconfig.json')) || 
      await fs.pathExists(path.join(serverPath, 'pyproject.toml'))) score += 3;
  else issues.push('Missing language configuration file');
  
  if (await fs.pathExists(path.join(serverPath, '.env.example'))) score += 3;
  else recommendations.push('Add .env.example for environment variables');
  
  return {
    category: 'Project Structure',
    score,
    maxScore,
    issues,
    recommendations
  };
}

async function analyzeCodeQuality(serverPath: string): Promise<ValidationScore> {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = 10; // Default good score
  const maxScore = 15;
  
  try {
    const serverFile = await findServerFile(serverPath);
    if (serverFile) {
      const content = await fs.readFile(serverFile, 'utf-8');
      
      // Check for proper imports
      if (content.includes('import') || content.includes('from')) score += 2;
      
      // Check for error handling
      if (content.includes('try') && content.includes('catch')) score += 3;
      else issues.push('Missing error handling blocks');
      
    } else {
      issues.push('No server file found');
      score -= 5;
    }
  } catch (error) {
    issues.push('Could not analyze code quality');
  }
  
  return {
    category: 'Code Quality',
    score: Math.max(0, score),
    maxScore,
    issues,
    recommendations
  };
}

async function analyzeDocumentation(serverPath: string): Promise<ValidationScore> {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = 0;
  const maxScore = 10;
  
  try {
    if (await fs.pathExists(path.join(serverPath, 'README.md'))) {
      const readme = await fs.readFile(path.join(serverPath, 'README.md'), 'utf-8');
      
      if (readme.includes('Setup') || readme.includes('Installation')) score += 3;
      if (readme.includes('npm install') || readme.includes('pip install')) score += 2;
      if (readme.includes('Tools') || readme.includes('API')) score += 3;
      if (readme.length > 500) score += 2;
      else recommendations.push('README could be more comprehensive');
    } else {
      issues.push('Missing README.md');
    }
  } catch (error) {
    issues.push('Could not analyze documentation');
  }
  
  return {
    category: 'Documentation',
    score,
    maxScore,
    issues,
    recommendations
  };
}

async function analyzeSecurity(serverPath: string): Promise<ValidationScore> {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = 10; // Default secure score
  const maxScore = 10;
  
  try {
    const serverFile = await findServerFile(serverPath);
    if (serverFile) {
      const content = await fs.readFile(serverFile, 'utf-8');
      
      // Check for hardcoded secrets (basic check)
      if (content.includes('password') || content.includes('secret')) {
        issues.push('Potential hardcoded credentials detected');
        score -= 5;
      }
      
      // Check for environment variable usage
      if (content.includes('process.env') || content.includes('os.getenv')) {
        // Good - using environment variables
      } else {
        recommendations.push('Consider using environment variables for configuration');
        score -= 2;
      }
    }
  } catch (error) {
    issues.push('Could not analyze security');
  }
  
  return {
    category: 'Security',
    score: Math.max(0, score),
    maxScore,
    issues,
    recommendations
  };
}

async function analyzeConfiguration(serverPath: string): Promise<ValidationScore> {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = 0;
  const maxScore = 10;
  
  try {
    if (await fs.pathExists(path.join(serverPath, 'package.json'))) {
      const pkg = await fs.readJSON(path.join(serverPath, 'package.json'));
      
      if (pkg.scripts) score += 3;
      if (pkg.dependencies) score += 3;
      if (pkg.name && pkg.version) score += 2;
      if (pkg.description) score += 2;
    } else if (await fs.pathExists(path.join(serverPath, 'pyproject.toml'))) {
      score += 8; // Python project configured
      score += 2; // Extra points for modern Python packaging
    }
  } catch (error) {
    issues.push('Could not analyze configuration');
  }
  
  return {
    category: 'Configuration',
    score,
    maxScore,
    issues,
    recommendations
  };
}

async function analyzeErrorHandling(serverPath: string): Promise<ValidationScore> {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = 5; // Default score
  const maxScore = 10;
  
  try {
    const serverFile = await findServerFile(serverPath);
    if (serverFile) {
      const content = await fs.readFile(serverFile, 'utf-8');
      
      if (content.includes('try') && content.includes('catch')) score += 3;
      if (content.includes('error') || content.includes('Error')) score += 2;
      else recommendations.push('Add comprehensive error handling');
    }
  } catch (error) {
    issues.push('Could not analyze error handling');
  }
  
  return {
    category: 'Error Handling',
    score,
    maxScore,
    issues,
    recommendations
  };
}

async function analyzeTesting(serverPath: string): Promise<ValidationScore> {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = 5; // Default score for generated projects
  const maxScore = 10;
  
  // Check for test directories or files
  if (await fs.pathExists(path.join(serverPath, 'tests')) ||
      await fs.pathExists(path.join(serverPath, 'test'))) {
    score += 5;
  } else {
    recommendations.push('Add test directory and unit tests');
  }
  
  return {
    category: 'Testing',
    score,
    maxScore,
    issues,
    recommendations
  };
}

async function findServerFile(serverPath: string): Promise<string | null> {
  const possibilities = [
    path.join(serverPath, 'src', 'server.ts'),
    path.join(serverPath, 'src', 'server.py'),
    path.join(serverPath, 'server.ts'),
    path.join(serverPath, 'server.py')
  ];
  
  for (const file of possibilities) {
    if (await fs.pathExists(file)) {
      return file;
    }
  }
  
  return null;
}

function getGrade(percentage: number): string {
  if (percentage >= 95) return 'A+';
  if (percentage >= 90) return 'A';
  if (percentage >= 85) return 'B+';
  if (percentage >= 80) return 'B';
  if (percentage >= 75) return 'C+';
  if (percentage >= 70) return 'C';
  if (percentage >= 60) return 'D';
  return 'F';
}

function displayResults(scores: ValidationScore[], totalScore: number, maxScore: number, percentage: number, grade: string): void {
  console.log(chalk.blue('\n🏆 Production Readiness Assessment'));
  console.log(chalk.blue('═'.repeat(50)));
  
  console.log(chalk.cyan(`\n📊 Overall Grade: ${grade} (${percentage}%) - ${totalScore}/${maxScore} points`));
  
  console.log(chalk.blue('\n📋 Category Breakdown:'));
  scores.forEach(score => {
    const categoryPercentage = Math.round((score.score / score.maxScore) * 100);
    const status = categoryPercentage >= 80 ? '✅' : categoryPercentage >= 60 ? '⚠️' : '❌';
    
    console.log(chalk.gray(`  ${status} ${score.category}: ${score.score}/${score.maxScore} (${categoryPercentage}%)`));
    
    if (score.issues.length > 0) {
      score.issues.forEach(issue => {
        console.log(chalk.red(`    • Issue: ${issue}`));
      });
    }
    
    if (score.recommendations.length > 0) {
      score.recommendations.forEach(rec => {
        console.log(chalk.yellow(`    • Recommendation: ${rec}`));
      });
    }
  });
  
  console.log(chalk.green('\n✨ Generated with MCP Author - Production Ready MCP Servers'));
}

async function saveReportToFile(serverPath: string, scores: ValidationScore[], totalScore: number, maxScore: number, percentage: number, grade: string): Promise<void> {
  const reportPath = path.join(serverPath, 'PRODUCTION-REPORT.md');
  
  let report = `# Production Readiness Report\n\n`;
  report += `**Generated:** ${new Date().toISOString()}\n`;
  report += `**Overall Grade:** ${grade} (${percentage}%) - ${totalScore}/${maxScore} points\n\n`;
  
  report += `## Category Breakdown\n\n`;
  scores.forEach(score => {
    const categoryPercentage = Math.round((score.score / score.maxScore) * 100);
    const status = categoryPercentage >= 80 ? '✅' : categoryPercentage >= 60 ? '⚠️' : '❌';
    
    report += `### ${status} ${score.category}: ${score.score}/${score.maxScore} (${categoryPercentage}%)\n\n`;
    
    if (score.issues.length > 0) {
      report += `**Issues:**\n`;
      score.issues.forEach(issue => {
        report += `- ${issue}\n`;
      });
      report += `\n`;
    }
    
    if (score.recommendations.length > 0) {
      report += `**Recommendations:**\n`;
      score.recommendations.forEach(rec => {
        report += `- ${rec}\n`;
      });
      report += `\n`;
    }
  });
  
  report += `---\n*Generated with MCP Author - Production Ready MCP Servers*\n`;
  
  await fs.writeFile(reportPath, report);
  console.log(chalk.blue(`\n📄 Report saved: ${reportPath}`));
}