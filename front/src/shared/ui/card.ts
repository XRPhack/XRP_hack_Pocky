import { appendChildren, createTextElement, cx, type UiChild } from './dom';

type CardProps = {
  title?: string;
  eyebrow?: string;
  description?: string;
  children?: UiChild;
  footer?: UiChild;
  elevated?: boolean;
  as?: 'article' | 'section' | 'div';
};

export function Card({
  title,
  eyebrow,
  description,
  children,
  footer,
  elevated = false,
  as = 'section'
}: CardProps): HTMLElement {
  const card = document.createElement(as);
  card.className = cx('ui-card', elevated && 'ui-card--elevated');

  if (eyebrow || title || description) {
    const header = document.createElement('div');
    header.className = 'ui-card__header';

    appendChildren(
      header,
      eyebrow ? createTextElement('p', 'ui-card__eyebrow', eyebrow) : null,
      title ? createTextElement('h2', 'ui-card__title', title) : null,
      description ? createTextElement('p', 'ui-card__description', description) : null
    );

    card.appendChild(header);
  }

  if (children) {
    const body = document.createElement('div');
    body.className = 'ui-card__body';
    appendChildren(body, children);
    card.appendChild(body);
  }

  if (footer) {
    const footerElement = document.createElement('footer');
    footerElement.className = 'ui-card__footer';
    appendChildren(footerElement, footer);
    card.appendChild(footerElement);
  }

  return card;
}
