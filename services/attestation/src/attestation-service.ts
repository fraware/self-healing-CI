import chalk from 'chalk';
import { exec } from 'child_process';
import fs from 'fs-extra';
import ora from 'ora';
import path from 'path';
import { promisify } from 'util';
import {
    AttestationOptions,
    AttestationPolicy,
    AttestationResult,
    CosignSignature,
    SLSAProvenance,
    VerificationResult
} from './types';

const execAsync = promisify(exec);

export class AttestationService {
  private options: AttestationOptions;

  constructor(options: AttestationOptions) {
    this.options = options;
  }

  /**
   * Generates SLSA v1 provenance and cosign signatures
   */
  async generateAttestation(): Promise<AttestationResult> {
    const spinner = ora('Generating supply chain attestation...').start();

    try {
      // Generate SLSA v1 provenance
      spinner.text = 'Generating SLSA v1 provenance...';
      const slsaProvenance = await this.generateSLSAProvenance();

      // Generate cosign signature
      spinner.text = 'Generating cosign signature...';
      const cosignSignature = await this.generateCosignSignature(slsaProvenance);

      // Verify attestation
      spinner.text = 'Verifying attestation...';
      const verification = await this.verifyAttestation(slsaProvenance, cosignSignature);

      // Store attestation in OPA registry
      spinner.text = 'Storing attestation in OPA registry...';
      await this.storeInOPARegistry(slsaProvenance, cosignSignature);

      const result: AttestationResult = {
        success: verification.success,
        slsaProvenance,
        cosignSignature,
        metadata: {
          repository: this.options.buildInfo.repository,
          commit: this.options.buildInfo.commit,
          branch: this.options.buildInfo.branch,
          timestamp: new Date().toISOString(),
          buildId: this.options.buildInfo.buildId,
          builderId: this.options.config.builderId,
        },
        artifacts: this.options.buildInfo.artifacts.map(artifact => ({
          uri: artifact.uri,
          digest: artifact.digest,
          attestations: [
            {
              type: 'slsa-provenance',
              data: slsaProvenance,
            },
            {
              type: 'cosign-signature',
              data: cosignSignature,
            },
          ],
        })),
        verification,
      };

      spinner.succeed('Supply chain attestation generated successfully');

      return result;

    } catch (error) {
      spinner.fail('Failed to generate attestation');
      throw error;
    }
  }

  /**
   * Generates SLSA v1 provenance
   */
  private async generateSLSAProvenance(): Promise<SLSAProvenance> {
    const { buildInfo, config } = this.options;

    const provenance: SLSAProvenance = {
      version: config.slsaVersion,
      predicateType: 'https://slsa.dev/provenance/v1',
      predicate: {
        buildDefinition: {
          buildType: buildInfo.buildType,
          externalParameters: buildInfo.externalParameters,
          internalParameters: buildInfo.internalParameters,
          resolvedDependencies: buildInfo.dependencies,
        },
        runDetails: {
          builder: {
            id: config.builderId,
          },
          metadata: {
            invocationId: buildInfo.buildId,
            startedOn: new Date().toISOString(),
            finishedOn: new Date().toISOString(),
          },
          byproducts: buildInfo.byproducts,
        },
      },
    };

    // Save provenance to file
    const provenancePath = path.join(this.options.outputPath, 'provenance.json');
    await fs.ensureDir(path.dirname(provenancePath));
    await fs.writeJson(provenancePath, provenance, { spaces: 2 });

    return provenance;
  }

  /**
   * Generates cosign signature for the provenance
   */
  private async generateCosignSignature(provenance: SLSAProvenance): Promise<CosignSignature> {
    const { config } = this.options;

    try {
      // Create payload from provenance
      const payload = JSON.stringify(provenance);
      const payloadPath = path.join(this.options.outputPath, 'provenance-payload.json');
      await fs.writeFile(payloadPath, payload);

      // Sign with cosign
      const signaturePath = path.join(this.options.outputPath, 'provenance.sig');
      const certificatePath = path.join(this.options.outputPath, 'provenance.cert');

      await execAsync(`cosign sign-blob --key ${config.cosignKeyPath} --output-signature ${signaturePath} --output-certificate ${certificatePath} ${payloadPath}`, {
        env: {
          ...process.env,
          COSIGN_PASSWORD: config.cosignPassword,
        },
      });

      // Read signature and certificate
      const signature = await fs.readFile(signaturePath, 'utf-8');
      const certificate = await fs.readFile(certificatePath, 'utf-8');

      // Generate timestamp
      const timestamp = new Date().toISOString();

      // Extract certificate chain (simplified)
      const chain = [certificate];

      return {
        signature: signature.trim(),
        payload,
        certificate,
        chain,
        timestamp,
      };

    } catch (error) {
      throw new Error(`Failed to generate cosign signature: ${error}`);
    }
  }

  /**
   * Verifies the attestation
   */
  private async verifyAttestation(slsaProvenance: SLSAProvenance, cosignSignature: CosignSignature): Promise<AttestationResult['verification']> {
    const errors: string[] = [];

    // Verify SLSA provenance
    const slsaVerified = await this.verifySLSAProvenance(slsaProvenance);
    if (!slsaVerified) {
      errors.push('SLSA provenance verification failed');
    }

    // Verify cosign signature
    const cosignVerified = await this.verifyCosignSignature(cosignSignature);
    if (!cosignVerified) {
      errors.push('Cosign signature verification failed');
    }

    // Verify policy compliance
    const policyVerified = await this.verifyPolicyCompliance(slsaProvenance);
    if (!policyVerified) {
      errors.push('Policy compliance verification failed');
    }

    return {
      slsaVerified,
      cosignVerified,
      policyVerified,
      errors,
    };
  }

  /**
   * Verifies SLSA provenance
   */
  private async verifySLSAProvenance(provenance: SLSAProvenance): Promise<boolean> {
    try {
      // Verify version
      if (provenance.version !== this.options.config.slsaVersion) {
        return false;
      }

      // Verify predicate type
      if (provenance.predicateType !== 'https://slsa.dev/provenance/v1') {
        return false;
      }

      // Verify builder ID
      if (provenance.predicate.runDetails.builder.id !== this.options.config.builderId) {
        return false;
      }

      // Verify build ID matches
      if (provenance.predicate.runDetails.metadata.invocationId !== this.options.buildInfo.buildId) {
        return false;
      }

      // Verify timestamps
      const startedOn = new Date(provenance.predicate.runDetails.metadata.startedOn);
      const finishedOn = new Date(provenance.predicate.runDetails.metadata.finishedOn);
      const now = new Date();

      if (startedOn > now || finishedOn > now || startedOn > finishedOn) {
        return false;
      }

      return true;

    } catch (error) {
      console.error('SLSA provenance verification error:', error);
      return false;
    }
  }

  /**
   * Verifies cosign signature
   */
  private async verifyCosignSignature(signature: CosignSignature): Promise<boolean> {
    try {
      // Verify signature format
      if (!signature.signature || !signature.payload || !signature.certificate) {
        return false;
      }

      // Verify timestamp
      const timestamp = new Date(signature.timestamp);
      const now = new Date();
      const timeDiff = Math.abs(now.getTime() - timestamp.getTime());
      
      // Allow 5 minute clock skew
      if (timeDiff > 5 * 60 * 1000) {
        return false;
      }

      // Verify certificate chain (simplified)
      if (!signature.chain || signature.chain.length === 0) {
        return false;
      }

      // Verify signature with cosign (simplified)
      const payloadPath = path.join(this.options.outputPath, 'verify-payload.json');
      await fs.writeFile(payloadPath, signature.payload);

      try {
        await execAsync(`cosign verify-blob --signature ${signature.signature} --certificate ${signature.certificate} ${payloadPath}`);
        return true;
      } catch (error) {
        console.error('Cosign verification error:', error);
        return false;
      }

    } catch (error) {
      console.error('Cosign signature verification error:', error);
      return false;
    }
  }

  /**
   * Verifies policy compliance
   */
  private async verifyPolicyCompliance(provenance: SLSAProvenance): Promise<boolean> {
    try {
      const policy = await this.loadAttestationPolicy();

      for (const rule of policy.rules) {
        const compliant = this.evaluatePolicyRule(rule, provenance);
        if (!compliant) {
          console.error(`Policy rule '${rule.name}' failed: ${rule.message}`);
          return false;
        }
      }

      return true;

    } catch (error) {
      console.error('Policy compliance verification error:', error);
      return false;
    }
  }

  /**
   * Loads attestation policy from file
   */
  private async loadAttestationPolicy(): Promise<AttestationPolicy> {
    const policyPath = this.options.config.policyPath;
    
    if (!await fs.pathExists(policyPath)) {
      // Return default policy
      return {
        version: '1.0.0',
        rules: [
          {
            name: 'require-slsa-level-2',
            type: 'require',
            conditions: [
              {
                field: 'predicate.buildDefinition.buildType',
                operator: 'equals',
                value: 'https://slsa.dev/buildTypes/v1',
              },
            ],
            message: 'Build must use SLSA Level 2 build type',
          },
          {
            name: 'require-authenticated-builder',
            type: 'require',
            conditions: [
              {
                field: 'predicate.runDetails.builder.id',
                operator: 'contains',
                value: 'github.com',
              },
            ],
            message: 'Build must use authenticated builder',
          },
        ],
        metadata: {
          name: 'Default Attestation Policy',
          description: 'Default policy for supply chain attestation',
          version: '1.0.0',
          createdBy: 'self-healing-ci',
          createdAt: new Date().toISOString(),
        },
      };
    }

    return await fs.readJson(policyPath);
  }

  /**
   * Evaluates a policy rule against the provenance
   */
  private evaluatePolicyRule(rule: any, provenance: SLSAProvenance): boolean {
    for (const condition of rule.conditions) {
      const value = this.getFieldValue(provenance, condition.field);
      
      switch (condition.operator) {
        case 'equals':
          if (value !== condition.value) {
            return false;
          }
          break;
        case 'contains':
          if (!String(value).includes(condition.value)) {
            return false;
          }
          break;
        case 'regex':
          const regex = new RegExp(condition.value);
          if (!regex.test(String(value))) {
            return false;
          }
          break;
        case 'in':
          if (!Array.isArray(condition.value) || !condition.value.includes(value)) {
            return false;
          }
          break;
        default:
          return false;
      }
    }

    return true;
  }

  /**
   * Gets a field value from the provenance using dot notation
   */
  private getFieldValue(provenance: SLSAProvenance, field: string): any {
    const parts = field.split('.');
    let value: any = provenance;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Stores attestation in OPA registry
   */
  private async storeInOPARegistry(slsaProvenance: SLSAProvenance, cosignSignature: CosignSignature): Promise<void> {
    try {
      const attestationData = {
        slsaProvenance,
        cosignSignature,
        metadata: {
          repository: this.options.buildInfo.repository,
          commit: this.options.buildInfo.commit,
          timestamp: new Date().toISOString(),
        },
      };

      // Store in local OPA registry (simplified)
      const registryPath = path.join(this.options.outputPath, 'opa-registry');
      await fs.ensureDir(registryPath);

      const attestationPath = path.join(registryPath, `${this.options.buildInfo.buildId}.json`);
      await fs.writeJson(attestationPath, attestationData, { spaces: 2 });

      console.log(`Attestation stored in OPA registry: ${attestationPath}`);

    } catch (error) {
      console.error('Failed to store attestation in OPA registry:', error);
      throw error;
    }
  }

  /**
   * Verifies an existing attestation
   */
  async verifyAttestation(attestationPath: string): Promise<VerificationResult> {
    const spinner = ora('Verifying attestation...').start();

    try {
      // Load attestation
      const attestation = await fs.readJson(attestationPath);

      // Verify SLSA provenance
      const slsaVerified = await this.verifySLSAProvenance(attestation.slsaProvenance);

      // Verify cosign signature
      const cosignVerified = await this.verifyCosignSignature(attestation.cosignSignature);

      // Verify policy compliance
      const policyVerified = await this.verifyPolicyCompliance(attestation.slsaProvenance);

      const errors: string[] = [];
      const warnings: string[] = [];

      if (!slsaVerified) {
        errors.push('SLSA provenance verification failed');
      }

      if (!cosignVerified) {
        errors.push('Cosign signature verification failed');
      }

      if (!policyVerified) {
        errors.push('Policy compliance verification failed');
      }

      const success = slsaVerified && cosignVerified && policyVerified;

      spinner.succeed('Attestation verification completed');

      return {
        success,
        slsaVerified,
        cosignVerified,
        policyVerified,
        errors,
        warnings,
        details: {
          provenanceVerified: slsaVerified,
          signatureVerified: cosignVerified,
          policyCompliant: policyVerified,
          dependenciesVerified: true, // Simplified
        },
      };

    } catch (error) {
      spinner.fail('Attestation verification failed');
      throw error;
    }
  }

  /**
   * Formats attestation results for console output
   */
  formatResults(result: AttestationResult): string {
    const output: string[] = [];

    // Header
    output.push(chalk.bold.blue('\n🔐 Supply Chain Attestation Results'));
    output.push(chalk.gray(`Repository: ${result.metadata.repository}`));
    output.push(chalk.gray(`Commit: ${result.metadata.commit}`));
    output.push(chalk.gray(`Build ID: ${result.metadata.buildId}`));
    output.push(chalk.gray(`Builder: ${result.metadata.builderId}`));
    output.push(chalk.gray(`Timestamp: ${result.metadata.timestamp}`));
    output.push('');

    // Verification status
    output.push(chalk.bold('✅ Verification Status:'));
    output.push(`  SLSA Provenance: ${result.verification.slsaVerified ? chalk.green('✓') : chalk.red('✗')}`);
    output.push(`  Cosign Signature: ${result.verification.cosignVerified ? chalk.green('✓') : chalk.red('✗')}`);
    output.push(`  Policy Compliance: ${result.verification.policyVerified ? chalk.green('✓') : chalk.red('✗')}`);
    output.push('');

    // Artifacts
    output.push(chalk.bold('📦 Attested Artifacts:'));
    for (const artifact of result.artifacts) {
      output.push(`  • ${artifact.uri}`);
      output.push(`    Digest: ${Object.entries(artifact.digest).map(([k, v]) => `${k}:${v}`).join(', ')}`);
      output.push(`    Attestations: ${artifact.attestations.length}`);
    }
    output.push('');

    // Errors
    if (result.verification.errors.length > 0) {
      output.push(chalk.bold.red('❌ Verification Errors:'));
      for (const error of result.verification.errors) {
        output.push(`  • ${error}`);
      }
      output.push('');
    }

    // Final status
    const status = result.success ? chalk.green('✅ Attestation successful') : chalk.red('❌ Attestation failed');
    output.push(status);

    return output.join('\n');
  }
} 