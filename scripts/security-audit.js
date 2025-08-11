#!/usr/bin/env node

/**
 * Security Audit Script for Self-Healing CI
 *
 * This script performs automated security checks including:
 * - Dependency vulnerability scanning
 * - Environment variable validation
 * - File permission checks
 * - Configuration security validation
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class SecurityAuditor {
  constructor() {
    this.issues = [];
    this.warnings = [];
    this.passed = [];
  }

  /**
   * Run all security checks
   */
  async runAudit() {
    console.log('🔒 Starting Security Audit for Self-Healing CI...\n');

    try {
      // Check dependencies
      this.checkDependencies();

      // Check environment configuration
      this.checkEnvironmentConfig();

      // Check file permissions
      this.checkFilePermissions();

      // Check configuration files
      this.checkConfigurationFiles();

      // Check for secrets in code
      this.checkForSecrets();

      // Check SSL/TLS configuration
      this.checkSSLConfiguration();

      // Generate report
      this.generateReport();
    } catch (error) {
      console.error('❌ Security audit failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Check for vulnerable dependencies
   */
  checkDependencies() {
    console.log('📦 Checking dependencies for vulnerabilities...');

    try {
      // Check if pnpm audit is available
      const result = execSync('pnpm audit', {
        encoding: 'utf8',
        stdio: 'pipe',
      });

      if (result.includes('No known vulnerabilities found')) {
        this.passed.push('✅ No vulnerabilities found in dependencies');
      } else if (result.includes('found 0 vulnerabilities')) {
        this.passed.push(
          '✅ No critical vulnerabilities found in dependencies'
        );
      } else {
        this.issues.push(
          '❌ Vulnerable dependencies detected. Run "pnpm audit" for details.'
        );
      }
    } catch (error) {
      this.warnings.push(
        '⚠️  Could not run dependency audit. Ensure pnpm is installed.'
      );
    }
  }

  /**
   * Check environment configuration
   */
  checkEnvironmentConfig() {
    console.log('🔐 Checking environment configuration...');

    const envFile = path.join(process.cwd(), '.env');
    const envExample = path.join(process.cwd(), 'env.example');

    // Check if .env file exists and is not committed
    if (fs.existsSync(envFile)) {
      const gitStatus = execSync('git status --porcelain .env', {
        encoding: 'utf8',
      });
      if (gitStatus.includes('.env')) {
        this.issues.push(
          '❌ .env file is tracked in git. Remove it and add to .gitignore.'
        );
      } else {
        this.passed.push('✅ .env file exists and is not tracked in git');
      }
    } else {
      this.warnings.push(
        '⚠️  .env file not found. Create one based on env.example'
      );
    }

    // Check env.example
    if (fs.existsSync(envExample)) {
      const content = fs.readFileSync(envExample, 'utf8');
      if (content.includes('your_') || content.includes('example_')) {
        this.passed.push('✅ env.example uses placeholder values');
      } else {
        this.issues.push(
          '❌ env.example contains actual values instead of placeholders'
        );
      }
    }
  }

  /**
   * Check file permissions
   */
  checkFilePermissions() {
    console.log('📁 Checking file permissions...');

    const criticalFiles = ['.env', 'package.json', 'pnpm-lock.yaml'];

    criticalFiles.forEach(file => {
      const filePath = path.join(process.cwd(), file);
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        const mode = stats.mode & parseInt('777', 8);

        if (mode > parseInt('644', 8)) {
          this.warnings.push(
            `⚠️  ${file} has overly permissive permissions: ${mode.toString(8)}`
          );
        } else {
          this.passed.push(
            `✅ ${file} has appropriate permissions: ${mode.toString(8)}`
          );
        }
      }
    });
  }

  /**
   * Check configuration files
   */
  checkConfigurationFiles() {
    console.log('⚙️  Checking configuration files...');

    // Check package.json for security scripts
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const scripts = packageJson.scripts || {};

    if (scripts['security:audit']) {
      this.passed.push('✅ Security audit script found in package.json');
    } else {
      this.warnings.push('⚠️  No security audit script found in package.json');
    }

    // Check for security-related dependencies
    const devDependencies = packageJson.devDependencies || {};
    const hasSecurityTools = Object.keys(devDependencies).some(
      dep =>
        dep.includes('security') ||
        dep.includes('audit') ||
        dep.includes('lint')
    );

    if (hasSecurityTools) {
      this.passed.push('✅ Security-related development dependencies found');
    } else {
      this.warnings.push(
        '⚠️  No security-related development dependencies found'
      );
    }
  }

  /**
   * Check for secrets in code
   */
  checkForSecrets() {
    console.log('🔍 Checking for secrets in code...');

    const patterns = [
      /password\s*=\s*['"][^'"]+['"]/gi,
      /api_key\s*=\s*['"][^'"]+['"]/gi,
      /secret\s*=\s*['"][^'"]+['"]/gi,
      /token\s*=\s*['"][^'"]+['"]/gi,
      /private_key\s*=\s*['"][^'"]+['"]/gi,
    ];

    const sourceFiles = this.findSourceFiles();
    let secretsFound = false;

    sourceFiles.forEach(file => {
      try {
        const content = fs.readFileSync(file, 'utf8');
        patterns.forEach(pattern => {
          if (pattern.test(content)) {
            this.issues.push(`❌ Potential secret found in ${file}`);
            secretsFound = true;
          }
        });
      } catch (error) {
        // Skip files that can't be read
      }
    });

    if (!secretsFound) {
      this.passed.push('✅ No obvious secrets found in source code');
    }
  }

  /**
   * Check SSL/TLS configuration
   */
  checkSSLConfiguration() {
    console.log('🔒 Checking SSL/TLS configuration...');

    // Check if HTTPS is configured
    const appFile = path.join(process.cwd(), 'apps/github-app/src/app.ts');
    if (fs.existsSync(appFile)) {
      const content = fs.readFileSync(appFile, 'utf8');
      if (content.includes('https') || content.includes('ssl')) {
        this.passed.push('✅ HTTPS/SSL configuration found');
      } else {
        this.warnings.push('⚠️  No HTTPS/SSL configuration found');
      }
    }
  }

  /**
   * Find source files to scan
   */
  findSourceFiles() {
    const extensions = ['.ts', '.js', '.json', '.yaml', '.yml'];
    const sourceDirs = ['src', 'apps', 'services'];
    const files = [];

    sourceDirs.forEach(dir => {
      if (fs.existsSync(dir)) {
        this.walkDir(dir, extensions, files);
      }
    });

    return files;
  }

  /**
   * Walk directory recursively
   */
  walkDir(dir, extensions, files) {
    const items = fs.readdirSync(dir);

    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (
        stat.isDirectory() &&
        !item.startsWith('.') &&
        item !== 'node_modules'
      ) {
        this.walkDir(fullPath, extensions, files);
      } else if (stat.isFile()) {
        const ext = path.extname(item);
        if (extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    });
  }

  /**
   * Generate security audit report
   */
  generateReport() {
    console.log('\n📊 Security Audit Report');
    console.log('='.repeat(50));

    if (this.passed.length > 0) {
      console.log('\n✅ PASSED CHECKS:');
      this.passed.forEach(check => console.log(`  ${check}`));
    }

    if (this.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      this.warnings.forEach(warning => console.log(`  ${warning}`));
    }

    if (this.issues.length > 0) {
      console.log('\n❌ SECURITY ISSUES:');
      this.issues.forEach(issue => console.log(`  ${issue}`));
    }

    console.log('\n' + '='.repeat(50));

    const totalChecks =
      this.passed.length + this.warnings.length + this.issues.length;
    const score = Math.round((this.passed.length / totalChecks) * 100);

    console.log(`\n🎯 Security Score: ${score}%`);

    if (this.issues.length > 0) {
      console.log(
        '\n🚨 CRITICAL: Security issues found that should be addressed immediately!'
      );
      process.exit(1);
    } else if (this.warnings.length > 0) {
      console.log(
        '\n⚠️  WARNING: Some security warnings found. Consider addressing them.'
      );
      process.exit(0);
    } else {
      console.log('\n🎉 EXCELLENT: All security checks passed!');
      process.exit(0);
    }
  }
}

// Run the security audit
if (require.main === module) {
  const auditor = new SecurityAuditor();
  auditor.runAudit();
}

module.exports = SecurityAuditor;
