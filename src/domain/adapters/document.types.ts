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
  documentVerificationCode?: string;
  qrVerificationUrl?: string;
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
  documentVerificationCode?: string;
  qrVerificationUrl?: string;
};

export type DocumentAuthenticityStatus = 'not-checked' | 'ready' | 'failed';

export type DocumentAuthenticityData = {
  status: DocumentAuthenticityStatus;
  verificationCodeHash?: string;
  qrVerificationUrlHash?: string;
  method: 'document-code' | 'qr-url' | 'missing';
  summary: string;
};

export type ExtractedDocumentText = {
  text: string;
  extractionMode: 'json' | 'plain-text' | 'pdf-text-lite';
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
  authenticity: DocumentAuthenticityData;
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
  authenticity: DocumentAuthenticityData;
  summary: string;
};
