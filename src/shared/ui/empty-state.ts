import { appendChildren, createActionElement, createTextElement, type UiAction } from './dom';

type EmptyStateProps = {
  title: string;
  description: string;
  action?: UiAction;
};

export function EmptyState({ title, description, action }: EmptyStateProps): HTMLElement {
  const state = document.createElement('section');
  state.className = 'ui-empty-state';

  const icon = createTextElement('span', 'ui-empty-state__icon', '＋');
  icon.setAttribute('aria-hidden', 'true');

  appendChildren(
    state,
    icon,
    createTextElement('h2', 'ui-empty-state__title', title),
    createTextElement('p', 'ui-empty-state__description', description),
    action ? createActionElement(action, 'ui-empty-state__action') : null
  );

  return state;
}
