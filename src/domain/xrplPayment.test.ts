import { describe, expect, it, vi } from 'vitest';

import { submitAndWait } from './xrplClient';
import { hexDecode, hexEncode } from './xrplEncoding';
import { buildRentPayment, hashRentPaymentData, submitRentPayment } from './xrplPayment';

vi.mock('./xrplClient', () => ({
  submitAndWait: vi.fn(async (tx: unknown, wallet: unknown) => ({ tx, wallet }))
}));

const rentData = {
  paidAt: '2026-05-01',
  amountKrw: 750_000,
  addressLabel: '서울 마포구 테스트로 12',
  status: 'paid'
};

describe('xrplPayment', () => {
  it('hashes rent payment data deterministically without preserving key order', async () => {
    const sameRentData = {
      status: 'paid',
      addressLabel: '서울 마포구 테스트로 12',
      amountKrw: 750_000,
      paidAt: '2026-05-01'
    };

    await expect(hashRentPaymentData(rentData)).resolves.toBe(await hashRentPaymentData(sameRentData));
    await expect(hashRentPaymentData(rentData)).resolves.toMatch(/^[0-9a-f]{64}$/);
  });

  it('builds an XRPL Payment draft with a hash-only rent memo', async () => {
    const payment = await buildRentPayment({
      tenant: 'rTENANTACCOUNT',
      landlord: 'rLANDLORDACCOUNT',
      amountDrops: '1000000',
      rentData
    });
    const memo = payment.Memos[0].Memo;
    const decodedMemoData = hexDecode(memo.MemoData);

    expect(payment).toMatchObject({
      TransactionType: 'Payment',
      Account: 'rTENANTACCOUNT',
      Destination: 'rLANDLORDACCOUNT',
      Amount: '1000000'
    });
    expect(memo.MemoType).toBe(hexEncode('nomokdon-rent'));
    expect(decodedMemoData).toBe(await hashRentPaymentData(rentData));
    expect(decodedMemoData).toMatch(/^[0-9a-f]{64}$/);

    const serializedMemos = JSON.stringify(payment.Memos);
    expect(serializedMemos).not.toContain(String(rentData.amountKrw));
    expect(serializedMemos).not.toContain(rentData.paidAt);
    expect(serializedMemos).not.toContain(rentData.addressLabel);
  });

  it('submits the unsigned rent payment draft through the shared XRPL client wrapper', async () => {
    const wallet = { classicAddress: 'rTENANTACCOUNT' } as never;
    const input = {
      tenant: 'rTENANTACCOUNT',
      landlord: 'rLANDLORDACCOUNT',
      amountDrops: '1000000',
      rentData
    };

    await submitRentPayment(wallet, input);

    expect(submitAndWait).toHaveBeenCalledWith(await buildRentPayment(input), wallet);
  });
});
