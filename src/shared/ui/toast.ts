import { appendChildren, createActionElement, createTextElement, cx, type UiAction } from './dom';

type ToastVariant = 'info' | 'success' | 'warning' | 'error';

type ToastProps = {
  title?: string;
  message: string;
  variant?: ToastVariant;
  action?: UiAction;
};

export function Toast({ title, message, variant = 'info', action }: ToastProps): HTMLDivElement {
  const toast = document.createElement('div');
  toast.className = cx('ui-toast', `ui-toast--${variant}`);
  toast.setAttribute('role', variant === 'error' ? 'alert' : 'status');
  toast.setAttribute('aria-live', variant === 'error' ? 'assertive' : 'polite');

  const copy = document.createElement('div');
  copy.className = 'ui-toast__copy';
  appendChildren(
    copy,
    title ? createTextElement('strong', 'ui-toast__title', title) : null,
    createTextElement('span', 'ui-toast__message', message)
  );

  appendChildren(toast, copy, action ? createActionElement(action, 'ui-toast__action') : null);
  return toast;
}
