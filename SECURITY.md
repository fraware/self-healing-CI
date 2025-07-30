# Security Policy

## Reporting a Vulnerability

We take the security of Self-Healing CI seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### Reporting Process

1. **DO NOT** create a public GitHub issue for the vulnerability.
2. **DO** email your findings to [security@self-healing-ci.com](mailto:security@self-healing-ci.com).
3. **DO** include a detailed description of the vulnerability, including:
   - Type of vulnerability (e.g., XSS, CSRF, SQL injection, etc.)
   - Steps to reproduce the issue
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- You will receive an acknowledgment within 48 hours
- We will investigate and provide updates on our progress
- We will work with you to understand and address the issue
- Once fixed, we will credit you in our security advisories (unless you prefer to remain anonymous)

### Responsible Disclosure Timeline

- **Day 0**: Vulnerability reported
- **Day 1**: Acknowledgment and initial assessment
- **Day 7**: Status update and timeline
- **Day 30**: Target fix date
- **Day 45**: Public disclosure (if not fixed)

### Scope

This security policy applies to:

- All code in the Self-Healing CI repository
- All dependencies and third-party integrations
- All deployment environments
- All API endpoints and services

### Security Features

Our system includes several security measures:

- **OIDC-backed secrets**: Short-lived tokens instead of long-lived PATs
- **Sandboxed LLM calls**: Policy-enforced egress proxy for Claude API
- **Supply chain attestation**: SLSA v1 provenance and cosign signatures
- **Static analysis**: Automated security scanning with semgrep
- **Differential fuzzing**: Automated vulnerability detection
- **Audit logging**: Full prompt/response logging (PII redacted)

### Security Best Practices

When contributing to this project:

1. Follow secure coding practices
2. Never commit secrets or sensitive data
3. Use dependency scanning tools
4. Implement proper input validation
5. Follow the principle of least privilege
6. Use HTTPS for all external communications
7. Implement proper error handling without information disclosure

### Bug Bounty

We currently do not offer a formal bug bounty program, but we do appreciate and acknowledge security researchers who help improve our security posture.

### Compliance

This project aims to comply with:

- SOC 2 Type II controls
- OWASP Top 10
- NIST Cybersecurity Framework
- GDPR requirements (where applicable)

### Updates

This security policy is reviewed and updated quarterly. Last updated: December 2024.
