import '../../styles.css';
import { getLocalePreference, setLocalePreference } from '../../shared/auth/session';
import { t, type Locale } from '../../shared/i18n';
import { HistoryControls } from '../../shared/ui';
import { getAppRoot } from '../app-placeholder';
import {
  IssuerGateScreen,
  IssuerShellScreen,
  IssuerStatsCard,
  IssuerSimulatorCard,
  normalizeIssuerLogEvents,
  type IssuerGateStatus,
  type IssuerLogEvent,
  type IssuerLogsLoadStatus,
  type IssuerShellTab,
  type IssuerSimulatorFixtureId,
  type IssuerSimulatorResult,
  type IssuerSimulatorStatus,
  type IssuerSimulatorStep,
  type IssuerSimulatorStepStatus
} from './screens';

type IssuerAuthStatus = 'checking' | 'locked' | 'submitting' | 'unlocked';

type IssuerState = {
  locale: Locale;
  status: IssuerAuthStatus;
  logs: IssuerLogEvent[];
  logsStatus: IssuerLogsLoadStatus;
  logsErrorMessage?: string;
  logsLastUpdatedAt?: string;
  errorMessage?: string;
  activeTab: IssuerShellTab;
  simulatorFixtureId: IssuerSimulatorFixtureId;
  simulatorStatus: IssuerSimulatorStatus;
  simulatorResult?: IssuerSimulatorResult;
  simulatorErrorMessage?: string;
};

type JsonRecord = Record<string, unknown>;

const root = getAppRoot();
const LOGS_POLL_INTERVAL_MS = 5_000;

const state: IssuerState = {
  locale: getLocalePreference(navigator.language),
  status: 'checking',
  logs: [],
  logsStatus: 'idle',
  activeTab: 'logs',
  simulatorFixtureId: 'happy',
  simulatorStatus: 'idle'
};

let logsPollInterval: number | undefined;
let logsRequestId = 0;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function isAuthenticatedResponse(payload: unknown): boolean {
  return isRecord(payload) && payload.authenticated === true;
}

function getErrorCode(payload: unknown): string | undefined {
  if (!isRecord(payload) || !isRecord(payload.error)) {
    return undefined;
  }

  return getString(payload.error.code);
}

function getLoginErrorMessage(payload: unknown): string {
  const errorCode = getErrorCode(payload);

  if (errorCode === 'ISSUER_PASSWORD_NOT_CONFIGURED') {
    return t('issuerGateConfigError', state.locale);
  }

  return t('issuerGateErrorCopy', state.locale);
}

function getSimulatorErrorMessage(payload: unknown): string {
  const errorCode = getErrorCode(payload);

  if (errorCode === 'ISSUER_SESSION_REQUIRED') {
    return t('issuerSimulatorSessionError', state.locale);
  }

  if (errorCode === 'SIMULATOR_FIXTURE_INVALID') {
    return t('issuerSimulatorFixtureError', state.locale);
  }

  return t('issuerSimulatorErrorCopy', state.locale);
}

function resetLogsState(): void {
  state.logs = [];
  state.logsStatus = 'idle';
  state.logsErrorMessage = undefined;
  state.logsLastUpdatedAt = undefined;
}

function stopLogsPolling(): void {
  if (logsPollInterval !== undefined) {
    window.clearInterval(logsPollInterval);
    logsPollInterval = undefined;
  }
}

function isLogsResponse(payload: unknown): payload is { ok: true; events: unknown } {
  return isRecord(payload) && payload.ok === true && Array.isArray(payload.events);
}

function normalizeSimulatorStepStatus(value: unknown): IssuerSimulatorStepStatus {
  return value === 'validated' ? 'validated' : 'failed';
}

function normalizeSimulatorFixtureId(value: unknown): IssuerSimulatorFixtureId | undefined {
  return value === 'happy' || value === 'edge' ? value : undefined;
}

function getNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function normalizeSimulatorStep(value: unknown): IssuerSimulatorStep | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const stepId = getString(value.stepId);
  const label = getString(value.label);
  const transactionType = getString(value.transactionType);
  const hash = getString(value.hash);
  const ledgerIndex = getNumber(value.ledgerIndex);
  const ledgerDate = getString(value.ledgerDate);
  const explorerUrl = getString(value.explorerUrl);
  const source = getString(value.source);
  const logId = getString(value.logId);

  if (!stepId || !label || !transactionType || !hash || ledgerIndex === undefined || !ledgerDate || !explorerUrl || !source || !logId) {
    return undefined;
  }

  return {
    stepId,
    label,
    transactionType,
    status: normalizeSimulatorStepStatus(value.status),
    hash,
    ledgerIndex,
    ledgerDate,
    explorerUrl,
    source,
    logId
  };
}

function normalizeSimulatorResult(payload: unknown): IssuerSimulatorResult | undefined {
  if (!isRecord(payload) || payload.ok !== true || !isRecord(payload.fixture) || !Array.isArray(payload.steps)) {
    return undefined;
  }

  const fixtureId = normalizeSimulatorFixtureId(payload.fixture.id);
  const mode = getString(payload.mode);
  const ledger = getString(payload.ledger);
  const executedAt = getString(payload.executedAt);
  const label = getString(payload.fixture.label);
  const subjectId = getString(payload.fixture.subjectId);
  const visaType = getString(payload.fixture.visaType);
  const employmentChannel = getString(payload.fixture.employmentChannel);
  const rentLedgerMonths = getNumber(payload.fixture.rentLedgerMonths);
  const steps = payload.steps.map(normalizeSimulatorStep).filter((step): step is IssuerSimulatorStep => Boolean(step));

  if (!fixtureId || !mode || !ledger || !executedAt || !label || !subjectId || !visaType || !employmentChannel || rentLedgerMonths === undefined || !steps.length) {
    return undefined;
  }

  return {
    mode,
    ledger,
    executedAt,
    fixture: {
      id: fixtureId,
      label,
      subjectId,
      visaType,
      employmentChannel,
      rentLedgerMonths
    },
    steps
  };
}

async function fetchIssuerLogs(): Promise<void> {
  const requestId = ++logsRequestId;

  if (state.logsStatus === 'idle') {
    state.logsStatus = 'loading';
    render();
  }

  try {
    const response = await fetch('/api/logs', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    });
    const payload = await response.json() as unknown;

    if (!response.ok || !isLogsResponse(payload)) {
      throw new Error('Issuer logs response was not usable.');
    }

    if (requestId !== logsRequestId || state.status !== 'unlocked') {
      return;
    }

    state.logs = normalizeIssuerLogEvents(payload.events);
    state.logsStatus = 'ready';
    state.logsErrorMessage = undefined;
    state.logsLastUpdatedAt = new Date().toISOString();
  } catch (error) {
    if (requestId !== logsRequestId || state.status !== 'unlocked') {
      return;
    }

    state.logsStatus = 'error';
    state.logsErrorMessage = error instanceof Error && error.message
      ? t('issuerLogsErrorCopy', state.locale)
      : t('issuerLogsErrorCopy', state.locale);
  }

  render();
}

function startLogsPolling(): void {
  if (logsPollInterval !== undefined) {
    return;
  }

  logsPollInterval = window.setInterval(() => {
    void fetchIssuerLogs();
  }, LOGS_POLL_INTERVAL_MS);
  void fetchIssuerLogs();
}

function createLocaleToggle(): HTMLDivElement {
  const group = document.createElement('div');
  group.className = 'route-locale-toggle issuer-locale-toggle';
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
  actions.className = 'route-header-actions issuer-header-actions';
  actions.append(
    HistoryControls({ backLabel: state.locale === 'ko' ? '뒤로' : 'Back' }),
    createLocaleToggle()
  );
  return actions;
}

function getGateStatus(): IssuerGateStatus {
  if (state.status === 'checking') {
    return 'checking';
  }

  if (state.status === 'submitting') {
    return 'submitting';
  }

  return state.errorMessage ? 'error' : 'idle';
}

async function checkIssuerSession(): Promise<void> {
  try {
    const response = await fetch('/api/issuer/session', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    });
    const payload = await response.json() as unknown;

    state.status = response.ok && isAuthenticatedResponse(payload) ? 'unlocked' : 'locked';
    state.errorMessage = undefined;
  } catch {
    state.status = 'locked';
    state.errorMessage = t('issuerGateSessionError', state.locale);
  }

  render();
}

async function submitIssuerPassword(password: string): Promise<void> {
  const trimmedPassword = password.trim();

  if (!trimmedPassword) {
    state.status = 'locked';
    state.errorMessage = t('issuerGatePasswordRequired', state.locale);
    render();
    return;
  }

  state.status = 'submitting';
  state.errorMessage = undefined;
  render();

  try {
    const response = await fetch('/api/issuer/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password: trimmedPassword })
    });
    const payload = await response.json() as unknown;

    if (response.ok && isAuthenticatedResponse(payload)) {
      state.status = 'unlocked';
      state.errorMessage = undefined;
      render();
      return;
    }

    state.status = 'locked';
    state.errorMessage = getLoginErrorMessage(payload);
  } catch {
    state.status = 'locked';
    state.errorMessage = t('issuerGateNetworkError', state.locale);
  }

  render();
}

function selectSimulatorFixture(fixtureId: IssuerSimulatorFixtureId): void {
  state.simulatorFixtureId = fixtureId;
  state.simulatorStatus = 'idle';
  state.simulatorResult = undefined;
  state.simulatorErrorMessage = undefined;
  render();
}

async function runIssuerSimulator(): Promise<void> {
  state.activeTab = 'simulator';
  state.simulatorStatus = 'submitting';
  state.simulatorErrorMessage = undefined;
  render();

  try {
    const response = await fetch('/api/issuer/simulator', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fixtureId: state.simulatorFixtureId })
    });
    const payload = await response.json() as unknown;
    const result = normalizeSimulatorResult(payload);

    if (!response.ok || !result) {
      throw new Error(getSimulatorErrorMessage(payload));
    }

    state.simulatorStatus = 'success';
    state.simulatorResult = result;
    state.simulatorErrorMessage = undefined;
    await fetchIssuerLogs();
    return;
  } catch (error) {
    state.simulatorStatus = 'error';
    state.simulatorErrorMessage = error instanceof Error && error.message
      ? error.message
      : t('issuerSimulatorErrorCopy', state.locale);
  }

  render();
}

function render(): void {
  const localeToggle = createHeaderActions();
  const isUnlocked = state.status === 'unlocked';

  if (isUnlocked) {
    startLogsPolling();
  } else {
    stopLogsPolling();
    resetLogsState();
  }

  root.replaceChildren(
    isUnlocked
      ? IssuerShellScreen({
        locale: state.locale,
        localeToggle,
        logsStatus: state.logsStatus,
        logs: state.logs,
        logsErrorMessage: state.logsErrorMessage,
        lastUpdatedAt: state.logsLastUpdatedAt,
        activeTab: state.activeTab,
        simulatorPanel: IssuerSimulatorCard({
          locale: state.locale,
          selectedFixtureId: state.simulatorFixtureId,
          status: state.simulatorStatus,
          result: state.simulatorResult,
          errorMessage: state.simulatorErrorMessage,
          onFixtureChange: selectSimulatorFixture,
          onRun: () => {
            void runIssuerSimulator();
          }
        }),
        statsPanel: IssuerStatsCard({
          locale: state.locale,
          logs: state.logs
        }),
        onSelectTab: (tab) => {
          state.activeTab = tab;
          render();
        }
      })
      : IssuerGateScreen({
        locale: state.locale,
        status: getGateStatus(),
        errorMessage: state.errorMessage,
        localeToggle,
        onSubmit: (password) => {
          void submitIssuerPassword(password);
        }
      })
  );
}

render();
void checkIssuerSession();
