export type VerificationStatus = 'pass' | 'warning' | 'fail';

export type TenantProfile = {
  id: string;
  displayName: string;
  nationality: string;
  visaType: string;
  visaExpiresAt: string;
  monthlyIncomeKrw: number;
  employmentVerified: boolean;
  schoolOrEmployer: string;
  passportNumber: string;
  phoneNumber: string;
};

export type PropertyOffer = {
  id: string;
  title: string;
  addressLabel: string;
  monthlyRentKrw: number;
  originalDepositKrw: number;
  reducedDepositKrw: number;
  reservationAmountKrw: number;
  landlordName: string;
};

export type RentPayment = {
  paidAt: string;
  amountKrw: number;
  status: 'paid' | 'late' | 'missed';
  note: string;
};

export type PrivacyProof = {
  did: string;
  credentialId: string;
  issuer: string;
  subjectHash: string;
  credentialHash: string;
  anchorHash: string;
  issuedAt: string;
  expiresAt: string;
};

export type XrplReservationProof = {
  mode: 'deterministic-fallback' | 'testnet-ready';
  ledger: 'XRPL Testnet';
  state: 'prepared' | 'locked' | 'release-ready' | 'cancel-ready';
  escrowSequence: string;
  txHash: string;
  explorerUrl: string;
  amountXrp: number;
  memoHash: string;
  caveat: string;
};

export type TrustBadge = {
  id: string;
  label: string;
  status: VerificationStatus;
  summary: string;
  evidence: string;
};

export type TrustChecklist = {
  badges: TrustBadge[];
  rentBurdenRate: number;
  level: 'share-ready' | 'review-needed' | 'not-shareable';
  headline: string;
};

export type DemoScenario = {
  tenant: TenantProfile;
  property: PropertyOffer;
  rentHistory: RentPayment[];
};

export type ShareableReport = {
  tenantLabel: string;
  propertyLabel: string;
  proof: PrivacyProof;
  escrow: XrplReservationProof;
  checklist: TrustChecklist;
  rentAnchorHash: string;
  generatedAt: string;
};
