import { log, proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities/index.js';
import { WorkflowRunEvent } from '../types/workflow-run.js';

// Define workflow state enum
export enum WorkflowState {
  NEW = 'NEW',
  DIAGNOSE = 'DIAGNOSE',
  PATCH = 'PATCH',
  TEST = 'TEST',
  PROVE = 'PROVE',
  MERGE = 'MERGE',
  DONE = 'DONE',
  FAILED = 'FAILED',
}

// Define root cause enum
export enum RootCause {
  DEP_UPGRADE = 'DEP_UPGRADE',
  API_CHANGE = 'API_CHANGE',
  FLAKY_TEST = 'FLAKY_TEST',
  CONFIG_ERROR = 'CONFIG_ERROR',
  ENV_ISSUE = 'ENV_ISSUE',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  TIMEOUT = 'TIMEOUT',
  UNKNOWN = 'UNKNOWN',
}

// Define workflow input interface
export interface SelfHealingWorkflowInput {
  workflowRunEvent: WorkflowRunEvent;
  repository: string;
  workflowRunId: number;
  headSha: string;
  branch: string;
  actor: string;
  installationId: number;
  failureData: {
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
  };
}

// Define workflow state interface
export interface WorkflowStateData {
  state: WorkflowState;
  timestamp: string;
  data?: Record<string, unknown>;
  error?: string;
}

// Define workflow result interface
export interface WorkflowResult {
  success: boolean;
  state: WorkflowState;
  rootCause?: RootCause;
  patchApplied?: boolean;
  testsPassed?: boolean;
  proofsValidated?: boolean;
  merged?: boolean;
  error?: string;
  duration: number;
  metadata: Record<string, unknown>;
}

// Activity proxy
const {
  diagnoseFailure,
  applyPatch,
  runTests,
  validateProofs,
  mergeChanges,
  emitCloudEvent,
  updateWorkflowStatus,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    initialInterval: '1s',
    maximumInterval: '1m',
    maximumAttempts: 3,
    backoffCoefficient: 2,
  },
});

/**
 * Main self-healing workflow implementation
 */
export async function SelfHealingWorkflow(
  input: SelfHealingWorkflowInput
): Promise<WorkflowResult> {
  const startTime = Date.now();
  const workflowId = log.info('Starting Self-Healing Workflow', {
    workflowId: log.meta().workflowId,
    repository: input.repository,
    workflowRunId: input.workflowRunId,
    headSha: input.headSha,
  });

  // Initialize workflow state
  let currentState: WorkflowState = WorkflowState.NEW;
  let rootCause: RootCause | undefined;
  let patchApplied = false;
  let testsPassed = false;
  let proofsValidated = false;
  let merged = false;
  let error: string | undefined;

  try {
    // State: NEW → DIAGNOSE
    await updateWorkflowStatus({
      workflowId,
      state: WorkflowState.NEW,
      timestamp: new Date().toISOString(),
      data: { input },
    });

    log.info('Workflow state: NEW', { workflowId });

    // State: DIAGNOSE
    currentState = WorkflowState.DIAGNOSE;
    await updateWorkflowStatus({
      workflowId,
      state: currentState,
      timestamp: new Date().toISOString(),
    });

    log.info('Workflow state: DIAGNOSE', { workflowId });

    // Emit CloudEvent for DIAGNOSE state
    await emitCloudEvent({
      eventType: 'workflow.state.diagnose',
      source: 'self-healing-ci',
      subject: 'self-healing-ci',
      eventData: {
        workflowId,
        state: currentState,
        repository: input.repository,
        workflowRunId: input.workflowRunId,
        timestamp: new Date().toISOString(),
      },
    });

    // Perform diagnosis
    const diagnosisResult = await diagnoseFailure(input);
    rootCause = diagnosisResult.rootCause;

    log.info('Diagnosis completed', {
      workflowId,
      rootCause,
      confidence: diagnosisResult.confidence,
    });

    // State: PATCH
    currentState = WorkflowState.PATCH;
    await updateWorkflowStatus({
      workflowId,
      state: currentState,
      timestamp: new Date().toISOString(),
      data: { diagnosisResult },
    });

    log.info('Workflow state: PATCH', { workflowId });

    // Emit CloudEvent for PATCH state
    await emitCloudEvent({
      eventType: 'workflow.state.patch',
      source: 'self-healing-ci',
      subject: 'self-healing-ci',
      eventData: {
        workflowId,
        state: currentState,
        repository: input.repository,
        workflowRunId: input.workflowRunId,
        rootCause,
        timestamp: new Date().toISOString(),
      },
    });

    // Apply patch if diagnosis was successful
    if (
      diagnosisResult.rootCause !== RootCause.UNKNOWN &&
      diagnosisResult.patch
    ) {
      const patchResult = await applyPatch({
        repository: input.repository,
        headSha: input.headSha,
        branch: input.branch,
        patch: diagnosisResult.patch,
        rootCause: diagnosisResult.rootCause,
        installationId: input.installationId,
      });

      patchApplied = patchResult.success;

      if (!patchApplied) {
        throw new Error(`Failed to apply patch: ${patchResult.error}`);
      }

      log.info('Patch applied successfully', {
        workflowId,
        patchSha: patchResult.patchSha,
        filesChanged: patchResult.filesChanged,
      });
    } else {
      log.info('No patch to apply', { workflowId, rootCause });
    }

    // State: TEST
    currentState = WorkflowState.TEST;
    await updateWorkflowStatus({
      workflowId,
      state: currentState,
      timestamp: new Date().toISOString(),
      data: { patchApplied },
    });

    log.info('Workflow state: TEST', { workflowId });

    // Emit CloudEvent for TEST state
    await emitCloudEvent({
      eventType: 'workflow.state.test',
      source: 'self-healing-ci',
      subject: 'self-healing-ci',
      eventData: {
        workflowId,
        state: currentState,
        repository: input.repository,
        workflowRunId: input.workflowRunId,
        patchApplied,
        timestamp: new Date().toISOString(),
      },
    });

    // Run tests
    const testResult = await runTests({
      repository: input.repository,
      headSha: input.headSha,
      branch: input.branch,
      installationId: input.installationId,
    });

    testsPassed = testResult.success;

    if (!testsPassed) {
      log.warn('Tests failed after patch', {
        workflowId,
        testError: testResult.error,
        testOutput: testResult.output,
      });

      // If tests fail, we might need to retry diagnosis
      if (testResult.retryDiagnosis) {
        log.info('Retrying diagnosis due to test failure', { workflowId });

        // Go back to DIAGNOSE state
        currentState = WorkflowState.DIAGNOSE;
        await updateWorkflowStatus({
          workflowId,
          state: currentState,
          timestamp: new Date().toISOString(),
          data: { testFailure: testResult },
        });

        // Retry diagnosis with test failure context
        const retryDiagnosisResult = await diagnoseFailure({
          ...input,
          testFailure: testResult,
        });

        if (
          retryDiagnosisResult.rootCause !== RootCause.UNKNOWN &&
          retryDiagnosisResult.patch
        ) {
          // Apply new patch
          const retryPatchResult = await applyPatch({
            repository: input.repository,
            headSha: input.headSha,
            branch: input.branch,
            patch: retryDiagnosisResult.patch,
            rootCause: retryDiagnosisResult.rootCause,
            installationId: input.installationId,
          });

          if (retryPatchResult.success) {
            // Run tests again
            const retryTestResult = await runTests({
              repository: input.repository,
              headSha: input.headSha,
              branch: input.branch,
              installationId: input.installationId,
            });

            testsPassed = retryTestResult.success;
          }
        }
      }
    } else {
      log.info('Tests passed after patch', { workflowId });
    }

    // State: PROVE
    currentState = WorkflowState.PROVE;
    await updateWorkflowStatus({
      workflowId,
      state: currentState,
      timestamp: new Date().toISOString(),
      data: { testsPassed },
    });

    log.info('Workflow state: PROVE', { workflowId });

    // Emit CloudEvent for PROVE state
    await emitCloudEvent({
      eventType: 'workflow.state.prove',
      source: 'self-healing-ci',
      subject: 'self-healing-ci',
      eventData: {
        workflowId,
        state: currentState,
        repository: input.repository,
        workflowRunId: input.workflowRunId,
        testsPassed,
        timestamp: new Date().toISOString(),
      },
    });

    // Validate proofs if tests passed
    if (testsPassed) {
      const proofResult = await validateProofs({
        repository: input.repository,
        headSha: input.headSha,
        branch: input.branch,
        installationId: input.installationId,
      });

      proofsValidated = proofResult.success;

      if (!proofsValidated) {
        log.warn('Proofs validation failed', {
          workflowId,
          proofError: proofResult.error,
        });
      } else {
        log.info('Proofs validated successfully', { workflowId });
      }
    } else {
      log.info('Skipping proofs validation due to test failure', {
        workflowId,
      });
    }

    // State: MERGE
    currentState = WorkflowState.MERGE;
    await updateWorkflowStatus({
      workflowId,
      state: currentState,
      timestamp: new Date().toISOString(),
      data: { testsPassed, proofsValidated },
    });

    log.info('Workflow state: MERGE', { workflowId });

    // Emit CloudEvent for MERGE state
    await emitCloudEvent({
      eventType: 'workflow.state.merge',
      source: 'self-healing-ci',
      subject: 'self-healing-ci',
      eventData: {
        workflowId,
        state: currentState,
        repository: input.repository,
        workflowRunId: input.workflowRunId,
        testsPassed,
        proofsValidated,
        timestamp: new Date().toISOString(),
      },
    });

    // Merge changes if everything passed
    if (testsPassed && proofsValidated) {
      // Parse repository to get owner and repo name
      const [owner, repo] = input.repository.split('/');

      const mergeResult = await mergeChanges({
        owner,
        repo,
        baseBranch: input.branch,
        headBranch: `ci/self-heal/${input.headSha.substring(0, 7)}`,
        title: `fix: Self-healing CI automated fix for ${
          rootCause || 'unknown issue'
        }`,
        body: `Automated fix applied by Self-Healing CI system.\n\nRoot cause: ${rootCause}\nPatch applied: ${patchApplied}\nTests passed: ${testsPassed}\nProofs validated: ${proofsValidated}`,
        rootCauseEnum: rootCause || 'UNKNOWN',
        proofVerdict: proofsValidated ? 'PASS' : 'FAIL',
        commitSha: input.headSha,
        appId: process.env.GITHUB_APP_ID || '',
        privateKey: process.env.GITHUB_APP_PRIVATE_KEY || '',
        webhookSecret: process.env.GITHUB_WEBHOOK_SECRET || '',
      });

      merged = mergeResult.success;

      if (!merged) {
        throw new Error(`Failed to merge changes: ${mergeResult.error}`);
      }

      log.info('Changes merged successfully', {
        workflowId,
        mergeCommitSha: mergeResult.mergeCommitSha,
        prNumber: mergeResult.prNumber,
        branchDeleted: mergeResult.branchDeleted,
      });
    } else {
      log.info('Skipping merge due to test or proof failure', {
        workflowId,
        testsPassed,
        proofsValidated,
      });
    }

    // State: DONE
    currentState = WorkflowState.DONE;
    await updateWorkflowStatus({
      workflowId,
      state: currentState,
      timestamp: new Date().toISOString(),
      data: { testsPassed, proofsValidated, merged },
    });

    log.info('Workflow state: DONE', { workflowId });

    // Emit CloudEvent for DONE state
    await emitCloudEvent({
      eventType: 'workflow.state.done',
      source: 'self-healing-ci',
      subject: 'self-healing-ci',
      eventData: {
        workflowId,
        state: currentState,
        repository: input.repository,
        workflowRunId: input.workflowRunId,
        testsPassed,
        proofsValidated,
        merged,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    // State: FAILED
    currentState = WorkflowState.FAILED;
    error = err instanceof Error ? err.message : 'Unknown error';

    await updateWorkflowStatus({
      workflowId,
      state: currentState,
      timestamp: new Date().toISOString(),
      data: { error },
    });

    log.error('Workflow failed', {
      workflowId,
      error,
      state: currentState,
    });

    // Emit CloudEvent for FAILED state
    await emitCloudEvent({
      eventType: 'workflow.state.failed',
      source: 'self-healing-ci',
      subject: 'self-healing-ci',
      eventData: {
        workflowId,
        state: currentState,
        repository: input.repository,
        workflowRunId: input.workflowRunId,
        error,
        timestamp: new Date().toISOString(),
      },
    });
  }

  const duration = Date.now() - startTime;

  const result: WorkflowResult = {
    success: currentState === WorkflowState.DONE,
    state: currentState,
    rootCause,
    patchApplied,
    testsPassed,
    proofsValidated,
    merged,
    error,
    duration,
    metadata: {
      workflowId,
      repository: input.repository,
      workflowRunId: input.workflowRunId,
      headSha: input.headSha,
      branch: input.branch,
      actor: input.actor,
      installationId: input.installationId,
    },
  };

  log.info('Self-Healing Workflow completed', {
    workflowId,
    result,
  });

  return result;
}
