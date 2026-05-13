import demoFixtures from '../../../../scripts/demo-fixtures.json';
import qrcode from 'qrcode-generator';
import { normalizeLocale, t, type Locale } from '../../../shared/i18n';
import { Badge, Card, ExplorerLink, MobileShell, Toast } from '../../../shared/ui';
import { appendChildren, createTextElement, type UiChild } from '../../../shared/ui/dom';

export type DashboardBadgeStatus = 'pass' | 'warning' | 'fail';
export type DashboardTrustGrade = 'A' | 'B' | 'C' | 'D';
export type DashboardShareFeedbackKey =
  | 'tenantDashboardCopySuccess'
  | 'tenantDashboardCopyFallback'
  | 'tenantDashboardShareSuccess'
  | 'tenantDashboardShareFallback';

export type DashboardBadge = {
  label: string;
  status: DashboardBadgeStatus;
};

type DashboardScreenProps = {
  locale: Locale;
  reportId: string;
  verifyUrl: string;
  trustGrade: DashboardTrustGrade;
  badges: [DashboardBadge, DashboardBadge, DashboardBadge, DashboardBadge, DashboardBadge, DashboardBadge];
  tenantName?: string;
  walletAddress?: string;
  shareFeedbackKey?: DashboardShareFeedbackKey;
  localeToggle: UiChild;
  onUnlock: () => void;
  onCopyLink: () => void;
  onShare: () => void;
};

type FixtureTransaction = {
  label: string;
  transactionType: string;
  hash: string;
  explorerUrl: string;
};

type FixturePersona = {
  displayName: string;
  nationality: string;
  visaType: string;
  schoolOrEmployer: string;
};

type FixtureData = {
  persona: FixturePersona;
  accounts: {
    tenant: { address: string };
    issuer: { address: string };
  };
  network: { name: string };
  transactions: FixtureTransaction[];
};

const fixtureData: FixtureData = demoFixtures;

function sanitizeReportId(reportId: string): string {
  const safeReportId = reportId.replace(/[^a-zA-Z0-9_-]/g, '');

  return safeReportId || 'report_local';
}

export function createVerifyPath(reportId: string): string {
  return `/verify/${encodeURIComponent(sanitizeReportId(reportId))}`;
}

function createMetaRow(label: string, value: string): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'tenant-dashboard-meta-row';
  appendChildren(row, createTextElement('span', 'tenant-dashboard-meta-row__label', label), createTextElement('span', 'tenant-dashboard-meta-row__value', value));
  return row;
}

function createTrustGradeCard(grade: DashboardTrustGrade, locale: Locale): HTMLElement {
  const gradeMark = createTextElement('strong', 'tenant-dashboard-grade__mark', grade);
  gradeMark.setAttribute('aria-label', t('tenantDashboardTrustGradeA11y', locale).replace('{grade}', grade));

  const card = Card({
    eyebrow: t('tenantDashboardTrustGradeEyebrow', locale),
    title: t('tenantDashboardTrustGradeTitle', locale).replace('{grade}', grade),
    description: t('tenantDashboardTrustGradeCopy', locale),
    children: [gradeMark, Badge({ label: t('tenantDashboardTrustGradeBadge', locale), variant: 'success' })],
    elevated: true
  });
  card.classList.add('tenant-dashboard-grade');
  return card;
}

function createContextCard(locale: Locale, tenantName: string | undefined, walletAddress: string | undefined): HTMLElement {
  const safeWalletAddress = walletAddress ?? fixtureData.accounts.tenant.address;
  const did = `did:xrpl:testnet:${safeWalletAddress}`;
  const persona = fixtureData.persona;
  const displayName = tenantName ?? persona.displayName;

  const card = Card({
    eyebrow: t('tenantDashboardContextEyebrow', locale),
    title: t('tenantDashboardContextTitle', locale).replace('{name}', displayName),
    description: t('tenantDashboardContextCopy', locale),
    children: [
      createMetaRow(t('tenantDashboardDidLabel', locale), did),
      createMetaRow(t('tenantDashboardWalletLabel', locale), safeWalletAddress),
      createMetaRow(t('tenantDashboardPersonaLabel', locale), `${persona.nationality} · ${persona.visaType}`),
      createMetaRow(t('tenantDashboardIssuerLabel', locale), fixtureData.accounts.issuer.address)
    ]
  });
  card.classList.add('tenant-dashboard-context');
  return card;
}

function findTransaction(label: string): FixtureTransaction | undefined {
  return fixtureData.transactions.find((transaction) => transaction.label === label);
}

function createCredentialItem(locale: Locale, titleKey: string, description: string, transactionLabels: string[]): HTMLElement {
  const item = document.createElement('article');
  item.className = 'tenant-dashboard-vc-item';

  const header = document.createElement('div');
  header.className = 'tenant-dashboard-vc-item__header';
  appendChildren(header, createTextElement('h3', 'tenant-dashboard-vc-item__title', t(titleKey, locale)), Badge({ label: t('tenantDashboardVcIssued', locale), variant: 'success' }));

  const links = document.createElement('div');
  links.className = 'tenant-dashboard-vc-item__links';
  for (const label of transactionLabels) {
    const transaction = findTransaction(label);
    if (!transaction) {
      continue;
    }

    links.appendChild(
      ExplorerLink({
        href: transaction.explorerUrl,
        label: transaction.label,
        value: transaction.hash,
        network: fixtureData.network.name
      })
    );
  }

  appendChildren(item, header, createTextElement('p', 'tenant-dashboard-vc-item__copy', description), links);
  return item;
}

function createVcListCard(locale: Locale): HTMLElement {
  const persona = fixtureData.persona;
  const card = Card({
    eyebrow: t('tenantDashboardVcEyebrow', locale),
    title: t('tenantDashboardVcTitle', locale),
    description: t('tenantDashboardVcCopy', locale),
    children: [
      createCredentialItem(
        locale,
        'tenantDashboardVisaVcTitle',
        t('tenantDashboardVisaVcCopy', locale)
          .replace('{visaType}', persona.visaType)
          .replace('{schoolOrEmployer}', persona.schoolOrEmployer),
        ['Visa CredentialCreate', 'Visa CredentialAccept']
      ),
      createCredentialItem(
        locale,
        'tenantDashboardRentVcTitle',
        t('tenantDashboardRentVcCopy', locale),
        ['Rent reputation CredentialCreate', 'Rent reputation CredentialAccept']
      )
    ]
  });
  card.classList.add('tenant-dashboard-vc');
  return card;
}

function badgeVariant(status: DashboardBadgeStatus): 'success' | 'warning' | 'error' {
  if (status === 'warning') {
    return 'warning';
  }

  return status === 'fail' ? 'error' : 'success';
}

function createBadgesCard(locale: Locale, badges: DashboardScreenProps['badges']): HTMLElement {
  const grid = document.createElement('div');
  grid.className = 'tenant-dashboard-badge-grid';
  badges.forEach((badge) => grid.appendChild(Badge({ label: badge.label, variant: badgeVariant(badge.status) })));

  const card = Card({
    eyebrow: t('tenantDashboardBadgesEyebrow', locale),
    title: t('tenantDashboardBadgesTitle', locale),
    description: t('tenantDashboardBadgesCopy', locale),
    children: grid
  });
  card.classList.add('tenant-dashboard-badges');
  return card;
}

function createUnlockCtaCard(locale: Locale, onUnlock: () => void): HTMLElement {
  const preview = document.createElement('div');
  preview.className = 'tenant-dashboard-unlock__preview';
  preview.setAttribute('aria-hidden', 'true');
  appendChildren(
    preview,
    createTextElement('span', 'tenant-dashboard-unlock__spark', '↗'),
    createTextElement('strong', 'tenant-dashboard-unlock__limit', t('tenantDashboardUnlockLimit', locale))
  );

  const button = createShareButton(
    'tenant-primary-action tenant-dashboard-unlock__action',
    t('tenantDashboardUnlockCta', locale),
    t('tenantDashboardUnlockCtaA11y', locale),
    onUnlock
  );

  const card = Card({
    eyebrow: t('tenantDashboardUnlockEyebrow', locale),
    title: t('tenantDashboardUnlockTitle', locale),
    description: t('tenantDashboardUnlockCopy', locale),
    children: [preview, button],
    elevated: true
  });
  card.classList.add('tenant-dashboard-unlock');
  return card;
}

function createQrVisual(verifyUrl: string, locale: Locale): HTMLAnchorElement {
  const link = document.createElement('a');
  link.className = 'tenant-dashboard-qr';
  link.href = verifyUrl;
  link.setAttribute('aria-label', t('tenantDashboardQrA11y', locale).replace('{url}', verifyUrl));

  const qr = qrcode(0, 'M');
  qr.addData(verifyUrl, 'Byte');
  qr.make();
  link.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 4, scalable: true });

  return link;
}

function createShareButton(className: string, label: string, ariaLabel: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = className;
  button.type = 'button';
  button.textContent = label;
  button.setAttribute('aria-label', ariaLabel);
  button.addEventListener('click', onClick);
  return button;
}

function createSharePanel(locale: Locale, reportId: string, verifyUrl: string, shareFeedbackKey: DashboardShareFeedbackKey | undefined, onCopyLink: () => void, onShare: () => void): HTMLElement {
  const verifyPath = createVerifyPath(reportId);
  const urlText = createTextElement('code', 'tenant-dashboard-share__url', verifyPath);
  urlText.setAttribute('aria-label', t('tenantDashboardShareUrlA11y', locale).replace('{url}', verifyPath));

  const actions = document.createElement('div');
  actions.className = 'tenant-dashboard-share__actions';
  appendChildren(
    actions,
    createShareButton('tenant-primary-action tenant-dashboard-share__action', t('tenantDashboardCopyLink', locale), t('tenantDashboardCopyLinkA11y', locale), onCopyLink),
    createShareButton('tenant-dashboard-secondary-action tenant-dashboard-share__action', t('tenantDashboardWebShare', locale), t('tenantDashboardWebShareA11y', locale), onShare)
  );

  const children: UiChild[] = [createQrVisual(verifyUrl, locale), urlText, actions];
  if (shareFeedbackKey) {
    children.push(Toast({ message: t(shareFeedbackKey, locale), variant: shareFeedbackKey.includes('Success') ? 'success' : 'warning' }));
  }

  const panel = Card({
    eyebrow: t('tenantDashboardShareEyebrow', locale),
    title: t('tenantDashboardShareTitle', locale),
    description: t('tenantDashboardShareCopy', locale),
    children
  });
  panel.classList.add('tenant-dashboard-share');
  return panel;
}

export function DashboardScreen({ locale, reportId, verifyUrl, trustGrade, badges, tenantName, walletAddress, shareFeedbackKey, localeToggle, onUnlock, onCopyLink, onShare }: DashboardScreenProps): HTMLElement {
  const normalizedLocale = normalizeLocale(locale);
  const content = document.createElement('div');
  content.className = 'tenant-dashboard-content';
  appendChildren(
    content,
    createTrustGradeCard(trustGrade, normalizedLocale),
    createUnlockCtaCard(normalizedLocale, onUnlock),
    createContextCard(normalizedLocale, tenantName, walletAddress),
    createVcListCard(normalizedLocale),
    createBadgesCard(normalizedLocale, badges),
    createSharePanel(normalizedLocale, reportId, verifyUrl, shareFeedbackKey, onCopyLink, onShare)
  );

  return MobileShell({
    title: t('tenantDashboardTitle', normalizedLocale),
    subtitle: t('tenantDashboardSubtitle', normalizedLocale),
    eyebrow: t('tenantDashboardEyebrow', normalizedLocale),
    activeTabId: 'dashboard',
    trailing: localeToggle,
    tabs: [{ id: 'dashboard', label: t('tenantDashboardTab', normalizedLocale), icon: '✓' }],
    children: content
  });
}
