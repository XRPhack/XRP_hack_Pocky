import { createHashAnchor } from '../hashing.js';
import type { UploadedDocumentPayload } from './document.types.js';
import { createUploadedDocumentHash } from './document-parsing.js';

export type DocumentManualReviewKind = 'visa' | 'employment';
export type DocumentManualReviewReasonCode = 'parse-failed' | 'verification-failed' | 'authenticity-missing';
export type DocumentManualReviewStatus = 'queued' | 'not-configured';

export type DocumentManualReviewTicket = {
  id: string;
  kind: DocumentManualReviewKind;
  status: DocumentManualReviewStatus;
  queue: 'manual-review' | 'ocr';
  reasonCode: DocumentManualReviewReasonCode;
  documentHash?: string;
  createdAt: string;
  summary: string;
};

export type DocumentManualReviewRequest = {
  kind: DocumentManualReviewKind;
  reasonCode: DocumentManualReviewReasonCode;
  document?: UploadedDocumentPayload;
  createdAt: string;
  summary: string;
};

export type DocumentReviewQueueAdapter = {
  readonly id: string;
  enqueue(request: DocumentManualReviewRequest): Promise<DocumentManualReviewTicket>;
};

function isOcrCandidate(document: UploadedDocumentPayload | undefined): boolean {
  return document?.mimeType === 'application/pdf'
    || document?.mimeType === 'image/png'
    || document?.mimeType === 'image/jpeg';
}

export async function createManualReviewTicket(request: DocumentManualReviewRequest): Promise<DocumentManualReviewTicket> {
  const documentHash = request.document ? await createUploadedDocumentHash(request.document) : undefined;
  const queue = isOcrCandidate(request.document) ? 'ocr' : 'manual-review';
  const ticketSeed = [
    request.kind,
    request.reasonCode,
    request.createdAt,
    documentHash ?? 'no-document'
  ].join(':');
  const idHash = await createHashAnchor('document-manual-review-ticket', ticketSeed);

  return {
    id: idHash.slice(0, 24),
    kind: request.kind,
    status: 'queued',
    queue,
    reasonCode: request.reasonCode,
    ...(documentHash ? { documentHash } : {}),
    createdAt: request.createdAt,
    summary: request.summary
  };
}

export const noopDocumentReviewQueueAdapter: DocumentReviewQueueAdapter = {
  id: 'noop-document-review-queue',
  async enqueue(request) {
    return {
      ...(await createManualReviewTicket(request)),
      status: 'not-configured'
    };
  }
};
