import type { AdapterResult, VerificationAdapter } from './adapter.interface.js';

export type RentLedgerEntry = {
  paidAt: string;
  amountKrw: number;
  status: 'paid' | 'late' | 'missed';
  note: string;
};

export type RentLedgerVerificationInput = {
  subjectId: string;
  landlordName: string;
  monthlyRentKrw: number;
  ledger: RentLedgerEntry[];
};

export type RentLedgerVerificationData = {
  subjectId: string;
  landlordName: string;
  observedMonths: number;
  onTimeRate: number;
  lateCount: number;
  missedCount: number;
  grade: 'A' | 'B' | 'C' | 'D';
  summary: string;
  ledger: RentLedgerEntry[];
};

export const rentLedgerHappyCase: RentLedgerVerificationInput = {
  subjectId: 'tenant-mina-001',
  landlordName: 'River View Residence',
  monthlyRentKrw: 650000,
  ledger: [
    { paidAt: '2025-11-01T09:00:00.000Z', amountKrw: 650000, status: 'paid', note: 'Paid on the due date.' },
    { paidAt: '2025-12-01T09:00:00.000Z', amountKrw: 650000, status: 'paid', note: 'Paid on the due date.' },
    { paidAt: '2026-01-01T09:00:00.000Z', amountKrw: 650000, status: 'paid', note: 'Paid one day early.' },
    { paidAt: '2026-02-01T09:00:00.000Z', amountKrw: 650000, status: 'paid', note: 'Paid on the due date.' },
    { paidAt: '2026-03-03T09:00:00.000Z', amountKrw: 650000, status: 'late', note: 'Paid three days late.' },
    { paidAt: '2026-04-01T09:00:00.000Z', amountKrw: 650000, status: 'paid', note: 'Paid on the due date.' },
  ],
};

export const rentLedgerEdgeCase: RentLedgerVerificationInput = {
  subjectId: 'tenant-mina-002',
  landlordName: 'River View Residence',
  monthlyRentKrw: 650000,
  ledger: [
    { paidAt: '2025-11-09T09:00:00.000Z', amountKrw: 650000, status: 'late', note: 'Paid eight days late.' },
    { paidAt: '2025-12-01T09:00:00.000Z', amountKrw: 650000, status: 'paid', note: 'Paid on time.' },
    { paidAt: '2026-01-15T09:00:00.000Z', amountKrw: 650000, status: 'missed', note: 'Payment missing after reminder.' },
    { paidAt: '2026-02-05T09:00:00.000Z', amountKrw: 650000, status: 'late', note: 'Paid five days late.' },
    { paidAt: '2026-03-01T09:00:00.000Z', amountKrw: 650000, status: 'missed', note: 'Payment never received.' },
    { paidAt: '2026-04-11T09:00:00.000Z', amountKrw: 650000, status: 'late', note: 'Paid ten days late.' },
  ],
};

const verifiedAt = '2026-05-12T00:00:00.000Z';
const happyEvidenceHash = '5555555555555555555555555555555555555555555555555555555555555555';
const edgeEvidenceHash = '6666666666666666666666666666666666666666666666666666666666666666';

function buildRentLedgerResult(
  input: RentLedgerVerificationInput,
): AdapterResult<RentLedgerVerificationData> {
  const observedMonths = input.ledger.length;
  const onTimeCount = input.ledger.filter((entry) => entry.status === 'paid').length;
  const lateCount = input.ledger.filter((entry) => entry.status === 'late').length;
  const missedCount = input.ledger.filter((entry) => entry.status === 'missed').length;
  const onTimeRate = observedMonths === 0 ? 0 : onTimeCount / observedMonths;
  const success = observedMonths >= 6 && onTimeRate >= 0.8 && missedCount === 0;
  const grade: 'A' | 'B' | 'C' | 'D' = success ? (lateCount > 0 ? 'B' : 'A') : 'D';

  return {
    success,
    data: {
      subjectId: input.subjectId,
      landlordName: input.landlordName,
      observedMonths,
      onTimeRate,
      lateCount,
      missedCount,
      grade,
      summary: success
        ? 'Six-month rent history is mostly on time with no missed payments.'
        : 'Late and missed rent payments prevent this ledger from being share-ready.',
      ledger: input.ledger,
    },
    verifiedAt,
    source: 'mock-fixture:rent-ledger',
    evidenceHash: success ? happyEvidenceHash : edgeEvidenceHash,
    message: success ? undefined : 'Ledger includes late or missed payments for edge-case coverage.',
  };
}

export const rentLedgerMockAdapter: VerificationAdapter<
  RentLedgerVerificationInput,
  RentLedgerVerificationData
> = {
  id: 'mock-rent-ledger-fixture',
  name: 'Rent ledger fixture adapter',
  async verify(input) {
    return buildRentLedgerResult(input);
  },
};
