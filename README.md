# Self-Healing CI System

A state-of-the-art Continuous Integration system that automatically diagnoses, patches, and validates code issues using AI-powered analysis and formal verification.

## Architecture

```
GitHub App → Temporal → Claude/Morph/Freestyle/Lean → GitHub Merge
     ↓           ↓              ↓
  Webhooks   Workflows    AI Services
     ↓           ↓              ↓
  Event Bus   Activities   Validation
     ↓           ↓              ↓
  Diagnosis   Patching    Proofs
     ↓           ↓              ↓
  Auto-Merge  Monitoring  Assurance
```

## Services

### Core Services

- **GitHub App**: Webhook listener and event processing
- **Temporal Worker**: Workflow orchestration and state management

### AI-Powered Services

- **Claude Service**: Enhanced AI diagnosis with streaming and token management
- **Morph Service**: Automated code patching with compilation validation
- **Freestyle Service**: Deterministic test containers with flakiness detection
- **Lean Service**: Formal invariant proofs and theorem validation

### Infrastructure Services

- **Monitoring**: Prometheus, Grafana, Jaeger for observability
- **Security**: OIDC, OPA, cosign for supply chain security
- **Documentation**: Auto-generated runbooks and architecture diagrams

## Installation

### Prerequisites

- Node.js 20+
- Docker with Docker Compose
- Rust toolchain (for Lean 4)
- Python 3.12+ (for static analysis)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/your-org/self-healing-ci.git
cd self-healing-ci

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start development environment
pnpm dev

# Run tests
pnpm test

# Build for production
pnpm build
```

### Environment Variables

```bash
# GitHub App Configuration
GITHUB_APP_ID=your_app_id
GITHUB_APP_PRIVATE_KEY=your_private_key
GITHUB_WEBHOOK_SECRET=your_webhook_secret

# AI Services
ANTHROPIC_API_KEY=your_claude_api_key
MORPH_API_KEY=your_morph_api_key
MORPH_API_URL=https://api.morph.dev

# Infrastructure
TEMPORAL_SERVER_URL=temporal:7233
REDIS_URL=redis://localhost:6379
DOCKER_SOCKET=/var/run/docker.sock

# Security
OIDC_PROVIDER_URL=your_oidc_provider
OIDC_CLIENT_ID=your_client_id
OIDC_CLIENT_SECRET=your_client_secret

# Monitoring
PROMETHEUS_URL=http://localhost:9090
GRAFANA_URL=http://localhost:3000
JAEGER_URL=http://localhost:16686
```

## Development

### Project Structure

```
self-healing-ci/
├── apps/
│   ├── github-app/          # GitHub App webhook handler
│   └── temporal-worker/     # Workflow orchestration
├── services/
│   ├── claude/             # Enhanced AI diagnosis
│   ├── morph/              # Code patching service
│   ├── freestyle/          # Test container service
│   └── lean/               # Formal verification
├── docs/                   # Documentation
├── scripts/                # Utility scripts
└── tests/                  # Test suites
```

### Development Commands

```bash
# Start all services
pnpm dev

# Run specific service
pnpm dev:github-app
pnpm dev:temporal-worker

# Run tests
pnpm test
pnpm test:coverage

# Lint and format
pnpm lint
pnpm format

# Type checking
pnpm type-check

# Build all packages
pnpm build
```

### Testing

```bash
# Unit tests
pnpm test:unit

# Integration tests
pnpm test:integration

# End-to-end tests
pnpm test:e2e

# Proof validation
pnpm proofs:validate

# Security scans
pnpm security:scan
```

## Monitoring

### Metrics

- **MTTR (Mean Time To Recovery)**: Target ≤ 5min p95
- **Diagnosis Accuracy**: Target ≥ 95%
- **Proof Success Rate**: Target ≥ 95%
- **Patch Success Rate**: Target ≥ 90%

### Dashboards

- **Operational Dashboard**: Real-time system health and performance
- **Security Dashboard**: Vulnerability tracking and compliance status
- **Quality Dashboard**: Test results and proof validation metrics

### Alerts

- **Critical**: MTTR > 10min, proof failure rate > 5%
- **Warning**: Diagnosis accuracy < 95%, patch success rate < 90%
- **Info**: New vulnerability detected, security scan completed

## Security

### Authentication

- **OIDC Integration**: Short-lived tokens for all external services
- **GitHub App**: Signed commits and verified merges
- **Service Mesh**: mTLS between all internal services

### Authorization

- **RBAC**: Role-based access control for all operations
- **Policy Engine**: OPA for fine-grained policy enforcement
- **Audit Logging**: Complete audit trail for all actions

### Supply Chain Security

- **SLSA v1**: Full provenance tracking
- **Cosign**: Image signing and verification
- **SBOM**: Software bill of materials for all dependencies

## Documentation

### Runbooks

- [How to triage when agent loops](docs/runbooks/agent-loops.md)
- [Escalate Claude hallucination](docs/runbooks/claude-hallucination.md)
- [Rotate Morph credentials](docs/runbooks/rotate-credentials.md)

### Architecture

- [System Architecture](docs/architecture/system.md)
- [Data Flow](docs/architecture/data-flow.md)
- [Security Model](docs/architecture/security.md)

### API Reference

- [GitHub App API](docs/api/github-app.md)
- [Temporal Workflows](docs/api/temporal.md)
- [AI Services API](docs/api/ai-services.md)

## Contributing

### Development Workflow

1. Create feature branch: `git checkout -b feat/your-feature`
2. Make changes and commit: `git commit -m 'feat: your feature'`
3. Push and create PR: `git push origin feat/your-feature`
4. Run tests: `pnpm test`
5. Validate: `pnpm validate`

### Code Quality

- **TypeScript**: Strict type checking enabled
- **ESLint**: Comprehensive linting rules
- **Prettier**: Consistent code formatting
- **Husky**: Pre-commit hooks for quality gates

### Testing Strategy

- **Unit Tests**: 90%+ coverage required
- **Integration Tests**: All service interactions
- **End-to-End Tests**: Full workflow validation
- **Proof Tests**: Formal verification of critical paths

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **Anthropic**: Claude AI for intelligent diagnosis
- **Morph**: Automated code patching platform
- **Lean 4**: Formal verification framework
- **Temporal**: Workflow orchestration
- **GitHub**: Platform integration and automation

## Support

- **Issues**: [GitHub Issues](https://github.com/your-org/self-healing-ci/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/self-healing-ci/discussions)
- **Documentation**: [Project Wiki](https://github.com/your-org/self-healing-ci/wiki)
- **Security**: [Security Policy](SECURITY.md)
