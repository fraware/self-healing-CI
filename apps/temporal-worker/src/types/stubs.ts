// Temporary stub types for missing service dependencies
// These will be replaced with actual imports once services are built

export interface MorphClientConfig {
  apiKey: string;
  apiUrl: string;
  timeoutMs: number;
  maxRetries: number;
}

export class MorphClient {
  constructor(private _config: MorphClientConfig) {}

  async applyPatch(_request: PatchRequest): Promise<PatchResult> {
    // TODO: Implement actual Morph API call
    // For now, return a mock response
    return {
      success: true,
      patchSha: 'mock-patch-sha',
      filesChanged: ['mock-file.ts'],
    };
  }
}

export interface PatchRequest {
  repository: string;
  headSha: string;
  branch: string;
  patch: string;
  rootCause: string;
  installationId: number;
  maxRetries: number;
}

export interface PatchResult {
  success: boolean;
  patchSha?: string;
  filesChanged?: string[];
  error?: string;
}

export interface FreestyleClientConfig {
  apiKey: string;
  apiUrl: string;
  timeoutMs: number;
  maxRetries: number;
}

export class FreestyleClient {
  constructor(private _config: FreestyleClientConfig) {}

  async runTests(_request: TestContainerRequest): Promise<TestContainerResult> {
    // TODO: Implement actual Freestyle API call
    // For now, return a mock response
    return {
      success: true,
      output: 'Mock test output',
      duration: 5000,
    };
  }
}

export interface TestContainerRequest {
  repository: string;
  headSha: string;
  branch: string;
  testCommand: string;
  timeoutMs: number;
}

export interface TestContainerResult {
  success: boolean;
  output?: string;
  error?: string;
  duration: number;
}

export interface LeanClientConfig {
  apiKey: string;
  apiUrl: string;
  timeoutMs: number;
  maxRetries: number;
}

export class LeanClient {
  constructor(private _config: LeanClientConfig) {}

  async validateProofs(
    _request: ValidateProofsRequest
  ): Promise<ValidateProofsResult> {
    // TODO: Implement actual Lean API call
    // For now, return a mock response
    return {
      success: true,
      validatedProofs: 5,
      totalProofs: 5,
      errors: [],
    };
  }
}

export interface ValidateProofsRequest {
  repository: string;
  headSha: string;
  branch: string;
  proofFiles: string[];
}

export interface ValidateProofsResult {
  success: boolean;
  validatedProofs: number;
  totalProofs: number;
  errors: string[];
}

export interface ClaudeInput {
  repository: string;
  workflowRunId: number;
  headSha: string;
  branch: string;
  installationId: number;
  failureData: FailureData;
  testFailure?: TestFailure;
}

export interface FailureData {
  buildLogs: string;
  baseSha: string;
  changedFiles: string[];
  commitMessage: string;
  author: string;
  duration: number;
  failedTests: string[];
  runner: string;
  os: string;
  nodeVersion: string;
  dependencies: Record<string, string>;
  environment: Record<string, string>;
  memoryUsage: number;
  cpuUsage: number;
  networkRequests: number;
}

export interface TestFailure {
  success: boolean;
  error?: string;
  output?: string;
  retryDiagnosis?: boolean;
}

export interface ClaudeResult {
  rootCause: string;
  confidence: number;
  patch: string;
  explanation: string;
  logs: string;
}
