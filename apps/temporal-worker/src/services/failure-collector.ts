import { logger } from '../../github-app/src/utils/logger.js';

export interface FailureData {
  logs?: string;
  diff?: string;
  testOutput?: string;
  error?: string;
}

export interface CollectFailureLogsInput {
  repository: string;
  workflowRunId: number;
  headSha: string;
  branch: string;
  installationId: number;
  testFailure?: {
    success: boolean;
    error?: string;
    output?: string;
    retryDiagnosis?: boolean;
  };
}

/**
 * Service to collect failure logs and context for diagnosis
 */
export async function collectFailureLogs(
  input: CollectFailureLogsInput
): Promise<FailureData> {
  const startTime = Date.now();

  try {
    logger.info('Collecting failure logs', {
      repository: input.repository,
      workflowRunId: input.workflowRunId,
      headSha: input.headSha,
    });

    // TODO: Implement actual log collection from GitHub API
    // This will collect:
    // - Workflow run logs
    // - Job logs
    // - Test outputs
    // - Git diff vs base SHA
    // - Redact secrets

    // For now, return stub data
    const failureData: FailureData = {
      logs: `[INFO] Workflow run ${input.workflowRunId} failed
[ERROR] Test suite failed with exit code 1
[ERROR] 2 tests failed, 1 test passed
[ERROR] Assertion failed: expected true but got false`,
      diff: `diff --git a/src/app.ts b/src/app.ts
index 1234567..abcdefg 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -10,7 +10,7 @@ export class App {
   constructor() {
     this.config = {
       port: process.env.PORT || 3000,
-      host: process.env.HOST || 'localhost',
+      host: process.env.HOST || '0.0.0.0',
       debug: process.env.DEBUG === 'true',
     };
   }`,
      testOutput: `FAIL  src/app.test.ts
  ● App initialization
  
    expect(received).toBe(expected)
    
    Expected: true
    Received: false
    
       8 |   it('should initialize correctly', () => {
       9 |     const app = new App();
    > 10 |     expect(app.isReady()).toBe(true);
         |                        ^
      11 |   });
      12 | });
    
    at Object.<anonymous> (src/app.test.ts:10:5)
    
Test Suites: 1 failed, 0 passed, 1 total
Tests:       1 failed, 0 passed, 1 total`,
      error: 'Test suite failed with 1 failing test',
    };

    logger.info('Failure logs collected', {
      repository: input.repository,
      workflowRunId: input.workflowRunId,
      logsSize: failureData.logs?.length || 0,
      diffSize: failureData.diff?.length || 0,
      testOutputSize: failureData.testOutput?.length || 0,
      duration: Date.now() - startTime,
    });

    return failureData;
  } catch (error) {
    logger.error('Failed to collect failure logs', {
      repository: input.repository,
      workflowRunId: input.workflowRunId,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    });

    return {
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
