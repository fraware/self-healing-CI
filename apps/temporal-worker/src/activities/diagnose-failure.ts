import { log } from '@temporalio/activity';
import type {
  ClaudeInput,
  ClaudeResult,
  FailureData,
  TestFailure,
} from '../types/stubs.js';
import { logger } from '../utils/logger.js';
import { RootCause } from '../workflows/self-healing-workflow.js';

export interface DiagnoseFailureInput {
  repository: string;
  workflowRunId: number;
  headSha: string;
  branch: string;
  installationId: number;
  failureData: FailureData;
  testFailure?: TestFailure;
}

export interface DiagnoseFailureResult {
  success: boolean;
  rootCause: RootCause;
  confidence: number;
  explanation: string;
  patch: string | undefined;
  error: string | undefined;
}

/**
 * Activity to diagnose CI failures using Claude AI
 */
export async function diagnoseFailure(
  input: DiagnoseFailureInput
): Promise<DiagnoseFailureResult> {
  const startTime = Date.now();
  const activityId = log.info('Diagnosing failure', {
    repository: input.repository,
    workflowRunId: input.workflowRunId,
    headSha: input.headSha,
    branch: input.branch,
  });

  try {
    // Prepare failure data for Claude
    const claudeInput: ClaudeInput = {
      repository: input.repository,
      workflowRunId: input.workflowRunId,
      headSha: input.headSha,
      branch: input.branch,
      installationId: input.installationId,
      failureData: input.failureData,
      testFailure: input.testFailure,
    };

    // Call Claude API for diagnosis
    const claudeResult = await callClaudeAPI(claudeInput);

    if (!claudeResult) {
      throw new Error('Claude API returned no result');
    }

    // Parse Claude response
    const parsedResult = parseClaudeResponse(claudeResult);

    logger.info('Failure diagnosis completed', {
      activityId,
      repository: input.repository,
      rootCause: parsedResult.rootCause,
      confidence: parsedResult.confidence,
      duration: Date.now() - startTime,
    });

    return {
      success: true,
      rootCause: parsedResult.rootCause,
      confidence: parsedResult.confidence,
      explanation: parsedResult.explanation,
      patch: parsedResult.patch,
      error: undefined,
    };
  } catch (error) {
    logger.error('Failure diagnosis failed', {
      activityId,
      repository: input.repository,
      workflowRunId: input.workflowRunId,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    });

    return {
      success: false,
      rootCause: RootCause.UNKNOWN,
      confidence: 0,
      explanation: error instanceof Error ? error.message : 'Unknown error',
      error: error instanceof Error ? error.message : 'Unknown error',
      patch: undefined,
    };
  }
}

/**
 * Call Claude API for failure diagnosis
 */
async function callClaudeAPI(input: ClaudeInput): Promise<ClaudeResult | null> {
  // TODO: Implement actual Claude API call
  // For now, return a mock response
  return {
    rootCause: 'Test failure',
    confidence: 0.8,
    patch: '',
    explanation: 'Mock diagnosis result',
    logs: input.failureData.buildLogs || '',
  };
}

/**
 * Parse Claude API response
 */
function parseClaudeResponse(response: ClaudeResult): {
  rootCause: RootCause;
  confidence: number;
  explanation: string;
  patch?: string;
} {
  // TODO: Implement proper response parsing
  return {
    rootCause: RootCause.FLAKY_TEST,
    confidence: response.confidence,
    explanation: response.explanation,
    patch: response.patch,
  };
}
