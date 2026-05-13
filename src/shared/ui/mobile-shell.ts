import { appendChildren, createTextElement, cx, type UiChild } from './dom';

type MobileShellTab = {
  id: string;
  label: string;
  icon?: string;
  href?: string;
};

type MobileShellProps = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  tabs: MobileShellTab[];
  activeTabId: string;
  children?: UiChild;
  trailing?: UiChild;
};

function createTab(tab: MobileShellTab, activeTabId: string): HTMLAnchorElement | HTMLButtonElement {
  const isActive = tab.id === activeTabId;
  const tabElement = tab.href ? document.createElement('a') : document.createElement('button');
  tabElement.className = cx('ui-mobile-shell__tab', isActive && 'ui-mobile-shell__tab--active');

  if (tab.href) {
    const link = tabElement as HTMLAnchorElement;
    link.href = tab.href;
  } else {
    const button = tabElement as HTMLButtonElement;
    button.type = 'button';
  }

  if (isActive) {
    tabElement.setAttribute('aria-current', 'page');
  }

  appendChildren(
    tabElement,
    createTextElement('span', 'ui-mobile-shell__tab-icon', tab.icon ?? '•'),
    createTextElement('span', 'ui-mobile-shell__tab-label', tab.label)
  );

  return tabElement;
}

export function MobileShell({
  title,
  subtitle,
  eyebrow,
  tabs,
  activeTabId,
  children,
  trailing
}: MobileShellProps): HTMLElement {
  const shell = document.createElement('div');
  shell.className = 'ui-mobile-shell';

  const header = document.createElement('header');
  header.className = 'ui-mobile-shell__header';

  const titleGroup = document.createElement('div');
  titleGroup.className = 'ui-mobile-shell__title-group';
  appendChildren(
    titleGroup,
    eyebrow ? createTextElement('p', 'ui-mobile-shell__eyebrow', eyebrow) : null,
    createTextElement('h1', 'ui-mobile-shell__title', title),
    subtitle ? createTextElement('p', 'ui-mobile-shell__subtitle', subtitle) : null
  );

  appendChildren(header, titleGroup, trailing ? [trailing] : null);

  const content = document.createElement('main');
  content.className = 'ui-mobile-shell__content';
  appendChildren(content, children);

  const nav = document.createElement('nav');
  nav.className = 'ui-mobile-shell__nav';
  nav.setAttribute('aria-label', '하단 탭');
  appendChildren(nav, tabs.map((tab) => createTab(tab, activeTabId)));

  appendChildren(shell, header, content, nav);
  return shell;
}
