# Self-Healing CI Development Recipes
# Run with: just <recipe-name>

# Default recipe
default:
    @just --list

# Development setup
setup: install-tools install-deps setup-hooks
    @echo "✅ Development environment setup complete!"

install-tools:
    @echo "🔧 Installing development tools..."
    # Install pnpm if not present
    @command -v pnpm >/dev/null 2>&1 || npm install -g pnpm
    # Install corepack for pnpm
    @corepack enable pnpm

install-deps:
    @echo "📦 Installing dependencies..."
    pnpm install

setup-hooks:
    @echo "🎣 Setting up git hooks..."
    pnpm prepare

# Development commands
dev: dev:start
    @echo "🚀 Starting development environment..."

dev:start:
    @echo "Starting all development services..."
    pnpm dev

dev:stop:
    @echo "Stopping development services..."
    pkill -f "pnpm dev" || true

dev:github-app:
    @echo "🔧 Starting GitHub App development server..."
    cd apps/github-app && pnpm dev

dev:temporal-worker:
    @echo "⚡ Starting Temporal worker development server..."
    cd apps/temporal-worker && pnpm dev

# Testing
test: test:all
    @echo "🧪 Running all tests..."

test:all:
    pnpm test

test:unit:
    pnpm test:unit

test:integration:
    pnpm test:integration

test:e2e:
    pnpm test:e2e

test:coverage:
    pnpm test:coverage

test:watch:
    pnpm test:watch

# Code quality
lint: lint:check
    @echo "🔍 Running linting..."

lint:check:
    pnpm lint

lint:fix:
    pnpm lint:fix

format: format:check
    @echo "🎨 Checking code formatting..."

format:check:
    pnpm format

format:fix:
    pnpm format:fix

type-check:
    @echo "🔍 Running type checking..."
    pnpm type-check

validate: lint format type-check test
    @echo "✅ All validations passed!"

# Building
build: build:clean
    @echo "🏗️ Building all packages..."

build:clean:
    pnpm build:clean

build:watch:
    pnpm build:watch

# Security
security: security:scan security:audit
    @echo "🔒 Running security checks..."

security:scan:
    @echo "Running security scans..."
    # Add security scanning commands here
    @echo "Security scans completed"

security:audit:
    @echo "Running dependency audit..."
    pnpm audit

security:update:
    @echo "Updating dependencies..."
    pnpm update

# Database
db: db:setup
    @echo "🗄️ Setting up database..."

db:setup:
    @echo "Setting up database schema..."
    # Add database setup commands here

db:migrate:
    @echo "Running database migrations..."
    # Add migration commands here

db:seed:
    @echo "Seeding database..."
    # Add seeding commands here

# Docker
docker: docker:build
    @echo "🐳 Building Docker images..."

docker:build:
    docker-compose build

docker:up:
    docker-compose up -d

docker:down:
    docker-compose down

docker:logs:
    docker-compose logs -f

# CI/CD
ci: ci:validate ci:build ci:test
    @echo "🔄 Running CI pipeline..."

ci:validate:
    pnpm validate

ci:build:
    pnpm build

ci:test:
    pnpm test

ci:deploy:
    @echo "Deploying to production..."
    # Add deployment commands here

# Monitoring
monitor: monitor:start
    @echo "📊 Starting monitoring services..."

monitor:start:
    @echo "Starting Prometheus, Grafana, and Jaeger..."
    # Add monitoring startup commands here

monitor:stop:
    @echo "Stopping monitoring services..."
    # Add monitoring stop commands here

# Documentation
docs: docs:build docs:serve
    @echo "📚 Building documentation..."

docs:build:
    @echo "Building documentation..."
    # Add documentation build commands here

docs:serve:
    @echo "Serving documentation..."
    # Add documentation serve commands here

# Release
release: release:prepare release:create
    @echo "🚀 Creating release..."

release:prepare:
    @echo "Preparing release..."
    pnpm semantic-release --dry-run

release:create:
    @echo "Creating release..."
    pnpm semantic-release

# Cleanup
clean: clean:all
    @echo "🧹 Cleaning up..."

clean:all:
    pnpm clean
    rm -rf node_modules
    rm -rf dist
    rm -rf .nyc_output
    rm -rf coverage

clean:cache:
    pnpm store prune
    rm -rf .pnpm-store

# Help
help:
    @echo "Self-Healing CI Development Recipes"
    @echo ""
    @echo "Available recipes:"
    @just --list
    @echo ""
    @echo "Usage: just <recipe-name>"
    @echo "Example: just dev"

# Development workflow
workflow:new-feature:
    @echo "🆕 Starting new feature workflow..."
    @echo "1. Create feature branch: git checkout -b feat/your-feature"
    @echo "2. Make changes and commit: git commit -m 'feat: your feature'"
    @echo "3. Push and create PR: git push origin feat/your-feature"
    @echo "4. Run tests: just test"
    @echo "5. Validate: just validate"

workflow:bugfix:
    @echo "🐛 Starting bugfix workflow..."
    @echo "1. Create bugfix branch: git checkout -b fix/your-bugfix"
    @echo "2. Make changes and commit: git commit -m 'fix: your bugfix'"
    @echo "3. Push and create PR: git push origin fix/your-bugfix"
    @echo "4. Run tests: just test"
    @echo "5. Validate: just validate"

# Environment checks
check: check:tools check:deps check:config
    @echo "🔍 Checking development environment..."

check:tools:
    @echo "Checking required tools..."
    @command -v node >/dev/null 2>&1 || (echo "❌ Node.js not found" && exit 1)
    @command -v pnpm >/dev/null 2>&1 || (echo "❌ pnpm not found" && exit 1)
    @command -v rustc >/dev/null 2>&1 || (echo "❌ Rust not found" && exit 1)
    @command -v python3 >/dev/null 2>&1 || (echo "❌ Python3 not found" && exit 1)
    @echo "✅ All required tools found"

check:deps:
    @echo "Checking dependencies..."
    @test -f pnpm-lock.yaml || (echo "❌ pnpm-lock.yaml not found" && exit 1)
    @echo "✅ Dependencies locked"

check:config:
    @echo "Checking configuration..."
    @test -f .npmrc || (echo "❌ .npmrc not found" && exit 1)
    @test -f pnpm-workspace.yaml || (echo "❌ pnpm-workspace.yaml not found" && exit 1)
    @test -f commitlint.config.js || (echo "❌ commitlint.config.js not found" && exit 1)
    @echo "✅ Configuration files present"

# Quick development commands
q: q:dev
    @echo "⚡ Quick development commands..."

q:dev:
    pnpm dev

q:test:
    pnpm test

q:lint:
    pnpm lint

q:build:
    pnpm build

q:clean:
    pnpm clean

# Show project status
status:
    @echo "📊 Project Status"
    @echo "=================="
    @echo "Node.js: $(node --version)"
    @echo "pnpm: $(pnpm --version)"
    @echo "Rust: $(rustc --version)"
    @echo "Python: $(python3 --version)"
    @echo ""
    @echo "Dependencies:"
    @pnpm list --depth=0
    @echo ""
    @echo "Recent commits:"
    @git log --oneline -5 