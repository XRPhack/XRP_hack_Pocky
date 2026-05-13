import { appendChildren, createTextElement } from './dom';

type ExplorerLinkProps = {
  href: string;
  value: string;
  label?: string;
  network?: string;
};

function shortenValue(value: string): string {
  if (value.length <= 18) {
    return value;
  }

  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

export function ExplorerLink({
  href,
  value,
  label = 'XRPL Explorer',
  network = 'Testnet'
}: ExplorerLinkProps): HTMLAnchorElement {
  const link = document.createElement('a');
  link.className = 'ui-explorer-link';
  link.href = href;
  link.target = '_blank';
  link.rel = 'noreferrer noopener';
  link.setAttribute('aria-label', `${label}에서 ${value} 열기`);

  const copy = document.createElement('span');
  copy.className = 'ui-explorer-link__copy';
  appendChildren(
    copy,
    createTextElement('span', 'ui-explorer-link__label', label),
    createTextElement('span', 'ui-explorer-link__value', shortenValue(value))
  );

  const meta = createTextElement('span', 'ui-explorer-link__network', network);
  const arrow = createTextElement('span', 'ui-explorer-link__arrow', '↗');
  arrow.setAttribute('aria-hidden', 'true');

  appendChildren(link, copy, meta, arrow);
  return link;
}
