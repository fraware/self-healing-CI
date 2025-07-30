import chalk from 'chalk';
import { exec } from 'child_process';
import fs from 'fs-extra';
import ora from 'ora';
import path from 'path';
import { promisify } from 'util';
import { CargoFuzzRunner } from './runners/cargo-fuzz-runner';
import { FuzzilliRunner } from './runners/fuzzilli-runner';
import {
    DifferentialFuzzingOptions,
    FuzzingIssue,
    FuzzingResult,
    FuzzingTool,
    GitHubIssue,
    Language,
    ToolResult
} from './types';

const execAsync = promisify(exec);

export class DifferentialFuzzingService {
  private options: DifferentialFuzzingOptions;
  private runners: Map<FuzzingTool, any> = new Map();

  constructor(options: DifferentialFuzzingOptions) {
    this.options = options;
    this.initializeRunners();
  }

  /**
   * Initializes all enabled fuzzing runners
   */
  private initializeRunners(): void {
    const { config, cargoFuzzConfig, fuzzilliConfig } = this.options;

    if (config.tools.includes(FuzzingTool.CARGO_FUZZ)) {
      this.runners.set(FuzzingTool.CARGO_FUZZ, new CargoFuzzRunner(cargoFuzzConfig));
    }

    if (config.tools.includes(FuzzingTool.FUZZILLI)) {
      this.runners.set(FuzzingTool.FUZZILLI, new FuzzilliRunner(fuzzilliConfig));
    }
  }

  /**
   * Runs differential fuzzing to compare pre- and post-patch behavior
   */
  async runDifferentialFuzzing(): Promise<FuzzingResult> {
    const startTime = Date.now();
    const spinner = ora('Running differential fuzzing...').start();

    try {
      // Create temporary directories for pre and post patch testing
      const tempDir = await fs.mkdtemp(path.join(process.cwd(), 'fuzz-'));
      const prePatchDir = path.join(tempDir, 'pre-patch');
      const postPatchDir = path.join(tempDir, 'post-patch');

      await fs.ensureDir(prePatchDir);
      await fs.ensureDir(postPatchDir);

      spinner.text = 'Setting up pre-patch environment...';

      // Checkout pre-patch commit
      await this.checkoutCommit(this.options.prePatchCommit, prePatchDir);

      spinner.text = 'Setting up post-patch environment...';

      // Checkout post-patch commit
      await this.checkoutCommit(this.options.postPatchCommit, postPatchDir);

      // Run fuzzing on both versions
      spinner.text = 'Running fuzzing on pre-patch version...';
      const prePatchResults = await this.runFuzzing(prePatchDir, 'pre-patch');

      spinner.text = 'Running fuzzing on post-patch version...';
      const postPatchResults = await this.runFuzzing(postPatchDir, 'post-patch');

      // Compare results and detect regressions/divergences
      spinner.text = 'Analyzing differential results...';
      const differentialResults = this.analyzeDifferentialResults(prePatchResults, postPatchResults);

      // Generate summary and recommendations
      const summary = this.generateSummary(differentialResults);
      const criticalIssues = this.getCriticalIssues(differentialResults);
      const regressions = this.getRegressions(differentialResults);
      const divergences = this.getDivergences(differentialResults);
      const recommendations = this.generateRecommendations(differentialResults, summary);

      const duration = Date.now() - startTime;
      const success = criticalIssues.length === 0 && regressions.length === 0;

      spinner.succeed(`Differential fuzzing completed in ${duration}ms`);

      // Cleanup temporary directories
      await fs.remove(tempDir);

      return {
        success,
        duration,
        tools: differentialResults,
        summary,
        criticalIssues,
        regressions,
        divergences,
        recommendations,
        metadata: {
          repository: this.options.repository,
          branch: this.options.branch,
          commit: this.options.postPatchCommit,
          prePatchCommit: this.options.prePatchCommit,
          postPatchCommit: this.options.postPatchCommit,
          timestamp: new Date().toISOString(),
          config: this.options.config,
        },
      };

    } catch (error) {
      spinner.fail('Differential fuzzing failed');
      throw error;
    }
  }

  /**
   * Checks out a specific commit to a directory
   */
  private async checkoutCommit(commit: string, targetDir: string): Promise<void> {
    try {
      // Clone repository to target directory
      await execAsync(`git clone ${this.options.repository} ${targetDir}`, {
        cwd: process.cwd(),
      });

      // Checkout specific commit
      await execAsync(`git checkout ${commit}`, {
        cwd: targetDir,
      });

    } catch (error) {
      throw new Error(`Failed to checkout commit ${commit}: ${error}`);
    }
  }

  /**
   * Runs fuzzing on a specific version
   */
  private async runFuzzing(workDir: string, version: string): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    // Run all enabled tools in parallel
    const toolPromises = this.options.config.tools.map(async (tool) => {
      const runner = this.runners.get(tool);
      if (!runner) {
        throw new Error(`Runner not found for tool: ${tool}`);
      }

      const startTime = Date.now();
      const result = await runner.run(workDir, version);
      const duration = Date.now() - startTime;

      return {
        ...result,
        duration,
      };
    });

    const toolResults = await Promise.allSettled(toolPromises);

    for (let i = 0; i < toolResults.length; i++) {
      const result = toolResults[i];
      const tool = this.options.config.tools[i];

      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        console.error(`Failed to run ${tool}:`, result.reason);
        results.push({
          tool,
          language: Language.RUST, // Default fallback
          success: false,
          duration: 0,
          iterations: 0,
          issues: [],
          coverage: {
            lines: 0,
            functions: 0,
            branches: 0,
            percentage: 0,
          },
          crashes: 0,
          timeouts: 0,
          memoryLeaks: 0,
          regressions: 0,
        });
      }
    }

    return results;
  }

  /**
   * Analyzes differential results to detect regressions and divergences
   */
  private analyzeDifferentialResults(preResults: ToolResult[], postResults: ToolResult[]): ToolResult[] {
    const differentialResults: ToolResult[] = [];

    for (const postResult of postResults) {
      const preResult = preResults.find(r => r.tool === postResult.tool);
      
      if (!preResult) {
        // New tool in post-patch, treat as baseline
        differentialResults.push(postResult);
        continue;
      }

      // Detect regressions and divergences
      const issues: FuzzingIssue[] = [];

      // Compare crashes
      if (postResult.crashes > preResult.crashes) {
        issues.push({
          id: `regression-crash-${postResult.tool}`,
          language: postResult.language,
          tool: postResult.tool,
          severity: 'high',
          type: 'regression',
          message: `Crash count increased from ${preResult.crashes} to ${postResult.crashes}`,
          file: 'unknown',
          reproducible: true,
        });
      }

      // Compare timeouts
      if (postResult.timeouts > preResult.timeouts) {
        issues.push({
          id: `regression-timeout-${postResult.tool}`,
          language: postResult.language,
          tool: postResult.tool,
          severity: 'medium',
          type: 'regression',
          message: `Timeout count increased from ${preResult.timeouts} to ${postResult.timeouts}`,
          file: 'unknown',
          reproducible: true,
        });
      }

      // Compare memory leaks
      if (postResult.memoryLeaks > preResult.memoryLeaks) {
        issues.push({
          id: `regression-memory-${postResult.tool}`,
          language: postResult.language,
          tool: postResult.tool,
          severity: 'high',
          type: 'memory_leak',
          message: `Memory leak count increased from ${preResult.memoryLeaks} to ${postResult.memoryLeaks}`,
          file: 'unknown',
          reproducible: true,
        });
      }

      // Compare coverage
      if (postResult.coverage.percentage < preResult.coverage.percentage) {
        issues.push({
          id: `regression-coverage-${postResult.tool}`,
          language: postResult.language,
          tool: postResult.tool,
          severity: 'medium',
          type: 'regression',
          message: `Coverage decreased from ${preResult.coverage.percentage}% to ${postResult.coverage.percentage}%`,
          file: 'unknown',
          reproducible: true,
        });
      }

      // Create differential result
      differentialResults.push({
        ...postResult,
        issues: [...postResult.issues, ...issues],
        regressions: issues.filter(i => i.type === 'regression').length,
      });
    }

    return differentialResults;
  }

  /**
   * Generates summary from differential results
   */
  private generateSummary(results: ToolResult[]): FuzzingResult['summary'] {
    const bySeverity: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    const byType: Record<string, number> = {
      crash: 0,
      timeout: 0,
      memory_leak: 0,
      regression: 0,
      divergence: 0,
    };

    const byLanguage: Record<Language, number> = {} as Record<Language, number>;
    const byTool: Record<FuzzingTool, number> = {} as Record<FuzzingTool, number>;

    let totalIssues = 0;

    for (const result of results) {
      for (const issue of result.issues) {
        totalIssues++;
        bySeverity[issue.severity]++;
        byType[issue.type]++;
        byLanguage[issue.language] = (byLanguage[issue.language] || 0) + 1;
        byTool[issue.tool] = (byTool[issue.tool] || 0) + 1;
      }
    }

    return {
      totalIssues,
      bySeverity,
      byType,
      byLanguage,
      byTool,
    };
  }

  /**
   * Gets critical issues from results
   */
  private getCriticalIssues(results: ToolResult[]): FuzzingIssue[] {
    const criticalIssues: FuzzingIssue[] = [];

    for (const result of results) {
      for (const issue of result.issues) {
        if (issue.severity === 'critical') {
          criticalIssues.push(issue);
        }
      }
    }

    return criticalIssues;
  }

  /**
   * Gets regression issues from results
   */
  private getRegressions(results: ToolResult[]): FuzzingIssue[] {
    const regressions: FuzzingIssue[] = [];

    for (const result of results) {
      for (const issue of result.issues) {
        if (issue.type === 'regression') {
          regressions.push(issue);
        }
      }
    }

    return regressions;
  }

  /**
   * Gets divergence issues from results
   */
  private getDivergences(results: ToolResult[]): FuzzingIssue[] {
    const divergences: FuzzingIssue[] = [];

    for (const result of results) {
      for (const issue of result.issues) {
        if (issue.type === 'divergence') {
          divergences.push(issue);
        }
      }
    }

    return divergences;
  }

  /**
   * Generates recommendations based on fuzzing results
   */
  private generateRecommendations(results: ToolResult[], summary: FuzzingResult['summary']): string[] {
    const recommendations: string[] = [];

    // Critical issues
    if (summary.bySeverity.critical > 0) {
      recommendations.push('🔴 Critical fuzzing issues found - immediate attention required');
    }

    // Regressions
    if (summary.byType.regression > 0) {
      recommendations.push('🟠 Regressions detected - patch may have introduced new issues');
    }

    // Coverage issues
    const lowCoverageTools = results.filter(r => r.coverage.percentage < 50);
    if (lowCoverageTools.length > 0) {
      recommendations.push('📊 Low fuzzing coverage detected - consider adding more test cases');
    }

    // Tool-specific recommendations
    const problematicTools = results.filter(r => r.issues.length > 0);
    if (problematicTools.length > 0) {
      recommendations.push(`🔧 Tools with issues: ${problematicTools.map(r => r.tool).join(', ')}`);
    }

    // Memory issues
    if (summary.byType.memory_leak > 0) {
      recommendations.push('💾 Memory leaks detected - investigate resource management');
    }

    return recommendations;
  }

  /**
   * Creates GitHub issues for detected problems
   */
  async createGitHubIssues(result: FuzzingResult): Promise<void> {
    const issues: GitHubIssue[] = [];

    // Create issue for critical issues
    if (result.criticalIssues.length > 0) {
      issues.push({
        title: `🚨 Critical fuzzing issues detected in ${this.options.repository}`,
        body: this.formatCriticalIssuesBody(result.criticalIssues),
        labels: ['fuzzing', 'critical', 'security'],
        assignees: ['self-healing-ci'],
      });
    }

    // Create issue for regressions
    if (result.regressions.length > 0) {
      issues.push({
        title: `🔄 Fuzzing regressions detected in ${this.options.repository}`,
        body: this.formatRegressionsBody(result.regressions),
        labels: ['fuzzing', 'regression', 'bug'],
        assignees: ['self-healing-ci'],
      });
    }

    // Create issue for divergences
    if (result.divergences.length > 0) {
      issues.push({
        title: `⚡ Behavioral divergences detected in ${this.options.repository}`,
        body: this.formatDivergencesBody(result.divergences),
        labels: ['fuzzing', 'divergence', 'behavior'],
        assignees: ['self-healing-ci'],
      });
    }

    // Submit issues to GitHub
    for (const issue of issues) {
      await this.submitGitHubIssue(issue);
    }
  }

  /**
   * Formats critical issues for GitHub issue body
   */
  private formatCriticalIssuesBody(issues: FuzzingIssue[]): string {
    let body = `## 🚨 Critical Fuzzing Issues Detected\n\n`;
    body += `**Repository:** ${this.options.repository}\n`;
    body += `**Pre-patch commit:** ${this.options.prePatchCommit}\n`;
    body += `**Post-patch commit:** ${this.options.postPatchCommit}\n\n`;

    body += `### Issues:\n\n`;
    for (const issue of issues) {
      body += `#### ${issue.tool} - ${issue.language}\n`;
      body += `- **Type:** ${issue.type}\n`;
      body += `- **Severity:** ${issue.severity}\n`;
      body += `- **Message:** ${issue.message}\n`;
      if (issue.stackTrace) {
        body += `- **Stack Trace:** \`\`\`\n${issue.stackTrace}\n\`\`\`\n`;
      }
      body += `\n`;
    }

    return body;
  }

  /**
   * Formats regressions for GitHub issue body
   */
  private formatRegressionsBody(issues: FuzzingIssue[]): string {
    let body = `## 🔄 Fuzzing Regressions Detected\n\n`;
    body += `**Repository:** ${this.options.repository}\n`;
    body += `**Pre-patch commit:** ${this.options.prePatchCommit}\n`;
    body += `**Post-patch commit:** ${this.options.postPatchCommit}\n\n`;

    body += `### Regressions:\n\n`;
    for (const issue of issues) {
      body += `#### ${issue.tool} - ${issue.language}\n`;
      body += `- **Type:** ${issue.type}\n`;
      body += `- **Severity:** ${issue.severity}\n`;
      body += `- **Message:** ${issue.message}\n`;
      if (issue.diff) {
        body += `- **Diff:** \`\`\`\n${issue.diff}\n\`\`\`\n`;
      }
      body += `\n`;
    }

    return body;
  }

  /**
   * Formats divergences for GitHub issue body
   */
  private formatDivergencesBody(issues: FuzzingIssue[]): string {
    let body = `## ⚡ Behavioral Divergences Detected\n\n`;
    body += `**Repository:** ${this.options.repository}\n`;
    body += `**Pre-patch commit:** ${this.options.prePatchCommit}\n`;
    body += `**Post-patch commit:** ${this.options.postPatchCommit}\n\n`;

    body += `### Divergences:\n\n`;
    for (const issue of issues) {
      body += `#### ${issue.tool} - ${issue.language}\n`;
      body += `- **Type:** ${issue.type}\n`;
      body += `- **Severity:** ${issue.severity}\n`;
      body += `- **Message:** ${issue.message}\n`;
      if (issue.prePatchOutput && issue.postPatchOutput) {
        body += `- **Pre-patch output:** \`\`\`\n${issue.prePatchOutput}\n\`\`\`\n`;
        body += `- **Post-patch output:** \`\`\`\n${issue.postPatchOutput}\n\`\`\`\n`;
      }
      body += `\n`;
    }

    return body;
  }

  /**
   * Submits a GitHub issue
   */
  private async submitGitHubIssue(issue: GitHubIssue): Promise<void> {
    try {
      // This would typically use the GitHub API
      // For now, we'll just log the issue
      console.log('GitHub Issue:', issue);
    } catch (error) {
      console.error('Failed to submit GitHub issue:', error);
    }
  }

  /**
   * Formats fuzzing results for console output
   */
  formatResults(result: FuzzingResult): string {
    const output: string[] = [];

    // Header
    output.push(chalk.bold.blue('\n🔍 Differential Fuzzing Results'));
    output.push(chalk.gray(`Repository: ${result.metadata.repository}`));
    output.push(chalk.gray(`Pre-patch: ${result.metadata.prePatchCommit}`));
    output.push(chalk.gray(`Post-patch: ${result.metadata.postPatchCommit}`));
    output.push(chalk.gray(`Duration: ${result.duration}ms`));
    output.push('');

    // Summary
    output.push(chalk.bold('📊 Summary:'));
    output.push(`  Total Issues: ${result.summary.totalIssues}`);
    output.push(`  Critical: ${chalk.red(result.summary.bySeverity.critical)}`);
    output.push(`  High: ${chalk.yellow(result.summary.bySeverity.high)}`);
    output.push(`  Medium: ${chalk.blue(result.summary.bySeverity.medium)}`);
    output.push(`  Low: ${chalk.gray(result.summary.bySeverity.low)}`);
    output.push('');

    // Tool results
    output.push(chalk.bold('🛠️ Tool Results:'));
    for (const toolResult of result.tools) {
      const status = toolResult.success ? chalk.green('✓') : chalk.red('✗');
      const issues = toolResult.issues.length;
      const duration = toolResult.duration;
      
      output.push(`  ${status} ${toolResult.tool}: ${issues} issues (${duration}ms)`);
    }
    output.push('');

    // Critical issues
    if (result.criticalIssues.length > 0) {
      output.push(chalk.bold.red('🚨 Critical Issues:'));
      for (const issue of result.criticalIssues.slice(0, 5)) {
        output.push(`  ${issue.tool} - ${issue.language}: ${issue.message}`);
      }
      output.push('');
    }

    // Regressions
    if (result.regressions.length > 0) {
      output.push(chalk.bold.yellow('🔄 Regressions:'));
      for (const issue of result.regressions.slice(0, 5)) {
        output.push(`  ${issue.tool} - ${issue.language}: ${issue.message}`);
      }
      output.push('');
    }

    // Recommendations
    if (result.recommendations.length > 0) {
      output.push(chalk.bold.yellow('💡 Recommendations:'));
      for (const recommendation of result.recommendations) {
        output.push(`  • ${recommendation}`);
      }
      output.push('');
    }

    // Final status
    const status = result.success ? chalk.green('✅ Fuzzing passed') : chalk.red('❌ Fuzzing failed');
    output.push(status);

    return output.join('\n');
  }
} 