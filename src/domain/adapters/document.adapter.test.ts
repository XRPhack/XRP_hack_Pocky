import { describe, expect, it } from 'vitest';

import { employmentDocumentAdapter } from './employment-document.adapter';
import { visaDocumentAdapter } from './visa-document.adapter';

function asBase64Json(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
}

describe('uploaded document adapters', () => {
  it('verifies an uploaded visa document without returning the raw foreign registration number', async () => {
    const rawForeignRegistrationNumber = '900101-5123456';
    const result = await visaDocumentAdapter.verify({
      subjectId: 'tenant-doc-001',
      now: '2026-05-15T00:00:00.000Z',
      document: {
        filename: 'foreign-registration.json',
        mimeType: 'application/json',
        base64: asBase64Json({
          documentType: 'foreign-registration-certificate',
          subjectId: 'tenant-doc-001',
          visaType: 'E-9',
          nationality: 'Kyrgyzstan',
          expiresAt: '2027-11-30T00:00:00.000Z',
          issuer: 'Ministry of Justice Mock',
          foreignRegistrationNumber: rawForeignRegistrationNumber
        })
      }
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      subjectId: 'tenant-doc-001',
      visaType: 'E-9',
      nationality: 'Kyrgyzstan',
      expiryStatus: 'valid',
      verified: true,
      foreignRegistrationNumberLast4: '3456'
    });
    expect(JSON.stringify(result)).not.toContain(rawForeignRegistrationNumber);
    expect(result.data.foreignRegistrationNumberHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('fails an expired uploaded visa document', async () => {
    const result = await visaDocumentAdapter.verify({
      subjectId: 'tenant-doc-002',
      now: '2026-05-15T00:00:00.000Z',
      document: {
        filename: 'foreign-registration-expired.json',
        mimeType: 'application/json',
        base64: asBase64Json({
          visaType: 'E-9',
          nationality: 'Kyrgyzstan',
          expiresAt: '2024-02-01T00:00:00.000Z'
        })
      }
    });

    expect(result.success).toBe(false);
    expect(result.data.expiryStatus).toBe('expired');
  });

  it('verifies active employment and hashes organization fields', async () => {
    const organizationName = 'Busan Technical College';
    const result = await employmentDocumentAdapter.verify({
      subjectId: 'tenant-doc-001',
      now: '2026-05-15T00:00:00.000Z',
      document: {
        filename: 'employment.json',
        mimeType: 'application/json',
        base64: asBase64Json({
          verificationChannel: 'school',
          organizationName,
          roleOrProgram: 'International Welding Program',
          acquiredAt: '2025-03-01T00:00:00.000Z',
          issuer: 'School Mock Registry'
        })
      }
    });

    expect(result.success).toBe(true);
    expect(result.data.status).toBe('verified');
    expect(result.data.verificationChannel).toBe('school');
    expect(result.data.organizationNameHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(result)).not.toContain(organizationName);
  });
});
