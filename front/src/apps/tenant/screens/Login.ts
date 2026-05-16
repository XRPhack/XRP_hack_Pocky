import { normalizeLocale, t, type Locale } from '../../../shared/i18n';
import { Badge, Card, ErrorState, LoadingOverlay } from '../../../shared/ui';
import { appendChildren, createTextElement, type UiChild } from '../../../shared/ui/dom';

export type LoginStatus = 'idle' | 'loading' | 'error';

type LoginScreenProps = {
  locale: Locale;
  status: LoginStatus;
  errorMessage?: string;
  localeToggle: UiChild;
  onLogin: () => void;
};

function createTrustList(locale: Locale): HTMLUListElement {
  const list = document.createElement('ul');
  list.className = 'tenant-trust-list';

  for (const key of ['tenantLoginPointResident', 'tenantLoginPointHousing', 'tenantLoginPointTrust']) {
    const item = document.createElement('li');
    item.textContent = t(key, locale);
    list.appendChild(item);
  }

  return list;
}

function createLoginButton(locale: Locale, status: LoginStatus, onLogin: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = 'tenant-primary-action';
  button.type = 'button';
  button.textContent = t('loginCta', locale);
  button.disabled = status === 'loading';
  button.setAttribute('aria-label', t('tenantLoginCtaA11y', locale));
  button.addEventListener('click', onLogin);
  return button;
}

function createErrorPanel(locale: Locale, errorMessage: string | undefined, onLogin: () => void): HTMLElement {
  return ErrorState({
    title: t('tenantLoginErrorTitle', locale),
    description: errorMessage ?? t('tenantLoginErrorCopy', locale),
    action: {
      label: t('tenantLoginRetry', locale),
      onClick: onLogin
    }
  });
}

export function LoginScreen({ locale, status, errorMessage, localeToggle, onLogin }: LoginScreenProps): HTMLElement {
  const normalizedLocale = normalizeLocale(locale);
  const screen = document.createElement('main');
  screen.className = 'tenant-screen tenant-login-screen';
  screen.dataset.locale = normalizedLocale;

  const shell = document.createElement('section');
  shell.className = 'tenant-panel';
  shell.setAttribute('aria-labelledby', 'tenant-login-title');

  const hero = document.createElement('div');
  hero.className = 'tenant-login-hero';
  appendChildren(
    hero,
    Badge({ label: t('tenantLoginBadge', normalizedLocale), variant: 'primary' }),
    createTextElement('h1', 'tenant-display-title', t('tenantLoginTitle', normalizedLocale)),
    createTextElement('p', 'tenant-display-copy', t('tenantLoginCopy', normalizedLocale))
  );
  hero.querySelector('h1')?.setAttribute('id', 'tenant-login-title');

  const card = Card({
    eyebrow: t('tenantLoginCardEyebrow', normalizedLocale),
    title: t('tenantLoginCardTitle', normalizedLocale),
    description: t('tenantLoginCardCopy', normalizedLocale),
    children: [createTrustList(normalizedLocale), createLoginButton(normalizedLocale, status, onLogin)],
    footer: Badge({ label: t('tenantLoginSafetyNote', normalizedLocale), variant: 'info' }),
    elevated: true
  });
  card.classList.add('tenant-login-card');

  if (status === 'loading') {
    card.appendChild(LoadingOverlay({ label: t('tenantLoginLoading', normalizedLocale) }));
  }

  appendChildren(shell, localeToggle, hero, card, status === 'error' ? createErrorPanel(normalizedLocale, errorMessage, onLogin) : null);
  screen.appendChild(shell);
  return screen;
}
