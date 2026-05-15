import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Wallet } from 'xrpl';

import { createApiServer, dumpReportStoreForTest, resetApiState } from './server';

type ApiJson = Record<string, unknown>;

const originalEnv = { ...process.env };

let server: Server;
let baseUrl: string;

function listen(serverToStart: Server): Promise<string> {
  return new Promise((resolve, reject) => {
    serverToStart.once('error', reject);
    serverToStart.listen(0, '127.0.0.1', () => {
      serverToStart.off('error', reject);
      const address = serverToStart.address();

      if (!address || typeof address === 'string') {
        reject(new Error('Expected TCP server address.'));
        return;
      }

      resolve(`http://127.0.0.1:${(address as AddressInfo).port}`);
    });
  });
}

function close(serverToClose: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    serverToClose.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function apiFetch(path: string, init?: RequestInit): Promise<{ response: Response; json: ApiJson; text: string }> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers
    }
  });
  const text = await response.text();
  const json = JSON.parse(text) as ApiJson;

  return { response, json, text };
}

function postJson(path: string, body: ApiJson, headers?: HeadersInit) {
  return apiFetch(path, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
}

function asBase64Json(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
}

function expectNoSecrets(text: string, secrets: string[]): void {
  for (const secret of secrets) {
    expect(text).not.toContain(secret);
  }
}

describe('mini Node API', () => {
  beforeEach(async () => {
    process.env = { ...originalEnv };
    delete process.env.ISSUER_SEED;
    delete process.env.NOMOKDON_ENABLE_LIVE_SUBMIT;
    delete process.env.XRPL_NETWORK;
    delete process.env.VC_ENCRYPTION_KEY;
    resetApiState();
    server = createApiServer();
    baseUrl = await listen(server);
  });

  afterEach(async () => {
    await close(server);
    resetApiState();
    process.env = { ...originalEnv };
  });

  it('returns a clear health response without live network access', async () => {
    const { response, json } = await apiFetch('/api/health');

    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      ok: true,
      service: 'nomokdon-mini-api',
      ledger: 'XRPL Testnet',
      mode: 'dry-run'
    });
    expect(json.routes).toContain('POST /api/auth/toss-mock');
    expect(json.routes).toContain('POST /api/verification-documents');
    expect(json.routes).toContain('POST /api/issuer/login');
    expect(json.routes).toContain('GET /api/issuer/session');
    expect(json.routes).toContain('POST /api/issuer/simulator');
    expect(json.routes).toContain('POST /api/sign-and-submit');
    expect(json.routes).toContain('POST /api/logs');
  });

  it('rejects issuer console password failures without setting a cookie', async () => {
    const password = 'issuer-test-password';
    process.env.ISSUER_CONSOLE_PASSWORD = password;

    const { response, json, text } = await postJson('/api/issuer/login', {
      password: 'wrong-password'
    });

    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(json).toMatchObject({
      ok: false,
      error: {
        code: 'ISSUER_PASSWORD_INVALID'
      }
    });
    expectNoSecrets(text, [password, 'wrong-password']);
  });

  it('sets an opaque issuer session cookie and validates it on refresh checks', async () => {
    const password = 'issuer-test-password';
    process.env.ISSUER_CONSOLE_PASSWORD = password;

    const login = await postJson('/api/issuer/login', { password });
    const setCookie = login.response.headers.get('set-cookie');

    expect(login.response.status).toBe(201);
    expect(login.json).toMatchObject({ ok: true, authenticated: true });
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain('nomokdon_issuer_session=issuer_sess_');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
    expect(login.text).not.toContain(password);
    expect(setCookie).not.toContain(password);

    const cookie = String(setCookie).split(';')[0];
    const validSession = await apiFetch('/api/issuer/session', {
      headers: { Cookie: cookie }
    });

    expect(validSession.response.status).toBe(200);
    expect(validSession.json).toMatchObject({ ok: true, authenticated: true });

    const invalidSession = await apiFetch('/api/issuer/session', {
      headers: { Cookie: 'nomokdon_issuer_session=issuer_sess_missing' }
    });

    expect(invalidSession.response.status).toBe(200);
    expect(invalidSession.json).toMatchObject({ ok: true, authenticated: false });
    expectNoSecrets(validSession.text, [password]);
    expectNoSecrets(invalidSession.text, [password]);
  });

  it('requires the issuer session cookie before running the fixture-backed simulator', async () => {
    const leakedSeed = 'simulator-request-seed-should-not-leak';
    const { response, json, text } = await postJson('/api/issuer/simulator', {
      fixtureId: 'happy',
      seed: leakedSeed
    });

    expect(response.status).toBe(401);
    expect(json).toMatchObject({
      ok: false,
      error: {
        code: 'ISSUER_SESSION_REQUIRED'
      }
    });
    expectNoSecrets(text, [leakedSeed]);
  });

  it('runs the issuer simulator against predefined tenant fixtures and logs four validated public TX steps', async () => {
    const password = 'issuer-test-password';
    const leakedSeed = 'simulator-seed-should-not-leak';
    const leakedPrivateKey = 'simulator-private-key-should-not-leak';
    process.env.ISSUER_CONSOLE_PASSWORD = password;

    const login = await postJson('/api/issuer/login', { password });
    const cookie = String(login.response.headers.get('set-cookie')).split(';')[0];
    const simulator = await postJson(
      '/api/issuer/simulator',
      {
        fixtureId: 'happy',
        seed: leakedSeed,
        privateKey: leakedPrivateKey
      },
      { Cookie: cookie }
    );

    expect(simulator.response.status).toBe(201);
    expect(simulator.json).toMatchObject({
      ok: true,
      mode: 'fixture-backed-testnet',
      ledger: 'XRPL Testnet',
      fixture: {
        id: 'happy',
        subjectId: 'tenant-mina-001'
      }
    });
    expect(simulator.json.steps).toHaveLength(4);
    expect(simulator.json.steps).toEqual([
      expect.objectContaining({ stepId: 'didset', transactionType: 'DIDSet', status: 'validated' }),
      expect.objectContaining({ stepId: 'visa-credential', transactionType: 'CredentialCreate', status: 'validated' }),
      expect.objectContaining({ stepId: 'rent-credential', transactionType: 'CredentialCreate', status: 'validated' }),
      expect.objectContaining({ stepId: 'escrow-create', transactionType: 'EscrowCreate', status: 'validated' })
    ]);
    expect(simulator.text).toContain('fixture-backed Testnet evidence');
    expectNoSecrets(simulator.text, [password, leakedSeed, leakedPrivateKey]);

    const logs = await apiFetch('/api/logs');

    expect(logs.response.status).toBe(200);
    expect(logs.json.events).toHaveLength(4);
    expect(logs.json.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'issuer.simulator', status: 'validated' }),
      expect.objectContaining({ type: 'issuer.simulator', status: 'validated' }),
      expect.objectContaining({ type: 'issuer.simulator', status: 'validated' }),
      expect.objectContaining({ type: 'issuer.simulator', status: 'validated' })
    ]));
    const simulatorEvents = logs.json.events as Array<{ details?: Record<string, unknown> }>;
    const simulatorRunIds = new Set(simulatorEvents.map((event) => event.details?.simulatorRunId));
    const escrowEvent = simulatorEvents.find((event) => event.details?.step === 'escrow-create');

    expect(simulatorRunIds.size).toBe(1);
    expect(String([...simulatorRunIds][0])).toMatch(/^simrun_/);
    expect(escrowEvent?.details).toMatchObject({ escrowAmountXrp: 10 });
    expect(logs.text).toContain('10792A6D1D9F215431D70D98B46BA98307FE193E8DE1DB8EEA21B7040711AA0C');
    expect(logs.text).toContain('BEAE9BA0916013DC5B9C41A87C2412D03853CBB149A6E5A751A3075B8EF273AF');
    expectNoSecrets(logs.text, [password, leakedSeed, leakedPrivateKey]);
  });

  it('creates a sanitized Toss mock session with a disposable tenant wallet mapping', async () => {
    const tenantWalletAddress = Wallet.generate().classicAddress;
    const { response, json, text } = await postJson('/api/auth/toss-mock', {
      userId: 'user-mina',
      name: 'Mina',
      phone: '+82-10-1111-2222',
      locale: 'ko-KR',
      tenantWalletAddress,
      seed: 'tenant-seed-should-not-leak',
      secret: 'tenant-secret-should-not-leak',
      privateKey: 'tenant-private-key-should-not-leak'
    });

    expect(response.status).toBe(201);
    expect(json.sessionId).toMatch(/^sess_/);
    expect(json.session).toMatchObject({
      userId: 'user-mina',
      name: 'Mina',
      phone: '+82-10-1111-2222',
      locale: 'ko',
      tenantWalletAddress
    });
    expect(json.tenantWallet).toMatchObject({
      classicAddress: tenantWalletAddress,
      disposable: true
    });
    expectNoSecrets(text, [
      'tenant-seed-should-not-leak',
      'tenant-secret-should-not-leak',
      'tenant-private-key-should-not-leak'
    ]);

    const sessionResponse = await apiFetch('/api/session', {
      headers: { 'x-session-id': String(json.sessionId) }
    });

    expect(sessionResponse.response.status).toBe(200);
    expect(sessionResponse.json.session).toEqual(json.session);
  });

  it('returns issuance and auth log events from memory', async () => {
    await postJson('/api/auth/toss-mock', {
      userId: 'user-log',
      name: 'Log User',
      phone: '+82-10-3333-4444'
    });

    const { response, json } = await apiFetch('/api/logs');

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.events).toEqual([
      expect.objectContaining({
        id: expect.stringMatching(/^log_/),
        type: 'auth.toss-mock',
        status: 'created',
        userId: 'user-log'
      })
    ]);
  });

  it('records a safe landlord verification confirmation log without personal data', async () => {
    const { response, json, text } = await postJson('/api/logs', {
      reportId: 'report_safe-confirmation',
      action: 'clicked-confirmation',
      status: 'confirmed',
      landlordName: 'Unsafe Landlord Name',
      phone: '+82-10-9999-0000',
      email: 'landlord@example.test',
      ip: '203.0.113.24',
      deviceFingerprint: 'fingerprint-should-not-leak'
    });

    expect(response.status).toBe(201);
    expect(json.ok).toBe(true);
    expect(json.logId).toMatch(/^log_/);
    expect(json.event).toMatchObject({
      id: expect.stringMatching(/^log_/),
      type: 'landlord.verify-confirmed',
      status: 'confirmed',
      details: {
        reportId: 'report_safe-confirmation',
        status: 'confirmed',
        action: 'landlord-confirmed-report'
      }
    });
    expect(text).toContain('timestamp');
    expectNoSecrets(text, ['Unsafe Landlord Name', '+82-10-9999-0000', 'landlord@example.test', '203.0.113.24', 'fingerprint-should-not-leak']);

    const logs = await apiFetch('/api/logs');

    expect(logs.response.status).toBe(200);
    expect(logs.json.events).toEqual([
      expect.objectContaining({
        type: 'landlord.verify-confirmed',
        status: 'confirmed',
        details: expect.objectContaining({
          reportId: 'report_safe-confirmation',
          action: 'landlord-confirmed-report'
        })
      })
    ]);
    expectNoSecrets(logs.text, ['Unsafe Landlord Name', '+82-10-9999-0000', 'landlord@example.test', '203.0.113.24', 'fingerprint-should-not-leak']);
  });

  it('dry-runs sign-and-submit, stores a report, and never exposes issuer or request secrets', async () => {
    const issuerWallet = Wallet.generate();
    const tenantWalletAddress = Wallet.generate().classicAddress;
    const issuerSeed = issuerWallet.seed;

    if (!issuerSeed) {
      throw new Error('Expected generated issuer wallet to include a seed.');
    }

    process.env.ISSUER_SEED = issuerSeed;
    process.env.NOMOKDON_ENABLE_LIVE_SUBMIT = 'false';
    process.env.XRPL_NETWORK = 'testnet';

    const auth = await postJson('/api/auth/toss-mock', {
      userId: 'user-sign',
      name: 'Signer',
      phone: '+82-10-5555-6666',
      tenantWalletAddress
    });
    const leakedRequestSeed = 'request-seed-should-not-leak';
    const leakedRequestSecret = 'request-secret-should-not-leak';
    const leakedPrivateKey = 'request-private-key-should-not-leak';
    const leakedTxBlob = 'request-tx-blob-should-not-leak';
    const sign = await postJson(
      '/api/sign-and-submit',
      {
        sessionId: String(auth.json.sessionId),
        dryRun: true,
        credentialType: 'nomokdon-visa',
        monthlyIncomeKrw: 2_800_000,
        monthlyRentKrw: 700_000,
        rentData: {
          month: '2026-05',
          seed: leakedRequestSeed,
          secret: leakedRequestSecret,
          privateKey: leakedPrivateKey,
          tx_blob: leakedTxBlob
        }
      },
      { 'x-session-id': String(auth.json.sessionId) }
    );

    expect(sign.response.status).toBe(200);
    expect(sign.json).toMatchObject({
      ok: true,
      mode: 'dry-run',
      ledger: 'XRPL Testnet',
      issuerAddress: issuerWallet.classicAddress,
      tenantWalletAddress
    });
    expect(sign.json.reportId).toMatch(/^report_/);
    expect(sign.text).toContain('CredentialCreate');
    expect(sign.text).not.toContain('tx_blob');
    expectNoSecrets(sign.text, [issuerSeed, leakedRequestSeed, leakedRequestSecret, leakedPrivateKey, leakedTxBlob]);

    const report = await apiFetch(`/api/report/${String(sign.json.reportId)}`);

    expect(report.response.status).toBe(200);
    expect(report.json).toMatchObject({
      ok: true,
      id: sign.json.reportId,
      placeholder: true
    });
    expectNoSecrets(report.text, [issuerSeed, leakedRequestSeed, leakedRequestSecret, leakedPrivateKey, leakedTxBlob]);

    const logs = await apiFetch('/api/logs');

    expect(logs.response.status).toBe(200);
    expect(logs.text).toContain('issuer.sign-and-submit');
    expectNoSecrets(logs.text, [issuerSeed, leakedRequestSeed, leakedRequestSecret, leakedPrivateKey, leakedTxBlob]);
  });

  it('uses uploaded visa and employment document verification for the generated report', async () => {
    const tenantWalletAddress = Wallet.generate().classicAddress;
    const rawForeignRegistrationNumber = '900101-5123456';
    const organizationName = 'Busan Technical College';
    const auth = await postJson('/api/auth/toss-mock', {
      userId: 'user-doc-upload',
      name: 'Document Tenant',
      phone: '+82-10-5555-1212',
      tenantWalletAddress
    });
    const sessionId = String(auth.json.sessionId);
    const upload = await postJson(
      '/api/verification-documents',
      {
        sessionId,
        visaDocument: {
          filename: 'foreign-registration.json',
          mimeType: 'application/json',
          base64: asBase64Json({
            documentType: 'foreign-registration-certificate',
            visaType: 'E-9',
            nationality: 'Kyrgyzstan',
            expiresAt: '2027-11-30T00:00:00.000Z',
            issuer: 'Ministry of Justice Mock',
            foreignRegistrationNumber: rawForeignRegistrationNumber
          })
        },
        employmentDocument: {
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
      },
      { 'x-session-id': sessionId }
    );

    expect(upload.response.status).toBe(201);
    expect(upload.json).toMatchObject({
      ok: true,
      status: 'verified',
      visa: expect.objectContaining({ success: true }),
      employment: expect.objectContaining({ success: true })
    });
    expectNoSecrets(upload.text, [rawForeignRegistrationNumber, organizationName]);

    const sign = await postJson(
      '/api/sign-and-submit',
      {
        sessionId,
        dryRun: true,
        credentialType: 'nomokdon-visa'
      },
      { 'x-session-id': sessionId }
    );

    expect(sign.response.status).toBe(200);
    expect(sign.json.report).toMatchObject({
      badges: expect.arrayContaining([
        expect.objectContaining({ id: 'visa-valid', status: 'pass' }),
        expect.objectContaining({ id: 'employment-confirmed', status: 'pass' })
      ])
    });
    expect(sign.json.documentVerification).toMatchObject({
      visa: expect.objectContaining({ success: true }),
      employment: expect.objectContaining({ success: true })
    });
    expect(sign.text).toContain('2027-11-30T00:00:00.000Z');
    expectNoSecrets(sign.text, [rawForeignRegistrationNumber, organizationName]);

    const did = await apiFetch(`/api/did/${encodeURIComponent(tenantWalletAddress)}`);

    expect(did.response.status).toBe(200);
    expect(did.json.didDocument).toMatchObject({
      id: `did:xrpl:testnet:${tenantWalletAddress}`,
      controller: tenantWalletAddress,
      proofPurpose: 'nomokdon-housing-trust-pass'
    });
    expect(did.json.didDocument).toHaveProperty('service');
    expect(did.text).toContain('/api/vc/vc_');
    expect(did.text).toContain(`/api/report/${String(sign.json.reportId)}`);
    expectNoSecrets(did.text, [rawForeignRegistrationNumber, organizationName]);

    const credentialId = `vc_${String(sign.json.reportId)}`;
    const vc = await apiFetch(`/api/vc/${encodeURIComponent(credentialId)}`);

    expect(vc.response.status).toBe(200);
    expect(vc.json.credential).toMatchObject({
      id: credentialId,
      type: ['VerifiableCredential', 'nomokdon-visa'],
      credentialSubject: {
        id: `did:xrpl:testnet:${tenantWalletAddress}`,
        walletAddress: tenantWalletAddress,
        reportId: sign.json.reportId,
        visa: expect.objectContaining({
          verified: true,
          visaType: 'E-9',
          nationality: 'Kyrgyzstan',
          expiresAt: '2027-11-30T00:00:00.000Z'
        }),
        employment: expect.objectContaining({
          verified: true,
          channel: 'school'
        })
      }
    });
    const credential = vc.json.credential as { evidence: unknown[] };
    expect(credential.evidence).toHaveLength(2);
    expectNoSecrets(vc.text, [rawForeignRegistrationNumber, organizationName]);
  });

  it('encrypts the in-memory report store and preserves report API responses when configured', async () => {
    const keyMaterial = '0123456789abcdef0123456789abcdef';
    const callerProvidedReportId = 'report_caller_supplied_should_not_be_stored';
    const tenantWalletAddress = Wallet.generate().classicAddress;
    const tenantUserId = 'user-encrypted-vc-pii';
    const tenantPhone = '+82-10-7777-8888';

    process.env.VC_ENCRYPTION_KEY = keyMaterial;

    const auth = await postJson('/api/auth/toss-mock', {
      userId: tenantUserId,
      name: 'Encrypted VC Tenant',
      phone: tenantPhone,
      tenantWalletAddress
    });
    const sign = await postJson(
      '/api/sign-and-submit',
      {
        sessionId: String(auth.json.sessionId),
        dryRun: true,
        reportId: callerProvidedReportId,
        credentialId: 'vc_encrypted_memory',
        credentialType: 'nomokdon-visa',
        monthlyIncomeKrw: 3_100_000,
        monthlyRentKrw: 720_000
      },
      { 'x-session-id': String(auth.json.sessionId) }
    );

    expect(sign.response.status).toBe(200);
    expect(sign.json.reportId).toMatch(/^report_/);
    expect(sign.json.reportId).not.toBe(callerProvidedReportId);
    expectNoSecrets(sign.text, [keyMaterial]);

    const report = await apiFetch(`/api/report/${String(sign.json.reportId)}`);

    expect(report.response.status).toBe(200);
    expect(report.json).toMatchObject({
      ok: true,
      id: sign.json.reportId,
      placeholder: true
    });
    expect(report.json.report).toEqual(sign.json.report);
    expectNoSecrets(report.text, [keyMaterial]);

    const memoryDump = dumpReportStoreForTest();

    expect(memoryDump).toContain('"encryptedReport"');
    expect(memoryDump).toContain('"ciphertext"');
    expect(memoryDump).toContain('"aes-256-gcm"');
    expect(memoryDump).not.toContain('"report":');
    expectNoSecrets(memoryDump, [
      tenantUserId,
      tenantPhone,
      'trustGrade',
      'badges',
      'visa-valid',
      'vc_encrypted_memory',
      callerProvidedReportId,
      keyMaterial
    ]);
  });

  it('returns a safe error without storing a report when the VC encryption key is invalid', async () => {
    const invalidKey = 'too-short-vc-key';

    process.env.VC_ENCRYPTION_KEY = invalidKey;

    const sign = await postJson('/api/sign-and-submit', {
      tenantWalletAddress: Wallet.generate().classicAddress,
      dryRun: true,
      reportId: 'report_invalid_encryption_key'
    });

    expect(sign.response.status).toBe(500);
    expect(sign.json).toMatchObject({
      ok: false,
      error: {
        code: 'REPORT_ENCRYPTION_FAILED'
      }
    });
    expectNoSecrets(sign.text, [invalidKey]);
    expect(dumpReportStoreForTest()).toBe('[]');
  });
});
