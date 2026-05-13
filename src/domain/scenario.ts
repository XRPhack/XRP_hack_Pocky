import { createHashAnchor, sha256Hex, stringToHex } from './hashing.js';
import { calculateTrustChecklist } from './trust.js';
import { createEscrowContractDraft } from './xrplService.js';
import type { DemoScenario, OffchainVerificationSource, PrivacyProof, RentPayment, RentReputation, ShareableReport, TenantProfile } from './types.js';

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
    phoneNumber: '+82-10-DEMO-2244',
    xrplAccount: 'rf1BiGeXwwQoi8Z2ueFYTEXSwuJYfV2Jpn'
  },
  property: {
    id: 'property-guro-studio-203',
    title: '구로역 8분 원룸 203호',
    addressLabel: '서울 구로구 디지털로 인근',
    monthlyRentKrw: 680_000,
    originalDepositKrw: 20_000_000,
    reducedDepositKrw: 3_000_000,
    reservationAmountKrw: 2_000_000,
    landlordName: 'Kim Landlord',
    realtorName: 'Guro Partner Realty',
    escrowDestination: 'rsA2LpzuawewSBQXkiju3YQTMzW13pAAdW'
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

export const verificationSources: OffchainVerificationSource[] = [
  {
    id: 'visa-status',
    label: '체류자격',
    provider: '출입국/비자 확인 어댑터',
    status: 'pass',
    dataFlow: '사용자 동의 -> 오프체인 기관 조회 -> 결과 요약 -> 해시 앵커',
    anchorField: 'credentialHash'
  },
  {
    id: 'employment-status',
    label: '고용/재학',
    provider: '고용보험/학교/고용주 확인 어댑터',
    status: 'pass',
    dataFlow: '사용자 동의 -> 오프체인 확인 -> 상태값만 리포트 반영',
    anchorField: 'credentialHash'
  },
  {
    id: 'rent-ledger',
    label: '월세 이력',
    provider: '임차인 납부 원장/계좌 내역 어댑터',
    status: 'pass',
    dataFlow: '상세 납부 내역 수집 -> 내부 등급화 -> 원본 비공개 -> 요약 해시 앵커',
    anchorField: 'rentAnchorHash'
  },
  {
    id: 'property-supply',
    label: '매물 검증',
    provider: '제휴 중개사 매물 어댑터',
    status: 'pass',
    dataFlow: '제휴 매물 확인 -> 보증금 인하 가능 조건 저장 -> 리포트에 요약 표시',
    anchorField: 'contractHash'
  }
];

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
    credentialHash,
    controllingAccount: tenant.xrplAccount
  });
  const did = `did:xrpl:1:${tenant.xrplAccount}`;
  const didDocumentUri = `ipfs://nomokdon/${anchorHash.slice(0, 32)}`;
  const didAttestation = {
    subjectHash,
    credentialHash,
    issuer: 'NomokDon Local Issuer',
    purpose: 'housing-trust-pass'
  };

  return {
    did,
    networkId: 1,
    controllingAccount: tenant.xrplAccount,
    credentialId: `cred:xls70:${credentialHash.slice(0, 28)}`,
    issuer: 'NomokDon Local Issuer',
    didDocumentUri,
    didSetTransaction: {
      TransactionType: 'DIDSet',
      Account: tenant.xrplAccount,
      URI: stringToHex(didDocumentUri),
      Data: stringToHex(JSON.stringify(didAttestation)),
      Memos: [
        {
          Memo: {
            MemoType: '6E6F6D6F6B646F6E2D646964',
            MemoData: anchorHash.toUpperCase()
          }
        }
      ]
    },
    subjectHash,
    credentialHash,
    anchorHash,
    issuedAt: '2026-05-10T00:00:00.000Z',
    expiresAt: tenant.visaExpiresAt
  };
}

function calculateRentReputation(history: RentPayment[]): RentReputation {
  const observedMonths = history.length;
  const lateCount = history.filter((payment) => payment.status === 'late').length;
  const missedCount = history.filter((payment) => payment.status === 'missed').length;
  const paidCount = history.filter((payment) => payment.status === 'paid').length;
  const onTimeRate = observedMonths === 0 ? 0 : Math.round((paidCount / observedMonths) * 1000) / 10;

  if (missedCount > 0) {
    return { observedMonths, onTimeRate, lateCount, missedCount, grade: 'D', summary: '미납 이력으로 보증 파트너 검토 필요' };
  }

  if (lateCount > 1) {
    return { observedMonths, onTimeRate, lateCount, missedCount, grade: 'C', summary: '지연 납부가 반복되어 조건부 공유' };
  }

  if (lateCount === 1) {
    return { observedMonths, onTimeRate, lateCount, missedCount, grade: 'B', summary: '대부분 정상 납부, 1회 지연' };
  }

  return { observedMonths, onTimeRate, lateCount, missedCount, grade: 'A', summary: '정상 납부 이력 우수' };
}

export async function buildShareableReport(scenario: DemoScenario = demoScenario): Promise<ShareableReport> {
  const proof = await issuePrivacyProof(scenario.tenant);
  const escrow = await createEscrowContractDraft(scenario.tenant, scenario.property, 'ready-to-sign');
  const rentReputation = calculateRentReputation(scenario.rentHistory);
  const checklist = calculateTrustChecklist(scenario.tenant, scenario.property, rentReputation, escrow);
  const rentAnchorHash = await createHashAnchor('rent-history', {
    tenantId: scenario.tenant.id,
    payments: scenario.rentHistory.map(({ paidAt, amountKrw, status }) => ({ paidAt, amountKrw, status }))
  });

  return {
    tenantLabel: `${scenario.tenant.displayName} (${scenario.tenant.nationality}, ${scenario.tenant.visaType})`,
    propertyLabel: scenario.property.title,
    proof,
    sources: verificationSources,
    escrow,
    checklist,
    rentReputation,
    rentAnchorHash,
    generatedAt: '2026-05-10T00:00:00.000Z'
  };
}
