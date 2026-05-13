import { cx } from './dom';

type BadgeVariant = 'primary' | 'neutral' | 'success' | 'warning' | 'error' | 'info';

type BadgeProps = {
  label: string;
  variant?: BadgeVariant;
};

export function Badge({ label, variant = 'neutral' }: BadgeProps): HTMLSpanElement {
  const badge = document.createElement('span');
  badge.className = cx('ui-badge', `ui-badge--${variant}`);
  badge.textContent = label;
  return badge;
}
