import { createHashAnchor } from './hashing';
import type { PropertyOffer, TenantProfile, XrplReservationProof } from './types';

const dropsPerXrp = 1_000_000;
const krwPerDemoXrp = 1_000;

export async function createDeterministicReservationProof(
  tenant: TenantProfile,
  property: PropertyOffer,
  state: XrplReservationProof['state'] = 'locked'
): Promise<XrplReservationProof> {
  const memoHash = await createHashAnchor('reservation-escrow', {
    tenantId: tenant.id,
    propertyId: property.id,
    reservationAmountKrw: property.reservationAmountKrw,
    state
  });
  const txHash = (await createHashAnchor('xrpl-fallback-tx', memoHash)).toUpperCase();
  const escrowSequence = Number.parseInt(txHash.slice(0, 8), 16).toString();
  const amountXrp = Math.round((property.reservationAmountKrw / krwPerDemoXrp) * dropsPerXrp) / dropsPerXrp;

  return {
    mode: 'deterministic-fallback',
    ledger: 'XRPL Testnet',
    state,
    escrowSequence,
    txHash,
    explorerUrl: `https://testnet.xrpl.org/transactions/${txHash}`,
    amountXrp,
    memoHash,
    caveat:
      '로컬 MVP는 seed, private key, 실제 KRW 이동 없이 결정론적 Testnet-style proof를 생성합니다. Live Testnet 제출은 xrpl.js 지갑 주입 후 연결할 TODO입니다.'
  };
}

export function getFallbackTxLinks(proof: XrplReservationProof): string[] {
  return [proof.explorerUrl, `https://test.bithomp.com/explorer/${proof.txHash}`];
}

// TODO: Live Testnet wiring should accept an injected, user-owned signer and never store seeds in this repo or localStorage.
