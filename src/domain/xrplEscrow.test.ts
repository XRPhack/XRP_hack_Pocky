import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSubmitAndWait = vi.hoisted(() =>
  vi.fn(async (tx: unknown, wallet: unknown) => ({ tx, wallet }))
);

vi.mock('./xrplClient', () => ({
  submitAndWait: mockSubmitAndWait
}));

import {
  buildEscrowCancel,
  buildEscrowCreate,
  buildEscrowFinish,
  submitEscrowCancel,
  submitEscrowCreate,
  submitEscrowFinish
} from './xrplEscrow';
import { isoTimeToRippleTime } from './xrplEncoding';

const tenantAccount = 'rTENANT111111111111111111111111111111';
const landlordAccount = 'rLANDLORD111111111111111111111111111';
const amountDrops = '10000000';
const finishAfterIso = '2026-05-12T00:00:00.000Z';
const cancelAfterDate = new Date('2026-05-12T01:00:00.000Z');
const forbiddenFields = [
  'Condition',
  'Fulfillment',
  'TokenEscrow',
  'Signers',
  'SignerQuorum',
  'SignerEntries'
] as const;

function expectNoForbiddenFields(tx: Record<string, unknown>): void {
  for (const field of forbiddenFields) {
    expect(tx).not.toHaveProperty(field);
  }
}

describe('xrplEscrow time-based MVP builders', () => {
  beforeEach(() => {
    mockSubmitAndWait.mockClear();
  });

  it('builds an EscrowCreate using only time-based FinishAfter and CancelAfter values', () => {
    const tx = buildEscrowCreate({
      account: tenantAccount,
      destination: landlordAccount,
      amountDrops,
      finishAfter: finishAfterIso,
      cancelAfter: cancelAfterDate
    });

    expect(tx).toEqual({
      TransactionType: 'EscrowCreate',
      Account: tenantAccount,
      Destination: landlordAccount,
      Amount: amountDrops,
      FinishAfter: isoTimeToRippleTime(finishAfterIso),
      CancelAfter: isoTimeToRippleTime(cancelAfterDate)
    });
    expect(tx.CancelAfter).toBeGreaterThan(tx.FinishAfter ?? 0);
    expectNoForbiddenFields(tx);
  });

  it('rejects escrow windows where CancelAfter is not after FinishAfter', () => {
    expect(() =>
      buildEscrowCreate({
        account: tenantAccount,
        destination: landlordAccount,
        amountDrops,
        finishAfter: '2026-05-12T01:00:00.000Z',
        cancelAfter: '2026-05-12T01:00:00.000Z'
      })
    ).toThrow('cancelAfter must be after finishAfter');
  });

  it('rejects invalid drops amounts before producing an escrow transaction', () => {
    expect(() =>
      buildEscrowCreate({
        account: tenantAccount,
        destination: landlordAccount,
        amountDrops: '10 XRP',
        finishAfter: finishAfterIso,
        cancelAfter: cancelAfterDate
      })
    ).toThrow('amountDrops must be a positive drops string');
  });

  it('builds finish and cancel transactions with numeric OfferSequence values', () => {
    const offerSequence = 12345;
    const finishTx = buildEscrowFinish({
      account: landlordAccount,
      owner: tenantAccount,
      offerSequence
    });
    const cancelTx = buildEscrowCancel({
      account: tenantAccount,
      owner: tenantAccount,
      offerSequence
    });

    expect(finishTx).toEqual({
      TransactionType: 'EscrowFinish',
      Account: landlordAccount,
      Owner: tenantAccount,
      OfferSequence: offerSequence
    });
    expect(cancelTx).toEqual({
      TransactionType: 'EscrowCancel',
      Account: tenantAccount,
      Owner: tenantAccount,
      OfferSequence: offerSequence
    });
    expect(typeof finishTx.OfferSequence).toBe('number');
    expect(typeof cancelTx.OfferSequence).toBe('number');
    expectNoForbiddenFields(finishTx);
    expectNoForbiddenFields(cancelTx);
  });

  it('rejects placeholder or non-positive OfferSequence values', () => {
    expect(() =>
      buildEscrowFinish({
        account: landlordAccount,
        owner: tenantAccount,
        offerSequence: 'FROM_VALIDATED_ESCROW_CREATE_SEQUENCE' as never
      })
    ).toThrow('offerSequence must be a positive integer');
    expect(() =>
      buildEscrowCancel({
        account: tenantAccount,
        owner: tenantAccount,
        offerSequence: 0
      })
    ).toThrow('offerSequence must be a positive integer');
  });

  it('keeps submit helpers as thin wrappers around submitAndWait', async () => {
    const wallet = { classicAddress: 'rWALLET1111111111111111111111111111' } as never;
    const createParams = {
      account: tenantAccount,
      destination: landlordAccount,
      amountDrops,
      finishAfter: finishAfterIso,
      cancelAfter: cancelAfterDate
    };
    const actionParams = {
      account: landlordAccount,
      owner: tenantAccount,
      offerSequence: 12345
    };

    await submitEscrowCreate(createParams, wallet);
    await submitEscrowFinish(actionParams, wallet);
    await submitEscrowCancel(actionParams, wallet);

    expect(mockSubmitAndWait).toHaveBeenNthCalledWith(1, buildEscrowCreate(createParams), wallet);
    expect(mockSubmitAndWait).toHaveBeenNthCalledWith(2, buildEscrowFinish(actionParams), wallet);
    expect(mockSubmitAndWait).toHaveBeenNthCalledWith(3, buildEscrowCancel(actionParams), wallet);
  });
});
