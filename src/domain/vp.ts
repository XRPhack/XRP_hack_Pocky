import { stableJson } from './hashing.js';
import type {
  Credential,
  PresentationPurpose,
  TenantProfile,
  VerifiablePresentation,
  VerificationStatus
} from './types.js';

export type BuildVpInput = {
  tenant: TenantProfile;
  credentials: Credential[];
  now?: Date | string;
  purpose?: PresentationPurpose;
  challenge?: string;
  domain?: string;
};

export type CompactVp = VerifiablePresentation & {
  reportId: string;
  verificationMetadata: {
    issuerCheck: 'local-credential-data';
    xrplCheck: 'deferred-account-objects';
    caveat: string;
  };
};

export type VpCredentialVerification = {
  credentialId: string;
  type: Credential['type'];
  issuer: string | null;
  status: VerificationStatus;
  expiresAt?: string;
  reason?: string;
};

export type VpVerificationResult = {
  reportId: string;
  status: VerificationStatus;
  holderId: string;
  credentialIds: string[];
  verifiedAt: string;
  checks: {
    issuerPresence: VerificationStatus;
    expiration: VerificationStatus;
    credentialSet: VerificationStatus;
  };
  credentials: VpCredentialVerification[];
  caveat: string;
};

type StoredVp = {
  vp: CompactVp;
  credentials: Credential[];
};

export type VerifyVpOptions = {
  credentials?: Credential[];
  now?: Date | string;
};

const LOCAL_ISSUER_CHECK_CAVEAT =
  'Issuer presence is checked from local credential data; accepted XRPL Credential objects can be confirmed with account_objects later.';

const verificationStore = new Map<string, StoredVp>();

function toIsoTimestamp(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid VP timestamp: ${String(value)}`);
  }

  return date.toISOString();
}

function createStableFingerprint(value: unknown): string {
  let hash = 2_166_136_261;

  for (const character of stableJson(value)) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }

  return (hash >>> 0).toString(36).padStart(7, '0');
}

function createReportId(holderId: string, credentialIds: string[], createdAt: string): string {
  const fingerprint = createStableFingerprint({ holderId, credentialIds, createdAt });

  return `report_${fingerprint}`;
}

function getVpReportId(vp: VerifiablePresentation | CompactVp): string {
  return 'reportId' in vp ? vp.reportId : vp.id;
}

function resolveStoredVp(
  input: string | VerifiablePresentation | CompactVp,
  options: VerifyVpOptions
): StoredVp | undefined {
  if (typeof input === 'string') {
    return verificationStore.get(input);
  }

  if (options.credentials) {
    const vp = 'reportId' in input
      ? input
      : {
          ...input,
          reportId: input.id,
          verificationMetadata: {
            issuerCheck: 'local-credential-data',
            xrplCheck: 'deferred-account-objects',
            caveat: LOCAL_ISSUER_CHECK_CAVEAT
          }
        };

    return {
      vp: vp as CompactVp,
      credentials: options.credentials
    };
  }

  return verificationStore.get(getVpReportId(input));
}

function buildMissingVpResult(
  reportId: string,
  verifiedAt: string
): VpVerificationResult {
  return {
    reportId,
    status: 'fail',
    holderId: '',
    credentialIds: [],
    verifiedAt,
    checks: {
      issuerPresence: 'fail',
      expiration: 'fail',
      credentialSet: 'fail'
    },
    credentials: [],
    caveat: 'VP credentials were not found in the local verification store.'
  };
}

function verifyCredential(
  credential: Credential,
  holderId: string,
  now: Date
): VpCredentialVerification {
  const issuer = credential.issuer.trim();

  if (!issuer) {
    return {
      credentialId: credential.id,
      type: credential.type,
      issuer: null,
      status: 'fail',
      expiresAt: credential.expiresAt,
      reason: 'Missing issuer in credential payload.'
    };
  }

  if (credential.subjectId !== holderId) {
    return {
      credentialId: credential.id,
      type: credential.type,
      issuer,
      status: 'fail',
      expiresAt: credential.expiresAt,
      reason: 'Credential subject does not match VP holder.'
    };
  }

  if (credential.expiresAt) {
    const expiresAt = new Date(credential.expiresAt);

    if (Number.isNaN(expiresAt.getTime())) {
      return {
        credentialId: credential.id,
        type: credential.type,
        issuer,
        status: 'fail',
        expiresAt: credential.expiresAt,
        reason: 'Credential expiration timestamp is invalid.'
      };
    }

    if (expiresAt <= now) {
      return {
        credentialId: credential.id,
        type: credential.type,
        issuer,
        status: 'fail',
        expiresAt: credential.expiresAt,
        reason: 'Credential is expired.'
      };
    }
  }

  return {
    credentialId: credential.id,
    type: credential.type,
    issuer,
    status: 'pass',
    expiresAt: credential.expiresAt
  };
}

function aggregateStatus(results: VpCredentialVerification[]): VerificationStatus {
  return results.length > 0 && results.every((result) => result.status === 'pass')
    ? 'pass'
    : 'fail';
}

export function buildVp({
  tenant,
  credentials,
  now = new Date(),
  purpose = 'share-report',
  challenge,
  domain
}: BuildVpInput): CompactVp {
  const createdAt = toIsoTimestamp(now);
  const credentialIds = credentials.map((credential) => credential.id);
  const reportId = createReportId(tenant.id, credentialIds, createdAt);
  const vp: CompactVp = {
    id: reportId,
    reportId,
    holderId: tenant.id,
    purpose,
    credentialIds,
    createdAt,
    challenge,
    domain,
    verificationMetadata: {
      issuerCheck: 'local-credential-data',
      xrplCheck: 'deferred-account-objects',
      caveat: LOCAL_ISSUER_CHECK_CAVEAT
    }
  };

  verificationStore.set(reportId, { vp, credentials: [...credentials] });

  return vp;
}

export function verifyVp(
  input: string | VerifiablePresentation | CompactVp,
  options: VerifyVpOptions = {}
): VpVerificationResult {
  const verifiedAt = toIsoTimestamp(options.now ?? new Date());
  const storedVp = resolveStoredVp(input, options);

  if (!storedVp) {
    const reportId = typeof input === 'string' ? input : getVpReportId(input);
    return buildMissingVpResult(reportId, verifiedAt);
  }

  const now = new Date(verifiedAt);
  const credentialResults = storedVp.credentials.map((credential) =>
    verifyCredential(credential, storedVp.vp.holderId, now)
  );
  const credentialIdsMatch =
    stableJson(storedVp.vp.credentialIds) ===
    stableJson(storedVp.credentials.map((credential) => credential.id));
  const issuerPresence = storedVp.credentials.every((credential) => credential.issuer.trim())
    ? 'pass'
    : 'fail';
  const expiration = credentialResults.every(
    (result) =>
      result.status === 'pass' ||
      (result.reason !== 'Credential is expired.' &&
        result.reason !== 'Credential expiration timestamp is invalid.')
  )
    ? 'pass'
    : 'fail';
  const credentialSet = credentialIdsMatch ? aggregateStatus(credentialResults) : 'fail';
  const status = issuerPresence === 'pass' && expiration === 'pass' && credentialSet === 'pass'
    ? 'pass'
    : 'fail';

  return {
    reportId: storedVp.vp.reportId,
    status,
    holderId: storedVp.vp.holderId,
    credentialIds: storedVp.vp.credentialIds,
    verifiedAt,
    checks: {
      issuerPresence,
      expiration,
      credentialSet
    },
    credentials: credentialResults,
    caveat: storedVp.vp.verificationMetadata.caveat
  };
}
