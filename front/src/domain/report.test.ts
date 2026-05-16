import { describe, expect, it } from 'vitest';

import { buildReport, type ReportRentPayment } from './report';
import type { VpVerificationResult } from './vp';

const generatedAt = '2026-05-12T00:00:00.000Z';

const healthyRentHistory: ReportRentPayment[] = [
  { paidAt: '2025-11-01T09:00:00.000Z', amountKrw: 650_000, status: 'paid' },
  { paidAt: '2025-12-01T09:00:00.000Z', amountKrw: 650_000, status: 'paid' },
  { paidAt: '2026-01-01T09:00:00.000Z', amountKrw: 650_000, status: 'paid' },
  { paidAt: '2026-02-01T09:00:00.000Z', amountKrw: 650_000, status: 'paid' },
  { paidAt: '2026-03-03T09:00:00.000Z', amountKrw: 650_000, status: 'late' },
  {
    paidAt: '2026-04-01T09:00:00.000Z',
    amountKrw: 650_000,
    status: 'paid',
    anchorHash: 'rent-anchor-001'
  }
];

function statusesById(report: ReturnType<typeof buildReport>) {
  return Object.fromEntries(report.badges.map((badge) => [badge.id, badge.status]));
}

describe('report', () => {
  it('builds exactly six UI-ready badges with the required labels', () => {
    const report = buildReport({
      vp: {
        reportId: 'report_happy',
        holderId: 'tenant-mina-001',
        visaStatus: 'pass',
        employmentStatus: 'pass',
        monthlyIncomeKrw: 2_750_000,
        monthlyRentKrw: 650_000,
        anchors: ['vp-anchor-001']
      },
      escrowState: {
        state: 'locked',
        amountXrp: 10,
        txHash: 'escrow-tx-001'
      },
      rentHistory: healthyRentHistory,
      generatedAt
    });

    expect(report.reportId).toBe('report_happy');
    expect(report.holderId).toBe('tenant-mina-001');
    expect(report.generatedAt).toBe(generatedAt);
    expect(report.trustGrade).toBe('A');
    expect(report.badges).toHaveLength(6);
    expect(report.badges.map((badge) => badge.id)).toEqual([
      'visa-valid',
      'employment-confirmed',
      'rent-burden',
      'escrow',
      'rent-history',
      'on-chain-verification'
    ]);
    expect(report.badges.map((badge) => badge.label)).toEqual([
      '비자유효',
      '고용확인',
      '부담률',
      'Escrow',
      '납부이력',
      '온체인검증'
    ]);
    expect(statusesById(report)).toEqual({
      'visa-valid': 'pass',
      'employment-confirmed': 'pass',
      'rent-burden': 'pass',
      escrow: 'pass',
      'rent-history': 'pass',
      'on-chain-verification': 'pass'
    });
  });

  it('uses a VP verification result when one is passed in', () => {
    const vpResult: VpVerificationResult = {
      reportId: 'report_verified_vp',
      status: 'pass',
      holderId: 'tenant-mina-001',
      credentialIds: ['cred_visa_001'],
      verifiedAt: generatedAt,
      checks: {
        issuerPresence: 'pass',
        expiration: 'pass',
        credentialSet: 'pass'
      },
      credentials: [
        {
          credentialId: 'cred_visa_001',
          type: 'visa',
          issuer: 'Seoul Immigration Mock Desk',
          status: 'pass',
          expiresAt: '2027-11-30T00:00:00.000Z'
        }
      ],
      caveat: 'Local MVP verification result.'
    };

    const report = buildReport({
      vp: vpResult,
      escrowState: { state: 'ready-to-sign', anchorHash: 'escrow-anchor-001' },
      rentHistory: healthyRentHistory,
      generatedAt
    });

    expect(report.reportId).toBe('report_verified_vp');
    expect(report.holderId).toBe('tenant-mina-001');
    expect(statusesById(report)).toMatchObject({
      'visa-valid': 'pass',
      'employment-confirmed': 'warning',
      'rent-burden': 'warning',
      escrow: 'pass',
      'rent-history': 'pass',
      'on-chain-verification': 'pass'
    });
    expect(report.trustGrade).toBe('B');
  });

  it('degrades trust grade deterministically from badge statuses', () => {
    const oneFailReport = buildReport({
      vp: {
        reportId: 'report_one_fail',
        holderId: 'tenant-mina-002',
        visaStatus: 'pass',
        employmentStatus: 'pass',
        rentBurdenRate: 50,
        txHashes: ['vp-tx-001']
      },
      escrowState: { state: 'locked', txHash: 'escrow-tx-001' },
      rentHistory: healthyRentHistory,
      generatedAt
    });

    const twoFailReport = buildReport({
      vp: {
        reportId: 'report_two_fail',
        holderId: 'tenant-mina-003',
        visaStatus: 'fail',
        employmentStatus: 'pass',
        rentBurdenRate: 50,
        txHashes: ['vp-tx-002']
      },
      escrowState: { state: 'locked', txHash: 'escrow-tx-002' },
      rentHistory: healthyRentHistory,
      generatedAt
    });

    expect(statusesById(oneFailReport)['rent-burden']).toBe('fail');
    expect(oneFailReport.trustGrade).toBe('C');
    expect(statusesById(twoFailReport)['visa-valid']).toBe('fail');
    expect(statusesById(twoFailReport)['rent-burden']).toBe('fail');
    expect(twoFailReport.trustGrade).toBe('D');
  });
});
