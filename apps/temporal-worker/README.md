# Temporal Worker

This is the Temporal worker for the Self-Healing CI system. It orchestrates workflows that automatically diagnose, patch, test, and merge fixes for CI failures.

## Features

- **Failure Diagnosis**: Uses Claude AI to analyze CI failures and identify root causes
- **Automated Patching**: Applies fixes using Morph API
- **Test Execution**: Runs tests using Freestyle API
- **Proof Validation**: Validates formal proofs using Lean 4
- **Auto-Merge**: Automatically merges successful fixes
- **Monitoring**: Comprehensive metrics and alerting

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file with your configuration:

   ```bash
   cp .env.example .env
   ```

3. Configure the following environment variables:
   - `TEMPORAL_TASK_QUEUE`: Task queue name (default: self-healing-ci)
   - `TEMPORAL_NAMESPACE`: Temporal namespace (default: default)
   - `MORPH_API_KEY`: API key for Morph code patching service
   - `FREESTYLE_API_KEY`: API key for Freestyle testing service
   - `LEAN_API_KEY`: API key for Lean 4 proof validation
   - `OPSGENIE_API_KEY`: API key for alerting (optional)

## Development

```bash
# Build the project
npm run build

# Run in development mode with hot reload
npm run dev

# Run tests
npm test

# Type check
npm run type-check
```

## Architecture

The worker consists of several key components:

### Activities

- `diagnose-failure`: Analyzes CI failures using Claude AI
- `apply-patch`: Applies code patches using Morph API
- `run-tests`: Executes tests using Freestyle API
- `validate-proofs`: Validates formal proofs using Lean 4
- `merge-changes`: Merges successful fixes
- `emit-cloud-event`: Emits events for monitoring

### Workflows

- `SelfHealingWorkflow`: Main orchestration workflow

### Services

- `alerting`: Handles alerting and SLO violations
- `metrics`: Collects and exports Prometheus metrics
- `tracing`: Distributed tracing with Jaeger
- `workflow-state-store`: State persistence for deterministic replay

## Monitoring

The worker exposes several endpoints:

- `/health`: Health check
- `/ready`: Readiness check
- `/metrics`: Prometheus metrics
- `/alerts/stats`: Alert statistics
- `/alerts/active`: Active alerts

## Deployment

The worker is designed to be deployed as a container with:

- Temporal Server connection
- Redis for state storage
- Jaeger for tracing
- Prometheus for metrics

## Error Handling

The worker includes comprehensive error handling:

- Automatic retries with exponential backoff
- Circuit breakers for external API calls
- Graceful degradation when services are unavailable
- Detailed logging and tracing

## Testing

The worker includes unit tests and integration tests:

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage
```

## Contributing

1. Follow the project's coding standards
2. Add tests for new features
3. Update documentation
4. Ensure all checks pass before submitting PRs
