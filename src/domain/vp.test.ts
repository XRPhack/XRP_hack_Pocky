import { describe, expect, it } from 'vitest';

import type { Credential, TenantProfile } from './types';
import { buildVp, verifyVp } from './vp';

const createdAt = '2026-05-12T00:00:00.000Z';
const verifiedAt = '2026-05-13T00:00:00.000Z';

const tenant: TenantProfile = {
  id: 'tenant-mina-001',
  displayName: 'Mina P.',
  nationality: 'Kyrgyzstan',
  visaType: 'E-9',
  visaExpiresAt: '2027-11-30T00:00:00.000Z',
  monthlyIncomeKrw: 2_750_000,
  employmentVerified: true,
  schoolOrEmployer: 'Busan Technical College',
  passportNumber: 'P-TEST-4821',
  phoneNumber: '+82-10-0000-4821',
  xrplAccount: 'rTENANTACCOUNT'
};

const validCredentials: Credential[] = [
  {
    id: 'cred_visa_001',
    type: 'visa',
    issuer: 'Seoul Immigration Mock Desk',
    subjectId: tenant.id,
    issuedAt: '2026-05-01T00:00:00.000Z',
    expiresAt: '2027-11-30T00:00:00.000Z',
    claims: {
      visaType: 'E-9',
      nationality: 'Kyrgyzstan'
    }
  },
  {
    id: 'cred_rent_001',
    type: 'rent-history',
    issuer: 'River View Residence',
    subjectId: tenant.id,
    issuedAt: '2026-05-01T00:00:00.000Z',
    claims: {
      observedMonths: 6,
      onTimeRate: 0.83,
      grade: 'B'
    }
  }
];

describe('vp', () => {
  it('builds a compact deterministic VP without a signature payload', () => {
    const vp = buildVp({ tenant, credentials: validCredentials, now: createdAt });
    const sameVp = buildVp({ tenant, credentials: validCredentials, now: createdAt });

    expect(vp).toEqual(sameVp);
    expect(vp.reportId).toMatch(/^report_[a-z0-9]+$/);
    expect(vp.id).toBe(vp.reportId);
    expect(vp.holderId).toBe(tenant.id);
    expect(vp.credentialIds).toEqual(['cred_visa_001', 'cred_rent_001']);
    expect(vp.createdAt).toBe(createdAt);
    expect(vp.verificationMetadata).toEqual(
      expect.objectContaining({
        issuerCheck: 'local-credential-data',
        xrplCheck: 'deferred-account-objects'
      })
    );
    expect(JSON.stringify(vp)).not.toContain('JsonWebSignature2020');
    expect(vp).not.toHaveProperty('proof');
  });

  it('passes verification for a normal credential set by report id', () => {
    const vp = buildVp({ tenant, credentials: validCredentials, now: createdAt });
    const result = verifyVp(vp.reportId, { now: verifiedAt });

    expect(result.status).toBe('pass');
    expect(result.reportId).toBe(vp.reportId);
    expect(result.holderId).toBe(tenant.id);
    expect(result.checks).toEqual({
      issuerPresence: 'pass',
      expiration: 'pass',
      credentialSet: 'pass'
    });
    expect(result.credentials).toHaveLength(2);
    expect(result.credentials.every((credential) => credential.status === 'pass')).toBe(true);
    expect(result.caveat).toContain('account_objects later');
  });

  it('fails verification when a credential is expired', () => {
    const expiredCredentials: Credential[] = [
      {
        ...validCredentials[0],
        id: 'cred_visa_expired',
        expiresAt: '2024-02-01T00:00:00.000Z'
      },
      validCredentials[1]
    ];
    const vp = buildVp({ tenant, credentials: expiredCredentials, now: createdAt });
    const result = verifyVp(vp, { credentials: expiredCredentials, now: verifiedAt });

    expect(result.status).toBe('fail');
    expect(result.checks.issuerPresence).toBe('pass');
    expect(result.checks.expiration).toBe('fail');
    expect(result.checks.credentialSet).toBe('fail');
    expect(result.credentials).toContainEqual(
      expect.objectContaining({
        credentialId: 'cred_visa_expired',
        status: 'fail',
        reason: 'Credential is expired.'
      })
    );
  });

  it('fails issuer presence when a credential omits issuer data', () => {
    const credentials = [{ ...validCredentials[0], issuer: ' ' }];
    const vp = buildVp({ tenant, credentials, now: createdAt });
    const result = verifyVp(vp, { credentials, now: verifiedAt });

    expect(result.status).toBe('fail');
    expect(result.checks.issuerPresence).toBe('fail');
    expect(result.credentials[0]).toEqual(
      expect.objectContaining({
        issuer: null,
        reason: 'Missing issuer in credential payload.'
      })
    );
  });
});
