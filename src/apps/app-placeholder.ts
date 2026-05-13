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
const launcherRouteKeys = ['tenant', 'verify', 'issuer'] as const;

const launcherHrefByRouteKey: Record<AppRouteKey, string> = {
  tenant: '/tenant/',
  verify: '/verify/',
  issuer: '/issuer/'
};

const launcherCopy = {
  ko: {
    eyebrow: 'NomokDon MVP launcher',
    title: '필요한 화면으로 바로 이동하세요.',
    copy: '노목돈은 임차인 신뢰 패스, 임대인 검증, 발급자 운영 콘솔로 나뉩니다. 각 표면은 별도 Vite 엔트리로 열립니다.',
    surfaces: {
      tenant: {
        title: 'Tenant',
        badge: '임차인 앱',
        copy: '외국인 임차인이 목업 토스 로그인으로 신뢰 패스를 만들고 공유 링크를 준비합니다.'
      },
      verify: {
        title: 'Verify',
        badge: '임대인 검증',
        copy: '공유받은 리포트 ID를 기준으로 신뢰 배지와 XRPL 근거 링크를 확인합니다.'
      },
      issuer: {
        title: 'Issuer',
        badge: '운영 콘솔',
        copy: '발급자 로그, 시뮬레이터, 통계를 확인하며 신뢰 패스 발급 흐름을 점검합니다.'
      }
    }
  },
  en: {
    eyebrow: 'NomokDon MVP launcher',
    title: 'Jump to the surface you need.',
    copy: 'NomokDon is split into tenant trust pass, landlord verification, and issuer operations. Each surface opens through its own Vite entry.',
    surfaces: {
      tenant: {
        title: 'Tenant',
        badge: 'Tenant app',
        copy: 'Foreign tenants use a mock Toss login to create a trust pass and prepare a shareable link.'
      },
      verify: {
        title: 'Verify',
        badge: 'Landlord check',
        copy: 'Landlords review trust badges and XRPL evidence links from a shared report ID.'
      },
      issuer: {
        title: 'Issuer',
        badge: 'Ops console',
        copy: 'Issuers inspect logs, run the simulator, and watch stats for the trust-pass issuance flow.'
      }
    }
  }
} as const;

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

function createLauncherLink(routeKey: AppRouteKey, locale: Locale): HTMLAnchorElement {
  const copy = launcherCopy[locale].surfaces[routeKey];
  const route = routeIa[routeKey];
  const pathLabel = routeKey === 'tenant' ? launcherHrefByRouteKey[routeKey] : 'pathPattern' in route ? route.pathPattern : route.path;

  const link = document.createElement('a');
  link.className = 'route-launcher-link';
  link.href = launcherHrefByRouteKey[routeKey];

  const header = document.createElement('span');
  header.className = 'route-launcher-link__header';

  const title = document.createElement('strong');
  title.className = 'route-launcher-link__title';
  title.textContent = copy.title;

  header.append(title, Badge({ label: copy.badge, variant: routeKey === 'tenant' ? 'primary' : 'neutral' }));

  const description = document.createElement('span');
  description.className = 'route-launcher-link__copy';
  description.textContent = copy.copy;

  const meta = document.createElement('span');
  meta.className = 'route-launcher-link__meta';
  meta.textContent = `${pathLabel} · ${route.label}`;

  const arrow = document.createElement('span');
  arrow.className = 'route-launcher-link__arrow';
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = '↗';

  link.append(header, description, meta, arrow);
  return link;
}

function renderRootLauncher(root: HTMLElement, locale: Locale, onChange: (nextLocale: Locale) => void): void {
  const copy = launcherCopy[locale];
  document.title = `${t('appTitle', locale)} · Launcher`;

  const shell = document.createElement('main');
  shell.className = 'route-shell route-shell--launcher';
  shell.dataset.route = 'launcher';
  shell.dataset.locale = locale;

  const card = document.createElement('section');
  card.className = 'route-card route-card--launcher';
  card.setAttribute('aria-labelledby', 'route-launcher-title');

  const header = document.createElement('div');
  header.className = 'route-header';

  const titleGroup = document.createElement('div');
  titleGroup.className = 'route-header__group';

  const eyebrow = document.createElement('p');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = copy.eyebrow;

  const title = document.createElement('h1');
  title.className = 'route-title route-title--launcher';
  title.id = 'route-launcher-title';
  title.textContent = copy.title;

  titleGroup.append(eyebrow, title);
  header.append(titleGroup, createLocaleToggle(locale, onChange));

  const description = document.createElement('p');
  description.className = 'copy route-launcher-copy';
  description.textContent = copy.copy;

  const nav = document.createElement('nav');
  nav.className = 'route-launcher-grid';
  nav.setAttribute('aria-label', 'NomokDon app surfaces');

  for (const routeKey of launcherRouteKeys) {
    nav.appendChild(createLauncherLink(routeKey, locale));
  }

  card.append(header, description, nav);
  shell.appendChild(card);
  root.replaceChildren(shell);
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

export function mountRootLauncher(root: HTMLElement): void {
  let locale = getInitialLocale();

  const render = () => {
    renderRootLauncher(root, locale, (nextLocale) => {
      locale = nextLocale;
      render();
    });
  };

  render();
}
