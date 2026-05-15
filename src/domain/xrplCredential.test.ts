import { beforeEach, describe, expect, it, vi } from 'vitest';

import { hexEncode, isoTimeToRippleTime } from './xrplEncoding';

const submitAndWaitMock = vi.hoisted(() =>
  vi.fn(async (tx: unknown, wallet: unknown) => ({ tx, wallet }))
);

vi.mock('./xrplClient', () => ({
  submitAndWait: submitAndWaitMock
}));

import {
  SUPPORTED_CREDENTIAL_TYPES,
  buildCredentialAccept,
  buildCredentialCreate,
  submitAccept,
  submitCreate
} from './xrplCredential';

describe('xrplCredential', () => {
  beforeEach(() => {
    submitAndWaitMock.mockClear();
  });

  it('exports the supported MVP credential types', () => {
    expect(SUPPORTED_CREDENTIAL_TYPES).toEqual([
      'nomokdon-visa',
      'nomokdon-employment',
      'nomokdon-rent-reputation'
    ]);
  });

  it('builds a CredentialCreate draft with hex fields and Ripple expiration', () => {
    expect(
      buildCredentialCreate({
        issuer: 'rISSUER',
        subject: 'rTENANT',
        type: 'nomokdon-visa',
        uri: 'https://nomokdon.app/vc/visa.json',
        expiration: '2027-06-30T00:00:00.000Z'
      })
    ).toEqual({
      TransactionType: 'CredentialCreate',
      Account: 'rISSUER',
      Subject: 'rTENANT',
      CredentialType: hexEncode('nomokdon-visa'),
      URI: hexEncode('https://nomokdon.app/vc/visa.json'),
      Expiration: isoTimeToRippleTime('2027-06-30T00:00:00.000Z')
    });
  });

  it('builds a CredentialAccept draft for rent reputation', () => {
    expect(
      buildCredentialAccept({
        tenant: 'rTENANT',
        issuer: 'rISSUER',
        type: 'nomokdon-rent-reputation'
      })
    ).toEqual({
      TransactionType: 'CredentialAccept',
      Account: 'rTENANT',
      Issuer: 'rISSUER',
      CredentialType: hexEncode('nomokdon-rent-reputation')
    });
  });

  it('normalizes Date expiration values through Ripple time conversion', () => {
    const tx = buildCredentialCreate({
      issuer: 'rISSUER',
      subject: 'rTENANT',
      type: 'nomokdon-rent-reputation',
      uri: 'https://nomokdon.app/vc/rent.json',
      expiration: new Date('2000-01-02T00:00:00.000Z')
    });

    expect(tx.Expiration).toBe(86_400);
  });

  it('rejects unhexified credential types longer than 64 bytes', () => {
    expect(() =>
      buildCredentialAccept({
        tenant: 'rTENANT',
        issuer: 'rISSUER',
        type: 'a'.repeat(65)
      })
    ).toThrow('CredentialType must be 64 bytes or fewer before hex encoding');
  });

  it('builds employment CredentialCreate drafts', () => {
    expect(
      buildCredentialCreate({
        issuer: 'rISSUER',
        subject: 'rTENANT',
        type: 'nomokdon-employment',
        uri: 'https://nomokdon.app/vc/employment.json',
        expiration: '2027-06-30T00:00:00.000Z'
      })
    ).toEqual({
      TransactionType: 'CredentialCreate',
      Account: 'rISSUER',
      Subject: 'rTENANT',
      CredentialType: hexEncode('nomokdon-employment'),
      URI: hexEncode('https://nomokdon.app/vc/employment.json'),
      Expiration: isoTimeToRippleTime('2027-06-30T00:00:00.000Z')
    });
  });

  it('submits CredentialCreate through the shared submitAndWait wrapper', async () => {
    const issuerWallet = { classicAddress: 'rISSUER' } as never;
    const input = {
      issuer: 'rISSUER',
      subject: 'rTENANT',
      type: 'nomokdon-visa',
      uri: 'https://nomokdon.app/vc/visa.json',
      expiration: 900_000
    };
    const expectedTx = buildCredentialCreate(input);

    await submitCreate(issuerWallet, input);

    expect(submitAndWaitMock).toHaveBeenCalledWith(expectedTx, issuerWallet);
  });

  it('submits CredentialAccept through the shared submitAndWait wrapper', async () => {
    const tenantWallet = { classicAddress: 'rTENANT' } as never;
    const input = {
      tenant: 'rTENANT',
      issuer: 'rISSUER',
      type: 'nomokdon-rent-reputation'
    };
    const expectedTx = buildCredentialAccept(input);

    await submitAccept(tenantWallet, input);

    expect(submitAndWaitMock).toHaveBeenCalledWith(expectedTx, tenantWallet);
  });
});
