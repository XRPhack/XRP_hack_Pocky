type UiChild = Node | string | number | null | undefined | UiChild[];

type UiAction = {
  label: string;
  href?: string;
  onClick?: () => void;
};

export function cx(...classNames: Array<string | false | null | undefined>): string {
  return classNames.filter(Boolean).join(' ');
}

export function appendChildren(parent: Node, ...children: UiChild[]): void {
  for (const child of children) {
    if (Array.isArray(child)) {
      appendChildren(parent, ...child);
      continue;
    }

    if (child === null || child === undefined) {
      continue;
    }

    parent.appendChild(
      typeof child === 'string' || typeof child === 'number'
        ? document.createTextNode(String(child))
        : child
    );
  }
}

export function createTextElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className: string,
  text: string
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  return element;
}

export function createActionElement(action: UiAction, className: string): HTMLAnchorElement | HTMLButtonElement {
  if (action.href) {
    const link = document.createElement('a');
    link.className = className;
    link.href = action.href;
    link.textContent = action.label;
    return link;
  }

  const button = document.createElement('button');
  button.className = className;
  button.type = 'button';
  button.textContent = action.label;

  if (action.onClick) {
    button.addEventListener('click', action.onClick);
  }

  return button;
}

export type { UiAction, UiChild };
