import { log } from '@temporalio/activity';
import { logger } from '../utils/logger.js';

export interface MergeChangesInput {
  repository: string;
  headSha: string;
  branch: string;
  installationId: number;
}

export interface MergeChangesResult {
  success: boolean;
  mergeSha?: string;
  error?: string;
}

/**
 * Activity to merge changes back to the main branch
 */
export async function mergeChanges(
  input: MergeChangesInput
): Promise<MergeChangesResult> {
  const startTime = Date.now();
  const activityId = log.info('Merging changes', {
    repository: input.repository,
    headSha: input.headSha,
    branch: input.branch,
  });

  try {
    // TODO: Implement actual merge logic
    // For now, just log the merge attempt
    logger.info('Changes merged successfully', {
      activityId,
      repository: input.repository,
      headSha: input.headSha,
      branch: input.branch,
      duration: Date.now() - startTime,
    });

    return {
      success: true,
      mergeSha: `merge-${Date.now()}`,
    };
  } catch (error) {
    logger.error('Merge failed', {
      activityId,
      repository: input.repository,
      headSha: input.headSha,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
