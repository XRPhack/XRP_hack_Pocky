import type { AdapterResult, VerificationAdapter } from './adapter.interface.js';

export type VisaVerificationInput = {
  subjectId: string;
  visaType: 'E-9';
  nationality: string;
  expiresAt: string;
  issuer: string;
  passportNumberLast4: string;
};

export type VisaVerificationData = {
  subjectId: string;
  visaType: 'E-9';
  nationality: string;
  expiryStatus: 'valid' | 'expired';
  verified: boolean;
  issuer: string;
  expiresAt: string;
  summary: string;
};

export const visaHappyCase: VisaVerificationInput = {
  subjectId: 'tenant-mina-001',
  visaType: 'E-9',
  nationality: 'Kyrgyzstan',
  expiresAt: '2027-11-30T00:00:00.000Z',
  issuer: 'Seoul Immigration Mock Desk',
  passportNumberLast4: '4821',
};

export const visaEdgeCase: VisaVerificationInput = {
  subjectId: 'tenant-mina-002',
  visaType: 'E-9',
  nationality: 'Kyrgyzstan',
  expiresAt: '2024-02-01T00:00:00.000Z',
  issuer: 'Seoul Immigration Mock Desk',
  passportNumberLast4: '9934',
};

const verifiedAt = '2026-05-12T00:00:00.000Z';
const happyEvidenceHash = '1111111111111111111111111111111111111111111111111111111111111111';
const edgeEvidenceHash = '2222222222222222222222222222222222222222222222222222222222222222';

function buildVisaResult(input: VisaVerificationInput): AdapterResult<VisaVerificationData> {
  const expiryStatus = new Date(input.expiresAt) > new Date(verifiedAt) ? 'valid' : 'expired';
  const success = input.visaType === 'E-9' && expiryStatus === 'valid';

  return {
    success,
    data: {
      subjectId: input.subjectId,
      visaType: input.visaType,
      nationality: input.nationality,
      expiryStatus,
      verified: success,
      issuer: input.issuer,
      expiresAt: input.expiresAt,
      summary: success
        ? 'Valid E-9 visa with a future expiry date.'
        : 'E-9 visa is expired or outside the allowed validity window.',
    },
    verifiedAt,
    source: 'mock-fixture:visa',
    evidenceHash: success ? happyEvidenceHash : edgeEvidenceHash,
    message: success ? undefined : 'Expired visa fixture used for edge-case verification.',
  };
}

export const visaMockAdapter: VerificationAdapter<VisaVerificationInput, VisaVerificationData> = {
  id: 'mock-visa-fixture',
  name: 'Visa fixture adapter',
  async verify(input) {
    return buildVisaResult(input);
  },
};
