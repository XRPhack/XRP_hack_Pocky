import { getSession } from '../shared/auth/session';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  ExplorerLink,
  LoadingOverlay,
  MobileShell,
  Toast
} from '../shared/ui';
import { normalizeLocale, t, type Locale } from '../shared/i18n';

function createStack(className: string, children: HTMLElement[]): HTMLDivElement {
  const stack = document.createElement('div');
  stack.className = className;
  stack.replaceChildren(...children);
  return stack;
}

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

function createBadgeRow(locale: Locale): HTMLDivElement {
  return createStack('dev-components__badge-row', [
    Badge({ label: t('loginCta', locale), variant: 'success' }),
    Badge({ label: t('onboardingStart', locale), variant: 'warning' }),
    Badge({ label: t('share', locale), variant: 'error' }),
    Badge({ label: t('verify', locale), variant: 'primary' })
  ]);
}

function createLoadingPreview(locale: Locale): HTMLDivElement {
  const preview = document.createElement('div');
  preview.className = 'dev-components__overlay-preview';
  preview.appendChild(LoadingOverlay({ label: t('loading', locale) }));
  return preview;
}

function renderComponentDemo(root: HTMLElement, locale: Locale, onChange: (nextLocale: Locale) => void): void {
  document.title = `${t('appTitle', locale)} · Dev`;

  const trustCard = Card({
    eyebrow: t('share', locale),
    title: t('appTitle', locale),
    description: `${t('loginCta', locale)} · ${t('onboardingStart', locale)}`,
    elevated: true,
    children: createStack('dev-components__stack', [
      createBadgeRow(locale),
      ExplorerLink({
        href: 'https://testnet.xrpl.org/transactions/9F4B7F5C2A1D8E3C6B0A9D4E8F2C1B7A',
        label: t('verify', locale),
        value: '9F4B7F5C2A1D8E3C6B0A9D4E8F2C1B7A'
      })
    ])
  });

  const stateCard = Card({
    eyebrow: t('empty', locale),
    title: t('error', locale),
    children: createStack('dev-components__state-grid', [
      EmptyState({
        title: t('empty', locale),
        description: t('onboardingStart', locale),
        action: { label: t('share', locale) }
      }),
      ErrorState({
        title: t('error', locale),
        description: `${t('verify', locale)} · ${t('loading', locale)}`,
        action: { label: t('loading', locale) }
      })
    ])
  });

  const feedbackCard = Card({
    eyebrow: t('loading', locale),
    title: t('issuer', locale),
    children: createStack('dev-components__stack', [
      createLoadingPreview(locale),
      Toast({
        title: t('share', locale),
        message: `${t('loginCta', locale)} · ${t('verify', locale)}`,
        variant: 'success',
        action: { label: t('onboardingStart', locale) }
      })
    ])
  });

  const demoContent = createStack('dev-components__content', [trustCard, stateCard, feedbackCard]);

  root.replaceChildren(
    MobileShell({
      eyebrow: t('appTitle', locale),
      title: t('appTitle', locale),
      subtitle: `${t('loginCta', locale)} · ${t('onboardingStart', locale)}`,
      activeTabId: 'components',
      trailing: createLocaleToggle(locale, onChange),
      tabs: [
        { id: 'home', label: t('share', locale), icon: '⌂', href: '/' },
        { id: 'components', label: t('verify', locale), icon: '◇', href: '/dev/components' },
        { id: 'verify', label: t('issuer', locale), icon: '✓', href: '/verify/sample-report' }
      ],
      children: demoContent
    })
  );
}

export function mountComponentDemo(root: HTMLElement): void {
  let locale = getInitialLocale();

  const render = () => {
    renderComponentDemo(root, locale, (nextLocale) => {
      locale = nextLocale;
      render();
    });
  };

  render();
}
