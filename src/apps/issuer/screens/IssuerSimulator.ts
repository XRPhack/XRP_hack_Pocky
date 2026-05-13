import { normalizeLocale, t, type Locale } from '../../../shared/i18n';
import { Badge, Card, ErrorState, LoadingOverlay } from '../../../shared/ui';
import { appendChildren, createTextElement, cx } from '../../../shared/ui/dom';

export type IssuerSimulatorFixtureId = 'happy' | 'edge';
export type IssuerSimulatorStatus = 'idle' | 'submitting' | 'success' | 'error';
export type IssuerSimulatorStepStatus = 'validated' | 'failed';

export type IssuerSimulatorStep = {
  stepId: string;
  label: string;
  transactionType: string;
  status: IssuerSimulatorStepStatus;
  hash: string;
  ledgerIndex: number;
  ledgerDate: string;
  explorerUrl: string;
  source: string;
  logId: string;
};

export type IssuerSimulatorResult = {
  mode: string;
  ledger: string;
  executedAt: string;
  fixture: {
    id: IssuerSimulatorFixtureId;
    label: string;
    subjectId: string;
    visaType: string;
    employmentChannel: string;
    rentLedgerMonths: number;
  };
  steps: IssuerSimulatorStep[];
};

type IssuerSimulatorCardProps = {
  locale: Locale;
  selectedFixtureId: IssuerSimulatorFixtureId;
  status: IssuerSimulatorStatus;
  result?: IssuerSimulatorResult;
  errorMessage?: string;
  onFixtureChange: (fixtureId: IssuerSimulatorFixtureId) => void;
  onRun: () => void;
};

type FixtureOption = {
  id: IssuerSimulatorFixtureId;
  titleKey: string;
  copyKey: string;
  metaKey: string;
};

const fixtureOptions: FixtureOption[] = [
  {
    id: 'happy',
    titleKey: 'issuerSimulatorFixtureHappyTitle',
    copyKey: 'issuerSimulatorFixtureHappyCopy',
    metaKey: 'issuerSimulatorFixtureHappyMeta'
  },
  {
    id: 'edge',
    titleKey: 'issuerSimulatorFixtureEdgeTitle',
    copyKey: 'issuerSimulatorFixtureEdgeCopy',
    metaKey: 'issuerSimulatorFixtureEdgeMeta'
  }
];

function statusLabel(status: IssuerSimulatorStepStatus, locale: Locale): string {
  return t(status === 'validated' ? 'issuerLogStatusValidated' : 'issuerLogStatusFailed', locale);
}

function formatDateTime(value: string, locale: Locale): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'medium'
  }).format(date);
}

function shortenHash(value: string): string {
  if (value.length <= 18) {
    return value;
  }

  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function createFixtureOptions(
  locale: Locale,
  selectedFixtureId: IssuerSimulatorFixtureId,
  disabled: boolean,
  onFixtureChange: (fixtureId: IssuerSimulatorFixtureId) => void
): HTMLFieldSetElement {
  const fieldset = document.createElement('fieldset');
  fieldset.className = 'issuer-simulator-fixtures';

  const legend = createTextElement('legend', 'issuer-simulator-fixtures__legend', t('issuerSimulatorFixtureLegend', locale));
  const list = document.createElement('div');
  list.className = 'issuer-simulator-fixture-list';

  for (const option of fixtureOptions) {
    const label = document.createElement('label');
    const input = document.createElement('input');
    const isSelected = selectedFixtureId === option.id;

    label.className = cx('issuer-simulator-fixture', isSelected && 'issuer-simulator-fixture--selected');
    input.className = 'issuer-simulator-fixture__control';
    input.type = 'radio';
    input.name = 'issuer-simulator-fixture';
    input.value = option.id;
    input.checked = isSelected;
    input.disabled = disabled;
    input.addEventListener('change', () => {
      onFixtureChange(option.id);
    });

    appendChildren(
      label,
      input,
      createTextElement('span', 'issuer-simulator-fixture__title', t(option.titleKey, locale)),
      createTextElement('span', 'issuer-simulator-fixture__copy', t(option.copyKey, locale)),
      Badge({ label: t(option.metaKey, locale), variant: option.id === 'happy' ? 'success' : 'warning' })
    );
    list.appendChild(label);
  }

  appendChildren(fieldset, legend, list);
  return fieldset;
}

function createRunForm(
  locale: Locale,
  selectedFixtureId: IssuerSimulatorFixtureId,
  status: IssuerSimulatorStatus,
  onFixtureChange: (fixtureId: IssuerSimulatorFixtureId) => void,
  onRun: () => void
): HTMLFormElement {
  const form = document.createElement('form');
  const isSubmitting = status === 'submitting';
  form.className = 'issuer-simulator-form';
  form.noValidate = true;

  const submit = document.createElement('button');
  submit.className = 'issuer-simulator-submit';
  submit.type = 'submit';
  submit.disabled = isSubmitting;
  submit.textContent = isSubmitting ? t('issuerSimulatorSubmitting', locale) : t('issuerSimulatorRun', locale);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    onRun();
  });

  appendChildren(
    form,
    createFixtureOptions(locale, selectedFixtureId, isSubmitting, onFixtureChange),
    createTextElement('p', 'issuer-simulator-safety-note', t('issuerSimulatorNoSecretNote', locale)),
    submit
  );

  return form;
}

function createStepItem(step: IssuerSimulatorStep, locale: Locale): HTMLElement {
  const item = document.createElement('article');
  item.className = 'issuer-simulator-step';

  const header = document.createElement('header');
  header.className = 'issuer-simulator-step__header';
  appendChildren(
    header,
    createTextElement('p', 'issuer-simulator-step__title', step.label),
    Badge({ label: statusLabel(step.status, locale), variant: step.status === 'validated' ? 'success' : 'error' })
  );

  const meta = document.createElement('div');
  meta.className = 'issuer-simulator-step__meta';
  appendChildren(
    meta,
    createTextElement('span', 'issuer-simulator-step__pill', step.transactionType),
    createTextElement('span', 'issuer-simulator-step__pill', t('issuerSimulatorLedgerIndex', locale).replace('{index}', String(step.ledgerIndex))),
    createTextElement('span', 'issuer-simulator-step__pill', formatDateTime(step.ledgerDate, locale))
  );

  const link = document.createElement('a');
  link.className = 'issuer-simulator-step__link';
  link.href = step.explorerUrl;
  link.target = '_blank';
  link.rel = 'noreferrer noopener';
  link.textContent = `${t('issuerTxExplorerLink', locale)} · ${shortenHash(step.hash)}`;
  link.setAttribute('aria-label', t('issuerTxOpenExplorerA11y', locale).replace('{hash}', step.hash));

  appendChildren(item, header, meta, createTextElement('p', 'issuer-simulator-step__source', step.source), link);
  return item;
}

function createResultPanel(result: IssuerSimulatorResult, locale: Locale): HTMLElement {
  const panel = document.createElement('section');
  panel.className = 'issuer-simulator-result';
  panel.setAttribute('aria-live', 'polite');

  const header = document.createElement('div');
  header.className = 'issuer-simulator-result__header';
  appendChildren(
    header,
    Badge({ label: t('issuerSimulatorResultBadge', locale), variant: 'success' }),
    createTextElement('h3', 'issuer-simulator-result__title', t('issuerSimulatorResultTitle', locale)),
    createTextElement('p', 'issuer-simulator-result__copy', t('issuerSimulatorResultCopy', locale)
      .replace('{count}', String(result.steps.length))
      .replace('{time}', formatDateTime(result.executedAt, locale)))
  );

  const list = document.createElement('div');
  list.className = 'issuer-simulator-step-list';
  appendChildren(list, result.steps.map((step) => createStepItem(step, locale)));

  appendChildren(panel, header, list);
  return panel;
}

export function IssuerSimulatorCard({
  locale,
  selectedFixtureId,
  status,
  result,
  errorMessage,
  onFixtureChange,
  onRun
}: IssuerSimulatorCardProps): HTMLElement {
  const normalizedLocale = normalizeLocale(locale);
  const content = document.createElement('div');
  content.className = 'issuer-simulator-content';

  appendChildren(
    content,
    createRunForm(normalizedLocale, selectedFixtureId, status, onFixtureChange, onRun),
    status === 'error'
      ? ErrorState({
        title: t('issuerSimulatorErrorTitle', normalizedLocale),
        description: errorMessage ?? t('issuerSimulatorErrorCopy', normalizedLocale)
      })
      : null,
    result ? createResultPanel(result, normalizedLocale) : null
  );

  const card = Card({
    eyebrow: t('issuerSimulatorEyebrow', normalizedLocale),
    title: t('issuerSimulatorTitle', normalizedLocale),
    description: t('issuerSimulatorCopy', normalizedLocale),
    children: content,
    footer: Badge({ label: t('issuerSimulatorEvidenceBadge', normalizedLocale), variant: 'info' }),
    elevated: true
  });
  card.classList.add('issuer-simulator-card');

  if (status === 'submitting') {
    card.appendChild(LoadingOverlay({ label: t('issuerSimulatorLoading', normalizedLocale) }));
  }

  return card;
}
