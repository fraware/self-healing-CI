import { log } from '@temporalio/activity';
import type { PatchRequest } from '../types/stubs.js';
import { MorphClient } from '../types/stubs.js';
import { logger } from '../utils/logger.js';
import { RootCause } from '../workflows/self-healing-workflow.js';

export interface ApplyPatchInput {
  repository: string;
  headSha: string;
  branch: string;
  patch: string;
  rootCause: RootCause;
  installationId: number;
}

export interface ApplyPatchResult {
  success: boolean;
  patchSha?: string;
  filesChanged?: string[];
  error?: string;
}

/**
 * Activity to apply patches using Morph API
 */
export async function applyPatch(
  input: ApplyPatchInput
): Promise<ApplyPatchResult> {
  const startTime = Date.now();
  const activityId = log.info('Applying patch', {
    repository: input.repository,
    headSha: input.headSha,
    branch: input.branch,
    rootCause: input.rootCause,
  });

  try {
    // Initialize Morph client
    const morphClient = new MorphClient({
      apiKey: (process.env as any).MORPH_API_KEY || '',
      apiUrl: (process.env as any).MORPH_API_URL || 'https://api.morph.dev',
      timeoutMs: 30000,
      maxRetries: 2,
    });

    // Create patch request
    const patchRequest: PatchRequest = {
      repository: input.repository,
      headSha: input.headSha,
      branch: input.branch,
      patch: input.patch,
      rootCause: input.rootCause,
      installationId: input.installationId,
      maxRetries: 2,
    };

    // Apply patch with Morph
    const morphResult = await morphClient.applyPatch(patchRequest);

    if (!morphResult.success) {
      throw new Error(`Morph patch application failed: ${morphResult.error}`);
    }

    logger.info('Patch applied successfully', {
      activityId,
      repository: input.repository,
      patchSha: morphResult.patchSha,
      filesChanged: morphResult.filesChanged,
      duration: Date.now() - startTime,
    });

    return {
      success: true,
      patchSha: morphResult.patchSha || undefined,
      filesChanged: morphResult.filesChanged || undefined,
    };
  } catch (error) {
    logger.error('Patch application failed', {
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
