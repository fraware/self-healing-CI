import { logger } from '../../github-app/src/utils/logger.js';

export interface ClaudeInput {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
}

export interface ClaudeResult {
  response: string;
  tokensUsed: number;
  model: string;
}

/**
 * Service to invoke Claude 3.5 Haiku for diagnosis
 */
export async function invokeClaude(input: ClaudeInput): Promise<ClaudeResult> {
  const startTime = Date.now();
  const maxTokens = input.maxTokens || 16000;

  try {
    logger.info('Invoking Claude for diagnosis', {
      maxTokens,
      systemPromptLength: input.systemPrompt.length,
      userPromptLength: input.userPrompt.length,
    });

    // TODO: Implement actual Claude API integration
    // This will include:
    // - Token budgeting (16k max)
    // - Streaming partials
    // - Exponential backoff retries
    // - Rate limiting
    // - Error handling

    // For now, return a stub response
    const stubResponse = {
      rootCause: 'CONFIG_ERROR',
      confidence: 85,
      patch: `diff --git a/src/app.ts b/src/app.ts
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
   }
   
   isReady(): boolean {
-    return this.config.port > 0;
+    return this.config.port > 0 && this.config.host !== undefined;
   }`,
      explanation: `The test failure is caused by a configuration issue where the host parameter is not properly validated. The test expects the app to be ready when initialized, but the isReady() method only checks if the port is greater than 0. It should also validate that the host parameter is properly set.

The fix involves:
1. Updating the default host from 'localhost' to '0.0.0.0' for better compatibility
2. Adding host validation to the isReady() method to ensure proper initialization

This is a CONFIG_ERROR with 85% confidence as it's a clear configuration validation issue.`,
    };

    const result: ClaudeResult = {
      response: JSON.stringify(stubResponse, null, 2),
      tokensUsed: 1500, // Estimated token usage
      model: 'claude-3-5-haiku-20241022',
    };

    logger.info('Claude diagnosis completed', {
      tokensUsed: result.tokensUsed,
      responseLength: result.response.length,
      duration: Date.now() - startTime,
    });

    return result;
  } catch (error) {
    logger.error('Claude invocation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    });

    // Return fallback response
    return {
      response: JSON.stringify({
        rootCause: 'UNKNOWN',
        confidence: 0,
        explanation: 'Failed to get AI diagnosis due to technical error',
      }),
      tokensUsed: 0,
      model: 'claude-3-5-haiku-20241022',
    };
  }
}
