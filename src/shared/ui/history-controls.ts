import { appendChildren, createTextElement } from './dom';

type HistoryControlsProps = {
  backLabel: string;
};

function createHistoryButton(label: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = 'ui-history-controls__button';
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.addEventListener('click', () => {
    window.history.back();
  });

  appendChildren(button, createTextElement('span', 'ui-history-controls__icon', '‹'), createTextElement('span', 'ui-history-controls__label', label));
  return button;
}

export function HistoryControls({ backLabel }: HistoryControlsProps): HTMLElement {
  const controls = document.createElement('div');
  controls.className = 'ui-history-controls';
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', backLabel);
  appendChildren(controls, createHistoryButton(backLabel));
  return controls;
}
