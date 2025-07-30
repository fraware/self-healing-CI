import type { WorkflowHandle } from '@temporalio/client';
import { Client, Connection, WorkflowClient } from '@temporalio/client';
import { logger } from '../utils/logger.js';

export interface TemporalConfig {
  namespace?: string;
  taskQueue?: string;
  serverUrl?: string;
  connectionTimeout?: number;
  maxRetries?: number;
}

export interface SelfHealingWorkflowInput {
  repository: string;
  workflowRunId: number;
  headSha: string;
  branch: string;
  actor: string;
  installationId: number;
}

export interface TemporalMetrics {
  connectionStatus: 'connected' | 'disconnected' | 'error';
  workflowsStarted: number;
  workflowsCompleted: number;
  workflowsFailed: number;
  activeWorkflows: number;
  lastError?: string;
}

export class TemporalClient {
  private connection: Connection | null = null;
  private client: Client | null = null;
  private workflowClient: WorkflowClient | null = null;
  private readonly config: Required<TemporalConfig>;
  private metrics: TemporalMetrics;
  private isInitialized = false;

  constructor(config: TemporalConfig = {}) {
    this.config = {
      namespace:
        config.namespace || process.env['TEMPORAL_NAMESPACE'] || 'default',
      taskQueue:
        config.taskQueue ||
        process.env['TEMPORAL_TASK_QUEUE'] ||
        'self-healing-ci',
      serverUrl:
        config.serverUrl ||
        process.env['TEMPORAL_SERVER_URL'] ||
        'localhost:7233',
      connectionTimeout:
        config.connectionTimeout ||
        parseInt(process.env['TEMPORAL_CONNECTION_TIMEOUT'] || '10000', 10),
      maxRetries:
        config.maxRetries ||
        parseInt(process.env['TEMPORAL_MAX_RETRIES'] || '3', 10),
    };

    this.metrics = {
      connectionStatus: 'disconnected',
      workflowsStarted: 0,
      workflowsCompleted: 0,
      workflowsFailed: 0,
      activeWorkflows: 0,
    };
  }

  /**
   * Initialize the Temporal client
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Temporal client', {
        namespace: this.config.namespace,
        taskQueue: this.config.taskQueue,
        serverUrl: this.config.serverUrl,
      });

      // Create connection
      this.connection = await Connection.connect({
        address: this.config.serverUrl,
        tls: process.env['TEMPORAL_TLS_ENABLED'] === 'true' ? true : null,
        connectTimeout: this.config.connectionTimeout,
      });

      // Create client
      this.client = new Client({
        connection: this.connection,
        namespace: this.config.namespace,
      });

      // Create workflow client
      this.workflowClient = this.client.workflow;

      // Test connection
      await this.testConnection();

      this.isInitialized = true;
      this.metrics.connectionStatus = 'connected';

      logger.info('Temporal client initialized successfully');
    } catch (error) {
      this.metrics.connectionStatus = 'error';
      this.metrics.lastError =
        error instanceof Error ? error.message : 'Unknown error';

      logger.error('Failed to initialize Temporal client', { error });
      throw new Error(
        `Temporal client initialization failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Test the Temporal connection
   */
  private async testConnection(): Promise<void> {
    if (!this.client) {
      throw new Error('Temporal client not initialized');
    }

    try {
      // Test connection by listing workflows (empty result is fine)
      await this.client.workflow.list({
        query: 'WorkflowType="SelfHealingWorkflow"',
        pageSize: 1,
      });

      logger.info('Temporal connection test successful');
    } catch (error) {
      logger.error('Temporal connection test failed', { error });
      throw error;
    }
  }

  /**
   * Start a self-healing workflow
   */
  async startSelfHealingWorkflow(
    input: SelfHealingWorkflowInput
  ): Promise<WorkflowHandle> {
    if (!this.workflowClient) {
      throw new Error('Temporal workflow client not initialized');
    }

    try {
      const workflowId = `self-healing-${input.repository}-${input.workflowRunId}`;

      logger.info('Starting self-healing workflow', {
        workflowId,
        repository: input.repository,
        workflowRunId: input.workflowRunId,
        headSha: input.headSha,
      });

      const handle = await this.workflowClient.start('SelfHealingWorkflow', {
        taskQueue: this.config.taskQueue,
        workflowId,
        args: [input],
        retry: {
          initialInterval: '1s',
          maximumInterval: '1m',
          maximumAttempts: 3,
          backoffCoefficient: 2,
        },
      });

      this.metrics.workflowsStarted++;
      this.metrics.activeWorkflows++;

      logger.info('Self-healing workflow started successfully', {
        workflowId,
        runId: handle.firstExecutionRunId,
      });

      return handle;
    } catch (error) {
      this.metrics.workflowsFailed++;
      this.metrics.lastError =
        error instanceof Error ? error.message : 'Unknown error';

      logger.error('Failed to start self-healing workflow', {
        error: error instanceof Error ? error.message : 'Unknown error',
        repository: input.repository,
        workflowRunId: input.workflowRunId,
      });
      throw error;
    }
  }

  /**
   * Get workflow status
   */
  async getWorkflowStatus(workflowId: string): Promise<{
    status: string;
    result?: unknown;
    error?: string;
  }> {
    if (!this.workflowClient) {
      throw new Error('Temporal workflow client not initialized');
    }

    try {
      const handle = this.workflowClient.getHandle(workflowId);
      const status = await handle.describe();

      const result: {
        status: string;
        result?: unknown;
        error?: string;
      } = {
        status: status.status.name,
      };

      if (status.status.name === 'COMPLETED') {
        result.result = await handle.result();
      } else if (status.status.name === 'FAILED') {
        result.error = 'Workflow failed';
      }

      return result;
    } catch (error) {
      logger.error('Failed to get workflow status', {
        error: error instanceof Error ? error.message : 'Unknown error',
        workflowId,
      });
      throw error;
    }
  }

  /**
   * Cancel a workflow
   */
  async cancelWorkflow(workflowId: string, reason?: string): Promise<void> {
    if (!this.workflowClient) {
      throw new Error('Temporal workflow client not initialized');
    }

    try {
      const handle = this.workflowClient.getHandle(workflowId);
      await handle.cancel();

      logger.info('Workflow cancelled successfully', {
        workflowId,
        reason,
      });
    } catch (error) {
      logger.error('Failed to cancel workflow', {
        error: error instanceof Error ? error.message : 'Unknown error',
        workflowId,
        reason,
      });
      throw error;
    }
  }

  /**
   * Terminate a workflow
   */
  async terminateWorkflow(workflowId: string, reason?: string): Promise<void> {
    if (!this.workflowClient) {
      throw new Error('Temporal workflow client not initialized');
    }

    try {
      const handle = this.workflowClient.getHandle(workflowId);
      await handle.terminate(reason);

      logger.info('Workflow terminated successfully', {
        workflowId,
        reason,
      });
    } catch (error) {
      logger.error('Failed to terminate workflow', {
        error: error instanceof Error ? error.message : 'Unknown error',
        workflowId,
        reason,
      });
      throw error;
    }
  }

  /**
   * List active workflows
   */
  async listActiveWorkflows(): Promise<
    Array<{
      workflowId: string;
      runId: string;
      status: string;
      startTime: Date;
    }>
  > {
    if (!this.client) {
      throw new Error('Temporal client not initialized');
    }

    try {
      const workflows = await this.client.workflow.list({
        query:
          'WorkflowType="SelfHealingWorkflow" AND ExecutionStatus="RUNNING"',
        pageSize: 100,
      });

      const results: Array<{
        workflowId: string;
        runId: string;
        status: string;
        startTime: Date;
      }> = [];

      for await (const execution of workflows) {
        results.push({
          workflowId: execution.workflowId,
          runId: execution.runId,
          status: execution.status.name,
          startTime: execution.startTime,
        });
      }

      return results;
    } catch (error) {
      logger.error('Failed to list active workflows', { error });
      throw error;
    }
  }

  /**
   * Get workflow metrics
   */
  async getWorkflowMetrics(): Promise<{
    totalWorkflows: number;
    completedWorkflows: number;
    failedWorkflows: number;
    activeWorkflows: number;
    averageDuration: number;
  }> {
    if (!this.client) {
      throw new Error('Temporal client not initialized');
    }

    try {
      const workflows = await this.client.workflow.list({
        query: 'WorkflowType="SelfHealingWorkflow"',
        pageSize: 1000,
      });

      const workflowsArray: any[] = [];
      for await (const workflow of workflows) {
        workflowsArray.push(workflow);
      }

      const totalWorkflows = workflowsArray.length;
      const completedWorkflows = workflowsArray.filter(
        (w: any) => w.status.name === 'COMPLETED'
      ).length;
      const failedWorkflows = workflowsArray.filter(
        (w: any) => w.status.name === 'FAILED'
      ).length;
      const activeWorkflows = workflowsArray.filter(
        (w: any) => w.status.name === 'RUNNING'
      ).length;

      // Calculate average duration for completed workflows
      const completedDurations = workflowsArray
        .filter(
          (w: any) =>
            w.status.name === 'COMPLETED' && w.closeTime && w.startTime
        )
        .map((w: any) => w.closeTime!.getTime() - w.startTime.getTime());

      const averageDuration =
        completedDurations.length > 0
          ? completedDurations.reduce(
              (sum: number, duration: number) => sum + duration,
              0
            ) / completedDurations.length
          : 0;

      return {
        totalWorkflows,
        completedWorkflows,
        failedWorkflows,
        activeWorkflows,
        averageDuration,
      };
    } catch (error) {
      logger.error('Failed to get workflow metrics', { error });
      throw error;
    }
  }

  /**
   * Health check for the Temporal client
   */
  async isHealthy(): Promise<boolean> {
    try {
      if (!this.isInitialized || !this.client) {
        return false;
      }

      await this.testConnection();
      return true;
    } catch (error) {
      logger.warn('Temporal health check failed', { error });
      return false;
    }
  }

  /**
   * Check if the client is ready
   */
  async isReady(): Promise<boolean> {
    return (
      this.isInitialized && this.connection !== null && this.client !== null
    );
  }

  /**
   * Get client metrics
   */
  async getMetrics(): Promise<TemporalMetrics> {
    // Update active workflows count
    try {
      const activeWorkflows = await this.listActiveWorkflows();
      this.metrics.activeWorkflows = activeWorkflows.length;
    } catch (error) {
      logger.warn('Failed to update active workflows count', { error });
    }

    return { ...this.metrics };
  }

  /**
   * Close the Temporal client
   */
  async close(): Promise<void> {
    try {
      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }

      this.client = null;
      this.workflowClient = null;
      this.isInitialized = false;
      this.metrics.connectionStatus = 'disconnected';

      logger.info('Temporal client closed successfully');
    } catch (error) {
      logger.error('Error closing Temporal client', { error });
      throw error;
    }
  }
}

// Export singleton instance
export const temporalClient = new TemporalClient();
