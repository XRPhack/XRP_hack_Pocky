import '../../styles.css';
import { employmentEdgeCase, employmentHappyCase } from '../../domain/adapters/employment.fixture';
import { visaEdgeCase, visaHappyCase, visaMockAdapter } from '../../domain/adapters/visa.fixture';
import { getLocalePreference, getSession, setLocalePreference, setSession, type TossOAuthMockSessionInput } from '../../shared/auth/session';
import { t, type Locale } from '../../shared/i18n';
import { HistoryControls } from '../../shared/ui';
import { getAppRoot } from '../app-placeholder';
import {
  DashboardScreen,
  HomeScreen,
  LoginScreen,
  OnboardingScreen,
  TossUnlockScreen,
  WizardScreen,
  createVerifyPath,
  type DashboardBadge,
  type DashboardBadgeStatus,
  type DashboardShareFeedbackKey,
  type DashboardTrustGrade,
  type LoginStatus,
  type TenantWizardFixtureId,
  type WizardStepStatus
} from './screens';

type TenantStage = 'login' | 'onboarding' | 'home' | 'wizard' | 'dashboard' | 'unlock';

type WizardStepState = {
  status: WizardStepStatus;
  progress: number;
  errorTitle?: string;
  errorMessage?: string;
};

type TenantState = {
  stage: TenantStage;
  locale: Locale;
  loginStatus: LoginStatus;
  onboardingStepIndex: number;
  trustPassPlaceholderVisible: boolean;
  selectedFixtureId: TenantWizardFixtureId;
  wizardStepIndex: number;
  wizardSteps: [WizardStepState, WizardStepState, WizardStepState, WizardStepState];
  documentFiles: {
    visa?: File;
    employment?: File;
  };
  reportBadges: string[];
  dashboardBadges?: [DashboardBadge, DashboardBadge, DashboardBadge, DashboardBadge, DashboardBadge, DashboardBadge];
  reportId?: string;
  trustGrade?: DashboardTrustGrade;
  shareFeedbackKey?: DashboardShareFeedbackKey;
  errorMessage?: string;
};

type JsonRecord = Record<string, unknown>;

const mockTenant = {
  userId: 'tenant_mina_p',
  name: 'Mina P.',
  phone: '+82-10-2604-0000'
} as const;

const root = getAppRoot();
const state: TenantState = {
  stage: 'login',
  locale: getLocalePreference(getSession()?.locale ?? navigator.language),
  loginStatus: 'idle',
  onboardingStepIndex: 0,
  trustPassPlaceholderVisible: false,
  selectedFixtureId: 'happy',
  wizardStepIndex: 0,
  wizardSteps: createWizardStepStates(),
  documentFiles: {},
  reportBadges: []
};

class WizardStepError extends Error {
  constructor(
    readonly title: string,
    message: string
  ) {
    super(message);
    this.name = 'WizardStepError';
  }
}

function createWizardStepStates(): [WizardStepState, WizardStepState, WizardStepState, WizardStepState] {
  return [
    { status: 'idle', progress: 0 },
    { status: 'idle', progress: 0 },
    { status: 'idle', progress: 0 },
    { status: 'idle', progress: 0 }
  ];
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function parseMockSession(payload: unknown): TossOAuthMockSessionInput {
  if (!isRecord(payload) || !isRecord(payload.session)) {
    throw new Error('Invalid mock auth response.');
  }

  const userId = getString(payload.session.userId);
  const name = getString(payload.session.name);
  const phone = getString(payload.session.phone);

  if (!userId || !name || !phone) {
    throw new Error('Mock auth response is missing a sanitized session.');
  }

  return {
    userId,
    name,
    phone,
    locale: getString(payload.session.locale),
    tenantWalletAddress: getString(payload.session.tenantWalletAddress)
  };
}

function isDashboardBadgeStatus(value: unknown): value is DashboardBadgeStatus {
  return value === 'pass' || value === 'warning' || value === 'fail';
}

function isDashboardTrustGrade(value: unknown): value is DashboardTrustGrade {
  return value === 'A' || value === 'B' || value === 'C' || value === 'D';
}

function clearDashboardReport(): void {
  state.reportBadges = [];
  state.dashboardBadges = undefined;
  state.reportId = undefined;
  state.trustGrade = undefined;
  state.shareFeedbackKey = undefined;
}

function createLocaleToggle(): HTMLDivElement {
  const group = document.createElement('div');
  group.className = 'route-locale-toggle tenant-locale-toggle';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', t('languageToggle', state.locale));

  for (const nextLocale of ['ko', 'en'] as const) {
    const button = document.createElement('button');
    const isActive = state.locale === nextLocale;

    button.className = `route-locale-toggle__button${isActive ? ' route-locale-toggle__button--active' : ''}`;
    button.type = 'button';
    button.textContent = t(nextLocale === 'ko' ? 'korean' : 'english', state.locale);
    button.setAttribute('aria-pressed', String(isActive));
    button.addEventListener('click', () => {
      state.locale = setLocalePreference(nextLocale);
      render();
    });
    group.appendChild(button);
  }

  return group;
}

function createHeaderActions(): HTMLDivElement {
  const actions = document.createElement('div');
  actions.className = 'route-header-actions tenant-header-actions';
  actions.append(
    HistoryControls({ backLabel: state.locale === 'ko' ? '뒤로' : 'Back' }),
    createLocaleToggle()
  );
  return actions;
}

function showOnboarding(): void {
  state.stage = 'onboarding';
  state.loginStatus = 'idle';
  state.errorMessage = undefined;
  state.onboardingStepIndex = 0;
  state.trustPassPlaceholderVisible = false;
  state.wizardStepIndex = 0;
  state.wizardSteps = createWizardStepStates();
  state.documentFiles = {};
  clearDashboardReport();
  render();
}

function showWizard(): void {
  state.stage = 'wizard';
  state.trustPassPlaceholderVisible = false;
  state.wizardStepIndex = 0;
  state.wizardSteps = createWizardStepStates();
  state.documentFiles = {};
  clearDashboardReport();
  render();
}

function isFixtureLocked(): boolean {
  return state.wizardStepIndex > 0 || state.wizardSteps.some((step) => step.status !== 'idle');
}

function selectWizardFixture(fixtureId: TenantWizardFixtureId): void {
  if (isFixtureLocked()) {
    return;
  }

  state.selectedFixtureId = fixtureId;
  clearDashboardReport();
  render();
}

function setDocumentFile(kind: 'visa' | 'employment', file: File | null): void {
  if (state.wizardStepIndex !== 1 || state.wizardSteps[1].status === 'loading') {
    return;
  }

  if (file) {
    state.documentFiles = { ...state.documentFiles, [kind]: file };
  } else {
    const nextFiles = { ...state.documentFiles };
    delete nextFiles[kind];
    state.documentFiles = nextFiles;
  }

  render();
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function formatFixtureDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(state.locale === 'ko' ? 'ko-KR' : 'en-US', {
    dateStyle: 'medium'
  }).format(date);
}

async function validateCredentialFixture(): Promise<void> {
  const visaInput = state.selectedFixtureId === 'edge' ? visaEdgeCase : visaHappyCase;
  const visaResult = await visaMockAdapter.verify(visaInput);

  if (visaResult.success) {
    return;
  }

  throw new WizardStepError(
    t('tenantWizardCredentialExpiredTitle', state.locale),
    t('tenantWizardCredentialExpiredCopy', state.locale)
      .replace('{expiresAt}', formatFixtureDate(visaInput.expiresAt))
      .replace('{reason}', visaResult.message ?? visaResult.data.summary)
  );
}

function encodeTextAsBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function createFixtureDocument(kind: 'visa' | 'employment'): { filename: string; mimeType: 'application/json'; base64: string } {
  const visaInput = state.selectedFixtureId === 'edge' ? visaEdgeCase : visaHappyCase;
  const employmentInput = state.selectedFixtureId === 'edge' ? employmentEdgeCase : employmentHappyCase;
  const payload = kind === 'visa'
    ? {
        documentType: 'foreign-registration-certificate',
        subjectId: visaInput.subjectId,
        visaType: visaInput.visaType,
        nationality: visaInput.nationality,
        expiresAt: visaInput.expiresAt,
        issuer: visaInput.issuer,
        foreignRegistrationNumberLast4: visaInput.passportNumberLast4
      }
    : {
        documentType: 'employment-confirmation',
        subjectId: employmentInput.subjectId,
        verificationChannel: employmentInput.verificationChannel === 'school' ? 'school' : 'employment-insurance',
        organizationName: employmentInput.organizationName,
        roleOrProgram: employmentInput.roleOrProgram,
        acquiredAt: employmentInput.enrollmentVerified || employmentInput.employmentVerified ? '2025-03-01T00:00:00.000Z' : undefined,
        lostAt: employmentInput.enrollmentVerified || employmentInput.employmentVerified ? undefined : '2025-12-31T00:00:00.000Z',
        issuer: `${employmentInput.verificationChannel}-mock-registry`
      };

  return {
    filename: `${kind}-${state.selectedFixtureId}.json`,
    mimeType: 'application/json',
    base64: encodeTextAsBase64(JSON.stringify(payload))
  };
}

async function createUploadedDocumentPayload(kind: 'visa' | 'employment'): Promise<{ filename: string; mimeType: string; base64: string }> {
  const file = state.documentFiles[kind];

  if (!file) {
    return createFixtureDocument(kind);
  }

  return {
    filename: file.name,
    mimeType: file.type || 'text/plain',
    base64: await fileToBase64(file)
  };
}

async function uploadVerificationDocuments(): Promise<void> {
  const session = getSession();
  const response = await fetch('/api/verification-documents', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      subjectId: session?.userId,
      visaDocument: await createUploadedDocumentPayload('visa'),
      employmentDocument: await createUploadedDocumentPayload('employment')
    })
  });

  if (!response.ok) {
    throw new Error(t('tenantWizardDocumentErrorCopy', state.locale));
  }

  const payload = await response.json() as unknown;

  if (!isRecord(payload) || payload.status !== 'verified') {
    throw new WizardStepError(
      t('tenantWizardDocumentReviewTitle', state.locale),
      t('tenantWizardDocumentReviewCopy', state.locale)
    );
  }
}

function parseDryRunReport(payload: unknown): {
  reportId: string;
  trustGrade: DashboardTrustGrade;
  badges: [DashboardBadge, DashboardBadge, DashboardBadge, DashboardBadge, DashboardBadge, DashboardBadge];
} {
  if (!isRecord(payload) || !isRecord(payload.report) || !Array.isArray(payload.report.badges)) {
    throw new Error(t('tenantWizardErrorCopy', state.locale));
  }

  const reportId = getString(payload.report.reportId) ?? getString(payload.reportId);
  const trustGrade = payload.report.trustGrade;
  const rawBadges = payload.report.badges;

  if (rawBadges.length !== 6) {
    throw new Error(t('tenantWizardBadgeError', state.locale));
  }

  const badges = rawBadges.map((badge) => {
      if (!isRecord(badge)) {
        return undefined;
      }

      const label = getString(badge.label);
      const status = badge.status;

      if (!label || !isDashboardBadgeStatus(status)) {
        return undefined;
      }

      return { label, status };
    })
    .filter((badge): badge is DashboardBadge => Boolean(badge));

  if (!reportId || !isDashboardTrustGrade(trustGrade) || badges.length !== 6) {
    throw new Error(t('tenantWizardBadgeError', state.locale));
  }

  return {
    reportId,
    trustGrade,
    badges: [badges[0], badges[1], badges[2], badges[3], badges[4], badges[5]]
  };
}

async function fetchDryRunReport(): Promise<ReturnType<typeof parseDryRunReport>> {
  const session = getSession();
  const response = await fetch('/api/sign-and-submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      dryRun: true,
      credentialType: 'nomokdon-visa',
      nationality: 'Philippines',
      visaType: 'D-4',
      monthlyIncomeKrw: 2_900_000,
      monthlyRentKrw: 850_000,
      tenantWalletAddress: session?.tenantWalletAddress
    })
  });

  if (!response.ok) {
    throw new Error(t('tenantWizardErrorCopy', state.locale));
  }

  return parseDryRunReport(await response.json());
}

function getAbsoluteVerifyUrl(): string {
  return new URL(createVerifyPath(state.reportId ?? 'report_local'), window.location.origin).toString();
}

function showTossUnlock(): void {
  state.stage = 'unlock';
  state.shareFeedbackKey = undefined;
  render();
}

async function handleCopyShareLink(): Promise<void> {
  const shareUrl = getAbsoluteVerifyUrl();

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(shareUrl);
      state.shareFeedbackKey = 'tenantDashboardCopySuccess';
      render();
      return;
    } catch {
      state.shareFeedbackKey = 'tenantDashboardCopyFallback';
      render();
      return;
    }
  }

  state.shareFeedbackKey = 'tenantDashboardCopyFallback';
  render();
}

async function handleWebShare(): Promise<void> {
  const shareUrl = getAbsoluteVerifyUrl();

  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: t('tenantDashboardShareTitle', state.locale),
        text: t('tenantDashboardSharePayloadText', state.locale),
        url: shareUrl
      });
      state.shareFeedbackKey = 'tenantDashboardShareSuccess';
      render();
      return;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
    }
  }

  state.shareFeedbackKey = 'tenantDashboardShareFallback';
  render();
}

async function runWizardStep(stepIndex: number): Promise<void> {
  const step = state.wizardSteps[stepIndex];

  if (!step || stepIndex !== state.wizardStepIndex || step.status === 'loading') {
    return;
  }

  step.status = 'loading';
  step.progress = 35;
  step.errorTitle = undefined;
  step.errorMessage = undefined;
  render();

  try {
    await delay(260);
    step.progress = 72;
    render();

    if (stepIndex === 3) {
      const report = await fetchDryRunReport();
      state.reportId = report.reportId;
      state.trustGrade = report.trustGrade;
      state.dashboardBadges = report.badges;
      state.reportBadges = report.badges.map((badge) => badge.label);
      state.shareFeedbackKey = undefined;
    } else if (stepIndex === 1) {
      await validateCredentialFixture();
      await uploadVerificationDocuments();
    } else if (stepIndex === 2) {
      await validateCredentialFixture();
    } else {
      await delay(240);
    }

    step.status = 'success';
    step.progress = 100;
    step.errorTitle = undefined;
    step.errorMessage = undefined;
    state.wizardStepIndex = Math.min(stepIndex + 1, state.wizardSteps.length - 1);
    if (stepIndex === 3 && state.wizardSteps.every((wizardStep) => wizardStep.status === 'success')) {
      state.stage = 'dashboard';
    }
    render();
  } catch (error) {
    step.status = 'error';
    step.progress = 0;
    step.errorTitle = error instanceof WizardStepError ? error.title : undefined;
    step.errorMessage = error instanceof Error ? error.message : t('tenantWizardErrorCopy', state.locale);
    render();
  }
}

async function handleLogin(): Promise<void> {
  state.loginStatus = 'loading';
  state.errorMessage = undefined;
  render();

  try {
    const response = await fetch('/api/auth/toss-mock', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...mockTenant,
        locale: state.locale
      })
    });

    if (!response.ok) {
      throw new Error(t('tenantLoginErrorCopy', state.locale));
    }

    const session = parseMockSession(await response.json());
    const sanitizedSession = setSession(session);

    state.locale = setLocalePreference(sanitizedSession.locale);
    showOnboarding();
  } catch (error) {
    state.loginStatus = 'error';
    state.errorMessage = error instanceof Error ? error.message : t('tenantLoginErrorCopy', state.locale);
    render();
  }
}

function renderHome(): HTMLElement {
  document.title = `${t('appTitle', state.locale)} · ${t('tenantHomeTitle', state.locale)}`;

  const session = getSession();

  return HomeScreen({
    locale: state.locale,
    sessionName: session?.name,
    localeToggle: createHeaderActions(),
    showPlaceholderToast: state.trustPassPlaceholderVisible,
    onCreateTrustPass: showWizard
  });
}

function renderDashboard(): HTMLElement {
  const session = getSession();

  if (!state.reportId || !state.trustGrade || !state.dashboardBadges) {
    return renderHome();
  }

  document.title = `${t('appTitle', state.locale)} · ${t('tenantDashboardTitle', state.locale)}`;

  return DashboardScreen({
    locale: state.locale,
    verifyUrl: getAbsoluteVerifyUrl(),
    trustGrade: state.trustGrade,
    badges: state.dashboardBadges,
    tenantName: session?.name,
    walletAddress: session?.tenantWalletAddress,
    shareFeedbackKey: state.shareFeedbackKey,
    localeToggle: createHeaderActions(),
    onUnlock: showTossUnlock,
    onCopyLink: () => {
      void handleCopyShareLink();
    },
    onShare: () => {
      void handleWebShare();
    }
  });
}

function renderTossUnlock(): HTMLElement {
  const session = getSession();

  if (!state.reportId || !state.trustGrade || !state.dashboardBadges) {
    return renderHome();
  }

  document.title = `${t('appTitle', state.locale)} · ${t('tenantTossUnlockTitle', state.locale)}`;

  return TossUnlockScreen({
    locale: state.locale,
    localeToggle: createHeaderActions(),
    tenantName: session?.name,
    onBack: () => {
      state.stage = 'dashboard';
      render();
    }
  });
}

function render(): void {
  if (state.stage === 'login') {
    document.title = `${t('appTitle', state.locale)} · ${t('tenantLoginTitle', state.locale)}`;
    root.replaceChildren(
      LoginScreen({
        locale: state.locale,
        status: state.loginStatus,
        errorMessage: state.errorMessage,
        localeToggle: createHeaderActions(),
        onLogin: () => {
          void handleLogin();
        }
      })
    );
    return;
  }

  if (state.stage === 'onboarding') {
    document.title = `${t('appTitle', state.locale)} · ${t('tenantOnboardingEyebrow', state.locale)}`;
    root.replaceChildren(
      OnboardingScreen({
        locale: state.locale,
        stepIndex: state.onboardingStepIndex,
        localeToggle: createHeaderActions(),
        onNext: () => {
          state.onboardingStepIndex += 1;
          render();
        },
        onStart: () => {
          state.stage = 'home';
          state.trustPassPlaceholderVisible = false;
          render();
        }
      })
    );
    return;
  }

  if (state.stage === 'wizard') {
    document.title = `${t('appTitle', state.locale)} · ${t('tenantWizardTitle', state.locale)}`;
    root.replaceChildren(
      WizardScreen({
        locale: state.locale,
        activeStepIndex: state.wizardStepIndex,
        steps: state.wizardSteps,
        reportBadges: state.reportBadges,
        selectedFixtureId: state.selectedFixtureId,
        isFixtureLocked: isFixtureLocked(),
        selectedDocumentNames: {
          visa: state.documentFiles.visa?.name,
          employment: state.documentFiles.employment?.name
        },
        localeToggle: createHeaderActions(),
        onFixtureChange: selectWizardFixture,
        onDocumentChange: setDocumentFile,
        onRunStep: (stepIndex) => {
          void runWizardStep(stepIndex);
        }
      })
    );
    return;
  }

  if (state.stage === 'dashboard') {
    root.replaceChildren(renderDashboard());
    return;
  }

  if (state.stage === 'unlock') {
    root.replaceChildren(renderTossUnlock());
    return;
  }

  root.replaceChildren(renderHome());
}

render();
