export type VerificationStatus = 'pass' | 'warning' | 'fail';

export type TrustLevel = 'share-ready' | 'review-needed' | 'not-shareable';

export type CredentialType = 'visa' | 'employment' | 'rent-history' | 'property' | 'custom';

export type PresentationPurpose = 'share-report' | 'verify-rent' | 'issue-badge';

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
  xrplAccount: string;
};

export type Credential = {
  id: string;
  type: CredentialType;
  issuer: string;
  subjectId: string;
  issuedAt: string;
  expiresAt?: string;
  claims: Record<string, string | number | boolean>;
};

export type VerifiablePresentation = {
  id: string;
  holderId: string;
  purpose: PresentationPurpose;
  credentialIds: string[];
  createdAt: string;
  challenge?: string;
  domain?: string;
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
  realtorName: string;
  escrowDestination: string;
};

export type Badge = {
  id: string;
  label: string;
  status: VerificationStatus;
  summary: string;
  evidence: string;
};

export type RentPayment = {
  paidAt: string;
  amountKrw: number;
  status: 'paid' | 'late' | 'missed';
  note: string;
};

export type Report = {
  tenantLabel: string;
  propertyLabel: string;
  proof: PrivacyProof;
  sources: OffchainVerificationSource[];
  escrow: XrplReservationProof;
  checklist: TrustChecklist;
  rentReputation: RentReputation;
  rentAnchorHash: string;
  generatedAt: string;
};

export type OffchainVerificationSource = {
  id: string;
  label: string;
  provider: string;
  status: VerificationStatus;
  dataFlow: string;
  anchorField: string;
};

export type XrplDidSetTransaction = {
  TransactionType: 'DIDSet';
  Account: string;
  URI: string;
  Data: string;
  Memos: XrplMemo[];
};

export type PrivacyProof = {
  did: string;
  networkId: 1;
  controllingAccount: string;
  credentialId: string;
  issuer: string;
  didDocumentUri: string;
  didSetTransaction: XrplDidSetTransaction;
  subjectHash: string;
  credentialHash: string;
  anchorHash: string;
  issuedAt: string;
  expiresAt: string;
};

export type XrplMemo = {
  Memo: {
    MemoType: string;
    MemoData: string;
  };
};

export type XrplEscrowCreateTransaction = {
  TransactionType: 'EscrowCreate';
  Account: string;
  Destination: string;
  Amount: string;
  FinishAfter: number;
  CancelAfter: number;
  Memos: XrplMemo[];
};

export type XrplEscrowFinishTemplate = {
  TransactionType: 'EscrowFinish';
  Account: string;
  Owner: string;
  OfferSequence: 'FROM_VALIDATED_ESCROW_CREATE_SEQUENCE';
  Memos: XrplMemo[];
};

export type XrplEscrowCancelTemplate = {
  TransactionType: 'EscrowCancel';
  Account: string;
  Owner: string;
  OfferSequence: 'FROM_VALIDATED_ESCROW_CREATE_SEQUENCE';
  Memos: XrplMemo[];
};

export type XrplReservationProof = {
  mode: 'unsigned-transaction-draft' | 'submitted-testnet';
  ledger: 'XRPL Testnet';
  state: 'ready-to-sign' | 'submitted' | 'release-ready' | 'cancel-ready';
  ownerAccount: string;
  destinationAccount: string;
  amountXrp: number;
  amountDrops: string;
  contractHash: string;
  finishAfterRippleTime: number;
  cancelAfterRippleTime: number;
  createTx: XrplEscrowCreateTransaction;
  finishTxTemplate: XrplEscrowFinishTemplate;
  cancelTxTemplate: XrplEscrowCancelTemplate;
  caveat: string;
};

export type RentReputation = {
  observedMonths: number;
  onTimeRate: number;
  lateCount: number;
  missedCount: number;
  grade: 'A' | 'B' | 'C' | 'D';
  summary: string;
};

export type TrustBadge = Badge;

export type TrustChecklist = {
  badges: Badge[];
  rentBurdenRate: number;
  level: TrustLevel;
  headline: string;
};

export type DemoScenario = {
  tenant: TenantProfile;
  property: PropertyOffer;
  rentHistory: RentPayment[];
};

export type ShareableReport = Report;
