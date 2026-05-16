import demoFixtures from '../../../../scripts/demo-fixtures.json';
import { normalizeLocale, t, type Locale } from '../../../shared/i18n';
import { Badge, Card, ErrorState, LoadingOverlay } from '../../../shared/ui';
import { appendChildren, createTextElement, cx, type UiChild } from '../../../shared/ui/dom';

export type IssuerLogsLoadStatus = 'idle' | 'loading' | 'ready' | 'error';
export type IssuerLogEntryStatus = 'created' | 'dry-run' | 'submitted' | 'confirmed' | 'validated' | 'failed' | 'error' | 'expired';
export type IssuerShellTab = 'logs' | 'simulator' | 'stats';

export type IssuerLogEvent = {
  id: string;
  type: string;
  createdAt: string;
  status: IssuerLogEntryStatus;
  details: Record<string, unknown>;
  sessionId?: string;
  userId?: string;
};

type IssuerShellScreenProps = {
  locale: Locale;
  localeToggle: UiChild;
  logsStatus: IssuerLogsLoadStatus;
  logs: IssuerLogEvent[];
  logsErrorMessage?: string;
  lastUpdatedAt?: string;
  activeTab: IssuerShellTab;
  simulatorPanel: UiChild;
  statsPanel: UiChild;
  onSelectTab: (tab: IssuerShellTab) => void;
};

type FixtureTransaction = {
  label: string;
  transactionType: string;
  hash: string;
  validated: boolean;
  ledgerIndex: number;
  ledgerDate: string;
  explorerUrl: string;
};

type FixtureData = {
  network: {
    name: string;
    explorerBaseUrl: string;
  };
  transactions: FixtureTransaction[];
};

type TxEvidence = {
  id: string;
  label: string;
  transactionType: string;
  hash: string;
  status: IssuerLogEntryStatus;
  href: string;
  occurredAt: string;
  source: 'logs' | 'fixture';
};

const fixtureData: FixtureData = demoFixtures;
const MAX_LOG_ENTRIES = 50;
const MAX_FIXTURE_TX_EVIDENCE = 6;
const XRPL_HASH_PATTERN = /^[a-fA-F0-9]{64}$/;
const EMAIL_PATTERN = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/;
const IPV4_PATTERN = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;
const PHONE_PATTERN = /(?:\+?\d[\d\s().-]{7,}\d)/;
const SENSITIVE_KEY_PATTERN = /(seed|secret|private|password|phone|email|ip|fingerprint|passport|sessiondata|raw)/i;

const allowedStatuses: readonly IssuerLogEntryStatus[] = [
  'created',
  'dry-run',
  'submitted',
  'confirmed',
  'validated',
  'failed',
  'error',
  'expired'
];

const safeDetailLabels: Record<string, string> = {
  action: 'issuerLogDetailAction',
  credentialType: 'issuerLogDetailCredentialType',
  dryRunReason: 'issuerLogDetailDryRunReason',
  evidenceSource: 'issuerLogDetailEvidenceSource',
  fixtureId: 'issuerLogDetailFixtureId',
  fixtureLabel: 'issuerLogDetailFixtureLabel',
  simulatorRunId: 'issuerLogDetailSimulatorRunId',
  issuerAddress: 'issuerLogDetailIssuerAddress',
  ledgerIndex: 'issuerLogDetailLedgerIndex',
  escrowAmountXrp: 'issuerLogDetailEscrowAmountXrp',
  mode: 'issuerLogDetailMode',
  provider: 'issuerLogDetailProvider',
  step: 'issuerLogDetailStep',
  transactionType: 'issuerLogDetailTransactionType',
  reportId: 'issuerLogContextReport',
  tenantWalletAddress: 'issuerLogDetailTenantWallet',
  verificationId: 'issuerLogDetailVerificationId',
  documentKinds: 'issuerLogDetailDocumentKinds',
  reviewReasonCount: 'issuerLogDetailReviewReasonCount',
  reviewReasons: 'issuerLogDetailReviewReasons',
  retentionTtlMinutes: 'issuerLogDetailRetentionTtlMinutes',
  replacedPrevious: 'issuerLogDetailReplacedPrevious',
  expiresAt: 'issuerLogDetailExpiresAt'
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function isSafeDisplayValue(value: string): boolean {
  return !EMAIL_PATTERN.test(value) && !IPV4_PATTERN.test(value) && !PHONE_PATTERN.test(value);
}

function getSafeString(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  const safeValue = getString(value);

  if (!safeValue || !isSafeDisplayValue(safeValue)) {
    return undefined;
  }

  return safeValue;
}

function normalizeStatus(value: unknown): IssuerLogEntryStatus {
  const status = getString(value);

  if (status && allowedStatuses.includes(status as IssuerLogEntryStatus)) {
    return status as IssuerLogEntryStatus;
  }

  return 'created';
}

function normalizeDetails(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    return {};
  }

  const details: Record<string, unknown> = {};

  for (const [key, detailValue] of Object.entries(value)) {
    if (!SENSITIVE_KEY_PATTERN.test(key)) {
      details[key] = detailValue;
    }
  }

  return details;
}

export function normalizeIssuerLogEvents(value: unknown): IssuerLogEvent[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((item): IssuerLogEvent => {
      const id = getSafeString(item.id) ?? `log-${crypto.randomUUID()}`;
      const createdAt = getString(item.createdAt) ?? new Date().toISOString();
      const type = getSafeString(item.type) ?? 'unknown';
      const sessionId = getSafeString(item.sessionId);
      const userId = getSafeString(item.userId);

      return {
        id,
        type,
        createdAt,
        status: normalizeStatus(item.status),
        details: normalizeDetails(item.details),
        ...(sessionId ? { sessionId } : {}),
        ...(userId ? { userId } : {})
      };
    })
    .slice(0, MAX_LOG_ENTRIES);
}

function statusVariant(status: IssuerLogEntryStatus): 'neutral' | 'success' | 'warning' | 'error' | 'info' {
  if (status === 'validated' || status === 'confirmed') {
    return 'success';
  }

  if (status === 'dry-run') {
    return 'warning';
  }

  if (status === 'failed' || status === 'error') {
    return 'error';
  }

  if (status === 'submitted' || status === 'expired') {
    return 'info';
  }

  return 'neutral';
}

function statusLabel(status: IssuerLogEntryStatus, locale: Locale): string {
  const keyByStatus: Record<IssuerLogEntryStatus, string> = {
    created: 'issuerLogStatusCreated',
    'dry-run': 'issuerLogStatusDryRun',
    submitted: 'issuerLogStatusSubmitted',
    confirmed: 'issuerLogStatusConfirmed',
    validated: 'issuerLogStatusValidated',
    failed: 'issuerLogStatusFailed',
    error: 'issuerLogStatusError',
    expired: 'issuerLogStatusExpired'
  };

  return t(keyByStatus[status], locale);
}

function eventTypeLabel(type: string, locale: Locale): string {
  if (type === 'auth.toss-mock') {
    return t('issuerLogEventAuthTossMock', locale);
  }

  if (type === 'issuer.sign-and-submit') {
    return t('issuerLogEventIssuerSignAndSubmit', locale);
  }

  if (type === 'document.verification') {
    return t('issuerLogEventDocumentVerification', locale);
  }

  if (type === 'issuer.simulator') {
    return t('issuerLogEventIssuerSimulator', locale);
  }

  if (type === 'landlord.verify-confirmed') {
    return t('issuerLogEventLandlordVerifyConfirmed', locale);
  }

  return t('issuerLogEventUnknown', locale);
}

function formatDateTime(value: string, locale: Locale): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'medium'
  }).format(date);
}

function shortenIdentifier(value: string): string {
  if (value.length <= 18) {
    return value;
  }

  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function createStatusBadge(status: IssuerLogEntryStatus, locale: Locale): HTMLSpanElement {
  const badge = Badge({ label: statusLabel(status, locale), variant: statusVariant(status) });
  badge.classList.add('issuer-log-status', `issuer-log-status--${status}`);
  return badge;
}

function createContextPill(label: string, value: string): HTMLSpanElement {
  const pill = document.createElement('span');
  pill.className = 'issuer-log-context-pill';
  appendChildren(
    pill,
    createTextElement('span', 'issuer-log-context-pill__label', label),
    createTextElement('span', 'issuer-log-context-pill__value', shortenIdentifier(value))
  );
  return pill;
}

function getReportId(details: Record<string, unknown>): string | undefined {
  return getSafeString(details.reportId);
}

function createLogContext(event: IssuerLogEvent, locale: Locale): HTMLDivElement {
  const context = document.createElement('div');
  context.className = 'issuer-log-context';

  appendChildren(
    context,
    event.userId ? createContextPill(t('issuerLogContextUser', locale), event.userId) : null,
    event.sessionId ? createContextPill(t('issuerLogContextSession', locale), event.sessionId) : null,
    getReportId(event.details) ? createContextPill(t('issuerLogContextReport', locale), getReportId(event.details) ?? '') : null
  );

  if (!context.childNodes.length) {
    context.appendChild(createTextElement('span', 'issuer-log-context__empty', t('issuerLogNoContext', locale)));
  }

  return context;
}

function createDetailList(details: Record<string, unknown>, locale: Locale): HTMLElement {
  const list = document.createElement('dl');
  list.className = 'issuer-log-details';

  for (const [key, labelKey] of Object.entries(safeDetailLabels)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      continue;
    }

    const value = getSafeString(details[key]);

    if (!value) {
      continue;
    }

    const item = document.createElement('div');
    item.className = 'issuer-log-details__item';
    appendChildren(
      item,
      createTextElement('dt', 'issuer-log-details__term', t(labelKey, locale)),
      createTextElement('dd', 'issuer-log-details__value', shortenIdentifier(value))
    );
    list.appendChild(item);
  }

  if (!list.childNodes.length) {
    const item = document.createElement('div');
    item.className = 'issuer-log-details__item';
    appendChildren(
      item,
      createTextElement('dt', 'issuer-log-details__term', t('issuerLogDetailSafeSummary', locale)),
      createTextElement('dd', 'issuer-log-details__value', t('issuerLogNoDetails', locale))
    );
    list.appendChild(item);
  }

  return list;
}

function getTxHash(details: Record<string, unknown>): string | undefined {
  for (const key of ['hash', 'txHash', 'transactionHash']) {
    const value = getSafeString(details[key]);

    if (value && XRPL_HASH_PATTERN.test(value)) {
      return value.toUpperCase();
    }
  }

  return undefined;
}

function getExplorerUrl(hash: string): string {
  return `${fixtureData.network.explorerBaseUrl}/${hash}`;
}

function createEvidenceLink(evidence: TxEvidence, locale: Locale): HTMLAnchorElement {
  const link = document.createElement('a');
  link.className = 'issuer-tx-link';
  link.href = evidence.href;
  link.target = '_blank';
  link.rel = 'noreferrer noopener';
  link.setAttribute('aria-label', t('issuerTxOpenExplorerA11y', locale).replace('{hash}', evidence.hash));

  appendChildren(
    link,
    createTextElement('span', 'issuer-tx-link__label', t('issuerTxExplorerLink', locale)),
    createTextElement('span', 'issuer-tx-link__value', shortenIdentifier(evidence.hash)),
    createTextElement('span', 'issuer-tx-link__arrow', '↗')
  );

  link.querySelector('.issuer-tx-link__arrow')?.setAttribute('aria-hidden', 'true');
  return link;
}

function createLogIdentifier(event: IssuerLogEvent, locale: Locale): HTMLElement {
  const hash = getTxHash(event.details);

  if (hash) {
    return createEvidenceLink({
      id: event.id,
      label: eventTypeLabel(event.type, locale),
      transactionType: event.type,
      hash,
      status: event.status,
      href: getExplorerUrl(hash),
      occurredAt: event.createdAt,
      source: 'logs'
    }, locale);
  }

  const reportId = getReportId(event.details);
  const fallbackValue = reportId ?? event.id;
  const value = createTextElement('code', 'issuer-log-identifier', shortenIdentifier(fallbackValue));
  value.setAttribute('aria-label', fallbackValue);
  return value;
}

function createLogItem(event: IssuerLogEvent, locale: Locale): HTMLElement {
  const item = document.createElement('article');
  item.className = 'issuer-log-item';

  const header = document.createElement('header');
  header.className = 'issuer-log-item__header';
  appendChildren(
    header,
    createTextElement('p', 'issuer-log-item__event', eventTypeLabel(event.type, locale)),
    createStatusBadge(event.status, locale)
  );

  const meta = document.createElement('div');
  meta.className = 'issuer-log-item__meta';
  appendChildren(
    meta,
    createContextPill(t('issuerLogTimeLabel', locale), formatDateTime(event.createdAt, locale)),
    createLogContext(event, locale)
  );

  const identifierGroup = document.createElement('div');
  identifierGroup.className = 'issuer-log-item__identifier';
  appendChildren(
    identifierGroup,
    createTextElement('span', 'issuer-log-item__identifier-label', t('issuerLogIdentifierLabel', locale)),
    createLogIdentifier(event, locale)
  );

  appendChildren(item, header, meta, identifierGroup, createDetailList(event.details, locale));
  return item;
}

function createLogsList(logs: IssuerLogEvent[], locale: Locale): HTMLElement {
  const list = document.createElement('div');
  list.className = 'issuer-log-list';

  if (!logs.length) {
    const empty = document.createElement('div');
    empty.className = 'issuer-log-empty';
    appendChildren(
      empty,
      createTextElement('p', 'issuer-log-empty__title', t('issuerLogsEmptyTitle', locale)),
      createTextElement('p', 'issuer-log-empty__copy', t('issuerLogsEmptyCopy', locale))
    );
    list.appendChild(empty);
    return list;
  }

  appendChildren(list, logs.map((event) => createLogItem(event, locale)));
  return list;
}

function createLogCard(logsStatus: IssuerLogsLoadStatus, logs: IssuerLogEvent[], logsErrorMessage: string | undefined, locale: Locale): HTMLElement {
  const content = document.createElement('div');
  content.className = 'issuer-log-card-content';
  appendChildren(content, createLogsList(logs, locale));

  if (logsStatus === 'error') {
    content.appendChild(ErrorState({
      title: t('issuerLogsErrorTitle', locale),
      description: logsErrorMessage ?? t('issuerLogsErrorCopy', locale)
    }));
  }

  const card = Card({
    eyebrow: t('issuerLogsActivityEyebrow', locale),
    title: t('issuerLogsActivityTitle', locale),
    description: t('issuerLogsActivityCopy', locale),
    children: content,
    elevated: true
  });
  card.classList.add('issuer-log-card');

  if (logsStatus === 'loading' || logsStatus === 'idle') {
    card.appendChild(LoadingOverlay({ label: t('issuerLogsLoading', locale) }));
  }

  return card;
}

function createTxEvidence(logs: IssuerLogEvent[]): TxEvidence[] {
  const liveEvidence = logs.flatMap((event): TxEvidence[] => {
    const hash = getTxHash(event.details);

    if (!hash) {
      return [];
    }

    return [{
      id: event.id,
      label: event.type,
      transactionType: event.type,
      hash,
      status: event.status,
      href: getExplorerUrl(hash),
      occurredAt: event.createdAt,
      source: 'logs'
    }];
  });

  if (liveEvidence.length) {
    return liveEvidence;
  }

  return fixtureData.transactions
    .slice(0, MAX_FIXTURE_TX_EVIDENCE)
    .map((transaction): TxEvidence => ({
      id: transaction.hash,
      label: transaction.label,
      transactionType: transaction.transactionType,
      hash: transaction.hash,
      status: transaction.validated ? 'validated' : 'failed',
      href: transaction.explorerUrl,
      occurredAt: transaction.ledgerDate,
      source: 'fixture'
    }));
}

function createTxEvidenceItem(evidence: TxEvidence, locale: Locale): HTMLElement {
  const item = document.createElement('article');
  item.className = cx('issuer-tx-item', evidence.source === 'fixture' && 'issuer-tx-item--fixture');
  const title = evidence.source === 'logs' ? eventTypeLabel(evidence.label, locale) : evidence.label;

  const header = document.createElement('header');
  header.className = 'issuer-tx-item__header';
  appendChildren(
    header,
    createTextElement('p', 'issuer-tx-item__title', title),
    createStatusBadge(evidence.status, locale)
  );

  const meta = document.createElement('div');
  meta.className = 'issuer-tx-item__meta';
  appendChildren(
    meta,
    createContextPill(t('issuerTxTypeLabel', locale), evidence.transactionType),
    createContextPill(t('issuerTxLedgerTimeLabel', locale), formatDateTime(evidence.occurredAt, locale)),
    createContextPill(t('issuerTxSourceLabel', locale), t(evidence.source === 'fixture' ? 'issuerTxSourceFixture' : 'issuerTxSourceLogs', locale))
  );

  appendChildren(item, header, meta, createEvidenceLink(evidence, locale));
  return item;
}

function createTxEvidenceCard(logs: IssuerLogEvent[], locale: Locale): HTMLElement {
  const evidence = createTxEvidence(logs);
  const usesFixtures = evidence.every((item) => item.source === 'fixture');
  const content = document.createElement('div');
  content.className = 'issuer-tx-list';
  appendChildren(content, evidence.map((item) => createTxEvidenceItem(item, locale)));

  const card = Card({
    eyebrow: t('issuerTxEvidenceEyebrow', locale),
    title: t(usesFixtures ? 'issuerTxEvidenceTitle' : 'issuerTxEvidenceLiveTitle', locale),
    description: t(usesFixtures ? 'issuerTxEvidenceFixtureCopy' : 'issuerTxEvidenceLiveCopy', locale),
    children: content,
    footer: Badge({ label: t('issuerTxEvidenceBadge', locale), variant: 'success' }),
    elevated: true
  });
  card.classList.add('issuer-tx-card');
  return card;
}

function createShellHero(locale: Locale, lastUpdatedAt?: string): HTMLElement {
  const hero = document.createElement('div');
  hero.className = 'issuer-shell-hero';

  appendChildren(
    hero,
    Badge({ label: t('issuerLogsPollingBadge', locale), variant: 'success' }),
    createTextElement('h1', 'issuer-display-title', t('issuerShellTitle', locale)),
    createTextElement('p', 'issuer-display-copy', t('issuerShellCopy', locale)),
    lastUpdatedAt ? createTextElement('p', 'issuer-shell-updated', t('issuerLogsLastUpdated', locale).replace('{time}', formatDateTime(lastUpdatedAt, locale))) : null
  );

  hero.querySelector('h1')?.setAttribute('id', 'issuer-shell-title');
  return hero;
}

function createShellTabs(activeTab: IssuerShellTab, locale: Locale, onSelectTab: (tab: IssuerShellTab) => void): HTMLElement {
  const tabs = document.createElement('div');
  tabs.className = 'issuer-shell-tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', t('issuerShellTabsA11y', locale));

  const tabLabels: Record<IssuerShellTab, string> = {
    logs: 'issuerShellTabLogs',
    simulator: 'issuerShellTabSimulator',
    stats: 'issuerShellTabStats'
  };

  for (const tab of ['logs', 'simulator', 'stats'] as const) {
    const button = document.createElement('button');
    const isSelected = activeTab === tab;

    button.className = cx('issuer-shell-tab', isSelected && 'issuer-shell-tab--active');
    button.type = 'button';
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(isSelected));
    button.textContent = t(tabLabels[tab], locale);
    button.addEventListener('click', () => {
      onSelectTab(tab);
    });
    tabs.appendChild(button);
  }

  return tabs;
}

export function IssuerShellScreen({
  locale,
  localeToggle,
  logsStatus,
  logs,
  logsErrorMessage,
  lastUpdatedAt,
  activeTab,
  simulatorPanel,
  statsPanel,
  onSelectTab
}: IssuerShellScreenProps): HTMLElement {
  const normalizedLocale = normalizeLocale(locale);
  const screen = document.createElement('main');
  screen.className = 'issuer-screen issuer-shell-screen';
  screen.dataset.locale = normalizedLocale;

  const panel = document.createElement('section');
  panel.className = 'issuer-panel issuer-shell-panel';
  panel.setAttribute('aria-labelledby', 'issuer-shell-title');

  const grid = document.createElement('div');
  grid.className = cx(
    'issuer-shell-grid',
    activeTab === 'simulator' && 'issuer-shell-grid--simulator',
    activeTab === 'stats' && 'issuer-shell-grid--stats'
  );

  if (activeTab === 'stats') {
    appendChildren(
      grid,
      statsPanel,
      createLogCard(logsStatus, logs, logsErrorMessage, normalizedLocale)
    );
  } else if (activeTab === 'simulator') {
    appendChildren(
      grid,
      simulatorPanel,
      createTxEvidenceCard(logs, normalizedLocale),
      createLogCard(logsStatus, logs, logsErrorMessage, normalizedLocale)
    );
  } else {
    appendChildren(
      grid,
      createLogCard(logsStatus, logs, logsErrorMessage, normalizedLocale),
      createTxEvidenceCard(logs, normalizedLocale)
    );
  }

  appendChildren(panel, localeToggle, createShellHero(normalizedLocale, lastUpdatedAt), createShellTabs(activeTab, normalizedLocale, onSelectTab), grid);
  screen.appendChild(panel);
  return screen;
}
