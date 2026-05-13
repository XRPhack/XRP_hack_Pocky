import type { AdapterResult, VerificationAdapter } from './adapter.interface.js';

export type EmploymentVerificationInput = {
  subjectId: string;
  verificationChannel: 'school' | 'employer';
  organizationName: string;
  roleOrProgram: string;
  enrollmentVerified: boolean;
  employmentVerified: boolean;
};

export type EmploymentVerificationData = {
  subjectId: string;
  verificationChannel: 'school' | 'employer';
  organizationName: string;
  roleOrProgram: string;
  status: 'verified' | 'unverified';
  summary: string;
};

export const employmentHappyCase: EmploymentVerificationInput = {
  subjectId: 'tenant-mina-001',
  verificationChannel: 'school',
  organizationName: 'Busan Technical College',
  roleOrProgram: 'International Welding Program',
  enrollmentVerified: true,
  employmentVerified: false,
};

export const employmentEdgeCase: EmploymentVerificationInput = {
  subjectId: 'tenant-mina-002',
  verificationChannel: 'employer',
  organizationName: 'Open Market Holdings',
  roleOrProgram: 'Warehouse Staff',
  enrollmentVerified: false,
  employmentVerified: false,
};

const verifiedAt = '2026-05-12T00:00:00.000Z';
const happyEvidenceHash = '3333333333333333333333333333333333333333333333333333333333333333';
const edgeEvidenceHash = '4444444444444444444444444444444444444444444444444444444444444444';

function buildEmploymentResult(
  input: EmploymentVerificationInput,
): AdapterResult<EmploymentVerificationData> {
  const success = input.enrollmentVerified || input.employmentVerified;

  return {
    success,
    data: {
      subjectId: input.subjectId,
      verificationChannel: input.verificationChannel,
      organizationName: input.organizationName,
      roleOrProgram: input.roleOrProgram,
      status: success ? 'verified' : 'unverified',
      summary: success
        ? 'Verified school enrollment or employer record found.'
        : 'No enrollment or employment record could be confirmed.',
    },
    verifiedAt,
    source: 'mock-fixture:employment',
    evidenceHash: success ? happyEvidenceHash : edgeEvidenceHash,
    message: success ? undefined : 'Missing enrollment or employment proof for edge-case coverage.',
  };
}

export const employmentMockAdapter: VerificationAdapter<
  EmploymentVerificationInput,
  EmploymentVerificationData
> = {
  id: 'mock-employment-fixture',
  name: 'Employment fixture adapter',
  async verify(input) {
    return buildEmploymentResult(input);
  },
};
