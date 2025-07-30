export interface SLSAProvenance {
  version: string;
  predicateType: string;
  predicate: {
    buildDefinition: {
      buildType: string;
      externalParameters: Record<string, any>;
      internalParameters: Record<string, any>;
      resolvedDependencies: Array<{
        uri: string;
        digest: Record<string, string>;
      }>;
    };
    runDetails: {
      builder: {
        id: string;
      };
      metadata: {
        invocationId: string;
        startedOn: string;
        finishedOn: string;
      };
      byproducts: Array<{
        uri: string;
        digest: Record<string, string>;
      }>;
    };
  };
}

export interface CosignSignature {
  signature: string;
  payload: string;
  certificate: string;
  chain: string[];
  timestamp: string;
}

export interface AttestationResult {
  success: boolean;
  slsaProvenance: SLSAProvenance;
  cosignSignature: CosignSignature;
  metadata: {
    repository: string;
    commit: string;
    branch: string;
    timestamp: string;
    buildId: string;
    builderId: string;
  };
  artifacts: Array<{
    uri: string;
    digest: Record<string, string>;
    attestations: Array<{
      type: string;
      data: any;
    }>;
  }>;
  verification: {
    slsaVerified: boolean;
    cosignVerified: boolean;
    policyVerified: boolean;
    errors: string[];
  };
}

export interface AttestationConfig {
  slsaVersion: string;
  builderId: string;
  buildType: string;
  cosignKeyPath: string;
  cosignPassword: string;
  registryUrl: string;
  policyPath: string;
  attestationTypes: string[];
  verificationEnabled: boolean;
}

export interface BuildInfo {
  repository: string;
  commit: string;
  branch: string;
  buildId: string;
  buildType: string;
  externalParameters: Record<string, any>;
  internalParameters: Record<string, any>;
  dependencies: Array<{
    uri: string;
    digest: Record<string, string>;
  }>;
  artifacts: Array<{
    uri: string;
    digest: Record<string, string>;
  }>;
  byproducts: Array<{
    uri: string;
    digest: Record<string, string>;
  }>;
}

export interface AttestationOptions {
  buildInfo: BuildInfo;
  config: AttestationConfig;
  outputPath: string;
  verifyOnly: boolean;
}

export interface VerificationResult {
  success: boolean;
  slsaVerified: boolean;
  cosignVerified: boolean;
  policyVerified: boolean;
  errors: string[];
  warnings: string[];
  details: {
    provenanceVerified: boolean;
    signatureVerified: boolean;
    policyCompliant: boolean;
    dependenciesVerified: boolean;
  };
}

export interface PolicyRule {
  name: string;
  type: 'allow' | 'deny' | 'require';
  conditions: Array<{
    field: string;
    operator: 'equals' | 'contains' | 'regex' | 'in';
    value: any;
  }>;
  message: string;
}

export interface AttestationPolicy {
  version: string;
  rules: PolicyRule[];
  metadata: {
    name: string;
    description: string;
    version: string;
    createdBy: string;
    createdAt: string;
  };
} 