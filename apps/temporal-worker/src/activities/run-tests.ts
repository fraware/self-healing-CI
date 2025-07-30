import { log } from '@temporalio/activity';
import type { TestContainerRequest } from '../types/stubs.js';
import { FreestyleClient } from '../types/stubs.js';
import { logger } from '../utils/logger.js';

export interface RunTestsInput {
  repository: string;
  headSha: string;
  branch: string;
  testCommand: string;
  timeoutMs: number;
}

export interface RunTestsResult {
  success: boolean;
  output: string | undefined;
  error: string | undefined;
  duration: number;
  retryDiagnosis: boolean | undefined;
}

/**
 * Activity to run tests using Freestyle container
 */
export async function runTests(input: RunTestsInput): Promise<RunTestsResult> {
  const startTime = Date.now();
  const activityId = log.info('Running tests', {
    repository: input.repository,
    headSha: input.headSha,
    branch: input.branch,
    testCommand: input.testCommand,
  });

  try {
    // Initialize Freestyle client
    const freestyleClient = new FreestyleClient({
      apiKey: (process.env as any).FREESTYLE_API_KEY || '',
      apiUrl:
        (process.env as any).FREESTYLE_API_URL || 'https://api.freestyle.dev',
      timeoutMs: input.timeoutMs,
      maxRetries: 2,
    });

    // Create test request
    const testRequest: TestContainerRequest = {
      repository: input.repository,
      headSha: input.headSha,
      branch: input.branch,
      testCommand: input.testCommand,
      timeoutMs: input.timeoutMs,
    };

    // Run tests with Freestyle
    const testResult = await freestyleClient.runTests(testRequest);

    logger.info('Tests completed', {
      activityId,
      repository: input.repository,
      success: testResult.success,
      duration: testResult.duration,
    });

    return {
      success: testResult.success,
      output: testResult.output || undefined,
      error: testResult.error || undefined,
      duration: testResult.duration,
      retryDiagnosis: undefined,
    };
  } catch (error) {
    logger.error('Test execution failed', {
      activityId,
      repository: input.repository,
      headSha: input.headSha,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    });

    return {
      success: false,
      output: undefined,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
      retryDiagnosis: undefined,
    };
  }
}
