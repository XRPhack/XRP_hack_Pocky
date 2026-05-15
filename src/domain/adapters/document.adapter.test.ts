import { describe, expect, it } from 'vitest';

import { employmentDocumentAdapter } from './employment-document.adapter';
import { visaDocumentAdapter } from './visa-document.adapter';

function asBase64Json(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
}

function asBase64Text(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64');
}

function asBase64LitePdf(lines: string[]): string {
  const content = lines.map((line, index) => `BT /F1 12 Tf 50 ${760 - index * 16} Td (${line}) Tj ET`).join('\n');
  return Buffer.from(`%PDF-1.4\n1 0 obj\n<<>>\nstream\n${content}\nendstream\nendobj\n%%EOF`, 'latin1').toString('base64');
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
          foreignRegistrationNumber: rawForeignRegistrationNumber,
          documentVerificationCode: 'MOJ-2027-ABC123'
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
      foreignRegistrationNumberLast4: '3456',
      authenticity: expect.objectContaining({
        status: 'ready',
        method: 'document-code'
      })
    });
    expect(JSON.stringify(result)).not.toContain(rawForeignRegistrationNumber);
    expect(JSON.stringify(result)).not.toContain('MOJ-2027-ABC123');
    expect(result.data.foreignRegistrationNumberHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.data.authenticity.verificationCodeHash).toMatch(/^[a-f0-9]{64}$/);
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
          issuer: 'School Mock Registry',
          qrVerificationUrl: 'https://verify.example.test/school/abc'
        })
      }
    });

    expect(result.success).toBe(true);
    expect(result.data.status).toBe('verified');
    expect(result.data.verificationChannel).toBe('school');
    expect(result.data.authenticity).toMatchObject({
      status: 'ready',
      method: 'qr-url'
    });
    expect(result.data.organizationNameHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(result)).not.toContain(organizationName);
    expect(JSON.stringify(result)).not.toContain('https://verify.example.test/school/abc');
  });

  it('parses visa fields from plain text documents', async () => {
    const result = await visaDocumentAdapter.verify({
      subjectId: 'tenant-text-001',
      now: '2026-05-15T00:00:00.000Z',
      document: {
        filename: 'foreign-registration.txt',
        mimeType: 'text/plain',
        base64: asBase64Text([
          '문서종류: 외국인등록 사실증명',
          '체류자격: E-9',
          '국적: Kyrgyzstan',
          '만료일: 2027-11-30',
          '발급기관: Ministry of Justice Mock',
          '외국인등록번호: 900101-5123456',
          '문서확인번호: MOJ-2027-TEXT'
        ].join('\n'))
      }
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      visaType: 'E-9',
      nationality: 'Kyrgyzstan',
      expiryStatus: 'valid',
      foreignRegistrationNumberLast4: '3456',
      authenticity: expect.objectContaining({
        status: 'ready',
        method: 'document-code'
      })
    });
    expect(JSON.stringify(result)).not.toContain('900101-5123456');
    expect(JSON.stringify(result)).not.toContain('MOJ-2027-TEXT');
  });

  it('parses employment fields from simple text-based PDF content', async () => {
    const result = await employmentDocumentAdapter.verify({
      subjectId: 'tenant-pdf-001',
      now: '2026-05-15T00:00:00.000Z',
      document: {
        filename: 'employment.pdf',
        mimeType: 'application/pdf',
        base64: asBase64LitePdf([
          'documentType: employment-insurance-history',
          'verificationChannel: employment-insurance',
          'organizationName: Seoul Mobility Parts',
          'acquiredAt: 2025-03-01',
          'issuer: Korea Workers Compensation Mock',
          'documentVerificationCode: EI-2026-PDF'
        ])
      }
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      verificationChannel: 'employment-insurance',
      status: 'verified',
      authenticity: expect.objectContaining({
        status: 'ready',
        method: 'document-code'
      })
    });
    expect(JSON.stringify(result)).not.toContain('Seoul Mobility Parts');
    expect(JSON.stringify(result)).not.toContain('EI-2026-PDF');
  });
});
