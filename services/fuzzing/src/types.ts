export enum Language {
  RUST = 'rust',
  JAVASCRIPT = 'javascript',
  TYPESCRIPT = 'typescript',
  PYTHON = 'python',
  GO = 'go',
}

export enum FuzzingTool {
  CARGO_FUZZ = 'cargo-fuzz',
  FUZZILLI = 'fuzzilli',
  AFL_PLUS_PLUS = 'afl-plus-plus',
  LIBFUZZER = 'libfuzzer',
}

export interface FuzzingConfig {
  languages: Language[];
  tools: FuzzingTool[];
  durationMs: number; // Fuzzing duration in milliseconds
  maxIterations: number; // Maximum fuzzing iterations
  timeoutMs: number; // Timeout per test case
  memoryLimit: string; // Memory limit (e.g., "1G")
  cpuLimit: number; // CPU limit (percentage)
  seedCorpus: string[]; // Seed corpus files
  customHarnesses: Record<Language, string[]>; // Custom fuzzing harnesses
  excludePatterns: string[]; // Patterns to exclude from fuzzing
  includePatterns: string[]; // Patterns to include in fuzzing
}

export interface FuzzingIssue {
  id: string;
  language: Language;
  tool: FuzzingTool;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'crash' | 'timeout' | 'memory_leak' | 'regression' | 'divergence';
  message: string;
  file: string;
  line?: number;
  column?: number;
  stackTrace?: string;
  input?: string; // The input that caused the issue
  prePatchOutput?: string; // Output before patch
  postPatchOutput?: string; // Output after patch
  diff?: string; // Diff between pre and post patch outputs
  reproducible: boolean;
  crashReport?: string;
}

export interface ToolResult {
  tool: FuzzingTool;
  language: Language;
  success: boolean;
  duration: number;
  iterations: number;
  issues: FuzzingIssue[];
  coverage: {
    lines: number;
    functions: number;
    branches: number;
    percentage: number;
  };
  crashes: number;
  timeouts: number;
  memoryLeaks: number;
  regressions: number;
}

export interface FuzzingResult {
  success: boolean;
  duration: number;
  tools: ToolResult[];
  summary: {
    totalIssues: number;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
    byLanguage: Record<Language, number>;
    byTool: Record<FuzzingTool, number>;
  };
  criticalIssues: FuzzingIssue[];
  regressions: FuzzingIssue[];
  divergences: FuzzingIssue[];
  recommendations: string[];
  metadata: {
    repository: string;
    branch: string;
    commit: string;
    prePatchCommit: string;
    postPatchCommit: string;
    timestamp: string;
    config: FuzzingConfig;
  };
}

export interface CargoFuzzConfig {
  targets: string[];
  maxLen: number;
  timeout: number;
  runs: number;
  corpusDir: string;
  artifactDir: string;
  seedCorpus: string[];
}

export interface FuzzilliConfig {
  target: string;
  maxIterations: number;
  timeout: number;
  maxMemory: number;
  seedCorpus: string[];
  customHarnesses: string[];
}

export interface DifferentialFuzzingOptions {
  repository: string;
  branch: string;
  prePatchCommit: string;
  postPatchCommit: string;
  config: FuzzingConfig;
  cargoFuzzConfig?: CargoFuzzConfig;
  fuzzilliConfig?: FuzzilliConfig;
}

export interface GitHubIssue {
  title: string;
  body: string;
  labels: string[];
  assignees: string[];
  milestone?: number;
}

export interface FuzzingHarness {
  name: string;
  language: Language;
  tool: FuzzingTool;
  target: string;
  description: string;
  setupCommands: string[];
  teardownCommands: string[];
  customConfig?: Record<string, any>;
} 