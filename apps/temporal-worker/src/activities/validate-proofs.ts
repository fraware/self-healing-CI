import { log } from '@temporalio/activity';
import type { ValidateProofsRequest } from '../types/stubs.js';
import { LeanClient } from '../types/stubs.js';
import { logger } from '../utils/logger.js';

export interface ValidateProofsInput {
  repository: string;
  headSha: string;
  branch: string;
  proofFiles: string[];
}

export interface ValidateProofsOutput {
  success: boolean;
  validatedProofs: number;
  totalProofs: number;
  errors: string[];
  error: string | undefined;
}

/**
 * Activity to validate formal proofs using Lean 4
 */
export async function validateProofs(
  input: ValidateProofsInput
): Promise<ValidateProofsOutput> {
  const startTime = Date.now();
  const activityId = log.info('Validating proofs', {
    repository: input.repository,
    headSha: input.headSha,
    branch: input.branch,
    proofFiles: input.proofFiles,
  });

  try {
    // Initialize Lean client
    const leanClient = new LeanClient({
      apiKey: (process.env as any).LEAN_API_KEY || '',
      apiUrl: (process.env as any).LEAN_API_URL || 'https://api.lean.dev',
      timeoutMs: 60000, // 1 minute timeout
      maxRetries: 2,
    });

    // Create validation request
    const validationRequest: ValidateProofsRequest = {
      repository: input.repository,
      headSha: input.headSha,
      branch: input.branch,
      proofFiles: input.proofFiles,
    };

    // Validate proofs with Lean
    const validationResult = await leanClient.validateProofs(validationRequest);

    logger.info('Proof validation completed', {
      activityId,
      repository: input.repository,
      success: validationResult.success,
      validatedProofs: validationResult.validatedProofs,
      totalProofs: validationResult.totalProofs,
      duration: Date.now() - startTime,
    });

    return {
      success: validationResult.success,
      validatedProofs: validationResult.validatedProofs,
      totalProofs: validationResult.totalProofs,
      errors: validationResult.errors,
      error: undefined,
    };
  } catch (error) {
    logger.error('Proof validation failed', {
      activityId,
      repository: input.repository,
      headSha: input.headSha,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    });

    return {
      success: false,
      validatedProofs: 0,
      totalProofs: input.proofFiles.length,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
