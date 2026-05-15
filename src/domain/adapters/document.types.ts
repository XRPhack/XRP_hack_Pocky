export type UploadedDocumentPayload = {
  filename: string;
  mimeType: 'application/json' | 'text/plain' | 'application/pdf' | 'image/png' | 'image/jpeg';
  base64: string;
};

export type UploadedDocumentInput = {
  subjectId: string;
  document: UploadedDocumentPayload;
  now?: string;
};

export type UploadedVisaDocument = {
  documentType?: string;
  subjectId?: string;
  visaType?: string;
  nationality?: string;
  expiresAt?: string;
  issuedAt?: string;
  issuer?: string;
  foreignRegistrationNumber?: string;
  foreignRegistrationNumberLast4?: string;
};

export type UploadedEmploymentDocument = {
  documentType?: string;
  subjectId?: string;
  verificationChannel?: 'employment-insurance' | 'health-insurance' | 'national-pension' | 'school';
  organizationName?: string;
  roleOrProgram?: string;
  acquiredAt?: string;
  lostAt?: string;
  issuedAt?: string;
  issuer?: string;
};

export type UploadedVisaVerificationData = {
  subjectId: string;
  visaType: string;
  nationality: string;
  expiryStatus: 'valid' | 'expired' | 'unknown';
  verified: boolean;
  issuer: string;
  expiresAt: string;
  issuedAt?: string;
  foreignRegistrationNumberLast4?: string;
  foreignRegistrationNumberHash?: string;
  summary: string;
};

export type UploadedEmploymentVerificationData = {
  subjectId: string;
  verificationChannel: 'employment-insurance' | 'health-insurance' | 'national-pension' | 'school';
  status: 'verified' | 'unverified' | 'unknown';
  issuer: string;
  issuedAt?: string;
  acquiredAt?: string;
  lostAt?: string;
  organizationNameHash?: string;
  roleOrProgramHash?: string;
  summary: string;
};
