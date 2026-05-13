import type { VerificationStatus } from './types.js';
import type { CompactVp, VpVerificationResult } from './vp.js';

export type ReportBadgeId =
  | 'visa-valid'
  | 'employment-confirmed'
  | 'rent-burden'
  | 'escrow'
  | 'rent-history'
  | 'on-chain-verification';

export type ReportTrustGrade = 'A' | 'B' | 'C' | 'D';

export type ReportBadge = {
  id: ReportBadgeId;
  label: string;
  status: VerificationStatus;
  summary: string;
  evidence: string;
};

export type ReportEscrowState = {
  state: 'ready-to-sign' | 'submitted' | 'locked' | 'release-ready' | 'cancel-ready' | 'cancelled' | 'missing';
  amountXrp?: number;
  txHash?: string;
  anchorHash?: string;
};

export type ReportRentPayment = {
  paidAt: string;
  amountKrw: number;
  status: 'paid' | 'late' | 'missed';
  note?: string;
  txHash?: string;
  anchorHash?: string;
};

export type CompactReportVp = Partial<CompactVp> & {
  reportId?: string;
  holderId?: string;
  status?: VerificationStatus;
  visaStatus?: VerificationStatus;
  employmentStatus?: VerificationStatus;
  rentBurdenRate?: number;
  monthlyIncomeKrw?: number;
  monthlyRentKrw?: number;
  txHashes?: string[];
  anchors?: string[];
  credentials?: Array<{
    type?: string;
    status?: VerificationStatus;
    credentialId?: string;
  }>;
};

export type BuildReportInput = {
  vp: VpVerificationResult | CompactReportVp;
  escrowState: ReportEscrowState;
  rentHistory: ReportRentPayment[];
  generatedAt?: Date | string;
};

export type BuiltReport = {
  reportId: string;
  holderId: string;
  trustGrade: ReportTrustGrade;
  badges: [ReportBadge, ReportBadge, ReportBadge, ReportBadge, ReportBadge, ReportBadge];
  generatedAt: string;
};

function toIsoTimestamp(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid report timestamp: ${String(value)}`);
  }

  return date.toISOString();
}

function getReportId(vp: VpVerificationResult | CompactReportVp): string {
  const compactVp = vp as CompactReportVp;

  return vp.reportId ?? compactVp.id ?? 'report_local';
}

function getHolderId(vp: VpVerificationResult | CompactReportVp): string {
  return vp.holderId ?? 'holder_local';
}

function statusFromCredential(
  vp: VpVerificationResult | CompactReportVp,
  credentialTypes: string[]
): VerificationStatus | undefined {
  return vp.credentials?.find((credential) =>
    credential.type ? credentialTypes.includes(credential.type) : false
  )?.status;
}

function resolveVisaStatus(vp: VpVerificationResult | CompactReportVp): VerificationStatus {
  const compactVp = vp as CompactReportVp;

  return compactVp.visaStatus ?? statusFromCredential(vp, ['visa']) ?? vp.status ?? 'warning';
}

function resolveEmploymentStatus(vp: VpVerificationResult | CompactReportVp): VerificationStatus {
  const compactVp = vp as CompactReportVp;

  return compactVp.employmentStatus ?? statusFromCredential(vp, ['employment', 'school', 'custom']) ?? 'warning';
}

function resolveRentBurdenRate(vp: VpVerificationResult | CompactReportVp): number | undefined {
  const compactVp = vp as CompactReportVp;

  if (typeof compactVp.rentBurdenRate === 'number') {
    return Math.round(compactVp.rentBurdenRate * 10) / 10;
  }

  if (
    typeof compactVp.monthlyIncomeKrw === 'number' &&
    typeof compactVp.monthlyRentKrw === 'number' &&
    compactVp.monthlyIncomeKrw > 0
  ) {
    return Math.round((compactVp.monthlyRentKrw / compactVp.monthlyIncomeKrw) * 1000) / 10;
  }

  return undefined;
}

function buildVisaBadge(status: VerificationStatus): ReportBadge {
  return {
    id: 'visa-valid',
    label: '비자유효',
    status,
    summary: status === 'pass' ? 'VP 비자 Credential 유효' : '비자 Credential 확인 필요',
    evidence: status === 'pass' ? '로컬 VP 검증 결과 비자 Credential이 통과했습니다.' : '만료, 누락, 또는 미검증 비자 상태입니다.'
  };
}

function buildEmploymentBadge(status: VerificationStatus): ReportBadge {
  return {
    id: 'employment-confirmed',
    label: '고용확인',
    status,
    summary: status === 'pass' ? '고용/재학 확인 통과' : '고용/재학 확인 보완 필요',
    evidence: status === 'pass' ? 'VP 또는 compact 입력에서 고용 확인이 통과했습니다.' : '고용/재학 증빙이 없거나 추가 확인이 필요합니다.'
  };
}

function buildRentBurdenBadge(rate: number | undefined): ReportBadge {
  if (rate === undefined) {
    return {
      id: 'rent-burden',
      label: '부담률',
      status: 'warning',
      summary: '월세 부담률 미입력',
      evidence: 'monthlyIncomeKrw/monthlyRentKrw 또는 rentBurdenRate 입력이 필요합니다.'
    };
  }

  if (rate <= 35) {
    return {
      id: 'rent-burden',
      label: '부담률',
      status: 'pass',
      summary: `월세 부담률 ${rate}%`,
      evidence: '내부 MVP 기준 35% 이하입니다.'
    };
  }

  if (rate <= 45) {
    return {
      id: 'rent-burden',
      label: '부담률',
      status: 'warning',
      summary: `월세 부담률 ${rate}%`,
      evidence: '공유 가능하지만 임대인 설명 또는 보완 자료가 필요합니다.'
    };
  }

  return {
    id: 'rent-burden',
    label: '부담률',
    status: 'fail',
    summary: `월세 부담률 ${rate}%`,
    evidence: '월세 부담률이 45%를 초과합니다.'
  };
}

function buildEscrowBadge(escrowState: ReportEscrowState): ReportBadge {
  if (['submitted', 'locked', 'release-ready', 'ready-to-sign'].includes(escrowState.state)) {
    const amount = typeof escrowState.amountXrp === 'number' ? `${escrowState.amountXrp} XRP` : 'XRPL';

    return {
      id: 'escrow',
      label: 'Escrow',
      status: 'pass',
      summary: `${amount} escrow ${escrowState.state}`,
      evidence: escrowState.txHash ?? escrowState.anchorHash ?? 'MVP escrow 상태 입력으로 확인했습니다.'
    };
  }

  return {
    id: 'escrow',
    label: 'Escrow',
    status: escrowState.state === 'cancel-ready' ? 'warning' : 'fail',
    summary: `escrow ${escrowState.state}`,
    evidence: '예약금 보호 상태가 잠금 또는 서명 가능 상태가 아닙니다.'
  };
}

function summarizeRentHistory(rentHistory: ReportRentPayment[]): {
  observedMonths: number;
  onTimeRate: number;
  lateCount: number;
  missedCount: number;
} {
  const observedMonths = rentHistory.length;
  const paidCount = rentHistory.filter((payment) => payment.status === 'paid').length;
  const lateCount = rentHistory.filter((payment) => payment.status === 'late').length;
  const missedCount = rentHistory.filter((payment) => payment.status === 'missed').length;

  return {
    observedMonths,
    onTimeRate: observedMonths === 0 ? 0 : paidCount / observedMonths,
    lateCount,
    missedCount
  };
}

function buildRentHistoryBadge(rentHistory: ReportRentPayment[]): ReportBadge {
  const { observedMonths, onTimeRate, lateCount, missedCount } = summarizeRentHistory(rentHistory);
  const onTimePercent = Math.round(onTimeRate * 100);

  if (observedMonths >= 6 && onTimeRate >= 0.8 && missedCount === 0) {
    return {
      id: 'rent-history',
      label: '납부이력',
      status: 'pass',
      summary: `${observedMonths}개월 정상 납부율 ${onTimePercent}%`,
      evidence: `지연 ${lateCount}건, 미납 ${missedCount}건.`
    };
  }

  if (observedMonths >= 3 && missedCount === 0) {
    return {
      id: 'rent-history',
      label: '납부이력',
      status: 'warning',
      summary: `${observedMonths}개월 정상 납부율 ${onTimePercent}%`,
      evidence: '관측 기간 또는 정상 납부율이 share-ready 기준보다 낮습니다.'
    };
  }

  return {
    id: 'rent-history',
    label: '납부이력',
    status: 'fail',
    summary: `${observedMonths}개월 정상 납부율 ${onTimePercent}%`,
    evidence: `미납 ${missedCount}건이 있거나 납부 이력이 부족합니다.`
  };
}

function collectOnChainReferences(
  vp: VpVerificationResult | CompactReportVp,
  escrowState: ReportEscrowState,
  rentHistory: ReportRentPayment[]
): string[] {
  const compactVp = vp as CompactReportVp;

  return [
    ...(compactVp.txHashes ?? []),
    ...(compactVp.anchors ?? []),
    escrowState.txHash,
    escrowState.anchorHash,
    ...rentHistory.flatMap((payment) => [payment.txHash, payment.anchorHash])
  ].filter((reference): reference is string => typeof reference === 'string' && reference.trim().length > 0);
}

function buildOnChainBadge(referenceCount: number): ReportBadge {
  return {
    id: 'on-chain-verification',
    label: '온체인검증',
    status: referenceCount > 0 ? 'pass' : 'warning',
    summary: referenceCount > 0 ? `${referenceCount}개 tx/hash anchor 연결` : 'tx/hash anchor 없음',
    evidence: referenceCount > 0 ? '입력된 tx hash 또는 anchor hash 존재만 확인했습니다.' : '라이브 XRPL 조회 없이 입력 anchor 기준으로만 판단합니다.'
  };
}

function calculateTrustGrade(badges: ReportBadge[]): ReportTrustGrade {
  const failCount = badges.filter((badge) => badge.status === 'fail').length;
  const warningCount = badges.filter((badge) => badge.status === 'warning').length;

  if (failCount >= 2) {
    return 'D';
  }

  if (failCount === 1 || warningCount >= 3) {
    return 'C';
  }

  if (warningCount > 0) {
    return 'B';
  }

  return 'A';
}

export function buildReport({
  vp,
  escrowState,
  rentHistory,
  generatedAt = new Date()
}: BuildReportInput): BuiltReport {
  const badges: BuiltReport['badges'] = [
    buildVisaBadge(resolveVisaStatus(vp)),
    buildEmploymentBadge(resolveEmploymentStatus(vp)),
    buildRentBurdenBadge(resolveRentBurdenRate(vp)),
    buildEscrowBadge(escrowState),
    buildRentHistoryBadge(rentHistory),
    buildOnChainBadge(collectOnChainReferences(vp, escrowState, rentHistory).length)
  ];

  return {
    reportId: getReportId(vp),
    holderId: getHolderId(vp),
    trustGrade: calculateTrustGrade(badges),
    badges,
    generatedAt: toIsoTimestamp(generatedAt)
  };
}
