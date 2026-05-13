import type { PropertyOffer, RentReputation, TenantProfile, TrustBadge, TrustChecklist, XrplReservationProof } from './types.js';

const dayMs = 24 * 60 * 60 * 1000;

export function calculateRentBurdenRate(tenant: TenantProfile, property: PropertyOffer): number {
  return Math.round((property.monthlyRentKrw / tenant.monthlyIncomeKrw) * 1000) / 10;
}

export function isVisaExpired(tenant: TenantProfile, now = new Date()): boolean {
  return new Date(tenant.visaExpiresAt).getTime() < now.getTime();
}

function createVisaBadge(tenant: TenantProfile, now: Date): TrustBadge {
  const expiresAt = new Date(tenant.visaExpiresAt);
  const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / dayMs);

  if (daysLeft < 0) {
    return {
      id: 'visa',
      label: '비자 유효',
      status: 'fail',
      summary: `${tenant.visaType} 체류자격 만료`,
      evidence: `만료일 ${tenant.visaExpiresAt}. Credential 갱신 전 공유 불가.`
    };
  }

  if (daysLeft < 90) {
    return {
      id: 'visa',
      label: '비자 유효',
      status: 'warning',
      summary: `${tenant.visaType} 갱신 필요`,
      evidence: `만료까지 ${daysLeft}일. 임대인에게 갱신 계획을 함께 공유.`
    };
  }

  return {
    id: 'visa',
    label: '비자 유효',
    status: 'pass',
    summary: `${tenant.visaType}, 만료 ${tenant.visaExpiresAt}`,
    evidence: 'XRPL Credential 스타일 증명에 체류 만료일 해시 앵커 포함.'
  };
}

function createEmploymentBadge(tenant: TenantProfile): TrustBadge {
  return tenant.employmentVerified
    ? {
        id: 'employment',
        label: '고용/재학 확인',
        status: 'pass',
        summary: tenant.schoolOrEmployer,
        evidence: 'Phase 0 데모 데이터: 고용/재학 확인값을 Credential payload에 포함.'
      }
    : {
        id: 'employment',
        label: '고용/재학 확인',
        status: 'warning',
        summary: '추가 확인 필요',
        evidence: '공유 전 고용보험, 학교, 또는 중개사 확인 단계 필요.'
      };
}

function createRentBurdenBadge(rate: number): TrustBadge {
  if (rate <= 35) {
    return {
      id: 'rent-burden',
      label: '월세 부담률',
      status: 'pass',
      summary: `Rent-to-Income ${rate}%`,
      evidence: '월 소득 대비 월세가 내부 기준 35% 이하.'
    };
  }

  if (rate <= 45) {
    return {
      id: 'rent-burden',
      label: '월세 부담률',
      status: 'warning',
      summary: `Rent-to-Income ${rate}%`,
      evidence: '임대인 공유 가능하나 보증 파트너 또는 추가 예약금 검토 필요.'
    };
  }

  return {
    id: 'rent-burden',
    label: '월세 부담률',
    status: 'fail',
    summary: `Rent-to-Income ${rate}%`,
    evidence: '월세 부담률이 45%를 초과해 신뢰 배지가 강등됨.'
  };
}

function createEscrowBadge(escrow: XrplReservationProof): TrustBadge {
  return escrow.state === 'ready-to-sign' || escrow.state === 'submitted'
    ? {
        id: 'escrow',
        label: '예약금 잠금 상태',
        status: 'pass',
        summary: `${escrow.amountXrp} XRP EscrowCreate 준비`,
        evidence: `서명 대기 transaction draft. Contract hash ${escrow.contractHash.slice(0, 12)}...`
      }
    : {
        id: 'escrow',
        label: '예약금 잠금 상태',
        status: 'warning',
        summary: `Escrow ${escrow.state}`,
        evidence: '실제 KRW 이동이 아닌 XRPL 예약금 보호 상태 데모.'
      };
}

function createRentReputationBadge(reputation: RentReputation): TrustBadge {
  if (reputation.missedCount > 0) {
    return {
      id: 'rent-history',
      label: '월세 평판 등급',
      status: 'fail',
      summary: `등급 ${reputation.grade}`,
      evidence: reputation.summary
    };
  }

  if (reputation.grade === 'C') {
    return {
      id: 'rent-history',
      label: '월세 평판 등급',
      status: 'warning',
      summary: `등급 ${reputation.grade}`,
      evidence: reputation.summary
    };
  }

  return {
    id: 'rent-history',
    label: '월세 평판 등급',
    status: 'pass',
    summary: `등급 ${reputation.grade}`,
    evidence: `${reputation.observedMonths}개월 기준 정상 납부율 ${reputation.onTimeRate}%. 상세 납부일/금액은 임대인에게 공개하지 않음.`
  };
}

export function calculateTrustChecklist(
  tenant: TenantProfile,
  property: PropertyOffer,
  rentReputation: RentReputation,
  escrow: XrplReservationProof,
  now = new Date('2026-05-10T00:00:00.000Z')
): TrustChecklist {
  const rentBurdenRate = calculateRentBurdenRate(tenant, property);
  const badges = [
    createVisaBadge(tenant, now),
    createEmploymentBadge(tenant),
    createRentBurdenBadge(rentBurdenRate),
    createEscrowBadge(escrow),
    createRentReputationBadge(rentReputation)
  ];
  const failCount = badges.filter((badge) => badge.status === 'fail').length;
  const warningCount = badges.filter((badge) => badge.status === 'warning').length;

  if (failCount > 0) {
    return {
      badges,
      rentBurdenRate,
      level: 'not-shareable',
      headline: '공유 전 핵심 리스크 해결 필요'
    };
  }

  if (warningCount > 0) {
    return {
      badges,
      rentBurdenRate,
      level: 'review-needed',
      headline: '조건부 공유 가능, 설명 필요'
    };
  }

  return {
    badges,
    rentBurdenRate,
    level: 'share-ready',
    headline: '임대인 공유 가능'
  };
}
