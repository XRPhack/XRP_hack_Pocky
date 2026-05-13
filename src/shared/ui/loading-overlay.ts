import { appendChildren, createTextElement, cx } from './dom';

type LoadingOverlayProps = {
  label?: string;
  visible?: boolean;
};

export function LoadingOverlay({
  label = '처리 중입니다',
  visible = true
}: LoadingOverlayProps = {}): HTMLDivElement {
  const overlay = document.createElement('div');
  overlay.className = cx('ui-loading-overlay', !visible && 'ui-loading-overlay--hidden');
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'polite');
  overlay.setAttribute('aria-busy', String(visible));

  const spinner = document.createElement('span');
  spinner.className = 'ui-loading-overlay__spinner';
  spinner.setAttribute('aria-hidden', 'true');

  appendChildren(overlay, spinner, createTextElement('span', 'ui-loading-overlay__label', label));
  return overlay;
}
