import type { AdapterResult, VerificationAdapter } from './adapter.interface.js';
import {
  buildAuthenticityData,
  createUploadedDocumentHash,
  extractUploadedDocumentText,
  getLast4,
  hashOptionalString,
  parseUploadedJsonDocument,
  parseVisaDocumentText
} from './document-parsing.js';
import type {
  UploadedDocumentInput,
  UploadedVisaDocument,
  UploadedVisaVerificationData
} from './document.types.js';

function normalizeString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function resolveExpiryStatus(
  expiresAt: string | undefined,
  now: string
): UploadedVisaVerificationData['expiryStatus'] {
  if (!expiresAt) {
    return 'unknown';
  }

  const expiresAtDate = new Date(expiresAt);
  const nowDate = new Date(now);

  if (Number.isNaN(expiresAtDate.getTime()) || Number.isNaN(nowDate.getTime())) {
    return 'unknown';
  }

  return expiresAtDate > nowDate ? 'valid' : 'expired';
}

export const visaDocumentAdapter: VerificationAdapter<
  UploadedDocumentInput,
  UploadedVisaVerificationData
> = {
  id: 'uploaded-visa-document',
  name: 'Uploaded visa document adapter',
  async verify(input): Promise<AdapterResult<UploadedVisaVerificationData>> {
    const extracted = extractUploadedDocumentText(input.document);
    const parsed = extracted.extractionMode === 'json'
      ? parseUploadedJsonDocument<UploadedVisaDocument>(input.document)
      : parseVisaDocumentText(extracted.text);
    const now = input.now ?? new Date().toISOString();
    const visaType = normalizeString(parsed.visaType) ?? 'unknown';
    const nationality = normalizeString(parsed.nationality) ?? 'unknown';
    const expiresAt = normalizeString(parsed.expiresAt) ?? '';
    const issuer = normalizeString(parsed.issuer) ?? 'uploaded-document';
    const expiryStatus = resolveExpiryStatus(expiresAt, now);
    const verified = expiryStatus === 'valid' && visaType !== 'unknown';
    const foreignRegistrationNumber = normalizeString(parsed.foreignRegistrationNumber);
    const authenticity = await buildAuthenticityData({
      documentVerificationCode: normalizeString(parsed.documentVerificationCode),
      qrVerificationUrl: normalizeString(parsed.qrVerificationUrl)
    });

    return {
      success: verified,
      data: {
        subjectId: normalizeString(parsed.subjectId) ?? input.subjectId,
        visaType,
        nationality,
        expiryStatus,
        verified,
        issuer,
        expiresAt,
        issuedAt: normalizeString(parsed.issuedAt),
        foreignRegistrationNumberLast4:
          normalizeString(parsed.foreignRegistrationNumberLast4) ?? getLast4(foreignRegistrationNumber),
        foreignRegistrationNumberHash: await hashOptionalString(foreignRegistrationNumber),
        authenticity,
        summary: verified
          ? 'Uploaded visa document has a future expiry date.'
          : 'Uploaded visa document is expired or missing required fields.'
      },
      verifiedAt: now,
      source: 'uploaded-document:foreign-registration-certificate',
      evidenceHash: await createUploadedDocumentHash(input.document),
      message: verified ? undefined : 'Visa document verification did not pass.'
    };
  }
};
