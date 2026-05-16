import { appendChildren, createActionElement, createTextElement, type UiAction } from './dom';

type ErrorStateProps = {
  title: string;
  description: string;
  action?: UiAction;
};

export function ErrorState({ title, description, action }: ErrorStateProps): HTMLElement {
  const state = document.createElement('section');
  state.className = 'ui-error-state';
  state.setAttribute('role', 'alert');

  const icon = createTextElement('span', 'ui-error-state__icon', '!');
  icon.setAttribute('aria-hidden', 'true');

  appendChildren(
    state,
    icon,
    createTextElement('h2', 'ui-error-state__title', title),
    createTextElement('p', 'ui-error-state__description', description),
    action ? createActionElement(action, 'ui-error-state__action') : null
  );

  return state;
}
