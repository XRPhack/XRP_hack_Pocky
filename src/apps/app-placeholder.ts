import { getSession } from '../shared/auth/session';
import { Badge } from '../shared/ui';
import { type AppRouteKey, routeIa } from '../shared/design-tokens';
import { normalizeLocale, t, type Locale } from '../shared/i18n';

const routeCopyKeys = {
  tenant: {
    eyebrow: 'tenantEyebrow',
    title: 'tenantTitle',
    copy: 'tenantCopy'
  },
  verify: {
    eyebrow: 'verifyEyebrow',
    title: 'verifyTitle',
    copy: 'verifyCopy'
  },
  issuer: {
    eyebrow: 'issuerEyebrow',
    title: 'issuerTitle',
    copy: 'issuerCopy'
  }
} as const;

const featureKeys = ['loginCta', 'onboardingStart', 'share', 'verify', 'issuer', 'loading', 'error', 'empty'] as const;

function getInitialLocale(): Locale {
  return normalizeLocale(getSession()?.locale ?? navigator.language);
}

function createLocaleToggle(locale: Locale, onChange: (nextLocale: Locale) => void): HTMLDivElement {
  const group = document.createElement('div');
  group.className = 'route-locale-toggle';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', t('languageToggle', locale));

  for (const nextLocale of ['ko', 'en'] as const) {
    const button = document.createElement('button');
    const isActive = locale === nextLocale;

    button.className = `route-locale-toggle__button${isActive ? ' route-locale-toggle__button--active' : ''}`;
    button.type = 'button';
    button.textContent = t(nextLocale === 'ko' ? 'korean' : 'english', locale);
    button.setAttribute('aria-pressed', String(isActive));
    button.addEventListener('click', () => onChange(nextLocale));
    group.appendChild(button);
  }

  return group;
}

function createFeatureRow(locale: Locale): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'route-badge-row';

  for (const key of featureKeys) {
    row.appendChild(Badge({ label: t(key, locale), variant: 'neutral' }));
  }

  return row;
}

function renderPlaceholder(root: HTMLElement, routeKey: AppRouteKey, locale: Locale, onChange: (nextLocale: Locale) => void): void {
  const copyKeys = routeCopyKeys[routeKey];
  const route = routeIa[routeKey];
  const routeLabel = 'pathPattern' in route ? route.pathPattern : route.path;

  document.title = `${t('appTitle', locale)} · ${t(copyKeys.title, locale)}`;

  const shell = document.createElement('main');
  shell.className = 'route-shell';
  shell.dataset.route = routeKey;
  shell.dataset.locale = locale;

  const card = document.createElement('section');
  card.className = 'route-card';
  card.setAttribute('aria-labelledby', 'route-title');

  const header = document.createElement('div');
  header.className = 'route-header';

  const titleGroup = document.createElement('div');
  titleGroup.className = 'route-header__group';

  const eyebrow = document.createElement('p');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = `${t(copyKeys.eyebrow, locale)} · ${t('appTitle', locale)}`;

  const title = document.createElement('h1');
  title.className = 'route-title';
  title.id = 'route-title';
  title.textContent = t(copyKeys.title, locale);

  titleGroup.append(eyebrow, title);
  header.append(titleGroup, createLocaleToggle(locale, onChange));

  const copy = document.createElement('p');
  copy.className = 'copy';
  copy.textContent = t(copyKeys.copy, locale);

  const featureRow = createFeatureRow(locale);

  const meta = document.createElement('span');
  meta.className = 'route-meta';
  meta.textContent = `${routeLabel} · ${route.label}`;

  card.append(header, copy, featureRow, meta);
  shell.appendChild(card);
  root.replaceChildren(shell);
}

export function getAppRoot(): HTMLDivElement {
  const app = document.querySelector<HTMLDivElement>('#app');

  if (!app) {
    throw new Error('App root not found');
  }

  return app;
}

export function resolveRouteKey(pathname = window.location.pathname): AppRouteKey {
  if (pathname === routeIa.issuer.path || pathname.startsWith(`${routeIa.issuer.path}/`)) {
    return 'issuer';
  }

  if (pathname === '/verify' || pathname.startsWith(routeIa.verify.basePath)) {
    return 'verify';
  }

  return 'tenant';
}

export function mountAppPlaceholder(root: HTMLElement, routeKey: AppRouteKey): void {
  let locale = getInitialLocale();

  const render = () => {
    renderPlaceholder(root, routeKey, locale, (nextLocale) => {
      locale = nextLocale;
      render();
    });
  };

  render();
}
