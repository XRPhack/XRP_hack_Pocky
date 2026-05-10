import { createHashAnchor, sha256Hex } from './hashing';
import { calculateTrustChecklist } from './trust';
import { createDeterministicReservationProof } from './xrplService';
import type { DemoScenario, PrivacyProof, ShareableReport, TenantProfile } from './types';

export const demoScenario: DemoScenario = {
  tenant: {
    id: 'tenant-mina-park-demo',
    displayName: 'Mina P.',
    nationality: 'Vietnam',
    visaType: 'E-9',
    visaExpiresAt: '2027-06-30',
    monthlyIncomeKrw: 2_750_000,
    employmentVerified: true,
    schoolOrEmployer: 'Seoul Mobility Parts Co.',
    passportNumber: 'P-DEMO-849201',
    phoneNumber: '+82-10-DEMO-2244'
  },
  property: {
    id: 'property-guro-studio-203',
    title: '구로역 8분 원룸 203호',
    addressLabel: '서울 구로구 디지털로 인근',
    monthlyRentKrw: 680_000,
    originalDepositKrw: 20_000_000,
    reducedDepositKrw: 3_000_000,
    reservationAmountKrw: 2_000_000,
    landlordName: 'Kim Landlord'
  },
  rentHistory: [
    { paidAt: '2025-11-25', amountKrw: 650_000, status: 'paid', note: '정상 납부' },
    { paidAt: '2025-12-24', amountKrw: 650_000, status: 'paid', note: '정상 납부' },
    { paidAt: '2026-01-26', amountKrw: 650_000, status: 'paid', note: '정상 납부' },
    { paidAt: '2026-02-25', amountKrw: 650_000, status: 'paid', note: '정상 납부' },
    { paidAt: '2026-03-27', amountKrw: 650_000, status: 'late', note: '2일 지연, 완납' },
    { paidAt: '2026-04-25', amountKrw: 650_000, status: 'paid', note: '정상 납부' }
  ]
};

export function createExpiredVisaScenario(): DemoScenario {
  return {
    ...demoScenario,
    tenant: {
      ...demoScenario.tenant,
      id: 'tenant-expired-visa-demo',
      displayName: 'Alex K.',
      visaExpiresAt: '2025-12-31'
    }
  };
}

export function createHighRentBurdenScenario(): DemoScenario {
  return {
    ...demoScenario,
    tenant: {
      ...demoScenario.tenant,
      id: 'tenant-high-burden-demo',
      displayName: 'Sam R.',
      monthlyIncomeKrw: 1_300_000
    }
  };
}

export async function issuePrivacyProof(tenant: TenantProfile): Promise<PrivacyProof> {
  const subjectHash = await sha256Hex(
    [tenant.passportNumber, tenant.phoneNumber, tenant.nationality].join(':')
  );
  const credentialPayload = {
    subjectHash,
    visaType: tenant.visaType,
    visaExpiresAt: tenant.visaExpiresAt,
    employmentVerified: tenant.employmentVerified,
    schoolOrEmployer: tenant.schoolOrEmployer
  };
  const credentialHash = await createHashAnchor('credential', credentialPayload);
  const anchorHash = await createHashAnchor('did-anchor', {
    tenantId: tenant.id,
    credentialHash
  });

  return {
    did: `did:xrpl:testnet:${anchorHash.slice(0, 32)}`,
    credentialId: `cred:xls70:${credentialHash.slice(0, 28)}`,
    issuer: 'NomokDon Local Issuer',
    subjectHash,
    credentialHash,
    anchorHash,
    issuedAt: '2026-05-10T00:00:00.000Z',
    expiresAt: tenant.visaExpiresAt
  };
}

export async function buildShareableReport(scenario: DemoScenario = demoScenario): Promise<ShareableReport> {
  const proof = await issuePrivacyProof(scenario.tenant);
  const escrow = await createDeterministicReservationProof(scenario.tenant, scenario.property, 'locked');
  const checklist = calculateTrustChecklist(scenario.tenant, scenario.property, scenario.rentHistory, escrow);
  const rentAnchorHash = await createHashAnchor('rent-history', {
    tenantId: scenario.tenant.id,
    payments: scenario.rentHistory.map(({ paidAt, amountKrw, status }) => ({ paidAt, amountKrw, status }))
  });

  return {
    tenantLabel: `${scenario.tenant.displayName} (${scenario.tenant.nationality}, ${scenario.tenant.visaType})`,
    propertyLabel: scenario.property.title,
    proof,
    escrow,
    checklist,
    rentAnchorHash,
    generatedAt: '2026-05-10T00:00:00.000Z'
  };
}
