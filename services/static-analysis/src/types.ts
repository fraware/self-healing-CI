export enum Severity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum ToolType {
  ESLINT = 'eslint',
  RUST_CLIPPY = 'rust-clippy',
  RUFF = 'ruff',
  SEMGREP = 'semgrep',
}

export interface AnalysisIssue {
  id: string;
  tool: ToolType;
  severity: Severity;
  message: string;
  file: string;
  line: number;
  column: number;
  rule: string;
  category: string;
  fixable: boolean;
  suggestedFix?: string;
  context?: string;
}

export interface ToolResult {
  tool: ToolType;
  success: boolean;
  duration: number;
  issues: AnalysisIssue[];
  summary: {
    total: number;
    bySeverity: Record<Severity, number>;
    byCategory: Record<string, number>;
  };
}

export interface AnalysisResult {
  success: boolean;
  duration: number;
  tools: ToolResult[];
  summary: {
    totalIssues: number;
    bySeverity: Record<Severity, number>;
    byTool: Record<ToolType, number>;
    byCategory: Record<string, number>;
  };
  blockingIssues: AnalysisIssue[];
  recommendations: string[];
  metadata: {
    repository: string;
    branch: string;
    commit: string;
    timestamp: string;
    config: AnalysisConfig;
  };
}

export interface AnalysisConfig {
  enabledTools: ToolType[];
  severityThreshold: Severity;
  maxIssues: number;
  timeoutMs: number;
  includePatterns: string[];
  excludePatterns: string[];
  customRules: Record<ToolType, string[]>;
}

export interface ESLintConfig {
  configFile?: string;
  rules?: Record<string, any>;
  parserOptions?: any;
  env?: Record<string, boolean>;
  extends?: string[];
  plugins?: string[];
}

export interface ClippyConfig {
  deny: string[];
  warn: string[];
  allow: string[];
  forbid: string[];
}

export interface RuffConfig {
  select: string[];
  ignore: string[];
  lineLength: number;
  targetVersion: string;
}

export interface SemgrepConfig {
  rules: string[];
  severity: Severity[];
  categories: string[];
  excludePatterns: string[];
}

export interface StaticAnalysisOptions {
  repository: string;
  branch: string;
  commit: string;
  config: AnalysisConfig;
  eslintConfig?: ESLintConfig;
  clippyConfig?: ClippyConfig;
  ruffConfig?: RuffConfig;
  semgrepConfig?: SemgrepConfig;
} 