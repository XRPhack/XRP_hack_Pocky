import demoFixtures from '../../../../../scripts/demo-fixtures.json';
import { normalizeLocale, t, type Locale } from '../../../shared/i18n';
import { Badge, Card, ErrorState, ExplorerLink, LoadingOverlay, MobileShell } from '../../../shared/ui';
import { appendChildren, createTextElement, cx, type UiChild } from '../../../shared/ui/dom';

export type WizardStepStatus = 'idle' | 'loading' | 'success' | 'error';
export type TenantWizardFixtureId = 'happy' | 'edge';

type WizardStepState = {
  status: WizardStepStatus;
  progress: number;
  errorTitle?: string;
  errorMessage?: string;
};

type WizardScreenProps = {
  locale: Locale;
  activeStepIndex: number;
  steps: [WizardStepState, WizardStepState, WizardStepState];
  reportBadges: string[];
  selectedFixtureId: TenantWizardFixtureId;
  isFixtureLocked: boolean;
  localeToggle: UiChild;
  onFixtureChange: (fixtureId: TenantWizardFixtureId) => void;
  onRunStep: (stepIndex: number) => void;
};

type FixtureTransaction = {
  label: string;
  transactionType: string;
  hash: string;
  explorerUrl: string;
};

type FixtureOption = {
  id: TenantWizardFixtureId;
  titleKey: string;
  copyKey: string;
  metaKey: string;
};

const fixtureTransactions = demoFixtures.transactions as FixtureTransaction[];

const fixtureOptions: FixtureOption[] = [
  {
    id: 'happy',
    titleKey: 'tenantWizardFixtureHappyTitle',
    copyKey: 'tenantWizardFixtureHappyCopy',
    metaKey: 'tenantWizardFixtureHappyMeta'
  },
  {
    id: 'edge',
    titleKey: 'tenantWizardFixtureEdgeTitle',
    copyKey: 'tenantWizardFixtureEdgeCopy',
    metaKey: 'tenantWizardFixtureEdgeMeta'
  }
];

const wizardSteps = [
  {
    title: 'tenantWizardStepDidTitle',
    copy: 'tenantWizardStepDidCopy',
    action: 'tenantWizardStepDidAction',
    types: ['DIDSet']
  },
  {
    title: 'tenantWizardStepCredentialTitle',
    copy: 'tenantWizardStepCredentialCopy',
    action: 'tenantWizardStepCredentialAction',
    labels: ['Visa CredentialCreate', 'Visa CredentialAccept', 'Rent reputation CredentialCreate', 'Rent reputation CredentialAccept']
  },
  {
    title: 'tenantWizardStepEscrowTitle',
    copy: 'tenantWizardStepEscrowCopy',
    action: 'tenantWizardStepEscrowAction',
    types: ['EscrowCreate']
  }
] as const;

function getStepTransactions(stepIndex: number): FixtureTransaction[] {
  const config = wizardSteps[stepIndex];

  if ('labels' in config) {
    const labels: readonly string[] = config.labels;

    return fixtureTransactions.filter((transaction) => labels.includes(transaction.label));
  }

  const types: readonly string[] = config.types;

  return fixtureTransactions.filter((transaction) => types.includes(transaction.transactionType));
}

function createStatusBadge(status: WizardStepStatus, locale: Locale): HTMLElement {
  const variant = status === 'success' ? 'success' : status === 'error' ? 'error' : status === 'loading' ? 'warning' : 'neutral';

  return Badge({ label: t(`tenantWizardStatus${status}` as never, locale), variant });
}

function createProgress(status: WizardStepStatus, progress: number, locale: Locale): HTMLElement | null {
  if (status !== 'loading') {
    return null;
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'tenant-wizard-progress';
  wrapper.setAttribute('role', 'progressbar');
  wrapper.setAttribute('aria-valuemin', '0');
  wrapper.setAttribute('aria-valuemax', '100');
  wrapper.setAttribute('aria-valuenow', String(progress));

  const bar = document.createElement('span');
  bar.className = 'tenant-wizard-progress__bar';
  bar.style.width = `${progress}%`;

  appendChildren(wrapper, bar, createTextElement('span', 'tenant-wizard-progress__label', t('tenantWizardLoading', locale)));
  return wrapper;
}

function createExplorerLinks(stepIndex: number, status: WizardStepStatus, locale: Locale): HTMLElement | null {
  if (status !== 'success') {
    return null;
  }

  const links = document.createElement('div');
  links.className = 'tenant-wizard-links';

  for (const transaction of getStepTransactions(stepIndex)) {
    links.appendChild(
      ExplorerLink({
        href: transaction.explorerUrl,
        label: transaction.label,
        value: transaction.hash,
        network: t('tenantWizardTestnet', locale)
      })
    );
  }

  return links;
}

function createStepAction(stepIndex: number, status: WizardStepStatus, isActive: boolean, locale: Locale, onRunStep: (stepIndex: number) => void): HTMLButtonElement | null {
  if (!isActive || status === 'success' || status === 'loading' || status === 'error') {
    return null;
  }

  const action = document.createElement('button');
  action.className = 'tenant-primary-action tenant-wizard-action';
  action.type = 'button';
  action.textContent = t(wizardSteps[stepIndex].action, locale);
  action.addEventListener('click', () => onRunStep(stepIndex));
  return action;
}

function createFixtureSelector(
  locale: Locale,
  selectedFixtureId: TenantWizardFixtureId,
  isFixtureLocked: boolean,
  onFixtureChange: (fixtureId: TenantWizardFixtureId) => void
): HTMLFieldSetElement {
  const fieldset = document.createElement('fieldset');
  fieldset.className = 'tenant-wizard-fixtures';

  const legend = createTextElement('legend', 'tenant-wizard-fixtures__legend', t('tenantWizardFixtureLegend', locale));
  const list = document.createElement('div');
  list.className = 'tenant-wizard-fixture-list';

  for (const option of fixtureOptions) {
    const label = document.createElement('label');
    const input = document.createElement('input');
    const isSelected = selectedFixtureId === option.id;

    label.className = cx('tenant-wizard-fixture', isSelected && 'tenant-wizard-fixture--selected');
    input.className = 'tenant-wizard-fixture__control';
    input.type = 'radio';
    input.name = 'tenant-wizard-fixture';
    input.value = option.id;
    input.checked = isSelected;
    input.disabled = isFixtureLocked;
    input.addEventListener('change', () => {
      onFixtureChange(option.id);
    });

    appendChildren(
      label,
      input,
      createTextElement('span', 'tenant-wizard-fixture__title', t(option.titleKey, locale)),
      createTextElement('span', 'tenant-wizard-fixture__copy', t(option.copyKey, locale)),
      Badge({ label: t(option.metaKey, locale), variant: option.id === 'happy' ? 'success' : 'warning' })
    );
    list.appendChild(label);
  }

  appendChildren(
    fieldset,
    legend,
    list,
    isFixtureLocked ? createTextElement('p', 'tenant-wizard-fixtures__note', t('tenantWizardFixtureLockedNote', locale)) : null
  );
  return fieldset;
}

function createCredentialFallbackGuide(stepIndex: number, step: WizardStepState, locale: Locale): HTMLElement | null {
  if (stepIndex !== 1 || step.status !== 'error') {
    return null;
  }

  const list = document.createElement('ul');
  list.className = 'tenant-wizard-renewal-list';

  for (const key of ['tenantWizardCredentialGuideVisa', 'tenantWizardCredentialGuideEmployment', 'tenantWizardCredentialGuideRetry'] as const) {
    const item = document.createElement('li');
    item.textContent = t(key, locale);
    list.appendChild(item);
  }

  const guide = Card({
    eyebrow: t('tenantWizardCredentialGuideEyebrow', locale),
    title: t('tenantWizardCredentialGuideTitle', locale),
    description: t('tenantWizardCredentialGuideCopy', locale),
    children: list,
    elevated: true
  });
  guide.classList.add('tenant-wizard-renewal-guide');
  return guide;
}

function createStepCard(stepIndex: number, step: WizardStepState, activeStepIndex: number, locale: Locale, onRunStep: (stepIndex: number) => void): HTMLElement {
  const isActive = stepIndex === activeStepIndex;
  const card = Card({
    eyebrow: `${t('tenantWizardStepLabel', locale)} ${stepIndex + 1}`,
    title: t(wizardSteps[stepIndex].title, locale),
    description: t(wizardSteps[stepIndex].copy, locale),
    children: [
      createStatusBadge(step.status, locale),
      createProgress(step.status, step.progress, locale),
      createExplorerLinks(stepIndex, step.status, locale),
      step.status === 'error'
        ? ErrorState({
            title: step.errorTitle ?? t('tenantWizardErrorTitle', locale),
            description: step.errorMessage ?? t('tenantWizardErrorCopy', locale),
            action: { label: t('tenantWizardRetry', locale), onClick: () => onRunStep(stepIndex) }
          })
        : null,
      createCredentialFallbackGuide(stepIndex, step, locale),
      createStepAction(stepIndex, step.status, isActive, locale, onRunStep)
    ],
    elevated: isActive
  });

  card.classList.add('tenant-wizard-card');
  if (isActive) {
    card.classList.add('tenant-wizard-card--active');
  }
  if (step.status === 'loading') {
    card.appendChild(LoadingOverlay({ label: t('tenantWizardLoading', locale) }));
  }

  return card;
}

function createFinalBadges(reportBadges: string[], locale: Locale): HTMLElement | null {
  if (reportBadges.length !== 6) {
    return null;
  }

  const group = document.createElement('section');
  group.className = 'tenant-wizard-final-badges';
  group.setAttribute('aria-label', t('tenantWizardFinalBadges', locale));
  group.appendChild(createTextElement('h2', 'tenant-wizard-final-badges__title', t('tenantWizardFinalBadges', locale)));

  const badges = document.createElement('div');
  badges.className = 'tenant-wizard-final-badges__grid';
  reportBadges.forEach((label) => badges.appendChild(Badge({ label, variant: 'success' })));
  group.appendChild(badges);

  return group;
}

export function WizardScreen({ locale, activeStepIndex, steps, reportBadges, selectedFixtureId, isFixtureLocked, localeToggle, onFixtureChange, onRunStep }: WizardScreenProps): HTMLElement {
  const normalizedLocale = normalizeLocale(locale);
  const stepCards = steps.map((step, index) => createStepCard(index, step, activeStepIndex, normalizedLocale, onRunStep));
  const finalBadges = createFinalBadges(reportBadges, normalizedLocale);

  const content = document.createElement('div');
  content.className = 'tenant-wizard-content';
  appendChildren(
    content,
    createFixtureSelector(normalizedLocale, selectedFixtureId, isFixtureLocked, onFixtureChange),
    ...stepCards,
    finalBadges
  );

  return MobileShell({
    title: t('tenantWizardTitle', normalizedLocale),
    subtitle: t('tenantWizardSubtitle', normalizedLocale),
    eyebrow: t('tenantWizardEyebrow', normalizedLocale),
    activeTabId: 'wizard',
    trailing: localeToggle,
    tabs: [],
    children: content
  });
}
