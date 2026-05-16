import { normalizeLocale, t, type Locale } from '../../../shared/i18n';
import { Badge, Card, MobileShell } from '../../../shared/ui';
import { appendChildren, createTextElement, type UiChild } from '../../../shared/ui/dom';

type TossUnlockScreenProps = {
  locale: Locale;
  localeToggle: UiChild;
  tenantName?: string;
  onBack: () => void;
};

function createSignalStack(locale: Locale): HTMLElement {
  const stack = document.createElement('div');
  stack.className = 'tenant-toss-unlock-signal-stack';

  for (const key of ['tenantTossUnlockSignalVisa', 'tenantTossUnlockSignalRent', 'tenantTossUnlockSignalEscrow'] as const) {
    const item = document.createElement('div');
    item.className = 'tenant-toss-unlock-signal';
    appendChildren(item, createTextElement('span', 'tenant-toss-unlock-signal__check', '✓'), createTextElement('span', 'tenant-toss-unlock-signal__label', t(key, locale)));
    stack.appendChild(item);
  }

  return stack;
}

function createMockAppChrome(locale: Locale, tenantName: string | undefined): HTMLElement {
  const chrome = document.createElement('section');
  chrome.className = 'tenant-toss-unlock-app';
  chrome.setAttribute('aria-labelledby', 'tenant-toss-unlock-app-title');

  const topBar = document.createElement('div');
  topBar.className = 'tenant-toss-unlock-app__topbar';
  const brandDot = createTextElement('span', 'tenant-toss-unlock-app__brand-dot', '');
  brandDot.setAttribute('aria-hidden', 'true');
  appendChildren(
    topBar,
    brandDot,
    createTextElement('span', 'tenant-toss-unlock-app__brand', t('tenantTossUnlockMockBrand', locale)),
    Badge({ label: t('tenantTossUnlockMockBadge', locale), variant: 'info' })
  );

  const limitCard = document.createElement('article');
  limitCard.className = 'tenant-toss-unlock-limit-card';
  appendChildren(
    limitCard,
    createTextElement('p', 'tenant-toss-unlock-limit-card__eyebrow', t('tenantTossUnlockLimitEyebrow', locale)),
    createTextElement('h2', 'tenant-toss-unlock-limit-card__title', t('tenantTossUnlockLimitTitle', locale)),
    createTextElement('strong', 'tenant-toss-unlock-limit-card__amount', t('tenantTossUnlockLimitAmount', locale)),
    createTextElement('p', 'tenant-toss-unlock-limit-card__copy', t('tenantTossUnlockLimitCopy', locale).replace('{name}', tenantName ?? t('tenantTossUnlockGuestName', locale)))
  );
  limitCard.querySelector('h2')?.setAttribute('id', 'tenant-toss-unlock-app-title');

  appendChildren(chrome, topBar, limitCard, createSignalStack(locale));
  return chrome;
}

function createProofCard(locale: Locale): HTMLElement {
  const meter = document.createElement('div');
  meter.className = 'tenant-toss-unlock-meter';
  appendChildren(meter, createTextElement('span', 'tenant-toss-unlock-meter__track', ''), createTextElement('span', 'tenant-toss-unlock-meter__value', ''));

  return Card({
    eyebrow: t('tenantTossUnlockProofEyebrow', locale),
    title: t('tenantTossUnlockProofTitle', locale),
    description: t('tenantTossUnlockProofCopy', locale),
    children: [meter, Badge({ label: t('tenantTossUnlockProofBadge', locale), variant: 'success' })]
  });
}

function createDisclaimerCard(locale: Locale, onBack: () => void): HTMLElement {
  const backButton = document.createElement('button');
  backButton.className = 'tenant-dashboard-secondary-action tenant-toss-unlock-back';
  backButton.type = 'button';
  backButton.textContent = t('tenantTossUnlockBack', locale);
  backButton.setAttribute('aria-label', t('tenantTossUnlockBackA11y', locale));
  backButton.addEventListener('click', onBack);

  return Card({
    eyebrow: t('tenantTossUnlockSafetyEyebrow', locale),
    title: t('tenantTossUnlockSafetyTitle', locale),
    description: t('tenantTossUnlockSafetyCopy', locale),
    children: backButton
  });
}

export function TossUnlockScreen({ locale, localeToggle, tenantName, onBack }: TossUnlockScreenProps): HTMLElement {
  const normalizedLocale = normalizeLocale(locale);
  const content = document.createElement('div');
  content.className = 'tenant-toss-unlock-content';
  appendChildren(content, createMockAppChrome(normalizedLocale, tenantName), createProofCard(normalizedLocale), createDisclaimerCard(normalizedLocale, onBack));

  return MobileShell({
    title: t('tenantTossUnlockTitle', normalizedLocale),
    subtitle: t('tenantTossUnlockSubtitle', normalizedLocale),
    eyebrow: t('tenantTossUnlockEyebrow', normalizedLocale),
    activeTabId: 'unlock',
    trailing: localeToggle,
    tabs: [{ id: 'unlock', label: t('tenantTossUnlockTab', normalizedLocale), icon: '＋' }],
    children: content
  });
}
