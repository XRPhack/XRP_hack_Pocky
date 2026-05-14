import { normalizeLocale, t, type Locale } from '../../../shared/i18n';
import { Card } from '../../../shared/ui';
import { appendChildren, type UiChild } from '../../../shared/ui/dom';

type OnboardingScreenProps = {
  locale: Locale;
  stepIndex: number;
  localeToggle: UiChild;
  onNext: () => void;
  onStart: () => void;
};

const onboardingStepKeys = [
  {
    title: 'tenantOnboardingStepResidentTitle',
    copy: 'tenantOnboardingStepResidentCopy'
  },
  {
    title: 'tenantOnboardingStepHousingTitle',
    copy: 'tenantOnboardingStepHousingCopy'
  },
  {
    title: 'tenantOnboardingStepTrustTitle',
    copy: 'tenantOnboardingStepTrustCopy'
  }
] as const;

export function OnboardingScreen({ locale, stepIndex, localeToggle, onNext, onStart }: OnboardingScreenProps): HTMLElement {
  const normalizedLocale = normalizeLocale(locale);
  const boundedStepIndex = Math.min(Math.max(stepIndex, 0), onboardingStepKeys.length - 1);
  const step = onboardingStepKeys[boundedStepIndex];
  const isFinalStep = boundedStepIndex === onboardingStepKeys.length - 1;

  const screen = document.createElement('main');
  screen.className = 'tenant-screen tenant-onboarding-screen';
  screen.dataset.locale = normalizedLocale;

  const panel = document.createElement('section');
  panel.className = 'tenant-panel tenant-onboarding-panel';
  panel.setAttribute('aria-labelledby', 'tenant-onboarding-title');

  const card = Card({
    eyebrow: t('tenantOnboardingEyebrow', normalizedLocale),
    title: t(step.title, normalizedLocale),
    description: t(step.copy, normalizedLocale),
    elevated: true
  });
  card.classList.add('tenant-onboarding-card');
  card.querySelector('h2')?.setAttribute('id', 'tenant-onboarding-title');

  const action = document.createElement('button');
  action.className = 'tenant-primary-action';
  action.type = 'button';
  action.textContent = isFinalStep ? t('tenantOnboardingStart', normalizedLocale) : t('tenantOnboardingNext', normalizedLocale);
  action.addEventListener('click', isFinalStep ? onStart : onNext);

  appendChildren(panel, localeToggle, card, action);
  screen.appendChild(panel);
  return screen;
}
