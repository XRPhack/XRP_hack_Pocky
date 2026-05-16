import '../../styles.css';
import { getLocalePreference, setLocalePreference } from '../../shared/auth/session';
import { t, type Locale } from '../../shared/i18n';
import { HistoryControls } from '../../shared/ui';
import { getAppRoot } from '../app-placeholder';
import {
  VerifyEntryScreen,
  VerifyErrorScreen,
  VerifyLoadingScreen,
  VerifyResultScreen,
  getFixtureEvidenceLinks,
  type VerifyBadge,
  type VerifyConfirmationStatus,
  type VerifyEvidenceLink,
  type VerifyReport
} from './screens';

type JsonRecord = Record<string, unknown>;
type VerifyBadgeStatus = VerifyBadge['status'];
type VerifyTrustGrade = VerifyReport['trustGrade'];

type VerifyViewState =
  | { status: 'entry'; hasValidationError?: boolean }
  | { status: 'loading'; reportId: string }
  | { status: 'error'; title: string; description: string }
  | { status: 'result'; report: VerifyReport; evidenceLinks: VerifyEvidenceLink[]; confirmationStatus: VerifyConfirmationStatus };

const root = getAppRoot();
let locale: Locale = getLocalePreference(navigator.language);
let viewState: VerifyViewState;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function isBadgeStatus(value: unknown): value is VerifyBadgeStatus {
  return value === 'pass' || value === 'warning' || value === 'fail';
}

function isTrustGrade(value: unknown): value is VerifyTrustGrade {
  return value === 'A' || value === 'B' || value === 'C' || value === 'D';
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch (error) {
    if (error instanceof URIError) {
      return value;
    }

    throw error;
  }
}

function getReportIdFromPath(pathname: string): string | undefined {
  const segments = pathname.split('/').filter(Boolean);

  if (segments[0] !== 'verify') {
    return undefined;
  }

  const reportId = segments[1] ? safeDecode(segments[1]).trim() : '';
  return reportId || undefined;
}

function createLocaleToggle(): HTMLElement {
  const group = document.createElement('div');
  group.className = 'route-locale-toggle verify-locale-toggle';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', t('languageToggle', locale));

  for (const nextLocale of ['ko', 'en'] as const) {
    const button = document.createElement('button');
    const isActive = locale === nextLocale;

    button.className = `route-locale-toggle__button${isActive ? ' route-locale-toggle__button--active' : ''}`;
    button.type = 'button';
    button.textContent = t(nextLocale === 'ko' ? 'korean' : 'english', locale);
    button.setAttribute('aria-pressed', String(isActive));
    button.addEventListener('click', () => {
      locale = setLocalePreference(nextLocale);
      render();
    });
    group.appendChild(button);
  }

  return group;
}

function createHeaderActions(): HTMLDivElement {
  const actions = document.createElement('div');
  actions.className = 'route-header-actions verify-header-actions';
  actions.append(
    HistoryControls({ backLabel: locale === 'ko' ? '뒤로' : 'Back' }),
    createLocaleToggle()
  );
  return actions;
}

function submitReportId(reportId: string): void {
  const trimmedReportId = reportId.trim();

  if (!trimmedReportId) {
    viewState = { status: 'entry', hasValidationError: true };
    render();
    return;
  }

  window.location.assign(`/verify/${encodeURIComponent(trimmedReportId)}`);
}

function parseBadge(value: unknown): VerifyBadge | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const id = getString(value.id);
  const label = getString(value.label);
  const status = value.status;
  const summary = getString(value.summary);
  const evidence = getString(value.evidence);

  if (!id || !label || !isBadgeStatus(status) || !summary || !evidence) {
    return undefined;
  }

  return { id, label, status, summary, evidence };
}

function createBadgeTuple(badges: VerifyBadge[]): VerifyReport['badges'] {
  if (badges.length !== 6) {
    throw new Error(t('verifyInvalidBadgeCount', locale));
  }

  return [badges[0], badges[1], badges[2], badges[3], badges[4], badges[5]];
}

function parseReportPayload(payload: unknown): VerifyReport {
  if (!isRecord(payload) || !isRecord(payload.report)) {
    throw new Error(t('verifyInvalidResponse', locale));
  }

  const report = payload.report;
  const reportId = getString(report.reportId) ?? getString(payload.id);
  const holderId = getString(report.holderId);
  const trustGrade = report.trustGrade;
  const generatedAt = getString(report.generatedAt);

  if (!reportId || !holderId || !isTrustGrade(trustGrade) || !generatedAt || !Array.isArray(report.badges)) {
    throw new Error(t('verifyInvalidResponse', locale));
  }

  const badges = report.badges.map(parseBadge);
  if (badges.some((badge) => badge === undefined)) {
    throw new Error(t('verifyInvalidResponse', locale));
  }

  return {
    reportId,
    holderId,
    trustGrade,
    generatedAt,
    badges: createBadgeTuple(badges.filter((badge): badge is VerifyBadge => badge !== undefined))
  };
}

function getHashFromExplorerUrl(href: string): string | undefined {
  const parts = href.split('/').filter(Boolean);
  return getString(parts[parts.length - 1]);
}

function parseEvidenceLink(value: unknown): VerifyEvidenceLink | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const href = getString(value.explorerUrl) ?? getString(value.href) ?? getString(value.url);
  if (!href || !href.startsWith('https://testnet.xrpl.org/transactions/')) {
    return undefined;
  }

  const hash = getString(value.hash) ?? getString(value.txHash) ?? getHashFromExplorerUrl(href);
  if (!hash) {
    return undefined;
  }

  return {
    label: getString(value.label) ?? getString(value.transactionType) ?? t('verifyEvidenceFallbackLabel', locale),
    hash,
    href,
    network: getString(value.network) ?? 'XRPL Testnet'
  };
}

function getCandidateEvidenceArrays(payload: JsonRecord): unknown[] {
  const report = isRecord(payload.report) ? payload.report : undefined;
  return [payload.evidenceLinks, payload.links, payload.txLinks, report?.evidenceLinks, report?.links, report?.txLinks];
}

function extractEvidenceLinks(payload: unknown): VerifyEvidenceLink[] {
  if (!isRecord(payload)) {
    return getFixtureEvidenceLinks();
  }

  for (const candidate of getCandidateEvidenceArrays(payload)) {
    if (!Array.isArray(candidate)) {
      continue;
    }

    const links = candidate.map(parseEvidenceLink).filter((link): link is VerifyEvidenceLink => link !== undefined);
    if (links.length > 0) {
      return links.slice(0, 6);
    }
  }

  return getFixtureEvidenceLinks();
}

function getApiErrorMessage(payload: unknown): string | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }

  return getString(payload.message) ?? getString(payload.error);
}

async function readJsonResponse(response: Response): Promise<unknown> {
  try {
    const payload: unknown = await response.json();
    return payload;
  } catch {
    throw new Error(t('verifyInvalidResponse', locale));
  }
}

async function loadReport(reportId: string): Promise<void> {
  try {
    const response = await fetch(`/api/report/${encodeURIComponent(reportId)}`);
    const payload = await readJsonResponse(response);

    if (!response.ok) {
      throw new Error(getApiErrorMessage(payload) ?? t('verifyReportNotFoundCopy', locale));
    }

    viewState = {
      status: 'result',
      report: parseReportPayload(payload),
      evidenceLinks: extractEvidenceLinks(payload),
      confirmationStatus: 'idle'
    };
  } catch (error) {
    viewState = {
      status: 'error',
      title: t('verifyReportNotFoundTitle', locale),
      description: error instanceof Error ? error.message : t('verifyReportNotFoundCopy', locale)
    };
  }

  render();
}

async function recordLandlordConfirmation(reportId: string): Promise<void> {
  if (viewState.status !== 'result' || viewState.confirmationStatus === 'submitting' || viewState.confirmationStatus === 'success') {
    return;
  }

  viewState = { ...viewState, confirmationStatus: 'submitting' };
  render();

  try {
    const response = await fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportId, action: 'landlord-confirmed-report' })
    });
    const payload = await readJsonResponse(response);

    if (!response.ok) {
      throw new Error(getApiErrorMessage(payload) ?? t('verifyConfirmErrorCopy', locale));
    }

    if (viewState.status === 'result') {
      viewState = { ...viewState, confirmationStatus: 'success' };
    }
  } catch {
    if (viewState.status === 'result') {
      viewState = { ...viewState, confirmationStatus: 'error' };
    }
  }

  render();
}

function printVerifyResult(): void {
  window.print();
}

function render(): void {
  root.innerHTML = '';
  const localeToggle = createHeaderActions();

  if (viewState.status === 'entry') {
    root.appendChild(
      VerifyEntryScreen({
        locale,
        localeToggle,
        errorMessage: viewState.hasValidationError ? t('verifyEntryRequired', locale) : undefined,
        onSubmit: submitReportId
      })
    );
    return;
  }

  if (viewState.status === 'loading') {
    root.appendChild(VerifyLoadingScreen({ locale, reportId: viewState.reportId, localeToggle }));
    return;
  }

  if (viewState.status === 'error') {
    root.appendChild(VerifyErrorScreen({ locale, title: viewState.title, description: viewState.description, localeToggle }));
    return;
  }

  root.appendChild(
    VerifyResultScreen({
      locale,
      report: viewState.report,
      evidenceLinks: viewState.evidenceLinks,
      confirmationStatus: viewState.confirmationStatus,
      localeToggle,
      onConfirm: () => {
        void recordLandlordConfirmation(viewState.status === 'result' ? viewState.report.reportId : '');
      },
      onPrint: printVerifyResult
    })
  );
}

const reportId = getReportIdFromPath(window.location.pathname);

if (!reportId) {
  viewState = { status: 'entry' };
  render();
} else {
  viewState = { status: 'loading', reportId };
  render();
  void loadReport(reportId);
}
