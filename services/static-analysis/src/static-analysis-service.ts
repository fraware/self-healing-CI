import chalk from 'chalk';
import { exec } from 'child_process';
import { glob } from 'glob';
import ora from 'ora';
import { promisify } from 'util';
import { ClippyAnalyzer } from './analyzers/clippy-analyzer';
import { ESLintAnalyzer } from './analyzers/eslint-analyzer';
import { RuffAnalyzer } from './analyzers/ruff-analyzer';
import { SemgrepAnalyzer } from './analyzers/semgrep-analyzer';
import {
    AnalysisIssue,
    AnalysisResult,
    Severity,
    StaticAnalysisOptions,
    ToolResult,
    ToolType
} from './types';

const execAsync = promisify(exec);

export class StaticAnalysisService {
  private options: StaticAnalysisOptions;
  private analyzers: Map<ToolType, any> = new Map();

  constructor(options: StaticAnalysisOptions) {
    this.options = options;
    this.initializeAnalyzers();
  }

  /**
   * Initializes all enabled analyzers
   */
  private initializeAnalyzers(): void {
    const { config, eslintConfig, clippyConfig, ruffConfig, semgrepConfig } = this.options;

    if (config.enabledTools.includes(ToolType.ESLINT)) {
      this.analyzers.set(ToolType.ESLINT, new ESLintAnalyzer(eslintConfig));
    }

    if (config.enabledTools.includes(ToolType.RUST_CLIPPY)) {
      this.analyzers.set(ToolType.RUST_CLIPPY, new ClippyAnalyzer(clippyConfig));
    }

    if (config.enabledTools.includes(ToolType.RUFF)) {
      this.analyzers.set(ToolType.RUFF, new RuffAnalyzer(ruffConfig));
    }

    if (config.enabledTools.includes(ToolType.SEMGREP)) {
      this.analyzers.set(ToolType.SEMGREP, new SemgrepAnalyzer(semgrepConfig));
    }
  }

  /**
   * Runs static analysis on the codebase
   */
  async analyze(): Promise<AnalysisResult> {
    const startTime = Date.now();
    const spinner = ora('Running static analysis...').start();

    try {
      // Get files to analyze
      const files = await this.getFilesToAnalyze();
      spinner.text = `Analyzing ${files.length} files with ${this.options.config.enabledTools.length} tools...`;

      // Run all enabled analyzers in parallel
      const toolResults = await Promise.allSettled(
        this.options.config.enabledTools.map(tool => this.runAnalyzer(tool, files))
      );

      // Process results
      const results: ToolResult[] = [];
      const allIssues: AnalysisIssue[] = [];

      for (let i = 0; i < toolResults.length; i++) {
        const result = toolResults[i];
        const tool = this.options.config.enabledTools[i];

        if (result.status === 'fulfilled') {
          results.push(result.value);
          allIssues.push(...result.value.issues);
        } else {
          console.error(`Failed to run ${tool}:`, result.reason);
          results.push({
            tool,
            success: false,
            duration: 0,
            issues: [],
            summary: {
              total: 0,
              bySeverity: {} as Record<Severity, number>,
              byCategory: {},
            },
          });
        }
      }

      // Generate summary
      const summary = this.generateSummary(results, allIssues);

      // Determine blocking issues
      const blockingIssues = this.getBlockingIssues(allIssues);

      // Generate recommendations
      const recommendations = this.generateRecommendations(allIssues, summary);

      const duration = Date.now() - startTime;
      const success = blockingIssues.length === 0;

      spinner.succeed(`Static analysis completed in ${duration}ms`);

      return {
        success,
        duration,
        tools: results,
        summary,
        blockingIssues,
        recommendations,
        metadata: {
          repository: this.options.repository,
          branch: this.options.branch,
          commit: this.options.commit,
          timestamp: new Date().toISOString(),
          config: this.options.config,
        },
      };

    } catch (error) {
      spinner.fail('Static analysis failed');
      throw error;
    }
  }

  /**
   * Gets files to analyze based on include/exclude patterns
   */
  private async getFilesToAnalyze(): Promise<string[]> {
    const { includePatterns, excludePatterns } = this.options.config;

    const patterns = includePatterns.length > 0 ? includePatterns : ['**/*'];
    const files: string[] = [];

    for (const pattern of patterns) {
      const matches = await glob(pattern, {
        ignore: excludePatterns,
        nodir: true,
        absolute: true,
      });
      files.push(...matches);
    }

    return [...new Set(files)]; // Remove duplicates
  }

  /**
   * Runs a specific analyzer
   */
  private async runAnalyzer(tool: ToolType, files: string[]): Promise<ToolResult> {
    const analyzer = this.analyzers.get(tool);
    if (!analyzer) {
      throw new Error(`Analyzer not found for tool: ${tool}`);
    }

    const startTime = Date.now();
    const issues = await analyzer.analyze(files);
    const duration = Date.now() - startTime;

    const summary = this.generateToolSummary(issues);

    return {
      tool,
      success: true,
      duration,
      issues,
      summary,
    };
  }

  /**
   * Generates summary for a tool
   */
  private generateToolSummary(issues: AnalysisIssue[]): ToolResult['summary'] {
    const bySeverity: Record<Severity, number> = {
      [Severity.LOW]: 0,
      [Severity.MEDIUM]: 0,
      [Severity.HIGH]: 0,
      [Severity.CRITICAL]: 0,
    };

    const byCategory: Record<string, number> = {};

    for (const issue of issues) {
      bySeverity[issue.severity]++;
      byCategory[issue.category] = (byCategory[issue.category] || 0) + 1;
    }

    return {
      total: issues.length,
      bySeverity,
      byCategory,
    };
  }

  /**
   * Generates overall summary
   */
  private generateSummary(results: ToolResult[], allIssues: AnalysisIssue[]): AnalysisResult['summary'] {
    const bySeverity: Record<Severity, number> = {
      [Severity.LOW]: 0,
      [Severity.MEDIUM]: 0,
      [Severity.HIGH]: 0,
      [Severity.CRITICAL]: 0,
    };

    const byTool: Record<ToolType, number> = {} as Record<ToolType, number>;
    const byCategory: Record<string, number> = {};

    for (const issue of allIssues) {
      bySeverity[issue.severity]++;
      byTool[issue.tool] = (byTool[issue.tool] || 0) + 1;
      byCategory[issue.category] = (byCategory[issue.category] || 0) + 1;
    }

    return {
      totalIssues: allIssues.length,
      bySeverity,
      byTool,
      byCategory,
    };
  }

  /**
   * Gets blocking issues based on severity threshold
   */
  private getBlockingIssues(issues: AnalysisIssue[]): AnalysisIssue[] {
    const severityOrder = [Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM, Severity.LOW];
    const thresholdIndex = severityOrder.indexOf(this.options.config.severityThreshold);

    return issues.filter(issue => {
      const issueIndex = severityOrder.indexOf(issue.severity);
      return issueIndex <= thresholdIndex;
    });
  }

  /**
   * Generates recommendations based on analysis results
   */
  private generateRecommendations(issues: AnalysisIssue[], summary: AnalysisResult['summary']): string[] {
    const recommendations: string[] = [];

    // High severity issues
    if (summary.bySeverity[Severity.CRITICAL] > 0) {
      recommendations.push('🔴 Critical issues found - immediate attention required');
    }

    if (summary.bySeverity[Severity.HIGH] > 0) {
      recommendations.push('🟠 High severity issues found - should be addressed soon');
    }

    // Most common categories
    const topCategories = Object.entries(summary.byCategory)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);

    if (topCategories.length > 0) {
      recommendations.push(`📊 Top issue categories: ${topCategories.map(([cat, count]) => `${cat} (${count})`).join(', ')}`);
    }

    // Tool-specific recommendations
    const toolIssues = Object.entries(summary.byTool);
    const problematicTools = toolIssues.filter(([, count]) => count > 0);

    if (problematicTools.length > 0) {
      recommendations.push(`🔧 Tools with issues: ${problematicTools.map(([tool, count]) => `${tool} (${count})`).join(', ')}`);
    }

    // Performance recommendations
    if (summary.totalIssues > this.options.config.maxIssues) {
      recommendations.push(`⚠️ Total issues (${summary.totalIssues}) exceed threshold (${this.options.config.maxIssues})`);
    }

    // Security recommendations
    const securityIssues = issues.filter(issue => 
      issue.category.toLowerCase().includes('security') || 
      issue.rule.toLowerCase().includes('security')
    );

    if (securityIssues.length > 0) {
      recommendations.push(`🔒 ${securityIssues.length} security-related issues found`);
    }

    return recommendations;
  }

  /**
   * Formats analysis results for console output
   */
  formatResults(result: AnalysisResult): string {
    const output: string[] = [];

    // Header
    output.push(chalk.bold.blue('\n🔍 Static Analysis Results'));
    output.push(chalk.gray(`Repository: ${result.metadata.repository}`));
    output.push(chalk.gray(`Branch: ${result.metadata.branch}`));
    output.push(chalk.gray(`Commit: ${result.metadata.commit}`));
    output.push(chalk.gray(`Duration: ${result.duration}ms`));
    output.push('');

    // Summary
    output.push(chalk.bold('📊 Summary:'));
    output.push(`  Total Issues: ${result.summary.totalIssues}`);
    output.push(`  Critical: ${chalk.red(result.summary.bySeverity[Severity.CRITICAL])}`);
    output.push(`  High: ${chalk.yellow(result.summary.bySeverity[Severity.HIGH])}`);
    output.push(`  Medium: ${chalk.blue(result.summary.bySeverity[Severity.MEDIUM])}`);
    output.push(`  Low: ${chalk.gray(result.summary.bySeverity[Severity.LOW])}`);
    output.push('');

    // Tool results
    output.push(chalk.bold('🛠️ Tool Results:'));
    for (const toolResult of result.tools) {
      const status = toolResult.success ? chalk.green('✓') : chalk.red('✗');
      const issues = toolResult.summary.total;
      const duration = toolResult.duration;
      
      output.push(`  ${status} ${toolResult.tool}: ${issues} issues (${duration}ms)`);
    }
    output.push('');

    // Blocking issues
    if (result.blockingIssues.length > 0) {
      output.push(chalk.bold.red('🚫 Blocking Issues:'));
      for (const issue of result.blockingIssues.slice(0, 10)) { // Show first 10
        const severityColor = this.getSeverityColor(issue.severity);
        output.push(`  ${severityColor(issue.severity.toUpperCase())} ${issue.file}:${issue.line}:${issue.column}`);
        output.push(`    ${issue.message}`);
        if (issue.suggestedFix) {
          output.push(`    💡 Suggested fix: ${issue.suggestedFix}`);
        }
        output.push('');
      }
      
      if (result.blockingIssues.length > 10) {
        output.push(chalk.gray(`    ... and ${result.blockingIssues.length - 10} more`));
      }
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
    const status = result.success ? chalk.green('✅ Analysis passed') : chalk.red('❌ Analysis failed');
    output.push(status);

    return output.join('\n');
  }

  /**
   * Gets color for severity level
   */
  private getSeverityColor(severity: Severity): (text: string) => string {
    switch (severity) {
      case Severity.CRITICAL:
        return chalk.red;
      case Severity.HIGH:
        return chalk.yellow;
      case Severity.MEDIUM:
        return chalk.blue;
      case Severity.LOW:
        return chalk.gray;
      default:
        return chalk.white;
    }
  }

  /**
   * Checks if analysis should block merge
   */
  shouldBlockMerge(result: AnalysisResult): boolean {
    return result.blockingIssues.length > 0;
  }

  /**
   * Gets blocking reason for merge
   */
  getBlockingReason(result: AnalysisResult): string {
    if (!this.shouldBlockMerge(result)) {
      return '';
    }

    const criticalCount = result.summary.bySeverity[Severity.CRITICAL];
    const highCount = result.summary.bySeverity[Severity.HIGH];
    const mediumCount = result.summary.bySeverity[Severity.MEDIUM];

    const reasons: string[] = [];

    if (criticalCount > 0) {
      reasons.push(`${criticalCount} critical issues`);
    }

    if (highCount > 0) {
      reasons.push(`${highCount} high severity issues`);
    }

    if (mediumCount > 0) {
      reasons.push(`${mediumCount} medium severity issues`);
    }

    return `Static analysis failed: ${reasons.join(', ')}`;
  }
} 