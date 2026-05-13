import type { EscrowCancel, EscrowCreate, EscrowFinish, TxResponse, Wallet } from 'xrpl';

import { submitAndWait } from './xrplClient.js';
import { isoTimeToRippleTime } from './xrplEncoding.js';

export type TimeBasedEscrowTime = string | Date | number;

export interface TimeBasedEscrowCreateParams {
  account: string;
  destination: string;
  amountDrops: string;
  finishAfter: TimeBasedEscrowTime;
  cancelAfter: TimeBasedEscrowTime;
}

export interface TimeBasedEscrowActionParams {
  account: string;
  owner: string;
  offerSequence: number;
}

function toRippleTime(time: TimeBasedEscrowTime): number {
  if (typeof time === 'number') {
    return time;
  }

  return isoTimeToRippleTime(time);
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
}

function assertAmountDrops(amountDrops: string): void {
  if (!/^\d+$/.test(amountDrops) || amountDrops === '0') {
    throw new Error('amountDrops must be a positive drops string');
  }
}

// Time-based MVP escrow: release and cancellation are controlled only by ledger timestamps.
export function buildEscrowCreate({
  account,
  destination,
  amountDrops,
  finishAfter,
  cancelAfter
}: TimeBasedEscrowCreateParams): EscrowCreate {
  const finishAfterRippleTime = toRippleTime(finishAfter);
  const cancelAfterRippleTime = toRippleTime(cancelAfter);

  assertAmountDrops(amountDrops);

  if (cancelAfterRippleTime <= finishAfterRippleTime) {
    throw new Error('cancelAfter must be after finishAfter');
  }

  return {
    TransactionType: 'EscrowCreate',
    Account: account,
    Destination: destination,
    Amount: amountDrops,
    FinishAfter: finishAfterRippleTime,
    CancelAfter: cancelAfterRippleTime
  };
}

export function buildEscrowFinish({
  account,
  owner,
  offerSequence
}: TimeBasedEscrowActionParams): EscrowFinish {
  assertPositiveInteger(offerSequence, 'offerSequence');

  return {
    TransactionType: 'EscrowFinish',
    Account: account,
    Owner: owner,
    OfferSequence: offerSequence
  };
}

export function buildEscrowCancel({
  account,
  owner,
  offerSequence
}: TimeBasedEscrowActionParams): EscrowCancel {
  assertPositiveInteger(offerSequence, 'offerSequence');

  return {
    TransactionType: 'EscrowCancel',
    Account: account,
    Owner: owner,
    OfferSequence: offerSequence
  };
}

export function submitEscrowCreate(
  params: TimeBasedEscrowCreateParams,
  wallet: Wallet
): Promise<TxResponse<EscrowCreate>> {
  return submitAndWait(buildEscrowCreate(params), wallet);
}

export function submitEscrowFinish(
  params: TimeBasedEscrowActionParams,
  wallet: Wallet
): Promise<TxResponse<EscrowFinish>> {
  return submitAndWait(buildEscrowFinish(params), wallet);
}

export function submitEscrowCancel(
  params: TimeBasedEscrowActionParams,
  wallet: Wallet
): Promise<TxResponse<EscrowCancel>> {
  return submitAndWait(buildEscrowCancel(params), wallet);
}
