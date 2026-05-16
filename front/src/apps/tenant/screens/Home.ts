import { normalizeLocale, t, type Locale } from '../../../shared/i18n';
import { Badge, Card, EmptyState, MobileShell, Toast } from '../../../shared/ui';
import { appendChildren, type UiChild } from '../../../shared/ui/dom';

type HomeScreenProps = {
  locale: Locale;
  sessionName?: string;
  localeToggle: UiChild;
  showPlaceholderToast: boolean;
  onCreateTrustPass: () => void;
};

function createTrustPassIllustration(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('tenant-home-illustration');
  svg.setAttribute('viewBox', '0 0 220 180');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  background.setAttribute('class', 'tenant-home-illustration__background');
  background.setAttribute('x', '30');
  background.setAttribute('y', '18');
  background.setAttribute('width', '160');
  background.setAttribute('height', '124');
  background.setAttribute('rx', '34');

  const card = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  card.setAttribute('class', 'tenant-home-illustration__card');
  card.setAttribute('x', '54');
  card.setAttribute('y', '42');
  card.setAttribute('width', '112');
  card.setAttribute('height', '104');
  card.setAttribute('rx', '24');

  const topLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  topLine.setAttribute('class', 'tenant-home-illustration__line tenant-home-illustration__line--strong');
  topLine.setAttribute('d', 'M78 78h64');

  const middleLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  middleLine.setAttribute('class', 'tenant-home-illustration__line');
  middleLine.setAttribute('d', 'M78 100h48');

  const bottomLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  bottomLine.setAttribute('class', 'tenant-home-illustration__line');
  bottomLine.setAttribute('d', 'M78 122h34');

  const badge = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  badge.setAttribute('class', 'tenant-home-illustration__badge');
  badge.setAttribute('cx', '156');
  badge.setAttribute('cy', '52');
  badge.setAttribute('r', '18');

  const check = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  check.setAttribute('class', 'tenant-home-illustration__check');
  check.setAttribute('d', 'm147 52 6 6 12-14');

  const sparkle = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  sparkle.setAttribute('class', 'tenant-home-illustration__sparkle');
  sparkle.setAttribute('d', 'M52 50c9-2 14-7 16-16 2 9 7 14 16 16-9 2-14 7-16 16-2-9-7-14-16-16Z');

  appendChildren(svg, background, card, topLine, middleLine, bottomLine, badge, check, sparkle);
  return svg;
}

function createBadgeRow(locale: Locale): HTMLDivElement {
  const badgeRow = document.createElement('div');
  badgeRow.className = 'route-badge-row tenant-home-badge-row';
  appendChildren(
    badgeRow,
    Badge({ label: t('tenantHomeBadgeResident', locale), variant: 'primary' }),
    Badge({ label: t('tenantHomeBadgeHousing', locale), variant: 'info' }),
    Badge({ label: t('tenantHomeBadgeTrust', locale), variant: 'success' })
  );
  return badgeRow;
}

function createPrimaryAction(locale: Locale, onCreateTrustPass: () => void): HTMLButtonElement {
  const action = document.createElement('button');
  action.className = 'tenant-primary-action tenant-home-primary-action';
  action.type = 'button';
  action.textContent = t('tenantHomeCta', locale);
  action.setAttribute('aria-label', t('tenantHomeCtaA11y', locale));
  action.addEventListener('click', onCreateTrustPass);
  return action;
}

export function HomeScreen({
  locale,
  sessionName,
  localeToggle,
  showPlaceholderToast,
  onCreateTrustPass
}: HomeScreenProps): HTMLElement {
  const normalizedLocale = normalizeLocale(locale);
  const landing = document.createElement('div');
  landing.className = 'tenant-home-landing';

  appendChildren(
    landing,
    createTrustPassIllustration(),
    EmptyState({
      title: t('tenantHomeEmptyTitle', normalizedLocale),
      description: t('tenantHomeEmptyCopy', normalizedLocale)
    }),
    createBadgeRow(normalizedLocale),
    createPrimaryAction(normalizedLocale, onCreateTrustPass)
  );

  const card = Card({
    eyebrow: t('tenantHomeEyebrow', normalizedLocale),
    children: [landing],
    elevated: true
  });
  card.classList.add('tenant-home-card');

  return MobileShell({
    title: t('tenantHomeTitle', normalizedLocale),
    subtitle: sessionName
      ? t('tenantHomeSubtitleWithName', normalizedLocale).replace('{name}', sessionName)
      : t('tenantHomeSubtitle', normalizedLocale),
    eyebrow: t('tenantHomeEyebrow', normalizedLocale),
    activeTabId: 'home',
    tabs: [{ id: 'home', label: t('tenantHomeTab', normalizedLocale), icon: '⌂' }],
    trailing: localeToggle,
    children: [
      card,
      showPlaceholderToast
        ? Toast({
            title: t('tenantHomePlaceholderToastTitle', normalizedLocale),
            message: t('tenantHomeToast', normalizedLocale),
            variant: 'info'
          })
        : null
    ]
  });
}
