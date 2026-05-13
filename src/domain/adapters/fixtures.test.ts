import { describe, expect, it } from 'vitest';
import type { AdapterResult } from './adapter.interface';
import {
  employmentEdgeCase,
  employmentHappyCase,
  employmentMockAdapter,
  rentLedgerEdgeCase,
  rentLedgerHappyCase,
  rentLedgerMockAdapter,
  visaEdgeCase,
  visaHappyCase,
  visaMockAdapter,
} from './index';

function expectAdapterResult<T>(result: AdapterResult<T>, expectedSource: string) {
  expect(result).toEqual(
    expect.objectContaining({
      success: expect.any(Boolean),
      data: expect.any(Object),
      verifiedAt: expect.any(String),
      source: expectedSource,
      evidenceHash: expect.any(String),
    }),
  );
}

describe('adapter fixtures', () => {
  it('exports and resolves visa fixtures without network access', async () => {
    const happy = await visaMockAdapter.verify(visaHappyCase);
    const edge = await visaMockAdapter.verify(visaEdgeCase);

    expectAdapterResult(happy, 'mock-fixture:visa');
    expectAdapterResult(edge, 'mock-fixture:visa');
    expect(happy.success).toBe(true);
    expect(happy.data.expiryStatus).toBe('valid');
    expect(edge.success).toBe(false);
    expect(edge.data.expiryStatus).toBe('expired');
  });

  it('exports and resolves employment fixtures without network access', async () => {
    const happy = await employmentMockAdapter.verify(employmentHappyCase);
    const edge = await employmentMockAdapter.verify(employmentEdgeCase);

    expectAdapterResult(happy, 'mock-fixture:employment');
    expectAdapterResult(edge, 'mock-fixture:employment');
    expect(happy.success).toBe(true);
    expect(happy.data.status).toBe('verified');
    expect(edge.success).toBe(false);
    expect(edge.data.status).toBe('unverified');
  });

  it('exports and resolves rent ledger fixtures without network access', async () => {
    const happy = await rentLedgerMockAdapter.verify(rentLedgerHappyCase);
    const edge = await rentLedgerMockAdapter.verify(rentLedgerEdgeCase);

    expectAdapterResult(happy, 'mock-fixture:rent-ledger');
    expectAdapterResult(edge, 'mock-fixture:rent-ledger');
    expect(happy.success).toBe(true);
    expect(happy.data.observedMonths).toBe(6);
    expect(happy.data.grade).toBe('B');
    expect(edge.success).toBe(false);
    expect(edge.data.missedCount).toBeGreaterThan(0);
  });
});
