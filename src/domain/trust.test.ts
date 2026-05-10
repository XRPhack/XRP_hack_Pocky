import { describe, expect, it } from 'vitest';
import { buildShareableReport, createExpiredVisaScenario, createHighRentBurdenScenario, demoScenario } from './scenario';

describe('NomokDon trust checklist', () => {
  it('creates a shareable default report with hashed proof and fallback XRPL state', async () => {
    const report = await buildShareableReport(demoScenario);

    expect(report.checklist.level).toBe('share-ready');
    expect(report.proof.subjectHash).toHaveLength(64);
    expect(report.proof.subjectHash).not.toContain(demoScenario.tenant.passportNumber);
    expect(report.escrow.mode).toBe('deterministic-fallback');
    expect(report.escrow.state).toBe('locked');
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
