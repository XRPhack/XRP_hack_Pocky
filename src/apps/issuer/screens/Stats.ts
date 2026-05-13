import { normalizeLocale, t, type Locale } from '../../../shared/i18n';
import { Badge, Card } from '../../../shared/ui';
import { appendChildren, createTextElement } from '../../../shared/ui/dom';
import type { IssuerLogEvent, IssuerLogEntryStatus } from './IssuerLogs';

type IssuerStatsCardProps = {
  locale: Locale;
  logs: IssuerLogEvent[];
};

type ActivityPoint = {
  key: string;
  label: string;
  count: number;
};

type IssuerStats = {
  totalIssuanceCount: number;
  activeTrustPassCount: number;
  lockedEscrowXrp: number;
  verificationClickCount: number;
  activityPoints: ActivityPoint[];
};

type StatDefinition = {
  key: string;
  labelKey: string;
  value: string;
  copyKey: string;
};

const CHART_WIDTH = 640;
const CHART_HEIGHT = 180;
const CHART_PADDING_X = 34;
const CHART_PADDING_TOP = 24;
const CHART_PADDING_BOTTOM = 34;
const ACTIVITY_BUCKET_COUNT = 8;
const SIMULATOR_ESCROW_FALLBACK_XRP = 10;
const inactiveStatuses: readonly IssuerLogEntryStatus[] = ['failed', 'error'];

function getString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
}

function getNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function isActiveStatus(status: IssuerLogEntryStatus): boolean {
  return !inactiveStatuses.includes(status);
}

function getHourStart(date: Date): Date {
  const hour = new Date(date);
  hour.setMinutes(0, 0, 0);
  return hour;
}

function getHourKey(date: Date): string {
  return getHourStart(date).toISOString();
}

function getEventDate(value: string): Date | undefined {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function getSimulatorRunKey(event: IssuerLogEvent): string | undefined {
  if (event.type !== 'issuer.simulator') {
    return undefined;
  }

  const simulatorRunId = getString(event.details.simulatorRunId);

  if (simulatorRunId) {
    return `simulator:${simulatorRunId}`;
  }

  const fixtureId = getString(event.details.fixtureId) ?? 'fixture';
  const subjectId = event.userId ?? 'tenant';
  const eventDate = getEventDate(event.createdAt);
  const hourKey = eventDate ? getHourKey(eventDate) : 'unknown-hour';

  return `simulator-legacy:${fixtureId}:${subjectId}:${hourKey}`;
}

function getSignAndSubmitKey(event: IssuerLogEvent): string | undefined {
  if (event.type !== 'issuer.sign-and-submit') {
    return undefined;
  }

  return `report:${getString(event.details.reportId) ?? event.id}`;
}

function getIssuanceKey(event: IssuerLogEvent): string | undefined {
  return getSignAndSubmitKey(event) ?? getSimulatorRunKey(event);
}

function isSimulatorEscrowCreate(event: IssuerLogEvent): boolean {
  return event.type === 'issuer.simulator'
    && getString(event.details.step) === 'escrow-create'
    && getString(event.details.transactionType) === 'EscrowCreate';
}

function createActivityPoints(logs: IssuerLogEvent[], locale: Locale): ActivityPoint[] {
  const now = getHourStart(new Date());
  const formatter = new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
    hour: '2-digit',
    hour12: false
  });
  const buckets = Array.from({ length: ACTIVITY_BUCKET_COUNT }, (_, index): ActivityPoint => {
    const bucketDate = new Date(now);
    bucketDate.setHours(now.getHours() - (ACTIVITY_BUCKET_COUNT - 1 - index));

    return {
      key: bucketDate.toISOString(),
      label: formatter.format(bucketDate),
      count: 0
    };
  });
  const bucketByKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  for (const event of logs) {
    const eventDate = getEventDate(event.createdAt);

    if (!eventDate) {
      continue;
    }

    const bucket = bucketByKey.get(getHourKey(eventDate));

    if (bucket) {
      bucket.count += 1;
    }
  }

  return buckets;
}

function getIssuerStats(logs: IssuerLogEvent[], locale: Locale): IssuerStats {
  const issuanceKeys = new Set<string>();
  const activePassKeys = new Set<string>();
  const escrowKeys = new Set<string>();
  let lockedEscrowXrp = 0;
  let verificationClickCount = 0;

  for (const event of logs) {
    const issuanceKey = getIssuanceKey(event);

    if (issuanceKey) {
      issuanceKeys.add(issuanceKey);

      if (isActiveStatus(event.status)) {
        activePassKeys.add(issuanceKey);
      }
    }

    if (event.type === 'landlord.verify-confirmed') {
      verificationClickCount += 1;
    }

    if (event.type === 'issuer.sign-and-submit') {
      const escrowAmount = getNumber(event.details.escrowAmountXrp);
      const escrowKey = getSignAndSubmitKey(event);

      if (escrowKey && escrowAmount !== undefined && !escrowKeys.has(escrowKey)) {
        escrowKeys.add(escrowKey);
        lockedEscrowXrp += escrowAmount;
      }
    }

    if (isSimulatorEscrowCreate(event)) {
      const escrowKey = getSimulatorRunKey(event);
      const escrowAmount = getNumber(event.details.escrowAmountXrp) ?? SIMULATOR_ESCROW_FALLBACK_XRP;

      if (escrowKey && !escrowKeys.has(escrowKey)) {
        escrowKeys.add(escrowKey);
        lockedEscrowXrp += escrowAmount;
      }
    }
  }

  return {
    totalIssuanceCount: issuanceKeys.size,
    activeTrustPassCount: activePassKeys.size,
    lockedEscrowXrp,
    verificationClickCount,
    activityPoints: createActivityPoints(logs, locale)
  };
}

function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'ko' ? 'ko-KR' : 'en-US').format(value);
}

function formatXrp(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
    maximumFractionDigits: 2
  }).format(value);
}

function createStatCard(definition: StatDefinition): HTMLElement {
  const card = document.createElement('article');
  card.className = 'issuer-stat-card';

  appendChildren(
    card,
    createTextElement('p', 'issuer-stat-card__label', definition.labelKey),
    createTextElement('p', 'issuer-stat-card__value', definition.value),
    createTextElement('p', 'issuer-stat-card__copy', definition.copyKey)
  );
  card.dataset.stat = definition.key;

  return card;
}

function getChartPolyline(points: ActivityPoint[]): string {
  const maxCount = Math.max(1, ...points.map((point) => point.count));
  const usableWidth = CHART_WIDTH - (CHART_PADDING_X * 2);
  const usableHeight = CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM;
  const interval = points.length > 1 ? usableWidth / (points.length - 1) : 0;

  return points.map((point, index) => {
    const x = CHART_PADDING_X + (interval * index);
    const y = CHART_PADDING_TOP + (usableHeight - ((point.count / maxCount) * usableHeight));
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

function createSvgElement<K extends keyof SVGElementTagNameMap>(tagName: K): SVGElementTagNameMap[K] {
  return document.createElementNS('http://www.w3.org/2000/svg', tagName);
}

function createChartPoint(point: ActivityPoint, index: number, maxCount: number, locale: Locale): SVGCircleElement {
  const usableWidth = CHART_WIDTH - (CHART_PADDING_X * 2);
  const usableHeight = CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM;
  const interval = ACTIVITY_BUCKET_COUNT > 1 ? usableWidth / (ACTIVITY_BUCKET_COUNT - 1) : 0;
  const circle = createSvgElement('circle');
  const x = CHART_PADDING_X + (interval * index);
  const y = CHART_PADDING_TOP + (usableHeight - ((point.count / maxCount) * usableHeight));

  circle.setAttribute('cx', x.toFixed(1));
  circle.setAttribute('cy', y.toFixed(1));
  circle.setAttribute('r', '4');
  circle.setAttribute('aria-label', t('issuerStatsChartPointA11y', locale)
    .replace('{hour}', point.label)
    .replace('{count}', formatNumber(point.count, locale)));

  return circle;
}

function createActivityChart(points: ActivityPoint[], locale: Locale): HTMLElement {
  const chart = document.createElement('div');
  chart.className = 'issuer-stats-chart-card';
  const maxCount = Math.max(1, ...points.map((point) => point.count));
  const svg = createSvgElement('svg');
  const title = createSvgElement('title');
  const desc = createSvgElement('desc');
  const baseline = createSvgElement('line');
  const area = createSvgElement('polyline');
  const line = createSvgElement('polyline');
  const labels = document.createElement('div');

  svg.classList.add('issuer-stats-chart');
  svg.setAttribute('viewBox', `0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-labelledby', 'issuer-stats-chart-title issuer-stats-chart-desc');

  title.id = 'issuer-stats-chart-title';
  title.textContent = t('issuerStatsChartTitle', locale);
  desc.id = 'issuer-stats-chart-desc';
  desc.textContent = t('issuerStatsChartA11y', locale);

  baseline.classList.add('issuer-stats-chart__baseline');
  baseline.setAttribute('x1', String(CHART_PADDING_X));
  baseline.setAttribute('x2', String(CHART_WIDTH - CHART_PADDING_X));
  baseline.setAttribute('y1', String(CHART_HEIGHT - CHART_PADDING_BOTTOM));
  baseline.setAttribute('y2', String(CHART_HEIGHT - CHART_PADDING_BOTTOM));

  const polylinePoints = getChartPolyline(points);
  area.classList.add('issuer-stats-chart__area');
  area.setAttribute('points', `${CHART_PADDING_X},${CHART_HEIGHT - CHART_PADDING_BOTTOM} ${polylinePoints} ${CHART_WIDTH - CHART_PADDING_X},${CHART_HEIGHT - CHART_PADDING_BOTTOM}`);
  line.classList.add('issuer-stats-chart__line');
  line.setAttribute('points', polylinePoints);

  labels.className = 'issuer-stats-chart-labels';
  appendChildren(
    labels,
    createTextElement('span', 'issuer-stats-chart-labels__item', points[0]?.label ?? ''),
    createTextElement('span', 'issuer-stats-chart-labels__item', points.at(-1)?.label ?? '')
  );

  appendChildren(
    svg,
    title,
    desc,
    baseline,
    area,
    line,
    points.map((point, index) => createChartPoint(point, index, maxCount, locale))
  );

  appendChildren(
    chart,
    createTextElement('p', 'issuer-stats-chart-card__title', t('issuerStatsChartTitle', locale)),
    createTextElement('p', 'issuer-stats-chart-card__copy', t('issuerStatsChartCopy', locale)),
    svg,
    labels
  );

  return chart;
}

export function IssuerStatsCard({ locale, logs }: IssuerStatsCardProps): HTMLElement {
  const normalizedLocale = normalizeLocale(locale);
  const stats = getIssuerStats(logs, normalizedLocale);
  const content = document.createElement('div');
  content.className = 'issuer-stats-content';

  const statGrid = document.createElement('div');
  statGrid.className = 'issuer-stats-grid';
  appendChildren(
    statGrid,
    [
      createStatCard({
        key: 'total-issuance',
        labelKey: t('issuerStatsTotalIssuanceTitle', normalizedLocale),
        value: formatNumber(stats.totalIssuanceCount, normalizedLocale),
        copyKey: t('issuerStatsTotalIssuanceCopy', normalizedLocale)
      }),
      createStatCard({
        key: 'active-pass',
        labelKey: t('issuerStatsActivePassTitle', normalizedLocale),
        value: formatNumber(stats.activeTrustPassCount, normalizedLocale),
        copyKey: t('issuerStatsActivePassCopy', normalizedLocale)
      }),
      createStatCard({
        key: 'locked-escrow',
        labelKey: t('issuerStatsLockedEscrowTitle', normalizedLocale),
        value: t('issuerStatsLockedEscrowValue', normalizedLocale).replace('{xrp}', formatXrp(stats.lockedEscrowXrp, normalizedLocale)),
        copyKey: t('issuerStatsLockedEscrowCopy', normalizedLocale)
      }),
      createStatCard({
        key: 'verification-clicks',
        labelKey: t('issuerStatsVerificationClicksTitle', normalizedLocale),
        value: formatNumber(stats.verificationClickCount, normalizedLocale),
        copyKey: t('issuerStatsVerificationClicksCopy', normalizedLocale)
      })
    ]
  );

  appendChildren(
    content,
    statGrid,
    createActivityChart(stats.activityPoints, normalizedLocale),
    createTextElement('p', 'issuer-stats-source-note', t('issuerStatsSourceNote', normalizedLocale))
  );

  const card = Card({
    eyebrow: t('issuerStatsEyebrow', normalizedLocale),
    title: t('issuerStatsTitle', normalizedLocale),
    description: t('issuerStatsCopy', normalizedLocale),
    children: content,
    footer: Badge({ label: t('issuerStatsBadge', normalizedLocale), variant: 'info' }),
    elevated: true
  });
  card.classList.add('issuer-stats-card');
  return card;
}
