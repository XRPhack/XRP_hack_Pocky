import demoFixtures from '../../../../scripts/demo-fixtures.json';
import { normalizeLocale, t, type Locale } from '../../../shared/i18n';
import { Badge, Card, ErrorState, ExplorerLink, LoadingOverlay, MobileShell } from '../../../shared/ui';
import { appendChildren, createTextElement, cx, type UiChild } from '../../../shared/ui/dom';

export type WizardStepStatus = 'idle' | 'loading' | 'success' | 'error';
export type TenantWizardFixtureId = 'happy' | 'edge';
type WizardDocumentAuthenticityStatus = 'not-checked' | 'ready' | 'failed';

export type WizardDocumentAuthenticity = {
  status: WizardDocumentAuthenticityStatus;
  method: 'document-code' | 'qr-url' | 'missing';
  summary: string;
};

export type WizardDocumentReviewReason = {
  kind: 'visa' | 'employment';
  code: 'parse-failed' | 'verification-failed' | 'authenticity-missing';
  title: string;
  message: string;
  action: string;
};

export type WizardDocumentRetention = {
  expiresAt: string;
  ttlMs: number;
  replacedPrevious: boolean;
};

type WizardDocumentVerificationResult = {
  success: boolean;
  source: string;
  evidenceHash: string;
  summary: string;
  authenticity?: WizardDocumentAuthenticity;
};

type WizardStepState = {
  status: WizardStepStatus;
  progress: number;
  errorTitle?: string;
  errorMessage?: string;
};

export type WizardDocumentVerificationSummary = {
  visa?: WizardDocumentVerificationResult;
  employment?: WizardDocumentVerificationResult;
  reviewReasons: WizardDocumentReviewReason[];
  retention?: WizardDocumentRetention;
};

type WizardScreenProps = {
  locale: Locale;
  activeStepIndex: number;
  steps: [WizardStepState, WizardStepState, WizardStepState, WizardStepState];
  reportBadges: string[];
  selectedFixtureId: TenantWizardFixtureId;
  isFixtureLocked: boolean;
  selectedDocumentNames: {
    visa?: string;
    employment?: string;
  };
  documentVerification?: WizardDocumentVerificationSummary;
  localeToggle: UiChild;
  onFixtureChange: (fixtureId: TenantWizardFixtureId) => void;
  onDocumentChange: (kind: 'visa' | 'employment', file: File | null) => void;
  onDocumentRemove: (kind: 'visa' | 'employment') => void;
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
    title: 'tenantWizardStepDocumentTitle',
    copy: 'tenantWizardStepDocumentCopy',
    action: 'tenantWizardStepDocumentAction',
    labels: []
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

function createDocumentUploadControls(
  stepIndex: number,
  status: WizardStepStatus,
  isActive: boolean,
  locale: Locale,
  selectedDocumentNames: WizardScreenProps['selectedDocumentNames'],
  onDocumentChange: WizardScreenProps['onDocumentChange'],
  onDocumentRemove: WizardScreenProps['onDocumentRemove']
): HTMLElement | null {
  if (stepIndex !== 1 || !isActive || status === 'loading' || status === 'success') {
    return null;
  }

  const group = document.createElement('div');
  group.className = 'tenant-wizard-document-upload';

  for (const kind of ['visa', 'employment'] as const) {
    const label = document.createElement('label');
    label.className = 'tenant-wizard-document-upload__field';

    const input = document.createElement('input');
    input.className = 'tenant-wizard-document-upload__input';
    input.type = 'file';
    input.accept = '.json,.txt,application/json,text/plain';
    input.addEventListener('change', () => {
      onDocumentChange(kind, input.files?.[0] ?? null);
    });
    const removeButton = document.createElement('button');
    removeButton.className = 'tenant-wizard-document-upload__remove';
    removeButton.type = 'button';
    removeButton.textContent = t('tenantWizardDocumentRemove', locale);
    removeButton.disabled = !selectedDocumentNames[kind];
    removeButton.addEventListener('click', () => {
      input.value = '';
      onDocumentRemove(kind);
    });

    appendChildren(
      label,
      createTextElement(
        'span',
        'tenant-wizard-document-upload__label',
        t(kind === 'visa' ? 'tenantWizardDocumentVisaLabel' : 'tenantWizardDocumentEmploymentLabel', locale)
      ),
      input,
      createTextElement(
        'span',
        'tenant-wizard-document-upload__filename',
        selectedDocumentNames[kind] ?? t('tenantWizardDocumentFixtureFallback', locale)
      ),
      removeButton
    );
    group.appendChild(label);
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'tenant-wizard-document-panel';
  appendChildren(
    wrapper,
    createTextElement('p', 'tenant-wizard-document-panel__hint', t('tenantWizardDocumentSupportedFormats', locale)),
    group
  );
  return wrapper;
}

function createDocumentVerificationSummary(
  stepIndex: number,
  summary: WizardScreenProps['documentVerification'],
  locale: Locale
): HTMLElement | null {
  if (stepIndex !== 1 || !summary || (!summary.visa && !summary.employment && summary.reviewReasons.length === 0)) {
    return null;
  }

  const list = document.createElement('div');
  list.className = 'tenant-wizard-document-results';

  for (const kind of ['visa', 'employment'] as const) {
    const result = summary[kind];

    if (!result) {
      continue;
    }

    const item = document.createElement('article');
    item.className = 'tenant-wizard-document-result';
    const title = createTextElement(
      'h3',
      'tenant-wizard-document-result__title',
      t(kind === 'visa' ? 'tenantWizardDocumentVisaLabel' : 'tenantWizardDocumentEmploymentLabel', locale)
    );
    const meta = createTextElement(
      'p',
      'tenant-wizard-document-result__meta',
      `${result.source} · ${t('tenantWizardDocumentEvidenceHash', locale)} ${result.evidenceHash.slice(0, 12)}...`
    );
    const authenticity = result.authenticity
      ? createDocumentAuthenticity(result.authenticity, locale)
      : null;

    appendChildren(
      item,
      title,
      Badge({
        label: t(result.success ? 'tenantWizardDocumentVerified' : 'tenantWizardDocumentReviewNeeded', locale),
        variant: result.success ? 'success' : 'warning'
      }),
      createTextElement('p', 'tenant-wizard-document-result__summary', result.summary),
      authenticity,
      meta
    );
    list.appendChild(item);
  }

  if (summary.reviewReasons.length > 0) {
    list.appendChild(createDocumentReviewReasons(summary.reviewReasons, locale));
  }
  appendChildren(list, createDocumentRetention(summary.retention, locale));

  return list;
}

function createDocumentReviewReasons(reasons: WizardDocumentReviewReason[], locale: Locale): HTMLElement {
  const panel = document.createElement('section');
  panel.className = 'tenant-wizard-document-review';

  const list = document.createElement('ul');
  list.className = 'tenant-wizard-document-review__list';

  for (const reason of reasons) {
    const item = document.createElement('li');
    item.className = 'tenant-wizard-document-review__item';
    appendChildren(
      item,
      createTextElement('strong', 'tenant-wizard-document-review__title', reason.title),
      createTextElement('span', 'tenant-wizard-document-review__message', reason.message),
      createTextElement('span', 'tenant-wizard-document-review__action', reason.action)
    );
    list.appendChild(item);
  }

  appendChildren(
    panel,
    Badge({ label: t('tenantWizardDocumentReviewNeeded', locale), variant: 'warning' }),
    createTextElement('h3', 'tenant-wizard-document-review__heading', t('tenantWizardDocumentReviewReasonTitle', locale)),
    list
  );

  return panel;
}

function formatRetentionExpiresAt(value: string, locale: Locale): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function createDocumentRetention(retention: WizardDocumentRetention | undefined, locale: Locale): HTMLElement | null {
  if (!retention) {
    return null;
  }

  return createTextElement(
    'p',
    'tenant-wizard-document-retention',
    t('tenantWizardDocumentRetention', locale).replace('{expiresAt}', formatRetentionExpiresAt(retention.expiresAt, locale))
  );
}

function createDocumentAuthenticity(authenticity: WizardDocumentAuthenticity, locale: Locale): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'tenant-wizard-document-result__authenticity';

  const statusKey = authenticity.status === 'ready'
    ? 'tenantWizardDocumentAuthenticityReady'
    : authenticity.status === 'failed'
      ? 'tenantWizardDocumentAuthenticityFailed'
      : 'tenantWizardDocumentAuthenticityNotChecked';

  appendChildren(
    wrapper,
    Badge({
      label: t(statusKey, locale),
      variant: authenticity.status === 'ready' ? 'success' : authenticity.status === 'failed' ? 'error' : 'warning'
    }),
    createTextElement('span', 'tenant-wizard-document-result__authenticity-summary', authenticity.summary)
  );

  return wrapper;
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
  if ((stepIndex !== 1 && stepIndex !== 2) || step.status !== 'error') {
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

function createStepCard(
  stepIndex: number,
  step: WizardStepState,
  activeStepIndex: number,
  locale: Locale,
  selectedDocumentNames: WizardScreenProps['selectedDocumentNames'],
  documentVerification: WizardScreenProps['documentVerification'],
  onDocumentChange: WizardScreenProps['onDocumentChange'],
  onDocumentRemove: WizardScreenProps['onDocumentRemove'],
  onRunStep: (stepIndex: number) => void
): HTMLElement {
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
      createDocumentVerificationSummary(stepIndex, documentVerification, locale),
      createDocumentUploadControls(stepIndex, step.status, isActive, locale, selectedDocumentNames, onDocumentChange, onDocumentRemove),
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

export function WizardScreen({
  locale,
  activeStepIndex,
  steps,
  reportBadges,
  selectedFixtureId,
  isFixtureLocked,
  selectedDocumentNames,
  documentVerification,
  localeToggle,
  onFixtureChange,
  onDocumentChange,
  onDocumentRemove,
  onRunStep
}: WizardScreenProps): HTMLElement {
  const normalizedLocale = normalizeLocale(locale);
  const stepCards = steps.map((step, index) =>
    createStepCard(
      index,
      step,
      activeStepIndex,
      normalizedLocale,
      selectedDocumentNames,
      documentVerification,
      onDocumentChange,
      onDocumentRemove,
      onRunStep
    )
  );
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
