import { normalizeLocale, t, type Locale } from '../../../shared/i18n';
import { Badge, Card, ErrorState, LoadingOverlay } from '../../../shared/ui';
import { appendChildren, createTextElement, type UiChild } from '../../../shared/ui/dom';

export type IssuerGateStatus = 'checking' | 'idle' | 'submitting' | 'error';

type IssuerGateScreenProps = {
  locale: Locale;
  status: IssuerGateStatus;
  errorMessage?: string;
  localeToggle: UiChild;
  onSubmit: (password: string) => void;
};

function createPasswordForm(locale: Locale, status: IssuerGateStatus, onSubmit: (password: string) => void): HTMLFormElement {
  const form = document.createElement('form');
  form.className = 'issuer-gate-form';
  form.noValidate = true;

  const field = document.createElement('label');
  field.className = 'issuer-gate-field';
  field.setAttribute('for', 'issuer-console-password');

  const label = createTextElement('span', 'issuer-gate-field__label', t('issuerGatePasswordLabel', locale));
  const input = document.createElement('input');
  input.id = 'issuer-console-password';
  input.className = 'issuer-gate-field__input';
  input.name = 'password';
  input.type = 'password';
  input.autocomplete = 'current-password';
  input.placeholder = t('issuerGatePasswordPlaceholder', locale);
  input.required = true;
  input.disabled = status === 'checking' || status === 'submitting';

  appendChildren(field, label, input);

  const button = document.createElement('button');
  button.className = 'issuer-gate-submit';
  button.type = 'submit';
  button.disabled = status === 'checking' || status === 'submitting';
  button.textContent = status === 'submitting' ? t('issuerGateSubmitting', locale) : t('issuerGateSubmit', locale);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const password = formData.get('password');
    onSubmit(typeof password === 'string' ? password : '');
  });

  appendChildren(form, field, button);
  return form;
}

function createGateError(locale: Locale, errorMessage?: string): HTMLElement {
  return ErrorState({
    title: t('issuerGateErrorTitle', locale),
    description: errorMessage ?? t('issuerGateErrorCopy', locale)
  });
}

export function IssuerGateScreen({ locale, status, errorMessage, localeToggle, onSubmit }: IssuerGateScreenProps): HTMLElement {
  const normalizedLocale = normalizeLocale(locale);
  const screen = document.createElement('main');
  screen.className = 'issuer-screen issuer-gate-screen';
  screen.dataset.locale = normalizedLocale;

  const panel = document.createElement('section');
  panel.className = 'issuer-panel';
  panel.setAttribute('aria-labelledby', 'issuer-gate-title');

  const hero = document.createElement('div');
  hero.className = 'issuer-gate-hero';
  appendChildren(
    hero,
    Badge({ label: t('issuerGateBadge', normalizedLocale), variant: 'primary' }),
    createTextElement('h1', 'issuer-display-title', t('issuerGateTitle', normalizedLocale)),
    createTextElement('p', 'issuer-display-copy', t('issuerGateCopy', normalizedLocale))
  );
  hero.querySelector('h1')?.setAttribute('id', 'issuer-gate-title');

  const card = Card({
    eyebrow: t('issuerGateCardEyebrow', normalizedLocale),
    title: t('issuerGateCardTitle', normalizedLocale),
    description: t('issuerGateCardCopy', normalizedLocale),
    children: createPasswordForm(normalizedLocale, status, onSubmit),
    footer: Badge({ label: t('issuerGateSafetyNote', normalizedLocale), variant: 'info' }),
    elevated: true
  });
  card.classList.add('issuer-gate-card');

  if (status === 'checking' || status === 'submitting') {
    card.appendChild(LoadingOverlay({ label: t(status === 'checking' ? 'issuerGateChecking' : 'issuerGateSubmitting', normalizedLocale) }));
  }

  appendChildren(panel, localeToggle, hero, card, status === 'error' ? createGateError(normalizedLocale, errorMessage) : null);
  screen.appendChild(panel);
  return screen;
}
