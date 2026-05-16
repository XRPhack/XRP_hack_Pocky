import type { SubmittableTransaction, TxResponse, Wallet } from 'xrpl';

import { createHashAnchor } from './hashing.js';
import { submitAndWait } from './xrplClient.js';
import { buildMemo } from './xrplEncoding.js';
import type { XrplMemo } from './types.js';

export type RentPaymentInput = {
  tenant: string;
  landlord: string;
  amountDrops: string;
  rentData: unknown;
};

export type XrplRentPaymentTransaction = {
  TransactionType: 'Payment';
  Account: string;
  Destination: string;
  Amount: string;
  Memos: XrplMemo[];
};

export async function hashRentPaymentData(rentData: unknown): Promise<string> {
  return createHashAnchor('rent-payment', rentData);
}

export async function buildRentPayment({
  tenant,
  landlord,
  amountDrops,
  rentData
}: RentPaymentInput): Promise<XrplRentPaymentTransaction> {
  const rentHash = await hashRentPaymentData(rentData);

  return {
    TransactionType: 'Payment',
    Account: tenant,
    Destination: landlord,
    Amount: amountDrops,
    Memos: [buildMemo({ type: 'nomokdon-rent', data: rentHash })]
  };
}

export async function submitRentPayment(
  wallet: Wallet,
  input: RentPaymentInput
): Promise<TxResponse<SubmittableTransaction>> {
  const payment = await buildRentPayment(input);

  return submitAndWait(payment as SubmittableTransaction, wallet);
}
