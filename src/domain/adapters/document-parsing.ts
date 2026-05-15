import { createHashAnchor, sha256Hex } from '../hashing.js';
import type {
  DocumentAuthenticityData,
  ExtractedDocumentText,
  UploadedDocumentPayload
} from './document.types.js';

export function decodeUploadedDocument(document: UploadedDocumentPayload): string {
  const decoded = Buffer.from(document.base64, 'base64').toString('utf8').trim();

  if (!decoded) {
    throw new Error('Uploaded document is empty.');
  }

  return decoded;
}

function decodeUploadedDocumentBuffer(document: UploadedDocumentPayload): Buffer {
  const decoded = Buffer.from(document.base64, 'base64');

  if (decoded.byteLength === 0) {
    throw new Error('Uploaded document is empty.');
  }

  return decoded;
}

function extractPdfTextLite(document: UploadedDocumentPayload): string {
  const buffer = decodeUploadedDocumentBuffer(document);
  const raw = buffer.toString('latin1');
  const textChunks = [...raw.matchAll(/\(([^()]*)\)\s*Tj/g), ...raw.matchAll(/\(([^()]*)\)\s*'/g)]
    .map((match) => match[1])
    .filter(Boolean);
  const arrayChunks = [...raw.matchAll(/\[((?:\([^()]*\)\s*)+)\]\s*TJ/g)].flatMap((match) =>
    [...match[1].matchAll(/\(([^()]*)\)/g)].map((nested) => nested[1])
  );
  const text = [...textChunks, ...arrayChunks]
    .join('\n')
    .replace(/\\([()\\])/g, '$1')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\n')
    .trim();

  if (!text) {
    throw new Error('PDF text could not be extracted without an OCR/PDF parser.');
  }

  return text;
}

export function extractUploadedDocumentText(document: UploadedDocumentPayload): ExtractedDocumentText {
  if (document.mimeType === 'application/pdf') {
    return {
      text: extractPdfTextLite(document),
      extractionMode: 'pdf-text-lite'
    };
  }

  const decoded = decodeUploadedDocument(document);

  if (document.mimeType === 'application/json') {
    return {
      text: decoded,
      extractionMode: 'json'
    };
  }

  if (document.mimeType === 'text/plain') {
    return {
      text: decoded,
      extractionMode: 'plain-text'
    };
  }

  throw new Error('Only JSON, text, or text-based PDF documents are supported in this MVP.');
}

export function parseUploadedJsonDocument<T extends object>(
  document: UploadedDocumentPayload
): T {
  const { text } = extractUploadedDocumentText(document);

  const parsed = JSON.parse(text) as unknown;

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Uploaded document JSON must be an object.');
  }

  return parsed as T;
}

function getFirstMatch(text: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = match?.[1]?.trim();

    if (value) {
      return value;
    }
  }

  return undefined;
}

export function parseKeyValueDocumentText(text: string): Record<string, string> {
  const entries = new Map<string, string>();

  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([^:=]+)\s*[:=]\s*(.+?)\s*$/);

    if (match) {
      entries.set(match[1].trim(), match[2].trim());
    }
  }

  return Object.fromEntries(entries);
}

export function parseVisaDocumentText(text: string): Record<string, string | undefined> {
  const keyValue = parseKeyValueDocumentText(text);

  return {
    documentType: keyValue.documentType ?? keyValue['문서종류'],
    subjectId: keyValue.subjectId,
    visaType: keyValue.visaType ?? keyValue['체류자격'] ?? getFirstMatch(text, [/체류자격\s*[:=]?\s*([A-Z]-?\d+)/i]),
    nationality: keyValue.nationality ?? keyValue['국적'] ?? getFirstMatch(text, [/국적\s*[:=]?\s*([^\n]+)/]),
    expiresAt:
      keyValue.expiresAt ??
      keyValue['만료일'] ??
      keyValue['체류기간만료일'] ??
      getFirstMatch(text, [/만료일\s*[:=]?\s*([0-9]{4}[-./][0-9]{1,2}[-./][0-9]{1,2})/]),
    issuedAt: keyValue.issuedAt ?? keyValue['발급일'],
    issuer: keyValue.issuer ?? keyValue['발급기관'],
    foreignRegistrationNumber:
      keyValue.foreignRegistrationNumber ??
      keyValue['외국인등록번호'] ??
      getFirstMatch(text, [/외국인등록번호\s*[:=]?\s*([0-9*-]{7,})/]),
    foreignRegistrationNumberLast4: keyValue.foreignRegistrationNumberLast4,
    documentVerificationCode:
      keyValue.documentVerificationCode ??
      keyValue['문서확인번호'] ??
      keyValue['발급번호'] ??
      getFirstMatch(text, [/(?:문서확인번호|발급번호)\s*[:=]?\s*([A-Z0-9-]{6,})/i]),
    qrVerificationUrl:
      keyValue.qrVerificationUrl ??
      keyValue['QR검증URL'] ??
      getFirstMatch(text, [/(https?:\/\/[^\s]+)/])
  };
}

export function parseEmploymentDocumentText(text: string): Record<string, string | undefined> {
  const keyValue = parseKeyValueDocumentText(text);

  return {
    documentType: keyValue.documentType ?? keyValue['문서종류'],
    subjectId: keyValue.subjectId,
    verificationChannel: keyValue.verificationChannel ?? keyValue['확인채널'],
    organizationName:
      keyValue.organizationName ??
      keyValue['기관명'] ??
      keyValue['사업장명'] ??
      keyValue['학교명'],
    roleOrProgram: keyValue.roleOrProgram ?? keyValue['직무'] ?? keyValue['과정명'],
    acquiredAt: keyValue.acquiredAt ?? keyValue['취득일'] ?? keyValue['자격취득일'],
    lostAt: keyValue.lostAt ?? keyValue['상실일'] ?? keyValue['자격상실일'],
    issuedAt: keyValue.issuedAt ?? keyValue['발급일'],
    issuer: keyValue.issuer ?? keyValue['발급기관'],
    documentVerificationCode:
      keyValue.documentVerificationCode ??
      keyValue['문서확인번호'] ??
      keyValue['발급번호'] ??
      getFirstMatch(text, [/(?:문서확인번호|발급번호)\s*[:=]?\s*([A-Z0-9-]{6,})/i]),
    qrVerificationUrl:
      keyValue.qrVerificationUrl ??
      keyValue['QR검증URL'] ??
      getFirstMatch(text, [/(https?:\/\/[^\s]+)/])
  };
}

export async function createUploadedDocumentHash(document: UploadedDocumentPayload): Promise<string> {
  const decoded = decodeUploadedDocumentBuffer(document).toString('base64');

  return sha256Hex(`${document.filename}:${document.mimeType}:${decoded}`);
}

export async function hashOptionalString(value: string | undefined): Promise<string | undefined> {
  const normalized = value?.trim();

  if (!normalized) {
    return undefined;
  }

  return createHashAnchor('uploaded-document-field', normalized);
}

export async function buildAuthenticityData(input: {
  documentVerificationCode?: string;
  qrVerificationUrl?: string;
}): Promise<DocumentAuthenticityData> {
  const documentVerificationCode = input.documentVerificationCode?.trim();
  const qrVerificationUrl = input.qrVerificationUrl?.trim();

  if (documentVerificationCode) {
    return {
      status: 'ready',
      method: 'document-code',
      verificationCodeHash: await hashOptionalString(documentVerificationCode),
      summary: 'Document verification code is present; external authenticity check is ready.'
    };
  }

  if (qrVerificationUrl) {
    return {
      status: 'ready',
      method: 'qr-url',
      qrVerificationUrlHash: await hashOptionalString(qrVerificationUrl),
      summary: 'QR verification URL is present; external authenticity check is ready.'
    };
  }

  return {
    status: 'not-checked',
    method: 'missing',
    summary: 'No document verification code or QR verification URL was found.'
  };
}

export function getLast4(value: string | undefined): string | undefined {
  const digits = value?.replace(/\D/g, '');

  if (!digits) {
    return undefined;
  }

  return digits.slice(-4);
}
