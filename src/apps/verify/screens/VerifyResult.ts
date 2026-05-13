import demoFixtures from '../../../../scripts/demo-fixtures.json';
import { normalizeLocale, t, type Locale } from '../../../shared/i18n';
import { Badge, Card, ErrorState, ExplorerLink, LoadingOverlay, Toast } from '../../../shared/ui';
import { appendChildren, createTextElement, cx, type UiChild } from '../../../shared/ui/dom';

type VerifyBadgeStatus = 'pass' | 'warning' | 'fail';
type VerifyTrustGrade = 'A' | 'B' | 'C' | 'D';

export type VerifyConfirmationStatus = 'idle' | 'submitting' | 'success' | 'error';

export type VerifyBadge = {
  id: string;
  label: string;
  status: VerifyBadgeStatus;
  summary: string;
  evidence: string;
};

export type VerifyReport = {
  reportId: string;
  holderId: string;
  trustGrade: VerifyTrustGrade;
  generatedAt: string;
  badges: [VerifyBadge, VerifyBadge, VerifyBadge, VerifyBadge, VerifyBadge, VerifyBadge];
};

export type VerifyEvidenceLink = {
  label: string;
  hash: string;
  href: string;
  network: string;
};

type VerifyScreenProps = {
  locale: Locale;
  localeToggle: UiChild;
};

type VerifyResultScreenProps = VerifyScreenProps & {
  report: VerifyReport;
  evidenceLinks: VerifyEvidenceLink[];
  confirmationStatus: VerifyConfirmationStatus;
  onConfirm: () => void;
  onPrint: () => void;
};

type VerifyLoadingScreenProps = VerifyScreenProps & {
  reportId: string;
};

type VerifyErrorScreenProps = VerifyScreenProps & {
  title: string;
  description: string;
};

type FixtureTransaction = {
  label: string;
  transactionType: string;
  hash: string;
  explorerUrl: string;
};

type FixtureData = {
  network: { name: string };
  transactions: FixtureTransaction[];
};

const fixtureData: FixtureData = demoFixtures;

function badgeVariant(status: VerifyBadgeStatus): 'success' | 'warning' | 'error' {
  if (status === 'warning') {
    return 'warning';
  }

  return status === 'fail' ? 'error' : 'success';
}

function maskIdentifier(value: string): string {
  if (value.length <= 4) {
    return '••••';
  }

  return `${value.slice(0, 4)}••••${value.slice(-3)}`;
}

function formatGeneratedAt(value: string, locale: Locale): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function createVerifyShell(locale: Locale, localeToggle: UiChild, children: UiChild, className?: string): HTMLElement {
  const shell = document.createElement('main');
  shell.className = cx('verify-page', className);

  const frame = document.createElement('div');
  frame.className = 'verify-page__frame';

  const header = document.createElement('header');
  header.className = 'verify-page__header';
  appendChildren(
    header,
    createTextElement('p', 'eyebrow', t('verifyEyebrow', locale)),
    createTextElement('h1', 'verify-page__title', t('verifyResultTitle', locale)),
    createTextElement('p', 'verify-page__copy', t('verifyResultCopy', locale))
  );

  appendChildren(frame, localeToggle, header, children);
  shell.appendChild(frame);
  return shell;
}

function createMetaRow(label: string, value: string): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'verify-meta-row';
  appendChildren(row, createTextElement('span', 'verify-meta-row__label', label), createTextElement('span', 'verify-meta-row__value', value));
  return row;
}

function createGradeCard(report: VerifyReport, locale: Locale): HTMLElement {
  const gradeMark = createTextElement('strong', 'verify-grade__mark', report.trustGrade);
  gradeMark.setAttribute('aria-label', t('verifyTrustGradeA11y', locale).replace('{grade}', report.trustGrade));

  const card = Card({
    eyebrow: t('verifyTrustGradeEyebrow', locale),
    title: t('verifyTrustGradeTitle', locale).replace('{grade}', report.trustGrade),
    description: t('verifyTrustGradeCopy', locale),
    children: [gradeMark, Badge({ label: t('verifyTrustGradeBadge', locale), variant: 'success' })],
    elevated: true
  });
  card.classList.add('verify-grade');
  return card;
}

function createTenantCard(report: VerifyReport, locale: Locale): HTMLElement {
  const card = Card({
    eyebrow: t('verifyTenantEyebrow', locale),
    title: t('verifyTenantTitle', locale),
    description: t('verifyTenantCopy', locale),
    children: [
      createMetaRow(t('verifyReportIdLabel', locale), report.reportId),
      createMetaRow(t('verifyHolderIdLabel', locale), maskIdentifier(report.holderId)),
      createMetaRow(t('verifyGeneratedAtLabel', locale), formatGeneratedAt(report.generatedAt, locale))
    ]
  });
  card.classList.add('verify-tenant');
  return card;
}

function createBadgeItem(badge: VerifyBadge): HTMLElement {
  const item = document.createElement('article');
  item.className = 'verify-badge-item';

  const header = document.createElement('div');
  header.className = 'verify-badge-item__header';
  appendChildren(header, createTextElement('h3', 'verify-badge-item__title', badge.label), Badge({ label: badge.status, variant: badgeVariant(badge.status) }));

  appendChildren(
    item,
    header,
    createTextElement('p', 'verify-badge-item__summary', badge.summary),
    createTextElement('p', 'verify-badge-item__evidence', badge.evidence)
  );
  return item;
}

function createBadgesCard(report: VerifyReport, locale: Locale): HTMLElement {
  const grid = document.createElement('div');
  grid.className = 'verify-badge-grid';
  report.badges.forEach((badge) => grid.appendChild(createBadgeItem(badge)));

  const card = Card({
    eyebrow: t('verifyBadgesEyebrow', locale),
    title: t('verifyBadgesTitle', locale),
    description: t('verifyBadgesCopy', locale),
    children: grid
  });
  card.classList.add('verify-badges');
  return card;
}

function createEvidenceCard(evidenceLinks: VerifyEvidenceLink[], locale: Locale): HTMLElement {
  const links = document.createElement('div');
  links.className = 'verify-evidence-list';

  evidenceLinks.forEach((link) => {
    links.appendChild(
      ExplorerLink({
        href: link.href,
        label: link.label,
        value: link.hash,
        network: link.network
      })
    );
  });

  const card = Card({
    eyebrow: t('verifyEvidenceEyebrow', locale),
    title: t('verifyEvidenceTitle', locale).replace('{count}', String(evidenceLinks.length)),
    description: t('verifyEvidenceCopy', locale),
    children: links
  });
  card.classList.add('verify-evidence');
  return card;
}

function createActionButton(label: string, className: string, onClick: () => void, disabled = false): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = className;
  button.type = 'button';
  button.textContent = label;
  button.disabled = disabled;
  button.addEventListener('click', onClick);
  return button;
}

function createConfirmationFeedback(status: VerifyConfirmationStatus, locale: Locale): HTMLElement | null {
  if (status === 'success') {
    return Toast({
      title: t('verifyConfirmSuccessTitle', locale),
      message: t('verifyConfirmSuccessCopy', locale),
      variant: 'success'
    });
  }

  if (status === 'error') {
    return Toast({
      title: t('verifyConfirmErrorTitle', locale),
      message: t('verifyConfirmErrorCopy', locale),
      variant: 'error'
    });
  }

  return null;
}

function createResultActions(
  confirmationStatus: VerifyConfirmationStatus,
  locale: Locale,
  onConfirm: () => void,
  onPrint: () => void
): HTMLElement {
  const actions = document.createElement('div');
  actions.className = 'verify-actions__buttons';
  const confirmButtonLabel = confirmationStatus === 'submitting' ? t('verifyConfirmSubmitting', locale) : t('verifyConfirmAction', locale);

  appendChildren(
    actions,
    createActionButton(confirmButtonLabel, 'verify-action-button verify-action-button--primary', onConfirm, confirmationStatus === 'submitting' || confirmationStatus === 'success'),
    createActionButton(t('verifySavePdfAction', locale), 'verify-action-button verify-action-button--secondary', onPrint),
    createActionButton(t('verifyPrintAction', locale), 'verify-action-button verify-action-button--secondary', onPrint)
  );

  const card = Card({
    eyebrow: t('verifyActionsEyebrow', locale),
    title: t('verifyActionsTitle', locale),
    description: t('verifyActionsCopy', locale),
    children: createTextElement('p', 'verify-actions__privacy', t('verifyActionsPrivacyCopy', locale)),
    footer: [actions, createConfirmationFeedback(confirmationStatus, locale)]
  });
  card.classList.add('verify-actions');
  return card;
}

export function getFixtureEvidenceLinks(): VerifyEvidenceLink[] {
  return fixtureData.transactions.slice(0, 6).map((transaction) => ({
    label: transaction.label,
    hash: transaction.hash,
    href: transaction.explorerUrl,
    network: fixtureData.network.name
  }));
}

export function VerifyLoadingScreen({ locale, reportId, localeToggle }: VerifyLoadingScreenProps): HTMLElement {
  const normalizedLocale = normalizeLocale(locale);
  const loadingCard = Card({
    eyebrow: t('verifyLoadingEyebrow', normalizedLocale),
    title: t('verifyLoadingTitle', normalizedLocale),
    description: t('verifyLoadingCopy', normalizedLocale).replace('{reportId}', reportId),
    children: LoadingOverlay({ label: t('verifyLoadingStatus', normalizedLocale) }),
    elevated: true
  });
  loadingCard.classList.add('verify-loading-card');

  return createVerifyShell(normalizedLocale, localeToggle, loadingCard, 'verify-page--loading');
}

export function VerifyErrorScreen({ locale, title, description, localeToggle }: VerifyErrorScreenProps): HTMLElement {
  const normalizedLocale = normalizeLocale(locale);
  const error = ErrorState({ title, description });
  error.classList.add('verify-error-state');

  return createVerifyShell(normalizedLocale, localeToggle, error, 'verify-page--error');
}

export function VerifyResultScreen({ locale, report, evidenceLinks, localeToggle, confirmationStatus, onConfirm, onPrint }: VerifyResultScreenProps): HTMLElement {
  const normalizedLocale = normalizeLocale(locale);
  const content = document.createElement('div');
  content.className = 'verify-result-content';

  const summary = document.createElement('section');
  summary.className = 'verify-result-summary';
  appendChildren(summary, createGradeCard(report, normalizedLocale), createTenantCard(report, normalizedLocale));

  appendChildren(
    content,
    summary,
    createResultActions(confirmationStatus, normalizedLocale, onConfirm, onPrint),
    createBadgesCard(report, normalizedLocale),
    createEvidenceCard(evidenceLinks, normalizedLocale)
  );
  return createVerifyShell(normalizedLocale, localeToggle, content, 'verify-page--result');
}
