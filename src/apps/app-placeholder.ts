import { getLocalePreference, getSession, setLocalePreference } from '../shared/auth/session';
import { Badge } from '../shared/ui';
import { type AppRouteKey, routeIa } from '../shared/design-tokens';
import { t, type Locale } from '../shared/i18n';

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
    eyebrow: '노목돈 주거 신뢰 패스',
    title: '목돈보다 먼저, 신뢰를 보여주세요.',
    copy: '노목돈은 재한 외국인이 집을 구할 때 필요한 신뢰 근거를 만들고, 임대인이 개인정보 없이 확인할 수 있게 돕습니다.',
    surfaces: {
      tenant: {
        title: '임차인 앱',
        badge: '임차인 앱',
        copy: '외국인 임차인이 목업 토스 로그인으로 신뢰 패스를 만들고 공유 링크를 준비합니다.'
      },
      verify: {
        title: '검증 페이지',
        badge: '임대인 검증',
        copy: '공유받은 리포트 ID를 기준으로 신뢰 배지와 XRPL 근거 링크를 확인합니다.'
      },
      issuer: {
        title: '발급자 콘솔',
        badge: '운영 콘솔',
        copy: '발급자 로그, 시뮬레이터, 통계를 확인하며 신뢰 패스 발급 흐름을 점검합니다.'
      }
    }
  },
  en: {
    eyebrow: 'NomokDon MVP launcher',
    title: 'Show trust before cash becomes the barrier.',
    copy: 'NomokDon helps foreign residents prepare housing trust evidence and lets landlords review it without raw private records.',
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
  return getLocalePreference(getSession()?.locale ?? navigator.language);
}

function createHeaderActions(locale: Locale, onChange: (nextLocale: Locale) => void): HTMLDivElement {
  const actions = document.createElement('div');
  actions.className = 'route-header-actions';
  actions.append(createLocaleToggle(locale, onChange));
  return actions;
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

  const arrow = document.createElement('span');
  arrow.className = 'route-launcher-link__arrow';
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = '↗';

  link.append(header, description, arrow);
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
  header.append(titleGroup, createHeaderActions(locale, onChange));

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
  header.append(titleGroup, createHeaderActions(locale, onChange));

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
      locale = setLocalePreference(nextLocale);
      render();
    });
  };

  render();
}

export function mountRootLauncher(root: HTMLElement): void {
  let locale = getInitialLocale();

  const render = () => {
    renderRootLauncher(root, locale, (nextLocale) => {
      locale = setLocalePreference(nextLocale);
      render();
    });
  };

  render();
}
