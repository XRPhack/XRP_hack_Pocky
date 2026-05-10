import './styles.css';
import { shortHash } from './domain/hashing';
import { buildShareableReport, createExpiredVisaScenario, createHighRentBurdenScenario, demoScenario } from './domain/scenario';
import { getFallbackTxLinks } from './domain/xrplService';
import type { DemoScenario, ShareableReport, TrustBadge } from './domain/types';

const allowedFallbackHosts = new Set(['testnet.xrpl.org', 'test.bithomp.com']);
const allowedBadgeStatuses = new Set<TrustBadge['status']>(['pass', 'warning', 'fail']);
const allowedReportLevels = new Set<ShareableReport['checklist']['level']>([
  'share-ready',
  'review-needed',
  'not-shareable'
]);

const root = document.querySelector<HTMLDivElement>('#app');

if (!root) {
  throw new Error('App root not found');
}

const app = root;

function formatKrw(value: number): string {
  return new Intl.NumberFormat('ko-KR').format(value);
}

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttr(value: unknown): string {
  return escapeHtml(value).replaceAll('`', '&#96;');
}

function safeBadgeStatus(status: TrustBadge['status']): TrustBadge['status'] {
  return allowedBadgeStatuses.has(status) ? status : 'warning';
}

function safeReportLevel(level: ShareableReport['checklist']['level']): ShareableReport['checklist']['level'] {
  return allowedReportLevels.has(level) ? level : 'review-needed';
}

function safeExternalUrl(value: string): string | null {
  try {
    const url = new URL(value);

    if (url.protocol !== 'https:' || !allowedFallbackHosts.has(url.hostname)) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function statusLabel(status: TrustBadge['status']): string {
  return status === 'pass' ? '통과' : status === 'warning' ? '검토' : '실패';
}

function renderBadge(badge: TrustBadge): string {
  const status = safeBadgeStatus(badge.status);

  return `
    <article class="badge-card ${escapeAttr(status)}">
      <div class="badge-row">
        <strong>${escapeHtml(badge.label)}</strong>
        <span>${escapeHtml(statusLabel(status))}</span>
      </div>
      <p>${escapeHtml(badge.summary)}</p>
      <small>${escapeHtml(badge.evidence)}</small>
    </article>
  `;
}

function renderReport(report: ShareableReport, scenario: DemoScenario): string {
  const passCount = report.checklist.badges.filter((badge) => badge.status === 'pass').length;
  const txLinks = getFallbackTxLinks(report.escrow).map(safeExternalUrl).filter((link): link is string => Boolean(link));
  const reportLevel = safeReportLevel(report.checklist.level);

  return `
    <header class="hero-shell">
      <nav class="topbar" aria-label="NomokDon MVP navigation">
        <div class="brand-mark">노목돈 <span>Local MVP</span></div>
        <div class="nav-links">
          <a href="#pass">신뢰 패스</a>
          <a href="#report">리포트</a>
          <a href="#escrow">예약금 보호</a>
          <a href="#profile">프로필</a>
          <a href="#toss">Toss 역할</a>
          <a href="#qa">Q&amp;A</a>
        </div>
      </nav>
      <section class="hero-grid">
        <div>
          <p class="eyebrow">Phase 0: Trust Report + XRP Reservation Escrow Proof</p>
          <h1>목돈이 필요 없다.<br />임대인은 신뢰 근거를 보고 판단합니다.</h1>
          <p class="hero-copy">
            DID/Credential 스타일 증명, 설명 가능한 신뢰 배지, XRPL Testnet-style 예약금 상태,
            월세 이력 해시 앵커를 한 번에 시연하는 로컬 MVP입니다.
          </p>
          <div class="hero-actions">
            <a class="primary-action" href="#report">임대인 리포트 보기</a>
            <a class="secondary-action" href="#toss">Toss/XRPL 경계 보기</a>
          </div>
        </div>
        <aside class="phone-card" aria-label="Toss-like three screen flow preview">
          <div class="phone-step active">1. 주거 신뢰 패스 발급</div>
          <div class="phone-step">2. 임대인 리포트 공유</div>
          <div class="phone-step">3. 예약금 보호 상태 확인</div>
          <p>Vault는 Phase 2. 지금은 보증금을 낮추는 신뢰 리포트와 예약금 Escrow proof가 핵심입니다.</p>
        </aside>
      </section>
    </header>

    <main>
      <section id="pass" class="panel-grid two-col">
        <div class="section-heading">
          <p class="eyebrow">Flow 1</p>
          <h2>주거 신뢰 패스 발급</h2>
          <p>Mock 임차인/매물 데이터로 DID와 Credential 스타일 증명을 만들고, 여권/전화번호 원문은 저장하지 않습니다.</p>
        </div>
        <article class="proof-card">
          <dl>
            <div><dt>임차인</dt><dd>${escapeHtml(report.tenantLabel)}</dd></div>
            <div><dt>DID</dt><dd>${escapeHtml(report.proof.did)}</dd></div>
            <div><dt>Credential</dt><dd>${escapeHtml(report.proof.credentialId)}</dd></div>
            <div><dt>개인정보 해시</dt><dd>${escapeHtml(shortHash(report.proof.subjectHash))}</dd></div>
            <div><dt>발급자</dt><dd>${escapeHtml(report.proof.issuer)}</dd></div>
          </dl>
        </article>
      </section>

      <section id="report" class="panel-grid">
        <div class="section-heading wide">
          <p class="eyebrow">Flow 2</p>
          <h2>임대인 공유 리포트</h2>
          <p>블랙박스 AI 점수 대신 항목별 근거를 공개합니다. 배지가 왜 통과/검토/실패인지 임대인이 바로 읽을 수 있습니다.</p>
        </div>
        <div class="report-shell">
          <div class="report-summary">
            <span class="level ${escapeAttr(reportLevel)}">${escapeHtml(report.checklist.headline)}</span>
            <h3>${escapeHtml(scenario.property.landlordName)}님에게 공유할 리포트</h3>
            <p>${escapeHtml(scenario.property.title)} · 월세 ${escapeHtml(formatKrw(scenario.property.monthlyRentKrw))}원 · 월세 부담률 ${escapeHtml(report.checklist.rentBurdenRate)}%</p>
            <strong>${escapeHtml(passCount)}/${escapeHtml(report.checklist.badges.length)}개 신뢰 배지 통과</strong>
          </div>
          <div class="badge-grid">
            ${report.checklist.badges.map(renderBadge).join('')}
          </div>
        </div>
      </section>

      <section id="escrow" class="panel-grid two-col reverse">
        <div class="section-heading">
          <p class="eyebrow">Flow 3</p>
          <h2>예약금 보호</h2>
          <p>이 화면은 XRPL proof/state와 실제 KRW 이동을 명확히 구분합니다. 로컬 MVP는 실제 자금 이동 없이 fallback TX 링크를 제공합니다.</p>
        </div>
        <article class="escrow-card">
          <div class="escrow-state">${escapeHtml(report.escrow.state.toUpperCase())}</div>
          <dl>
            <div><dt>기존 보증금</dt><dd>${escapeHtml(formatKrw(scenario.property.originalDepositKrw))}원</dd></div>
            <div><dt>노목돈 제안 보증금</dt><dd>${escapeHtml(formatKrw(scenario.property.reducedDepositKrw))}원</dd></div>
            <div><dt>예약금 KRW</dt><dd>${escapeHtml(formatKrw(scenario.property.reservationAmountKrw))}원 (실제 이동 없음)</dd></div>
            <div><dt>XRPL proof</dt><dd>${escapeHtml(report.escrow.amountXrp)} XRP · ${escapeHtml(report.escrow.ledger)}</dd></div>
            <div><dt>Memo hash</dt><dd>${escapeHtml(shortHash(report.escrow.memoHash))}</dd></div>
          </dl>
          <div class="link-row">
            ${txLinks
              .map(
                (link, index) =>
                  `<a href="${escapeAttr(link)}" target="_blank" rel="noreferrer">Fallback TX ${escapeHtml(index + 1)}</a>`
              )
              .join('')}
          </div>
          <p class="safety-note">${escapeHtml(report.escrow.caveat)}</p>
        </article>
      </section>

      <section id="profile" class="panel-grid two-col">
        <div class="section-heading">
          <p class="eyebrow">Flow 4</p>
          <h2>월세 이력/프로필</h2>
          <p>월세 원장 원본 대신 납부 상태와 금액만 해시 앵커로 묶어 주거 신용 프로필 카드에 표시합니다.</p>
        </div>
        <article class="profile-card">
          <div class="avatar-orbit">ND</div>
          <div>
            <h3>${escapeHtml(scenario.tenant.displayName)}</h3>
            <p>${escapeHtml(scenario.tenant.visaType)} · ${escapeHtml(scenario.tenant.schoolOrEmployer)}</p>
            <div class="profile-metrics">
              <span>${escapeHtml(scenario.rentHistory.length)}개월 이력</span>
              <span>${escapeHtml(shortHash(report.rentAnchorHash))}</span>
            </div>
            <ol class="payment-list">
              ${scenario.rentHistory
                .map(
                  (payment) => `
                    <li>
                      <span>${escapeHtml(payment.paidAt)}</span>
                      <strong>${escapeHtml(formatKrw(payment.amountKrw))}원</strong>
                      <em class="${escapeAttr(payment.status)}">${escapeHtml(payment.note)}</em>
                    </li>
                  `
                )
                .join('')}
            </ol>
          </div>
        </article>
      </section>

      <section id="toss" class="panel-grid">
        <div class="section-heading wide">
          <p class="eyebrow">Toss Strategy</p>
          <h2>Toss는 쉬운 금융 UX와 운영 경계, XRPL은 검증 가능한 상태</h2>
          <p>노목돈 Phase 0은 Web 중심 앱입니다. Toss UX는 임차인이 동의하고, 임대인에게 리포트를 보내고, 파트너가 실제 돈의 경계를 처리하는 3-screen 흐름으로 고려합니다.</p>
        </div>
        <div class="value-grid">
          <article><strong>Simple UX</strong><p>복잡한 DID, Credential, Escrow 용어를 “신뢰 패스 발급 → 리포트 공유 → 예약금 보호 확인”으로 단순화합니다.</p></article>
          <article><strong>Consent</strong><p>여권·전화번호 원문이 아니라 해시와 요약 배지만 공유하고, 임차인이 공유 목적을 이해한 뒤 리포트를 전달합니다.</p></article>
          <article><strong>Partner Routing</strong><p>실제 KRW 결제·정산·보증은 Toss/은행/보증보험/중개사 같은 규제권 파트너가 처리하는 경계로 둡니다.</p></article>
          <article><strong>Report Distribution</strong><p>임대인은 블록체인을 몰라도 리포트를 보고 판단하고, 필요하면 fallback explorer 링크로 XRPL 상태를 확인합니다.</p></article>
        </div>
      </section>

      <section id="qa" class="panel-grid qa-section">
        <div class="section-heading wide">
          <p class="eyebrow">Judging Q&amp;A</p>
          <h2>심사 질문에 바로 답하는 경계</h2>
        </div>
        <div class="qa-list">
          <article><strong>DB로도 되지 않나?</strong><p>리포트 UI는 DB로도 만들 수 있지만, 예약금 Escrow 상태는 XRPL이 제3자 검증 가능한 잠금 proof를 제공합니다.</p></article>
          <article><strong>RLUSD를 Escrow에 넣을 수 있나?</strong><p>현재 TokenEscrow 한계가 있어 Phase 0은 XRP Escrow proof/fallback으로 시연하고, RLUSD는 일반 Payment 이력/앵커 방향으로 분리합니다.</p></article>
          <article><strong>금융상품/규제 경계는?</strong><p>이 MVP는 투자자 모집, 수익 약속, 자금 풀링을 하지 않습니다. 실제 KRW 이동은 Toss/규제권 파트너 영역입니다.</p></article>
          <article><strong>누가 Credential 발급자인가?</strong><p>Phase 0은 NomokDon Local Issuer가 mock 검증값을 발급합니다. 운영 단계에서는 출입국·학교·고용·파트너 기관 발급으로 확장합니다.</p></article>
          <article><strong>임대인이 왜 믿나?</strong><p>블랙박스 점수가 아니라 비자, 고용/재학, 월세 부담률, 예약금 상태, 납부 이력 배지를 근거와 함께 공유하기 때문입니다.</p></article>
        </div>
      </section>

      <section class="panel-grid edge-cases">
        <div class="section-heading wide">
          <p class="eyebrow">Safety Check</p>
          <h2>엣지 케이스도 배지가 강등됩니다</h2>
          <p>만료 비자나 과도한 월세 부담은 공유 가능한 리포트로 포장하지 않습니다.</p>
        </div>
        <div id="edge-output" class="edge-output" aria-live="polite"></div>
        <button id="run-edge-case" class="primary-action" type="button">엣지 케이스 확인</button>
      </section>
    </main>
  `;
}

async function renderEdgeCases(): Promise<void> {
  const expired = await buildShareableReport(createExpiredVisaScenario());
  const highBurden = await buildShareableReport(createHighRentBurdenScenario());
  const output = document.querySelector<HTMLDivElement>('#edge-output');

  if (!output) {
    return;
  }

  output.innerHTML = [
    { title: '비자 만료 시나리오', report: expired },
    { title: '월세 부담 과다 시나리오', report: highBurden }
  ]
    .map(
      ({ title, report }) => `
      <article class="edge-card">
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(report.checklist.headline)}</span>
        <p>${escapeHtml(report.checklist.badges.find((badge) => badge.status === 'fail')?.evidence ?? '실패 배지 없음')}</p>
      </article>
    `
    )
    .join('');
}

async function bootstrap(): Promise<void> {
  const report = await buildShareableReport(demoScenario);
  app.innerHTML = renderReport(report, demoScenario);
  document.querySelector('#run-edge-case')?.addEventListener('click', () => {
    void renderEdgeCases();
  });
}

void bootstrap();
