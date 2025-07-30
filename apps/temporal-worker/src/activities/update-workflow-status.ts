import { log } from '@temporalio/activity';
import { logger } from '../utils/logger.js';
import { WorkflowState } from '../workflows/self-healing-workflow.js';

export interface UpdateWorkflowStatusInput {
  workflowId: string;
  state: WorkflowState;
  timestamp: string;
  data?: Record<string, unknown>;
}

export interface UpdateWorkflowStatusResult {
  success: boolean;
  error?: string;
}

/**
 * Activity to update workflow status in the state store
 */
export async function updateWorkflowStatus(
  input: UpdateWorkflowStatusInput
): Promise<UpdateWorkflowStatusResult> {
  const startTime = Date.now();
  const activityId = log.info('Updating workflow status', {
    workflowId: input.workflowId,
    state: input.state,
  });

  try {
    // TODO: Implement actual state store update
    // For now, just log the status update
    logger.info('Workflow status updated', {
      activityId,
      workflowId: input.workflowId,
      state: input.state,
      timestamp: input.timestamp,
      data: input.data || {},
      duration: Date.now() - startTime,
    });

    return {
      success: true,
    };
  } catch (error) {
    logger.error('Workflow status update failed', {
      activityId,
      workflowId: input.workflowId,
      state: input.state,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
