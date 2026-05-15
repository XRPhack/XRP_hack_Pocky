import { createHashAnchor, sha256Hex } from '../hashing.js';
import type { UploadedDocumentPayload } from './document.types.js';

export function decodeUploadedDocument(document: UploadedDocumentPayload): string {
  const decoded = Buffer.from(document.base64, 'base64').toString('utf8').trim();

  if (!decoded) {
    throw new Error('Uploaded document is empty.');
  }

  return decoded;
}

export function parseUploadedJsonDocument<T extends object>(
  document: UploadedDocumentPayload
): T {
  const decoded = decodeUploadedDocument(document);

  if (document.mimeType !== 'application/json' && document.mimeType !== 'text/plain') {
    throw new Error('Only JSON or text document fixtures are supported in this MVP.');
  }

  const parsed = JSON.parse(decoded) as unknown;

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Uploaded document JSON must be an object.');
  }

  return parsed as T;
}

export async function createUploadedDocumentHash(document: UploadedDocumentPayload): Promise<string> {
  const decoded = decodeUploadedDocument(document);

  return sha256Hex(`${document.filename}:${document.mimeType}:${decoded}`);
}

export async function hashOptionalString(value: string | undefined): Promise<string | undefined> {
  const normalized = value?.trim();

  if (!normalized) {
    return undefined;
  }

  return createHashAnchor('uploaded-document-field', normalized);
}

export function getLast4(value: string | undefined): string | undefined {
  const digits = value?.replace(/\D/g, '');

  if (!digits) {
    return undefined;
  }

  return digits.slice(-4);
}
