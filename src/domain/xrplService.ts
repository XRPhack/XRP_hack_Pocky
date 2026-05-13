import { createHashAnchor } from './hashing.js';
import type { PropertyOffer, TenantProfile, XrplReservationProof } from './types.js';

const dropsPerXrp = 1_000_000;
const testnetReservationXrp = 10;
const rippleEpochOffset = 946_684_800;

function toRippleTime(isoDate: string): number {
  return Math.floor(new Date(isoDate).getTime() / 1000) - rippleEpochOffset;
}

export async function createEscrowContractDraft(
  tenant: TenantProfile,
  property: PropertyOffer,
  state: XrplReservationProof['state'] = 'ready-to-sign'
): Promise<XrplReservationProof> {
  const contractHash = await createHashAnchor('reservation-escrow-contract', {
    tenantId: tenant.id,
    propertyId: property.id,
    reservationAmountKrw: property.reservationAmountKrw,
    ownerAccount: tenant.xrplAccount,
    destinationAccount: property.escrowDestination,
    state
  });
  const amountDrops = String(testnetReservationXrp * dropsPerXrp);
  const finishAfterRippleTime = toRippleTime('2026-05-17T00:00:00.000Z');
  const cancelAfterRippleTime = toRippleTime('2026-06-30T00:00:00.000Z');
  const memo = {
    Memo: {
      MemoType: '6E6F6D6F6B646F6E2D657363726F77',
      MemoData: contractHash.toUpperCase()
    }
  };

  return {
    mode: 'unsigned-transaction-draft',
    ledger: 'XRPL Testnet',
    state,
    ownerAccount: tenant.xrplAccount,
    destinationAccount: property.escrowDestination,
    amountXrp: testnetReservationXrp,
    amountDrops,
    contractHash,
    finishAfterRippleTime,
    cancelAfterRippleTime,
    createTx: {
      TransactionType: 'EscrowCreate',
      Account: tenant.xrplAccount,
      Destination: property.escrowDestination,
      Amount: amountDrops,
      FinishAfter: finishAfterRippleTime,
      CancelAfter: cancelAfterRippleTime,
      Memos: [memo]
    },
    finishTxTemplate: {
      TransactionType: 'EscrowFinish',
      Account: property.escrowDestination,
      Owner: tenant.xrplAccount,
      OfferSequence: 'FROM_VALIDATED_ESCROW_CREATE_SEQUENCE',
      Memos: [memo]
    },
    cancelTxTemplate: {
      TransactionType: 'EscrowCancel',
      Account: tenant.xrplAccount,
      Owner: tenant.xrplAccount,
      OfferSequence: 'FROM_VALIDATED_ESCROW_CREATE_SEQUENCE',
      Memos: [memo]
    },
    caveat:
      '이 화면은 가짜 tx hash가 아니라 XRPL 지갑 서명에 넘길 unsigned EscrowCreate transaction draft입니다. seed/private key는 앱에 저장하지 않고, 제출 후 validated Sequence를 EscrowFinish/EscrowCancel에 사용합니다.'
  };
}
