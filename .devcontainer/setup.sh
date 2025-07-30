#!/bin/bash

set -e

echo "🚀 Setting up Self-Healing CI development environment..."

# Update package lists
sudo apt-get update

# Install system dependencies
sudo apt-get install -y \
    curl \
    wget \
    git \
    build-essential \
    pkg-config \
    libssl-dev \
    libffi-dev \
    python3-dev \
    python3-pip \
    python3-venv \
    ca-certificates \
    gnupg \
    lsb-release \
    software-properties-common \
    apt-transport-https \
    unzip \
    jq \
    tree \
    htop \
    vim \
    nano

# Install pnpm
curl -fsSL https://get.pnpm.io/install.sh | sh -
export PNPM_HOME="/home/vscode/.local/share/pnpm"
export PATH="$PNPM_HOME:$PATH"

# Install Lean 4
curl -fsSL https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh | sh -s -- -y
source ~/.profile

# Install additional Python packages
pip3 install --user \
    black \
    flake8 \
    mypy \
    pytest \
    pytest-cov \
    pytest-asyncio \
    pre-commit \
    safety \
    bandit

# Install additional Node.js tools
npm install -g \
    @typescript-eslint/eslint-plugin \
    @typescript-eslint/parser \
    eslint \
    prettier \
    typescript \
    ts-node \
    nodemon \
    concurrently

# Install Rust tools
rustup component add \
    rustfmt \
    clippy \
    rust-src \
    rust-analysis

# Install cargo tools
cargo install \
    cargo-audit \
    cargo-tarpaulin \
    cargo-fuzz \
    cargo-watch \
    cargo-edit \
    cargo-outdated

# Install additional development tools
curl -sSf https://astral.sh/uv/install.sh | sh

# Create cache directory
mkdir -p /home/vscode/.cache

# Set up git configuration
git config --global init.defaultBranch main
git config --global pull.rebase false

# Create workspace directories
mkdir -p apps packages rust lean docs

echo "✅ Development environment setup complete!"
echo ""
echo "📋 Available tools:"
echo "  - Node.js $(node --version)"
echo "  - pnpm $(pnpm --version)"
echo "  - Rust $(rustc --version)"
echo "  - Python $(python3 --version)"
echo "  - Lean $(lean --version)"
echo "  - Docker $(docker --version)"
echo ""
echo "🚀 Ready to start developing!" 