import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import { createServer as createHttpServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { fileURLToPath } from 'node:url';

import { Wallet } from 'xrpl';

import demoFixtures from '../scripts/demo-fixtures.json' with { type: 'json' };
import { employmentEdgeCase, employmentHappyCase } from '../src/domain/adapters/employment.fixture.js';
import { employmentDocumentAdapter } from '../src/domain/adapters/employment-document.adapter.js';
import type {
  UploadedDocumentPayload,
  UploadedEmploymentVerificationData,
  UploadedVisaVerificationData
} from '../src/domain/adapters/document.types.js';
import { rentLedgerEdgeCase, rentLedgerHappyCase } from '../src/domain/adapters/rent-ledger.fixture.js';
import { visaEdgeCase, visaHappyCase } from '../src/domain/adapters/visa.fixture.js';
import { visaDocumentAdapter } from '../src/domain/adapters/visa-document.adapter.js';
import { buildReport, type BuiltReport, type ReportAuthenticityCheck, type ReportRentPayment } from '../src/domain/report.js';
import { buildCredentialAccept, buildCredentialCreate, submitCreate } from '../src/domain/xrplCredential.js';
import { buildDidSet } from '../src/domain/xrplDid.js';
import { buildRentPayment } from '../src/domain/xrplPayment.js';
import { createEscrowContractDraft } from '../src/domain/xrplService.js';
import type { PropertyOffer, TenantProfile, VerificationStatus } from '../src/domain/types.js';

type JsonObject = Record<string, unknown>;
type SessionLocale = 'en' | 'ko';

type ApiSession = {
  userId: string;
  name: string;
  phone: string;
  locale: SessionLocale;
  tenantWalletAddress: string;
};

type TenantWalletMapping = {
  userId: string;
  classicAddress: string;
  disposable: true;
  createdAt: string;
};

type LogEvent = {
  id: string;
  type: 'auth.toss-mock' | 'issuer.sign-and-submit' | 'issuer.simulator' | 'landlord.verify-confirmed';
  createdAt: string;
  sessionId?: string;
  userId?: string;
  status: 'created' | 'dry-run' | 'submitted' | 'confirmed' | 'validated' | 'failed' | 'error';
  details: unknown;
};

type EncryptedReportPayload = {
  algorithm: 'aes-256-gcm';
  iv: string;
  tag: string;
  ciphertext: string;
};

type PlainStoredReport = {
  id: string;
  report: BuiltReport;
  placeholder: true;
  createdAt: string;
};

type EncryptedStoredReport = {
  id: string;
  encryptedReport: EncryptedReportPayload;
  placeholder: true;
  createdAt: string;
};

type StoredReport = PlainStoredReport | EncryptedStoredReport;

type StoredDidDocument = {
  id: string;
  controller: string;
  alsoKnownAs: string[];
  service: Array<{
    id: string;
    type: string;
    serviceEndpoint: string;
  }>;
  proofPurpose: string;
  createdAt: string;
};

type StoredVerifiableCredential = {
  id: string;
  type: string[];
  issuer: string;
  issuanceDate: string;
  expirationDate?: string;
  credentialSubject: {
    id: string;
    walletAddress: string;
    visa?: {
      verified: boolean;
      visaType: string;
      nationality: string;
      expiresAt: string;
      evidenceHash?: string;
      authenticity: UploadedVisaVerificationData['authenticity'];
    };
    employment?: {
      verified: boolean;
      channel: string;
      evidenceHash?: string;
      authenticity: UploadedEmploymentVerificationData['authenticity'];
    };
    reportId: string;
  };
  evidence: Array<{
    type: string;
    source: string;
    hash: string;
  }>;
};

type CredentialDescriptor = {
  id: string;
  type: string;
  uri: string;
};

type DocumentVerificationRecord = {
  sessionId: string;
  subjectId: string;
  createdAt: string;
  visa?: {
    success: boolean;
    source: string;
    verifiedAt: string;
    evidenceHash: string;
    data: UploadedVisaVerificationData;
    message?: string;
  };
  employment?: {
    success: boolean;
    source: string;
    verifiedAt: string;
    evidenceHash: string;
    data: UploadedEmploymentVerificationData;
    message?: string;
  };
};

type DocumentReviewReason = {
  kind: 'visa' | 'employment';
  code: 'parse-failed' | 'verification-failed' | 'authenticity-missing';
  title: string;
  message: string;
  action: string;
};

type IssuerConfig = {
  issuerAddress: string;
  wallet: Wallet | null;
  liveSubmitEnabled: boolean;
  canLiveSubmit: boolean;
  dryRunReason: string;
};

type SimulatorFixtureId = 'happy' | 'edge';

type SimulatorFixtureChoice = {
  id: SimulatorFixtureId;
  label: string;
  subjectId: string;
  visaType: string;
  employmentChannel: string;
  rentLedgerMonths: number;
};

type DemoFixtureTransaction = {
  label: string;
  transactionType: string;
  hash: string;
  validated: boolean;
  ledgerIndex: number;
  ledgerDate: string;
  explorerUrl: string;
};

type DemoFixtureData = {
  network: { name: string };
  accounts: {
    tenant: { address: string };
    issuer: { address: string };
  };
  transactions: DemoFixtureTransaction[];
};

type SimulatorStepDefinition = {
  stepId: 'didset' | 'visa-credential' | 'rent-credential' | 'escrow-create';
  transactionType: string;
  labelIncludes: string;
};

const SERVER_PORT = 8787;
const SESSION_ID_PREFIX = 'sess_';
const ISSUER_SESSION_ID_PREFIX = 'issuer_sess_';
const ISSUER_SESSION_COOKIE = 'nomokdon_issuer_session';
const ISSUER_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
const LOG_ID_PREFIX = 'log_';
const REPORT_ID_PREFIX = 'report_';
const DEFAULT_ISSUER_ADDRESS = 'rNomokDonIssuerDryRunOnly';
const MAX_BODY_BYTES = 10_000_000;
const VC_ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const VC_ENCRYPTION_KEY_BYTES = 32;
const VC_ENCRYPTION_IV_BYTES = 12;
const SECRET_KEY_PARTS = ['seed', 'secret', 'privatekey', 'private_key', 'tx_blob', 'txblob'];

const sessionsById = new Map<string, ApiSession>();
const issuerSessionsById = new Map<string, string>();
const walletByUserId = new Map<string, TenantWalletMapping>();
const reportsById = new Map<string, StoredReport>();
const didDocumentsByAccount = new Map<string, StoredDidDocument>();
const verifiableCredentialsById = new Map<string, StoredVerifiableCredential>();
const documentVerificationsBySessionId = new Map<string, DocumentVerificationRecord>();
const logEvents: LogEvent[] = [];

let activeSessionId: string | null = null;

const simulatorDemoFixtures = demoFixtures as DemoFixtureData;
const SIMULATOR_EVIDENCE_SOURCE = 'fixture-backed Testnet evidence';
const SIMULATOR_ESCROW_AMOUNT_XRP = 10;
const simulatorFixtureChoices: Record<SimulatorFixtureId, SimulatorFixtureChoice> = {
  happy: {
    id: 'happy',
    label: 'Happy tenant fixture',
    subjectId: visaHappyCase.subjectId,
    visaType: visaHappyCase.visaType,
    employmentChannel: employmentHappyCase.verificationChannel,
    rentLedgerMonths: rentLedgerHappyCase.ledger.length
  },
  edge: {
    id: 'edge',
    label: 'Edge tenant fixture',
    subjectId: visaEdgeCase.subjectId,
    visaType: visaEdgeCase.visaType,
    employmentChannel: employmentEdgeCase.verificationChannel,
    rentLedgerMonths: rentLedgerEdgeCase.ledger.length
  }
};
const simulatorStepDefinitions: SimulatorStepDefinition[] = [
  { stepId: 'didset', transactionType: 'DIDSet', labelIncludes: 'DIDSet' },
  { stepId: 'visa-credential', transactionType: 'CredentialCreate', labelIncludes: 'Visa CredentialCreate' },
  { stepId: 'rent-credential', transactionType: 'CredentialCreate', labelIncludes: 'Rent reputation CredentialCreate' },
  { stepId: 'escrow-create', transactionType: 'EscrowCreate', labelIncludes: 'Reservation EscrowCreate' }
];

function createId(prefix: string): string {
  return `${prefix}${randomUUID()}`;
}

function decodeBase64Key(value: string): Buffer | null {
  const normalized = value.trim().replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const decoded = Buffer.from(padded, 'base64');
  const encoded = decoded.toString('base64').replace(/=+$/g, '');

  if (encoded !== normalized.replace(/=+$/g, '')) {
    return null;
  }

  return decoded;
}

function parseVcEncryptionKey(rawKey: string): Buffer {
  const prefixedKey = rawKey.match(/^(base64|hex|utf8):(.+)$/u);
  const encoding = prefixedKey?.[1];
  const keyMaterial = prefixedKey?.[2] ?? rawKey;
  let key: Buffer | null = null;

  if (encoding === 'base64') {
    key = decodeBase64Key(keyMaterial);
  } else if (encoding === 'hex') {
    key = /^[0-9a-f]+$/iu.test(keyMaterial) && keyMaterial.length % 2 === 0 ? Buffer.from(keyMaterial, 'hex') : null;
  } else if (encoding === 'utf8') {
    key = Buffer.from(keyMaterial, 'utf8');
  } else if (/^[0-9a-f]{64}$/iu.test(keyMaterial)) {
    key = Buffer.from(keyMaterial, 'hex');
  } else {
    const base64Key = decodeBase64Key(keyMaterial);

    key = base64Key?.byteLength === VC_ENCRYPTION_KEY_BYTES ? base64Key : Buffer.from(keyMaterial, 'utf8');
  }

  if (!key || key.byteLength !== VC_ENCRYPTION_KEY_BYTES) {
    throw new Error('VC encryption key is invalid.');
  }

  return key;
}

function resolveVcEncryptionKey(): Buffer | null {
  const rawKey = normalizeString(process.env.VC_ENCRYPTION_KEY);

  if (!rawKey) {
    return null;
  }

  return parseVcEncryptionKey(rawKey);
}

function isVcEncryptionConfigured(): boolean {
  return Boolean(normalizeString(process.env.VC_ENCRYPTION_KEY));
}

function nowIso(): string {
  return new Date().toISOString();
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeLocale(value: unknown): SessionLocale {
  const locale = normalizeString(value)?.toLowerCase();

  if (locale?.startsWith('ko')) {
    return 'ko';
  }

  return 'en';
}

function normalizeUploadedDocumentPayload(value: unknown): UploadedDocumentPayload | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const filename = normalizeString(value.filename);
  const mimeType = normalizeString(value.mimeType);
  const base64 = normalizeString(value.base64);
  const allowedMimeTypes = new Set([
    'application/json',
    'text/plain',
    'application/pdf',
    'image/png',
    'image/jpeg'
  ]);

  if (!filename || !mimeType || !base64 || !allowedMimeTypes.has(mimeType)) {
    return undefined;
  }

  return {
    filename,
    mimeType: mimeType as UploadedDocumentPayload['mimeType'],
    base64
  };
}

function isSecretKey(key: string): boolean {
  const normalized = key.replace(/[-\s]/g, '_').toLowerCase();

  return SECRET_KEY_PARTS.some((part) => normalized.includes(part));
}

function sanitizeForOutput(value: unknown, depth = 0): unknown {
  if (depth > 8) {
    return '[MaxDepth]';
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForOutput(item, depth + 1));
  }

  if (!isRecord(value)) {
    return value;
  }

  const sanitized: JsonObject = {};

  for (const [key, item] of Object.entries(value)) {
    if (isSecretKey(key)) {
      continue;
    }

    sanitized[key] = sanitizeForOutput(item, depth + 1);
  }

  return sanitized;
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown, headers?: Record<string, string>): void {
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    ...headers
  });
  response.end(JSON.stringify(sanitizeForOutput(body)));
}

function sendError(response: ServerResponse, statusCode: number, code: string, message: string): void {
  sendJson(response, statusCode, {
    ok: false,
    error: {
      code,
      message
    }
  });
}

function getRequestUrl(request: IncomingMessage): URL {
  return new URL(request.url ?? '/', 'http://127.0.0.1');
}

function getHeaderValue(request: IncomingMessage, headerName: string): string | undefined {
  const value = request.headers[headerName.toLowerCase()];

  if (Array.isArray(value)) {
    return normalizeString(value[0]);
  }

  return normalizeString(value);
}

function parseCookies(request: IncomingMessage): Map<string, string> {
  const cookies = new Map<string, string>();
  const cookieHeader = getHeaderValue(request, 'cookie');

  if (!cookieHeader) {
    return cookies;
  }

  for (const pair of cookieHeader.split(';')) {
    const separatorIndex = pair.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const name = pair.slice(0, separatorIndex).trim();
    const value = pair.slice(separatorIndex + 1).trim();

    if (name) {
      cookies.set(name, value);
    }
  }

  return cookies;
}

function getIssuerSessionIdFromRequest(request: IncomingMessage): string | undefined {
  return normalizeString(parseCookies(request).get(ISSUER_SESSION_COOKIE));
}

function createIssuerSessionCookie(sessionId: string): string {
  return `${ISSUER_SESSION_COOKIE}=${sessionId}; Max-Age=${ISSUER_SESSION_MAX_AGE_SECONDS}; Path=/; HttpOnly; SameSite=Lax`;
}

function getSessionIdFromRequest(request: IncomingMessage, url: URL, body?: JsonObject): string | undefined {
  const authorization = getHeaderValue(request, 'authorization');
  const bearerToken = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : undefined;

  return (
    getHeaderValue(request, 'x-session-id') ??
    normalizeString(url.searchParams.get('sessionId')) ??
    normalizeString(body?.sessionId) ??
    bearerToken ??
    undefined
  );
}

function getCurrentSession(request: IncomingMessage, url: URL, body?: JsonObject): { sessionId?: string; session: ApiSession | null } {
  const sessionId = getSessionIdFromRequest(request, url, body) ?? activeSessionId ?? undefined;

  if (!sessionId) {
    return { session: null };
  }

  return {
    sessionId,
    session: sessionsById.get(sessionId) ?? null
  };
}

async function readJsonBody(request: IncomingMessage): Promise<JsonObject> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;

    if (totalBytes > MAX_BODY_BYTES) {
      throw new Error('Request body is too large.');
    }

    chunks.push(buffer);
  }

  if (chunks.length === 0) {
    return {};
  }

  const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;

  if (!isRecord(parsed)) {
    throw new Error('JSON body must be an object.');
  }

  return parsed;
}

function createDisposableWalletMapping(userId: string, overrideAddress?: string): TenantWalletMapping {
  const existing = walletByUserId.get(userId);

  if (existing && !overrideAddress) {
    return existing;
  }

  const classicAddress = overrideAddress ?? Wallet.generate().classicAddress;
  const mapping: TenantWalletMapping = {
    userId,
    classicAddress,
    disposable: true,
    createdAt: nowIso()
  };

  walletByUserId.set(userId, mapping);

  return mapping;
}

function appendLog(event: Omit<LogEvent, 'id' | 'createdAt'>): LogEvent {
  const logEvent: LogEvent = {
    ...event,
    id: createId(LOG_ID_PREFIX),
    createdAt: nowIso(),
    details: sanitizeForOutput(event.details)
  };

  logEvents.unshift(logEvent);

  return logEvent;
}

function createReportAad(reportId: string, createdAt: string, algorithm: EncryptedReportPayload['algorithm']): Buffer {
  return Buffer.from(JSON.stringify({ reportId, createdAt, algorithm }), 'utf8');
}

function createStoredReport(report: BuiltReport, createdAt: string): StoredReport {
  const key = resolveVcEncryptionKey();

  if (!key) {
    return {
      id: report.reportId,
      report,
      placeholder: true,
      createdAt
    };
  }

  const iv = randomBytes(VC_ENCRYPTION_IV_BYTES);
  const cipher = createCipheriv(VC_ENCRYPTION_ALGORITHM, key, iv);
  cipher.setAAD(createReportAad(report.reportId, createdAt, VC_ENCRYPTION_ALGORITHM));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(report), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    id: report.reportId,
    encryptedReport: {
      algorithm: VC_ENCRYPTION_ALGORITHM,
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      ciphertext: ciphertext.toString('base64')
    },
    placeholder: true,
    createdAt
  };
}

function readStoredReport(storedReport: StoredReport): PlainStoredReport {
  if ('report' in storedReport) {
    return storedReport;
  }

  const key = resolveVcEncryptionKey();

  if (!key) {
    throw new Error('Stored report could not be decrypted.');
  }

  try {
    const iv = Buffer.from(storedReport.encryptedReport.iv, 'base64');
    const tag = Buffer.from(storedReport.encryptedReport.tag, 'base64');
    const ciphertext = Buffer.from(storedReport.encryptedReport.ciphertext, 'base64');
    const decipher = createDecipheriv(storedReport.encryptedReport.algorithm, key, iv);

    decipher.setAAD(createReportAad(storedReport.id, storedReport.createdAt, storedReport.encryptedReport.algorithm));
    decipher.setAuthTag(tag);

    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    const report = JSON.parse(plaintext) as BuiltReport;

    return {
      id: storedReport.id,
      report,
      placeholder: storedReport.placeholder,
      createdAt: storedReport.createdAt
    };
  } catch {
    throw new Error('Stored report could not be decrypted.');
  }
}

function resolveIssuerConfig(env: NodeJS.ProcessEnv): IssuerConfig {
  const liveSubmitEnabled = env.NOMOKDON_ENABLE_LIVE_SUBMIT === 'true';
  const configuredNetwork = normalizeString(env.XRPL_NETWORK)?.toLowerCase();
  const issuerSeed = normalizeString(env.ISSUER_SEED);
  const fallbackAddress = normalizeString(env.ISSUER_ADDRESS) ?? DEFAULT_ISSUER_ADDRESS;

  if (configuredNetwork === 'mainnet') {
    return {
      issuerAddress: fallbackAddress,
      wallet: null,
      liveSubmitEnabled,
      canLiveSubmit: false,
      dryRunReason: 'Mainnet is disabled; this API only allows XRPL Testnet dry-run or explicit Testnet live submit.'
    };
  }

  if (!issuerSeed) {
    return {
      issuerAddress: fallbackAddress,
      wallet: null,
      liveSubmitEnabled,
      canLiveSubmit: false,
      dryRunReason: 'Issuer signing seed is not configured, so the API returned a dry-run draft.'
    };
  }

  try {
    const wallet = Wallet.fromSeed(issuerSeed);

    return {
      issuerAddress: wallet.classicAddress,
      wallet,
      liveSubmitEnabled,
      canLiveSubmit: liveSubmitEnabled,
      dryRunReason: liveSubmitEnabled
        ? 'Live Testnet submission is enabled.'
        : 'Live submit opt-in is disabled, so the API returned a dry-run draft.'
    };
  } catch {
    return {
      issuerAddress: fallbackAddress,
      wallet: null,
      liveSubmitEnabled,
      canLiveSubmit: false,
      dryRunReason: 'Issuer signing seed could not be parsed, so the API returned a dry-run draft.'
    };
  }
}

function toNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function toRentHistory(value: unknown): ReportRentPayment[] {
  if (!Array.isArray(value)) {
    return [
      { paidAt: '2026-02-25T00:00:00.000Z', amountKrw: 650_000, status: 'paid' },
      { paidAt: '2026-03-25T00:00:00.000Z', amountKrw: 650_000, status: 'paid' },
      { paidAt: '2026-04-25T00:00:00.000Z', amountKrw: 650_000, status: 'paid' }
    ];
  }

  return value
    .filter(isRecord)
    .map((item): ReportRentPayment => ({
      paidAt: normalizeString(item.paidAt) ?? nowIso(),
      amountKrw: toNumber(item.amountKrw, 650_000),
      status: item.status === 'late' || item.status === 'missed' ? item.status : 'paid',
      note: normalizeString(item.note),
      txHash: normalizeString(item.txHash),
      anchorHash: normalizeString(item.anchorHash)
    }));
}

function createDidDocument({
  account,
  did,
  credentialId,
  reportId,
  purpose,
  createdAt
}: {
  account: string;
  did: string;
  credentialId: string;
  reportId: string;
  purpose: string;
  createdAt: string;
}): StoredDidDocument {
  return {
    id: did,
    controller: account,
    alsoKnownAs: [`xrpl:testnet:${account}`],
    service: [
      {
        id: `${did}#credential-${credentialId}`,
        type: 'VerifiableCredentialService',
        serviceEndpoint: `/api/vc/${encodeURIComponent(credentialId)}`
      },
      {
        id: `${did}#report-${reportId}`,
        type: 'TrustReportService',
        serviceEndpoint: `/api/report/${encodeURIComponent(reportId)}`
      }
    ],
    proofPurpose: purpose,
    createdAt
  };
}

function createVerifiableCredential({
  credentialId,
  credentialType,
  issuer,
  subjectDid,
  tenantAddress,
  reportId,
  expiration,
  issuedAt,
  documentVerification
}: {
  credentialId: string;
  credentialType: string;
  issuer: string;
  subjectDid: string;
  tenantAddress: string;
  reportId: string;
  expiration: string;
  issuedAt: string;
  documentVerification?: DocumentVerificationRecord;
}): StoredVerifiableCredential {
  const evidence: StoredVerifiableCredential['evidence'] = [];

  if (documentVerification?.visa) {
    evidence.push({
      type: 'VisaDocumentHash',
      source: documentVerification.visa.source,
      hash: documentVerification.visa.evidenceHash
    });
  }

  if (documentVerification?.employment) {
    evidence.push({
      type: 'EmploymentDocumentHash',
      source: documentVerification.employment.source,
      hash: documentVerification.employment.evidenceHash
    });
  }

  return {
    id: credentialId,
    type: ['VerifiableCredential', credentialType],
    issuer,
    issuanceDate: issuedAt,
    expirationDate: expiration,
    credentialSubject: {
      id: subjectDid,
      walletAddress: tenantAddress,
      visa: documentVerification?.visa
        ? {
            verified: documentVerification.visa.success,
            visaType: documentVerification.visa.data.visaType,
            nationality: documentVerification.visa.data.nationality,
            expiresAt: documentVerification.visa.data.expiresAt,
            evidenceHash: documentVerification.visa.evidenceHash,
            authenticity: documentVerification.visa.data.authenticity
          }
        : undefined,
      employment: documentVerification?.employment
        ? {
            verified: documentVerification.employment.success,
            channel: documentVerification.employment.data.verificationChannel,
            evidenceHash: documentVerification.employment.evidenceHash,
            authenticity: documentVerification.employment.data.authenticity
          }
        : undefined,
      reportId
    },
  evidence
  };
}

function createCredentialDescriptors(requestedCredentialId: string): {
  visa: CredentialDescriptor;
  employment: CredentialDescriptor;
} {
  const visaId = requestedCredentialId;
  const employmentId = `${requestedCredentialId}_employment`;

  return {
    visa: {
      id: visaId,
      type: 'nomokdon-visa',
      uri: `https://nomokdon.app/vc/${visaId}.json`
    },
    employment: {
      id: employmentId,
      type: 'nomokdon-employment',
      uri: `https://nomokdon.app/vc/${employmentId}.json`
    }
  };
}

function createReportAuthenticityChecks(documentVerification?: DocumentVerificationRecord): ReportAuthenticityCheck[] {
  const checks: ReportAuthenticityCheck[] = [];

  if (documentVerification?.visa) {
    checks.push({
      id: 'visa-document',
      label: 'Visa document authenticity',
      status: documentVerification.visa.data.authenticity.status,
      method: documentVerification.visa.data.authenticity.method,
      summary: documentVerification.visa.data.authenticity.summary
    });
  }

  if (documentVerification?.employment) {
    checks.push({
      id: 'employment-document',
      label: 'Employment or school document authenticity',
      status: documentVerification.employment.data.authenticity.status,
      method: documentVerification.employment.data.authenticity.method,
      summary: documentVerification.employment.data.authenticity.summary
    });
  }

  return checks;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Document could not be parsed.';
}

function createDocumentParseReviewReason(kind: 'visa' | 'employment', error: unknown): DocumentReviewReason {
  return {
    kind,
    code: 'parse-failed',
    title: kind === 'visa' ? 'Visa document could not be read.' : 'Employment or school document could not be read.',
    message: errorMessage(error),
    action: 'Upload JSON, plain text, or a text-based PDF. Scanned images and image-only PDFs need manual review or OCR first.'
  };
}

function createDocumentResultReviewReasons(
  kind: 'visa' | 'employment',
  result: NonNullable<DocumentVerificationRecord['visa'] | DocumentVerificationRecord['employment']>
): DocumentReviewReason[] {
  const reasons: DocumentReviewReason[] = [];

  if (!result.success) {
    reasons.push({
      kind,
      code: 'verification-failed',
      title: kind === 'visa' ? 'Visa document needs review.' : 'Employment or school document needs review.',
      message: result.message ?? result.data.summary,
      action: kind === 'visa'
        ? 'Upload a current visa or foreign-registration document that includes visa type and expiry date.'
        : 'Upload an active employment, insurance, pension, or school enrollment document.'
    });
  }

  if (result.data.authenticity.status !== 'ready') {
    reasons.push({
      kind,
      code: 'authenticity-missing',
      title: kind === 'visa' ? 'Visa authenticity check is incomplete.' : 'Employment authenticity check is incomplete.',
      message: result.data.authenticity.summary,
      action: 'Upload a version that includes a document verification code, issue number, or QR verification URL.'
    });
  }

  return reasons;
}

async function handleHealth(response: ServerResponse): Promise<void> {
  const issuerConfig = resolveIssuerConfig(process.env);

  sendJson(response, 200, {
    ok: true,
    service: 'nomokdon-mini-api',
    ledger: 'XRPL Testnet',
    mode: issuerConfig.canLiveSubmit ? 'live-testnet' : 'dry-run',
    routes: [
      'GET /api/health',
      'POST /api/auth/toss-mock',
      'GET /api/session',
      'POST /api/verification-documents',
      'POST /api/issuer/login',
      'GET /api/issuer/session',
      'POST /api/issuer/simulator',
      'POST /api/sign-and-submit',
      'GET /api/report/:id',
      'GET /api/did/:account',
      'GET /api/vc/:credentialId',
      'POST /api/logs',
      'GET /api/logs'
    ],
    time: nowIso()
  });
}

async function handleTossMockAuth(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const body = await readJsonBody(request);
  const userId = normalizeString(body.userId) ?? createId('user_');
  const name = normalizeString(body.name) ?? 'NomokDon Tenant';
  const phone = normalizeString(body.phone) ?? '+82-10-0000-0000';
  const walletMapping = createDisposableWalletMapping(userId, normalizeString(body.tenantWalletAddress));
  const sessionId = createId(SESSION_ID_PREFIX);
  const session: ApiSession = {
    userId,
    name,
    phone,
    locale: normalizeLocale(body.locale),
    tenantWalletAddress: walletMapping.classicAddress
  };

  sessionsById.set(sessionId, session);
  activeSessionId = sessionId;

  const logEvent = appendLog({
    type: 'auth.toss-mock',
    sessionId,
    userId,
    status: 'created',
    details: {
      provider: 'toss-oauth-mock',
      tenantWalletAddress: walletMapping.classicAddress,
      disposableWallet: true
    }
  });

  sendJson(response, 201, {
    ok: true,
    sessionId,
    session,
    tenantWallet: {
      classicAddress: walletMapping.classicAddress,
      disposable: true
    },
    logId: logEvent.id
  });
}

async function handleSession(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
  const requestedSessionId = getSessionIdFromRequest(request, url);
  const { sessionId, session } = getCurrentSession(request, url);

  if (requestedSessionId && !session) {
    sendError(response, 404, 'SESSION_NOT_FOUND', 'No session exists for the provided session id.');
    return;
  }

  sendJson(response, 200, {
    ok: true,
    sessionId: session ? sessionId : null,
    session
  });
}

async function handleVerificationDocuments(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL
): Promise<void> {
  const body = await readJsonBody(request);
  const { sessionId, session } = getCurrentSession(request, url, body);

  if (!sessionId && !normalizeString(body.subjectId)) {
    sendError(response, 400, 'SESSION_OR_SUBJECT_REQUIRED', 'Provide a session or subjectId for document verification.');
    return;
  }

  const subjectId = normalizeString(body.subjectId) ?? session?.userId ?? sessionId ?? 'tenant-local';
  const createdAt = nowIso();
  const visaDocument = normalizeUploadedDocumentPayload(body.visaDocument);
  const employmentDocument = normalizeUploadedDocumentPayload(body.employmentDocument);

  if (!visaDocument && !employmentDocument) {
    sendError(response, 400, 'DOCUMENT_REQUIRED', 'Upload at least one visaDocument or employmentDocument.');
    return;
  }

  const record: DocumentVerificationRecord = {
    sessionId: sessionId ?? `subject:${subjectId}`,
    subjectId,
    createdAt
  };
  const reviewReasons: DocumentReviewReason[] = [];

  if (visaDocument) {
    try {
      const result = await visaDocumentAdapter.verify({
        subjectId,
        document: visaDocument,
        now: createdAt
      });

      record.visa = {
        success: result.success,
        source: result.source,
        verifiedAt: result.verifiedAt,
        evidenceHash: result.evidenceHash,
        data: result.data,
        message: result.message
      };
      reviewReasons.push(...createDocumentResultReviewReasons('visa', record.visa));
    } catch (error) {
      reviewReasons.push(createDocumentParseReviewReason('visa', error));
    }
  }

  if (employmentDocument) {
    try {
      const result = await employmentDocumentAdapter.verify({
        subjectId,
        document: employmentDocument,
        now: createdAt
      });

      record.employment = {
        success: result.success,
        source: result.source,
        verifiedAt: result.verifiedAt,
        evidenceHash: result.evidenceHash,
        data: result.data,
        message: result.message
      };
      reviewReasons.push(...createDocumentResultReviewReasons('employment', record.employment));
    } catch (error) {
      reviewReasons.push(createDocumentParseReviewReason('employment', error));
    }
  }

  documentVerificationsBySessionId.set(record.sessionId, record);

  sendJson(response, 201, {
    ok: true,
    verificationId: record.sessionId,
    subjectId,
    status:
      (record.visa ? record.visa.success : true) &&
      (record.employment ? record.employment.success : true) &&
      reviewReasons.length === 0
        ? 'verified'
        : 'review-needed',
    reviewReasons,
    visa: record.visa,
    employment: record.employment
  });
}

async function handleSignAndSubmit(request: IncomingMessage, response: ServerResponse, url: URL): Promise<void> {
  const body = await readJsonBody(request);
  const { sessionId, session } = getCurrentSession(request, url, body);
  const tenantAddress = session?.tenantWalletAddress ?? normalizeString(body.tenantWalletAddress);

  if (!tenantAddress) {
    sendError(response, 400, 'TENANT_WALLET_REQUIRED', 'Create a session first or provide tenantWalletAddress.');
    return;
  }

  const issuerConfig = resolveIssuerConfig(process.env);
  const reportId = isVcEncryptionConfigured() ? createId(REPORT_ID_PREFIX) : normalizeString(body.reportId) ?? createId(REPORT_ID_PREFIX);
  const credentialId = normalizeString(body.credentialId) ?? `vc_${reportId}`;
  const purpose = normalizeString(body.purpose) ?? 'nomokdon-housing-trust-pass';
  const landlordAddress = normalizeString(body.landlordAddress) ?? 'rsA2LpzuawewSBQXkiju3YQTMzW13pAAdW';
  const monthlyIncomeKrw = toNumber(body.monthlyIncomeKrw, 2_750_000);
  const monthlyRentKrw = toNumber(body.monthlyRentKrw, 650_000);
  const dryRunRequested = body.dryRun !== false;
  const issuedAt = nowIso();
  const documentVerification = sessionId ? documentVerificationsBySessionId.get(sessionId) : undefined;
  const credentials = createCredentialDescriptors(credentialId);
  const expiration =
    normalizeString(body.expiration) ??
    (documentVerification?.visa?.success ? documentVerification.visa.data.expiresAt : undefined) ??
    '2027-06-30T00:00:00.000Z';
  const visaStatus: VerificationStatus = documentVerification?.visa
    ? documentVerification.visa.success ? 'pass' : 'fail'
    : 'pass';
  const employmentStatus: VerificationStatus = documentVerification?.employment
    ? documentVerification.employment.success ? 'pass' : 'warning'
    : body.employmentVerified !== false ? 'pass' : 'warning';
  const documentAnchors = [
    documentVerification?.visa?.evidenceHash,
    documentVerification?.employment?.evidenceHash
  ].filter((hash): hash is string => Boolean(hash));
  const subjectDid = `did:xrpl:testnet:${tenantAddress}`;
  const didSet = buildDidSet({ account: tenantAddress, purpose });
  const credentialCreate = buildCredentialCreate({
    issuer: issuerConfig.issuerAddress,
    subject: tenantAddress,
    type: credentials.visa.type,
    uri: credentials.visa.uri,
    expiration
  });
  const credentialAccept = buildCredentialAccept({
    tenant: tenantAddress,
    issuer: issuerConfig.issuerAddress,
    type: credentials.visa.type
  });
  const employmentCredentialCreate = buildCredentialCreate({
    issuer: issuerConfig.issuerAddress,
    subject: tenantAddress,
    type: credentials.employment.type,
    uri: credentials.employment.uri,
    expiration
  });
  const employmentCredentialAccept = buildCredentialAccept({
    tenant: tenantAddress,
    issuer: issuerConfig.issuerAddress,
    type: credentials.employment.type
  });
  const rentPayment = await buildRentPayment({
    tenant: tenantAddress,
    landlord: landlordAddress,
    amountDrops: String(toNumber(body.amountDrops, 10_000_000)),
    rentData: sanitizeForOutput(body.rentData ?? { reportId, monthlyRentKrw, issuedAt })
  });
  const tenantProfile: TenantProfile = {
    id: session?.userId ?? 'tenant-local',
    displayName: session?.name ?? 'NomokDon Tenant',
    nationality: documentVerification?.visa?.data.nationality ?? normalizeString(body.nationality) ?? 'local',
    visaType: documentVerification?.visa?.data.visaType ?? normalizeString(body.visaType) ?? 'E-9',
    visaExpiresAt: expiration,
    monthlyIncomeKrw,
    employmentVerified: employmentStatus === 'pass',
    schoolOrEmployer:
      documentVerification?.employment?.source ??
      normalizeString(body.schoolOrEmployer) ??
      'Local employer',
    passportNumber: 'hashed-offchain-only',
    phoneNumber: session?.phone ?? '+82-10-0000-0000',
    xrplAccount: tenantAddress
  };
  const propertyOffer: PropertyOffer = {
    id: normalizeString(body.propertyId) ?? 'property-local-placeholder',
    title: normalizeString(body.propertyTitle) ?? 'Local placeholder property',
    addressLabel: normalizeString(body.addressLabel) ?? 'Seoul local MVP',
    monthlyRentKrw,
    originalDepositKrw: toNumber(body.originalDepositKrw, 20_000_000),
    reducedDepositKrw: toNumber(body.reducedDepositKrw, 3_000_000),
    reservationAmountKrw: toNumber(body.reservationAmountKrw, 2_000_000),
    landlordName: normalizeString(body.landlordName) ?? 'Local landlord',
    realtorName: normalizeString(body.realtorName) ?? 'Local realtor',
    escrowDestination: landlordAddress
  };
  const escrowDraft = await createEscrowContractDraft(tenantProfile, propertyOffer);
  const report = buildReport({
    vp: {
      reportId,
      holderId: tenantProfile.id,
      status: visaStatus === 'pass' && employmentStatus === 'pass' ? 'pass' : 'warning',
      visaStatus,
      employmentStatus,
      monthlyIncomeKrw,
      monthlyRentKrw,
      credentials: [
        { type: 'visa', status: visaStatus, credentialId: credentials.visa.id },
        { type: 'employment', status: employmentStatus, credentialId: credentials.employment.id }
      ],
      anchors: [escrowDraft.contractHash, ...documentAnchors],
      authenticityChecks: createReportAuthenticityChecks(documentVerification)
    },
    escrowState: {
      state: 'ready-to-sign',
      amountXrp: escrowDraft.amountXrp,
      anchorHash: escrowDraft.contractHash
    },
    rentHistory: toRentHistory(body.rentHistory),
    generatedAt: issuedAt
  });
  const liveSubmitWallet = !dryRunRequested && issuerConfig.canLiveSubmit ? issuerConfig.wallet : null;
  let submission: JsonObject = {
    mode: 'dry-run',
    status: 'not-submitted',
    reason: issuerConfig.dryRunReason
  };

  if (liveSubmitWallet) {
    const txResponse = await submitCreate(liveSubmitWallet, {
      issuer: issuerConfig.issuerAddress,
      subject: tenantAddress,
      type: credentials.visa.type,
      uri: credentials.visa.uri,
      expiration
    }) as { result?: { hash?: unknown; engine_result?: unknown; validated?: unknown } };

    submission = {
      mode: 'live-testnet',
      status: 'submitted',
      hash: typeof txResponse.result?.hash === 'string' ? txResponse.result.hash : undefined,
      engineResult: txResponse.result?.engine_result,
      validated: txResponse.result?.validated
    };
  }

  let storedReport: StoredReport;

  try {
    storedReport = createStoredReport(report, issuedAt);
  } catch {
    sendError(response, 500, 'REPORT_ENCRYPTION_FAILED', 'Report encryption is not available.');
    return;
  }

  reportsById.set(report.reportId, storedReport);
  didDocumentsByAccount.set(
    tenantAddress,
    createDidDocument({
      account: tenantAddress,
      did: subjectDid,
      credentialId: credentials.visa.id,
      reportId: report.reportId,
      purpose,
      createdAt: issuedAt
    })
  );
  verifiableCredentialsById.set(
    credentials.visa.id,
    createVerifiableCredential({
      credentialId: credentials.visa.id,
      credentialType: credentials.visa.type,
      issuer: issuerConfig.issuerAddress,
      subjectDid,
      tenantAddress,
      reportId: report.reportId,
      expiration,
      issuedAt,
      documentVerification
    })
  );
  verifiableCredentialsById.set(
    credentials.employment.id,
    createVerifiableCredential({
      credentialId: credentials.employment.id,
      credentialType: credentials.employment.type,
      issuer: issuerConfig.issuerAddress,
      subjectDid,
      tenantAddress,
      reportId: report.reportId,
      expiration,
      issuedAt,
      documentVerification
    })
  );

  const status = submission.status === 'submitted' ? 'submitted' : 'dry-run';
  const logEvent = appendLog({
    type: 'issuer.sign-and-submit',
    sessionId,
    userId: session?.userId,
    status,
    details: {
      reportId: report.reportId,
      mode: submission.mode,
      issuerAddress: issuerConfig.issuerAddress,
      tenantWalletAddress: tenantAddress,
      escrowAmountXrp: escrowDraft.amountXrp,
      credentialTypes: [credentials.visa.type, credentials.employment.type],
      documentVerification: documentVerification
        ? {
            visa: documentVerification.visa
              ? { success: documentVerification.visa.success, source: documentVerification.visa.source }
              : undefined,
            employment: documentVerification.employment
              ? { success: documentVerification.employment.success, source: documentVerification.employment.source }
              : undefined
          }
        : undefined,
      dryRunReason: submission.reason
    }
  });

  sendJson(response, 200, {
    ok: true,
    reportId: report.reportId,
    mode: submission.mode,
    ledger: 'XRPL Testnet',
    issuerAddress: issuerConfig.issuerAddress,
    tenantWalletAddress: tenantAddress,
    drafts: {
      didSet,
      credentialCreate,
      credentialAccept,
      employmentCredentialCreate,
      employmentCredentialAccept,
      rentPayment,
      escrowCreate: escrowDraft.createTx
    },
    documentVerification,
    submission,
    report,
    logId: logEvent.id
  });
}

async function handleReport(response: ServerResponse, reportId: string): Promise<void> {
  const storedReport = reportsById.get(reportId);

  if (!storedReport) {
    sendError(response, 404, 'REPORT_NOT_FOUND', 'No report placeholder exists for the requested id.');
    return;
  }

  try {
    sendJson(response, 200, {
      ok: true,
      ...readStoredReport(storedReport)
    });
  } catch {
    sendError(response, 500, 'REPORT_DECRYPTION_FAILED', 'Stored report is not available.');
  }
}

async function handleDidDocument(response: ServerResponse, account: string): Promise<void> {
  const didDocument = didDocumentsByAccount.get(account);

  if (!didDocument) {
    sendError(response, 404, 'DID_DOCUMENT_NOT_FOUND', 'No DID document placeholder exists for the requested account.');
    return;
  }

  sendJson(response, 200, {
    ok: true,
    didDocument
  });
}

async function handleVerifiableCredential(response: ServerResponse, credentialId: string): Promise<void> {
  const credential = verifiableCredentialsById.get(credentialId);

  if (!credential) {
    sendError(response, 404, 'VC_NOT_FOUND', 'No verifiable credential placeholder exists for the requested id.');
    return;
  }

  sendJson(response, 200, {
    ok: true,
    credential
  });
}

async function handleLogs(response: ServerResponse): Promise<void> {
  sendJson(response, 200, {
    ok: true,
    events: logEvents
  });
}

async function handleCreateLog(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const body = await readJsonBody(request);
  const reportId = normalizeString(body.reportId);

  if (!reportId) {
    sendError(response, 400, 'REPORT_ID_REQUIRED', 'A reportId is required to record verification confirmation.');
    return;
  }

  const timestamp = nowIso();
  const logEvent = appendLog({
    type: 'landlord.verify-confirmed',
    status: 'confirmed',
    details: {
      reportId,
      status: 'confirmed',
      timestamp,
      action: 'landlord-confirmed-report'
    }
  });

  sendJson(response, 201, {
    ok: true,
    logId: logEvent.id,
    event: logEvent
  });
}

async function handleIssuerLogin(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const configuredPassword = normalizeString(process.env.ISSUER_CONSOLE_PASSWORD);
  const body = await readJsonBody(request);
  const submittedPassword = normalizeString(body.password);

  if (!configuredPassword) {
    sendError(response, 503, 'ISSUER_PASSWORD_NOT_CONFIGURED', 'Issuer console password is not configured.');
    return;
  }

  if (!submittedPassword || submittedPassword !== configuredPassword) {
    sendError(response, 401, 'ISSUER_PASSWORD_INVALID', 'Issuer console password is incorrect.');
    return;
  }

  const sessionId = createId(ISSUER_SESSION_ID_PREFIX);
  issuerSessionsById.set(sessionId, nowIso());

  sendJson(
    response,
    201,
    {
      ok: true,
      authenticated: true
    },
    {
      'Set-Cookie': createIssuerSessionCookie(sessionId)
    }
  );
}

async function handleIssuerSession(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const sessionId = getIssuerSessionIdFromRequest(request);
  const authenticated = sessionId ? issuerSessionsById.has(sessionId) : false;

  sendJson(response, 200, {
    ok: true,
    authenticated
  });
}

function getSimulatorFixtureChoice(value: unknown): SimulatorFixtureChoice | undefined {
  const fixtureId = normalizeString(value);

  if (fixtureId === 'happy' || fixtureId === 'edge') {
    return simulatorFixtureChoices[fixtureId];
  }

  return undefined;
}

function getSimulatorTransaction(definition: SimulatorStepDefinition): DemoFixtureTransaction {
  const transaction = simulatorDemoFixtures.transactions.find((item) => (
    item.transactionType === definition.transactionType && item.label.includes(definition.labelIncludes)
  ));

  if (!transaction) {
    throw new Error(`Missing simulator fixture transaction for ${definition.stepId}.`);
  }

  return transaction;
}

async function handleIssuerSimulator(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const issuerSessionId = getIssuerSessionIdFromRequest(request);

  if (!issuerSessionId || !issuerSessionsById.has(issuerSessionId)) {
    sendError(response, 401, 'ISSUER_SESSION_REQUIRED', 'Issuer simulator requires an active issuer console session.');
    return;
  }

  const body = await readJsonBody(request);
  const fixtureChoice = getSimulatorFixtureChoice(body.fixtureId);

  if (!fixtureChoice) {
    sendError(response, 400, 'SIMULATOR_FIXTURE_INVALID', 'Choose one of the predefined simulator tenant fixtures.');
    return;
  }

  const executedAt = nowIso();
  const simulatorRunId = createId('simrun_');
  const steps = simulatorStepDefinitions.map((definition) => {
    const transaction = getSimulatorTransaction(definition);
    const status = transaction.validated ? 'validated' : 'failed';
    const logEvent = appendLog({
      type: 'issuer.simulator',
      sessionId: issuerSessionId,
      userId: fixtureChoice.subjectId,
      status,
      details: {
        action: 'issuer-simulator-fixture-step',
        fixtureId: fixtureChoice.id,
        fixtureLabel: fixtureChoice.label,
        simulatorRunId,
        step: definition.stepId,
        transactionType: transaction.transactionType,
        hash: transaction.hash,
        ledgerIndex: String(transaction.ledgerIndex),
        mode: 'fixture-backed-testnet',
        evidenceSource: SIMULATOR_EVIDENCE_SOURCE,
        issuerAddress: simulatorDemoFixtures.accounts.issuer.address,
        tenantWalletAddress: simulatorDemoFixtures.accounts.tenant.address,
        ...(definition.stepId === 'escrow-create' ? { escrowAmountXrp: SIMULATOR_ESCROW_AMOUNT_XRP } : {})
      }
    });

    return {
      stepId: definition.stepId,
      label: transaction.label,
      transactionType: transaction.transactionType,
      status,
      hash: transaction.hash,
      ledgerIndex: transaction.ledgerIndex,
      ledgerDate: transaction.ledgerDate,
      explorerUrl: transaction.explorerUrl,
      source: SIMULATOR_EVIDENCE_SOURCE,
      logId: logEvent.id
    };
  });

  sendJson(response, 201, {
    ok: true,
    mode: 'fixture-backed-testnet',
    ledger: simulatorDemoFixtures.network.name,
    executedAt,
    simulatorRunId,
    fixture: fixtureChoice,
    steps
  });
}

export async function handleApiRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = getRequestUrl(request);
  const pathname = url.pathname.replace(/\/$/, '') || '/';

  try {
    if (request.method === 'GET' && pathname === '/api/health') {
      await handleHealth(response);
      return;
    }

    if (request.method === 'POST' && pathname === '/api/auth/toss-mock') {
      await handleTossMockAuth(request, response);
      return;
    }

    if (request.method === 'GET' && pathname === '/api/session') {
      await handleSession(request, response, url);
      return;
    }

    if (request.method === 'POST' && pathname === '/api/verification-documents') {
      await handleVerificationDocuments(request, response, url);
      return;
    }

    if (request.method === 'POST' && pathname === '/api/issuer/login') {
      await handleIssuerLogin(request, response);
      return;
    }

    if (request.method === 'GET' && pathname === '/api/issuer/session') {
      await handleIssuerSession(request, response);
      return;
    }

    if (request.method === 'POST' && pathname === '/api/issuer/simulator') {
      await handleIssuerSimulator(request, response);
      return;
    }

    if (request.method === 'POST' && pathname === '/api/sign-and-submit') {
      await handleSignAndSubmit(request, response, url);
      return;
    }

    if (request.method === 'GET' && pathname.startsWith('/api/report/')) {
      await handleReport(response, decodeURIComponent(pathname.slice('/api/report/'.length)));
      return;
    }

    if (request.method === 'GET' && pathname.startsWith('/api/did/')) {
      await handleDidDocument(response, decodeURIComponent(pathname.slice('/api/did/'.length)));
      return;
    }

    if (request.method === 'GET' && pathname.startsWith('/api/vc/')) {
      await handleVerifiableCredential(response, decodeURIComponent(pathname.slice('/api/vc/'.length)));
      return;
    }

    if (request.method === 'GET' && pathname === '/api/logs') {
      await handleLogs(response);
      return;
    }

    if (request.method === 'POST' && pathname === '/api/logs') {
      await handleCreateLog(request, response);
      return;
    }

    sendError(response, 404, 'NOT_FOUND', 'Route not found.');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.';
    appendLog({
      type: 'issuer.sign-and-submit',
      status: 'error',
      details: { route: pathname, message }
    });
    sendError(response, 400, 'BAD_REQUEST', message);
  }
}

export function createApiServer(): Server {
  return createHttpServer((request, response) => {
    void handleApiRequest(request, response);
  });
}

export function resetApiState(): void {
  sessionsById.clear();
  issuerSessionsById.clear();
  walletByUserId.clear();
  reportsById.clear();
  didDocumentsByAccount.clear();
  verifiableCredentialsById.clear();
  documentVerificationsBySessionId.clear();
  logEvents.splice(0, logEvents.length);
  activeSessionId = null;
}

export function dumpReportStoreForTest(): string {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Report store dump is only available in tests.');
  }

  return JSON.stringify([...reportsById.values()]);
}

const isDirectRun = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;

if (isDirectRun) {
  createApiServer().listen(SERVER_PORT, '127.0.0.1', () => {
    console.log(`NomokDon mini API listening on http://127.0.0.1:${SERVER_PORT}`);
  });
}
