import { describe, expect, it } from 'vitest';
import { buildShareableReport, createExpiredVisaScenario, createHighRentBurdenScenario, demoScenario } from './scenario';

describe('NomokDon trust checklist', () => {
  it('creates a shareable default report with XRPL DID and unsigned escrow transaction drafts', async () => {
    const report = await buildShareableReport(demoScenario);

    expect(report.checklist.level).toBe('share-ready');
    expect(report.proof.did).toBe(`did:xrpl:1:${demoScenario.tenant.xrplAccount}`);
    expect(report.proof.didSetTransaction.TransactionType).toBe('DIDSet');
    expect(report.proof.subjectHash).toHaveLength(64);
    expect(report.proof.subjectHash).not.toContain(demoScenario.tenant.passportNumber);
    expect(report.escrow.mode).toBe('unsigned-transaction-draft');
    expect(report.escrow.state).toBe('ready-to-sign');
    expect(report.escrow.createTx.TransactionType).toBe('EscrowCreate');
    expect(report.escrow.finishTxTemplate.TransactionType).toBe('EscrowFinish');
    expect(report.escrow.cancelTxTemplate.TransactionType).toBe('EscrowCancel');
    expect(report.rentReputation.grade).toBe('B');
  });

  it('degrades trust when visa is expired', async () => {
    const report = await buildShareableReport(createExpiredVisaScenario());
    const visaBadge = report.checklist.badges.find((badge) => badge.id === 'visa');

    expect(report.checklist.level).toBe('not-shareable');
    expect(visaBadge?.status).toBe('fail');
  });

  it('degrades trust when rent burden is too high', async () => {
    const report = await buildShareableReport(createHighRentBurdenScenario());
    const rentBurdenBadge = report.checklist.badges.find((badge) => badge.id === 'rent-burden');

    expect(report.checklist.level).toBe('not-shareable');
    expect(rentBurdenBadge?.status).toBe('fail');
    expect(report.checklist.rentBurdenRate).toBeGreaterThan(45);
  });
});
