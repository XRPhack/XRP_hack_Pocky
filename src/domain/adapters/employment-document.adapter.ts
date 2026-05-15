import type { AdapterResult, VerificationAdapter } from './adapter.interface.js';
import {
  buildAuthenticityData,
  createUploadedDocumentHash,
  extractUploadedDocumentText,
  hashOptionalString,
  parseEmploymentDocumentText,
  parseUploadedJsonDocument
} from './document-parsing.js';
import type {
  UploadedDocumentInput,
  UploadedEmploymentDocument,
  UploadedEmploymentVerificationData
} from './document.types.js';

function normalizeString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeChannel(value: unknown): UploadedEmploymentVerificationData['verificationChannel'] {
  if (
    value === 'employment-insurance' ||
    value === 'health-insurance' ||
    value === 'national-pension' ||
    value === 'school'
  ) {
    return value;
  }

  return 'employment-insurance';
}

function resolveStatus(
  parsed: UploadedEmploymentDocument,
  now: string
): UploadedEmploymentVerificationData['status'] {
  const lostAt = normalizeString(parsed.lostAt);

  if (!normalizeString(parsed.acquiredAt) && !normalizeString(parsed.organizationName)) {
    return 'unknown';
  }

  if (!lostAt) {
    return 'verified';
  }

  const lostAtDate = new Date(lostAt);
  const nowDate = new Date(now);

  if (Number.isNaN(lostAtDate.getTime()) || Number.isNaN(nowDate.getTime())) {
    return 'unknown';
  }

  return lostAtDate > nowDate ? 'verified' : 'unverified';
}

export const employmentDocumentAdapter: VerificationAdapter<
  UploadedDocumentInput,
  UploadedEmploymentVerificationData
> = {
  id: 'uploaded-employment-document',
  name: 'Uploaded employment document adapter',
  async verify(input): Promise<AdapterResult<UploadedEmploymentVerificationData>> {
    const extracted = extractUploadedDocumentText(input.document);
    const parsed = extracted.extractionMode === 'json'
      ? parseUploadedJsonDocument<UploadedEmploymentDocument>(input.document)
      : parseEmploymentDocumentText(extracted.text);
    const now = input.now ?? new Date().toISOString();
    const status = resolveStatus(parsed, now);
    const authenticity = await buildAuthenticityData({
      documentVerificationCode: normalizeString(parsed.documentVerificationCode),
      qrVerificationUrl: normalizeString(parsed.qrVerificationUrl)
    });

    return {
      success: status === 'verified',
      data: {
        subjectId: normalizeString(parsed.subjectId) ?? input.subjectId,
        verificationChannel: normalizeChannel(parsed.verificationChannel),
        status,
        issuer: normalizeString(parsed.issuer) ?? 'uploaded-document',
        issuedAt: normalizeString(parsed.issuedAt),
        acquiredAt: normalizeString(parsed.acquiredAt),
        lostAt: normalizeString(parsed.lostAt),
        organizationNameHash: await hashOptionalString(normalizeString(parsed.organizationName)),
        roleOrProgramHash: await hashOptionalString(normalizeString(parsed.roleOrProgram)),
        authenticity,
        summary: status === 'verified'
          ? 'Uploaded employment document shows an active status.'
          : 'Uploaded employment document is inactive or missing required fields.'
      },
      verifiedAt: now,
      source: 'uploaded-document:employment',
      evidenceHash: await createUploadedDocumentHash(input.document),
      message: status === 'verified' ? undefined : 'Employment document verification did not pass.'
    };
  }
};
