# 노목돈(NomokDon) 구현 계획서 v1.0

> 기획서 `docs/pitch/nomokdon_pitch_final.md` 기반 실제 코딩 구현 로드맵
> 대상: 3인 팀 / 예선 2주 + 본선 1개월 / TypeScript 풀스택

---

## TL;DR

> **6주 안에 노목돈 Phase 0 데모를 완성한다.** 7단계 데모 시나리오(DID 발급 → Credential → 신뢰 리포트 → Escrow → 월세 RLUSD 결제 → 정산 → 신용 프로필)를 XRPL Testnet 위에서 동작시키고, 임대인이 보는 신뢰 리포트 UI까지 인터랙티브하게 구현.

**Deliverables**
- Next.js 14 (App Router) 프론트엔드 (임차인 앱 + 임대인 리포트 뷰)
- Node.js/TypeScript 백엔드 API (Risk Score 계산, 메타데이터 저장, 트리거)
- XRPL 모듈 (DIDSet, Credential XLS-70, Escrow, MultiSign, Payment)
- AI Risk Score 산출 로직 + 검증 가능한 임대인용 공개 리포트 페이지
- E2E 데모 시나리오 (Testnet TX 링크 포함)

**팀 구성 (3명)**
- A (서버): 백엔드 API, DB, AI Risk Score, 인증 — Web3 비경험 OK
- B (컨트랙트/풀스택, 본인): XRPL 모듈, Escrow/Credential 워크플로우, 통합
- C (컨트랙트/풀스택): Frontend, XRPL 클라이언트 연동, UX/리포트 UI

**Estimated Effort**: Large (6주, 3인 풀타임 가정)
**Critical Path**: XRPL 모듈(B) → API 통합(A+B) → Frontend 워크플로우(C) → 데모 영상

---

## Context

### 프로젝트 정체성
- 노목돈은 "외국인 주거 신뢰 인프라"다. "예약금 = XRPL Escrow"가 핵심 차별점이며, DB로 절대 대체 불가능.
- Phase 0 (해커톤): Vault 없음. 신뢰 리포트 + 예약금 Escrow + 월세 결제 이력.
- 발표 임팩트의 80%는 임대인이 보는 신뢰 리포트 + 온체인 TX 링크 직접 클릭 시연.

### 기획서에서 확정된 핵심 기능 (Section 11 데모 스펙)
1. DID 생성 + 비자 Credential 발급 (DIDSet + Credential XLS-70)
2. 외국인 월세 신뢰 리포트 생성 (AI Risk Score)
3. 예약금 Escrow 생성 (XRP Testnet)
4. 월세 납부 (RLUSD 일반 Payment)
5. 계약 종료 → EscrowFinish/Cancel (MultiSign)
6. 온체인 TX 링크 표시 (Explorer)
7. 주거 신용 프로필 카드 조회

### 기술적 제약 인식
- TokenEscrow(XLS-85) 미활성화 → Escrow는 XRP로 구현, RLUSD는 일반 Payment로만
- Hooks 미배포 → 자동화는 오프체인 트리거 + MultiSign
- 명도 확인 오라클 부재 → 중개사+플랫폼 2-of-2 MultiSign

---

## 기술 스택 결정

| 계층 | 기술 | 선정 이유 |
|------|------|----------|
| Language | TypeScript (전 영역) | 팀 통일성, xrpl.js 공식 SDK가 TS |
| Frontend | Next.js 14 (App Router) + React | 임대인 공개 리포트 SSR 필요 |
| UI | Tailwind CSS + shadcn/ui | 6주 안에 신뢰감 있는 UI 빠르게 |
| Backend | Node.js + Fastify (또는 Next.js Route Handlers) | A 친숙도 우선 |
| DB | PostgreSQL (Supabase 권장) + Prisma ORM | 인증/Storage 한방 해결 |
| Blockchain | xrpl.js v3+ (Testnet) | 공식 SDK |
| 인증 | NextAuth.js (Google + 이메일) | 빠른 구현 |
| AI Risk Score | 결정론적 가중 연산 (Phase 0) | LLM 불필요. 규칙 기반 |
| State | Zustand (Frontend), DB (Backend) | Redux는 오버엔지니어링 |
| Validation | Zod (전 영역 공유) | API 계약 + Form 검증 통일 |
| Testing | Vitest + Playwright (E2E 데모용) | |
| Deploy | Vercel + Supabase | |
| Monorepo | Turborepo + pnpm workspaces | 패키지 분리 깔끔 |

---

## 레포지토리 구조

```
XRP_hack_Pocky/
├── apps/
│   ├── web/                    # Next.js 14 — 임차인 앱 + 임대인 리포트 뷰
│   │   ├── app/
│   │   │   ├── (tenant)/
│   │   │   │   ├── onboarding/ # DID/Credential 발급
│   │   │   │   ├── listings/   # 매물 목록 (목업)
│   │   │   │   ├── contract/   # 계약 + Escrow
│   │   │   │   ├── pay/        # 월세 RLUSD 결제
│   │   │   │   └── profile/    # 주거 신용 프로필
│   │   │   ├── (landlord)/
│   │   │   │   └── verify/[reportId]/  # 임대인용 공개 리포트 (SSR)
│   │   │   └── api/            # Next.js Route Handlers (BFF)
│   │   └── components/
│   └── api/                    # (선택) 분리 백엔드 — Fastify
│       └── src/{routes,services,jobs}/
├── packages/
│   ├── xrpl-core/              # B 담당 — XRPL 추상화 레이어
│   │   └── src/{client,did,credential,escrow,payment,multisign,wallet}.ts
│   ├── risk-score/             # A 담당 — AI Risk Score 엔진
│   │   └── src/{calculator,factors,anchor}.ts
│   ├── shared-types/           # 모두 공유 — Zod 스키마 + 타입
│   │   └── src/{domain,api}/
│   └── ui/                     # shadcn 래핑 컴포넌트
├── docs/
├── .sisyphus/
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

> 모노레포 이유: 컨트랙트(B)와 Frontend(C)가 `xrpl-core` 패키지를 통해 깔끔하게 분리됨. 서버(A)는 `risk-score` + `apps/api`만 만지므로 XRPL 모름이 OK.

---

## 팀 분담 전략

### 분담 원칙
1. A(서버)는 XRPL을 거의 안 만진다. XRPL 호출은 모두 `xrpl-core` 패키지 함수 import 형태로 추상화. A는 함수 시그니처만 보고 사용.
2. B(본인)는 XRPL 코어 + 통합. 모든 온체인 호출의 단일 진입점. 가장 리스키한 영역(Credential, Escrow MultiSign) 책임.
3. C는 Frontend + UX. 임대인 신뢰 리포트가 발표 임팩트의 핵심이므로 가장 시간 투자.
4. 공유 영역: `shared-types`는 셋이 동시 수정. Zod 스키마를 먼저 합의하고 시작.

### A — 백엔드 / DB / Risk Score / 인증
이유: Web3 비경험. XRPL 추상화 뒤에서 안전하게 작업.

책임 영역
- `apps/api` 또는 Next.js Route Handlers 전체 (선택은 A가)
- `packages/risk-score` 전체
- `packages/shared-types` 의 도메인 모델 초안
- DB 스키마 (Prisma) + 마이그레이션
- 인증 (NextAuth.js) — Google OAuth + 이메일
- 비자 만료 cron 스켈레톤 (트리거는 B와 협업)
- 고용보험 API 모킹 데이터 (실 API는 데모 범위 밖)
- Risk Score 산식 설계 (factor 가중치, 정규화)

필수 산출물
- REST API 엔드포인트 ~12개
- Risk Score 결정론적 알고리즘 + 단위 테스트
- DB ERD 문서

### B — XRPL 코어 / 컨트랙트 워크플로우 / 통합 (본인)
책임 영역
- `packages/xrpl-core` 전체
- DID/Credential 발급 플로우 (issuer 지갑 운영 포함)
- Escrow 생성 + MultiSign 정산 로직
- RLUSD Payment 발신 + 트랜잭션 해시 추적
- 데모 5번(EscrowFinish/Cancel) MultiSign 코디네이션
- A의 API ↔ XRPL 통합
- Testnet 지갑 관리 (issuer / platform / co-signer)
- XRPL Explorer 링크 생성 헬퍼

필수 산출물
- xrpl-core 함수 12개 + 테스트
- Testnet 데모 지갑 4개 (issuer, platform, tenant 샘플, landlord 샘플)
- 발표용 시연 스크립트

### C — Frontend / 임대인 리포트 / UX
책임 영역
- `apps/web` 전체 (UI/UX)
- 임차인 온보딩 플로우 (DID 생성 → Credential 신청)
- **임대인 공개 리포트 페이지 `/verify/[reportId]` — 최우선 임팩트 산출물**
- 주거 신용 프로필 카드 (`demo/nomokdon_profile_card.html` 참고하되 React 재구현)
- xrpl-core 클라이언트 사이드 호출 래퍼 (지갑 서명이 필요한 부분)
- 디자인 시스템 (Tailwind + shadcn 컴포넌트 셋업)
- 데모 영상용 시나리오 페이지 흐름 정리

필수 산출물
- 8~10개 페이지
- 임대인 리포트 페이지가 모바일에서도 완벽
- 발표용 데모 영상 시나리오 페이지 단계 매핑

---

## 6주 스프린트 로드맵

### Week 1 (예선 1주차) — 기반 구축
목표: 모두가 작업할 수 있는 인프라 + 첫 XRPL 트랜잭션 성공

| 일자 | A (서버) | B (XRPL/본인) | C (Frontend) |
|------|---------|--------------|-------------|
| D1 | 모노레포 셋업 (Turborepo, pnpm) | Testnet 지갑 4개 발급, faucet 충전 | Next.js 14 앱 셋업, Tailwind+shadcn |
| D2 | Prisma 스키마 v1 (User, Contract, Report, Payment) | xrpl.Client 싱글톤 + 기본 헬퍼 | 라우팅 구조 + 디자인 토큰 |
| D3 | shared-types Zod 스키마 합의 (3인 회의) | DIDSet 트랜잭션 성공 (Testnet) | 온보딩 페이지 스켈레톤 |
| D4 | NextAuth 셋업 + DB 연결 | Credential 발급(issuer) + Accept(holder) | 매물 목록 페이지 (목업) |
| D5 | API: `/api/users`, `/api/credentials/request` | Escrow Create/Finish 단위 테스트 | 임대인 리포트 페이지 v0 (정적) |
| D6-7 | Risk Score v1 (간단한 가중 평균) | A의 credentials API와 통합 | 매물 → 계약 플로우 UI |

Week 1 종료 기준
- [ ] 셋이 PR을 서로 리뷰하며 머지 가능
- [ ] Testnet에서 DID 1건 + Credential 1건 발급 성공 (Explorer 링크 확인)
- [ ] 첫 화면이 떠있고 로그인 가능

### Week 2 (예선 2주차) — 핵심 데모 7단계 동작
목표: 7단계 시나리오 모두 testnet에서 end-to-end 성공

| 일자 | A | B | C |
|------|---|---|---|
| D8 | API: `/api/contracts`, `/api/reports/[id]` | Escrow API 통합 + 트리거 큐 | 계약 페이지 + Escrow 시각화 |
| D9 | Risk Score 가중치 튜닝 + 온체인 해시 앵커 | RLUSD Payment 헬퍼 | 월세 결제 UI |
| D10 | 월세 결제 이력 API + 해시 기록 | MultiSign 시나리오 코디 | 주거 신용 프로필 카드 |
| D11 | 비자 만료 cron 스켈레톤 | EscrowFinish (다중서명) 성공 | 임대인 리포트 페이지 완성도 ↑ |
| D12 | 통합 테스트 셋업 | 7단계 시나리오 통합 스크립트 | 데모 시나리오 페이지 흐름 |
| D13 | 버그 픽스 + API 문서 | 시연 리허설 1회 | 데모 영상 1차 촬영 |
| D14 | 예선 제출일 — 발표 자료 + 데모 영상 마무리 | | |

Week 2 종료 기준 (예선 제출 기준선)
- [ ] 7단계 시나리오 모두 Testnet TX 링크 동반하여 성공
- [ ] 임대인 리포트 페이지에서 검증 링크 클릭 시 XRPL Explorer로 이동
- [ ] 데모 영상 3분 이내, 발표 자료 완성

### Week 3-4 (본선 1-2주차) — 깊이 + 안정성
- A: Risk Score 알고리즘 고도화, API 에러 핸들링/로깅, 통합 테스트
- B: TokenEscrow 활성화 시 즉시 전환 가능한 abstraction layer, 비자 만료 자동 트리거 워커
- C: 모바일 반응형 완성, 임차인 온보딩 UX 다듬기, 다국어(영어 최소) 지원

### Week 5-6 (본선 3-4주차) — 차별화 + 발표 준비
- A: Phase 2 Vault 모킹 화면용 API (DepositPreauth 시뮬), KPI 대시보드
- B: Cross-Currency Payment PoC (보증금 본국 송금 데모), 보안 점검
- C: 발표용 시연 페이지 폴리싱, 임대인 vs 임차인 split-screen 데모 모드, 데모 영상 V2

---

## API 명세 (A 담당)

| Method | Path | 설명 | xrpl-core 사용 |
|--------|------|------|---------------|
| POST | `/api/auth/*` | NextAuth 핸들러 | - |
| POST | `/api/users` | 사용자 등록 | - |
| POST | `/api/users/:id/did` | DID 발급 요청 | `xrplCore.did.create()` |
| POST | `/api/credentials/request` | Credential 발급 요청 | `xrplCore.credential.issue()` |
| POST | `/api/credentials/:id/accept` | 사용자가 Credential Accept | `xrplCore.credential.accept()` |
| GET | `/api/listings` | 매물 목록 (목업) | - |
| POST | `/api/contracts` | 계약 생성 + Escrow 트리거 | `xrplCore.escrow.create()` |
| GET | `/api/contracts/:id` | 계약 상세 (Escrow 상태 포함) | `xrplCore.escrow.lookup()` |
| POST | `/api/contracts/:id/finish` | 계약 종료 → MultiSign 정산 | `xrplCore.escrow.finish()` |
| POST | `/api/payments/rent` | 월세 RLUSD 결제 | `xrplCore.payment.send()` |
| GET | `/api/reports/:id` | 신뢰 리포트 (Risk Score 포함) | `xrplCore.credential.lookup()` |
| GET | `/api/profiles/:userId/credit` | 주거 신용 프로필 | DB only |

---

## XRPL 모듈 함수 시그니처 (B 담당, A의 호출용 계약)

```typescript
// packages/xrpl-core/src/index.ts

export interface DidModule {
  create(params: { account: Wallet; documentHash: string }): Promise<TxResult>;
  lookup(account: string): Promise<DidRecord | null>;
}

export interface CredentialModule {
  issue(params: {
    issuer: Wallet;
    subject: string;
    credentialType: 'VISA' | 'EMPLOYMENT';
    expiration: Date;
    uri: string;
  }): Promise<TxResult>;
  accept(params: { holder: Wallet; issuer: string; credentialType: string }): Promise<TxResult>;
  lookup(subject: string): Promise<CredentialRecord[]>;
}

export interface EscrowModule {
  create(params: {
    sender: Wallet;
    destination: string;
    amountXrp: string;
    finishAfter?: Date;
    cancelAfter?: Date;
    condition?: string;
  }): Promise<{ tx: TxResult; sequence: number }>;
  finish(params: { signers: Wallet[]; owner: string; sequence: number }): Promise<TxResult>;
  cancel(params: { signers: Wallet[]; owner: string; sequence: number }): Promise<TxResult>;
  lookup(owner: string, sequence: number): Promise<EscrowState>;
}

export interface PaymentModule {
  send(params: {
    sender: Wallet;
    destination: string;
    amount: { currency: 'XRP' } | { currency: 'RLUSD'; issuer: string; value: string };
    memo?: string;
  }): Promise<TxResult>;
}

export interface MultisignModule {
  setupSignerList(params: { account: Wallet; signers: { account: string; weight: number }[]; quorum: number }): Promise<TxResult>;
  combine(signedTxBlobs: string[]): string;
}

export type TxResult = {
  hash: string;
  ledgerIndex: number;
  explorerUrl: string;
  result: 'tesSUCCESS' | string;
};
```

계약: A는 위 인터페이스만 보고 호출. 내부 구현은 B가 자유롭게 변경 가능 (시그니처는 동결).

---

## DB 스키마 v1 (A 담당, 3인 합의)

```prisma
model User {
  id             String   @id @default(cuid())
  email          String   @unique
  visaType       String?
  passportHash   String?
  xrplAddress    String?
  didTxHash      String?
  createdAt      DateTime @default(now())
}

model Credential {
  id            String   @id @default(cuid())
  userId        String
  type          String
  issuerAddress String
  expirationAt  DateTime
  txHash        String
  acceptedAt    DateTime?
  uri           String
  user          User     @relation(fields: [userId], references: [id])
}

model Listing {
  id           String   @id @default(cuid())
  title        String
  monthlyRent  Int
  depositKrw   Int
  landlordName String
}

model Contract {
  id              String   @id @default(cuid())
  tenantId        String
  listingId       String
  monthlyRentRlusd String
  escrowOwner     String
  escrowSequence  Int
  escrowAmountXrp String
  status          String
  startedAt       DateTime
  endedAt         DateTime?
}

model RentPayment {
  id          String   @id @default(cuid())
  contractId  String
  amountRlusd String
  txHash      String
  paidAt      DateTime @default(now())
}

model TrustReport {
  id           String   @id @default(cuid())
  userId       String
  score        Int
  factors      Json
  anchorTxHash String?
  publicSlug   String   @unique
  createdAt    DateTime @default(now())
}
```

---

## TODOs (작업 단위 분해)

> 각 작업은 1-2일 단위. 담당자 + 의존성 + 완료 기준 명시.

- [ ] **T1 [A]** 모노레포 셋업: pnpm + Turborepo + 3개 패키지 + 2개 앱 골격
  - 완료: `pnpm dev`로 web 앱이 뜨고, `xrpl-core`와 `shared-types` 패키지가 import됨
  - 의존성: 없음

- [ ] **T2 [A]** Prisma 스키마 v1 + Supabase 연결 + 시드 데이터
  - 완료: 마이그레이션 통과, seed로 매물 5개 생성
  - 의존성: T1

- [ ] **T3 [A,B,C]** `shared-types` Zod 스키마 합의 (3인 회의 1시간)
  - 완료: 도메인 타입(User, Contract, Report, TxResult) 동결 + tsc 통과
  - 의존성: T1

- [ ] **T4 [B]** Testnet 지갑 4개 발급(issuer/platform/tenant/landlord) + faucet + .env 정리
  - 완료: 지갑 주소 4개 + 시드 4개를 `.env.local`로 공유 (gitignore)
  - 의존성: T1

- [ ] **T5 [B]** `xrpl-core/client.ts` + 기본 헬퍼(주소 검증, Explorer URL 생성)
  - 완료: `getClient()` 호출로 testnet 연결, ledger index 가져오기 성공
  - 의존성: T4

- [ ] **T6 [C]** Next.js 앱 셋업: 라우팅 + Tailwind + shadcn/ui + 디자인 토큰
  - 완료: `/`, `/onboarding`, `/listings`, `/verify/[id]` 4개 페이지 빈 껍데기
  - 의존성: T1

- [ ] **T7 [C]** NextAuth + 인증 페이지 (Google + Email 매직링크)
  - 완료: 로그인/로그아웃 동작, 세션이 API에 전달
  - 의존성: T2, T6

- [ ] **T8 [B]** `xrpl-core/did.ts` DIDSet 트랜잭션
  - 완료: 단위 테스트로 testnet에 DID 1건 발급, lookup 성공
  - 의존성: T5

- [ ] **T9 [B]** `xrpl-core/credential.ts` Credential Issue + Accept (XLS-70)
  - 완료: issuer가 발급 → tenant가 accept → lookup으로 확인
  - 의존성: T8

- [ ] **T10 [B]** `xrpl-core/escrow.ts` Create/Finish/Cancel (XRP 기반)
  - 완료: timeAfter 조건 Escrow 생성 → Finish 성공
  - 의존성: T5

- [ ] **T11 [B]** `xrpl-core/payment.ts` RLUSD 일반 Payment + memo 해시
  - 완료: tenant → landlord에게 RLUSD 1 전송 성공 (TrustLine 자동 셋업 포함)
  - 의존성: T5

- [ ] **T12 [B]** `xrpl-core/multisign.ts` SignerList 셋업 + sign combine
  - 완료: 2-of-2 (platform + 중개사) MultiSign으로 EscrowFinish 성공
  - 의존성: T10

- [ ] **T13 [A]** API: `/api/users`, `/api/users/:id/did` (xrpl-core 호출)
  - 완료: 회원가입 후 DID 발급 트리거 → DB에 txHash 저장
  - 의존성: T2, T8

- [ ] **T14 [A]** API: `/api/credentials/request` + `/api/credentials/:id/accept`
  - 완료: 비자 정보 입력 → Credential 발급 → DB 저장
  - 의존성: T9, T13

- [ ] **T15 [A]** `risk-score/calculator.ts` 가중 연산 (5개 factor)
  - factor: 비자 잔여기간, 소득 대비 월세, 고용보험 가입, 과거 납부 횟수, 체류 안정성
  - 완료: 단위 테스트 12개 통과, 결정론적
  - 의존성: T3

- [ ] **T16 [A]** `risk-score/anchor.ts` Risk Score 결과 → 해시 → 온체인 Memo로 앵커링
  - 완료: Risk Score JSON 해시 1개 testnet에 anchor TX로 기록
  - 의존성: T11, T15

- [ ] **T17 [A]** API: `/api/reports/:id` 신뢰 리포트 생성 + 공개 슬러그 발급
  - 완료: 리포트 ID 받으면 점수+근거+TX 링크 JSON 반환
  - 의존성: T15, T16

- [ ] **T18 [C]** 임차인 온보딩 페이지: 비자 정보 입력 → DID/Credential 발급 진행 표시
  - 완료: 4단계 위저드, 각 단계 testnet TX 링크 표시
  - 의존성: T13, T14, T7

- [ ] **T19 [C]** 매물 목록 + 상세 + "신뢰 리포트 만들기" 버튼
  - 완료: 매물 5개 카드 → 상세 → 리포트 생성
  - 의존성: T2, T17

- [ ] **T20 [C]** 🔥 임대인 공개 리포트 페이지 `/verify/[publicSlug]` (SSR) — 발표 핵심 산출물
  - 완료: 검증 링크 클릭 시 임차인 신뢰도, 비자 상태, Escrow 잠금, TX 링크 5개 표시. 모바일 완벽.
  - 의존성: T17

- [ ] **T21 [A,B]** API: `/api/contracts` 생성 시 Escrow 트리거 통합
  - 완료: 계약 POST → Escrow 생성 → Contract DB 레코드에 sequence 저장
  - 의존성: T10, T13

- [ ] **T22 [C]** 계약 페이지 + Escrow 상태 시각화 (잠금/해제 애니메이션)
  - 완료: Escrow 잠금 상태가 실시간 폴링으로 갱신
  - 의존성: T21

- [ ] **T23 [A,B]** API: `/api/payments/rent` + 월세 결제 페이지 통합
  - 완료: 결제 버튼 → RLUSD payment → DB 기록 → UI에 TX 링크
  - 의존성: T11

- [ ] **T24 [A,B]** API: `/api/contracts/:id/finish` MultiSign EscrowFinish
  - 완료: 종료 트리거 → 2-of-2 서명 → finish TX → DB status 갱신
  - 의존성: T12, T21

- [ ] **T25 [C]** 주거 신용 프로필 카드 페이지 (React 재구현)
  - 완료: 납부 횟수, Credential 상태, Risk Score 추이 표시
  - 의존성: T17, T23

- [ ] **T26 [B]** 7단계 통합 시연 스크립트 (TypeScript): 한 번 실행으로 모든 TX 발생
  - 완료: `pnpm demo:run` 1번에 7단계 모두 testnet에 기록
  - 의존성: T8-T12, T21-T24

- [ ] **T27 [C]** 데모 영상 시나리오 페이지 흐름 정리 + 1차 촬영
  - 완료: 3분 영상 초안
  - 의존성: T26, T20, T22, T25

- [ ] **T28 [A,B,C]** 통합 QA + 버그 픽스 라운드 (D13)
  - 완료: 셋이 서로의 영역을 한 번씩 시연하며 깨지는 것 다 잡기

- [ ] **T29 [전원]** 예선 제출 패키지 (D14): README, 영상, 발표 자료, 데모 링크

### 본선 추가 작업 (Week 3-6)

- [ ] **T30 [B]** TokenEscrow 마이그레이션 추상화 — 활성화 시 1줄 변경으로 RLUSD Escrow 전환
- [ ] **T31 [A]** 비자 만료 cron 워커 + 알림 시스템
- [ ] **T32 [C]** 모바일 반응형 + 영어 i18n
- [ ] **T33 [A]** Phase 2 Vault 데모용 모킹 (DepositPreauth UI 시뮬레이션)
- [ ] **T34 [B]** Cross-Currency Payment PoC (보증금 → 본국 송금)
- [ ] **T35 [전원]** 본선 발표 리허설 3회 + 영상 V2

---

## 통합 체크포인트 (반드시 지킬 것)

| 시점 | 체크 항목 | 책임 |
|------|----------|------|
| D3 종료 | shared-types Zod 스키마 동결 (이후 변경은 3인 합의) | 전원 |
| D5 종료 | xrpl-core 인터페이스 동결 — A가 mock으로 API 작업 시작 가능 | B |
| D7 종료 | Week 1 통합 시연 (DID + Credential 발급까지) | 전원 |
| D11 종료 | 7단계 시나리오 중 5번 EscrowFinish까지 통과 | B 주도 |
| D13 | 통합 QA — 셋이 모여 발표 시연 리허설 1회 | 전원 |
| D14 | 예선 제출 | 전원 |
| W4 말 | 본선 중간 리뷰: 어떤 로드맵 항목을 더 깊이 갈지 결정 | 전원 |

---

## 리스크 & 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| A가 XRPL 동작을 이해 못함 | 통합 시 막힘 | T5 종료 시점에 B가 A에게 "xrpl-core 사용법" 30분 강의. mock 함수 제공. |
| Credential XLS-70 사용법 미숙 | T9 지연 | xrpl.js 공식 예제 + Devnet 우선 테스트. Devnet 확인 후 Testnet 옮김. |
| MultiSign EscrowFinish 실패 | 데모 5단계 실패 | Week 1에 단순 EscrowFinish(단일 서명) 먼저 성공 → Week 2에 MultiSign 추가. |
| TokenEscrow 미활성화 → 심사 질문 | 발표 시 흔들림 | 기획서 Section 3 답변 + 추상화 코드(T30)로 "활성화 즉시 전환" 시연 |
| Risk Score 산식이 너무 단순 | 발표 임팩트 약함 | factor 5개로 충분. "왜 이 가중치인가" 1페이지 정당화 문서 작성. |
| 임대인 리포트 UI가 안 예쁨 | 발표 임팩트 약함 (가장 큰 리스크) | C가 D5부터 시작. shadcn 테마 활용. 외부 디자이너 친구 1명 리뷰 필수. |
| 3인 통합 시 머지 충돌 | 시간 증발 | 패키지로 영역 격리 (`xrpl-core` B만, `risk-score` A만). 공유는 `shared-types`만. |
| Testnet 다운/지갑 비활성화 | 데모 당일 사고 | 백업 지갑 셋트 1개 추가 준비. 데모 전날 다시 충전. |

---

## 발표 시연 시나리오 (Phase 0 7단계)

> 이게 최종 산출물의 형태. T26에서 자동화하고, 발표 당일엔 클릭 1번에 시연.

```
1. [임차인 화면] 김몽골 (E-9, 캄보디아 출신) 회원가입 → DID 생성
   → "DIDSet TX: testnet.xrpl.org/transactions/ABC..." 클릭 가능

2. [임차인 화면] 비자 정보 입력 → "비자 Credential 발급 요청"
   → issuer 지갑이 Credential 발급 → 임차인이 Accept
   → "Credential TX: testnet.xrpl.org/transactions/DEF..."

3. [임차인 화면] 매물 선택 → "월세 신뢰 리포트 만들기"
   → Risk Score 82/100 산출 → 해시 온체인 anchor
   → 임대인용 공유 링크 생성 (/verify/abc123)

4. [임대인 화면 split] 공유 링크 클릭 → 신뢰 리포트 페이지 표시
   → 5개 검증 항목 + Explorer 링크 5개 → 임대인이 직접 클릭해서 검증
   → "이 외국인을 받아도 되는 이유" 5줄

5. [임차인 화면] 계약 체결 → 예약금 200만원 상당 XRP Escrow 잠금
   → "EscrowCreate TX: ..." + UI에 자물쇠 아이콘 잠금

6. [임차인 화면] 1개월 후 시뮬레이션 → 월세 50만원 RLUSD 결제
   → "Payment TX: ..." + 주거 신용 프로필에 +1 기록

7. [임차인+임대인 화면] 계약 종료 → MultiSign 2-of-2 → EscrowFinish
   → "EscrowFinish TX: ..." + 자물쇠 해제 애니메이션
   → 주거 신용 프로필 최종 상태: 납부 12회, Risk Score 88, Credential 유효
```

---

## 성공 기준 (Definition of Done)

### 예선 제출 (D14)
- [ ] 7단계 데모 시나리오 모두 testnet에서 동작
- [ ] 임대인 공개 리포트 페이지 모바일 동작
- [ ] 데모 영상 3분 이내
- [ ] README setup 5분 이내 가능
- [ ] 발표 자료 + Q&A 답변 (기획서 Section 14 기반) 정리

### 본선 (W6 말)
- [ ] 위 모두 + TokenEscrow 추상화 + Phase 2 Vault 모킹 + i18n
- [ ] 심사위원 14개 예상 질문 답변 영상 또는 슬라이드
- [ ] 외부 1인이 "리포트 페이지만 보고 무엇인지 이해" 통과

---

## Commit / 브랜치 전략

- `main` 보호. PR + 1리뷰 머지.
- 브랜치: `feat/<package>/<short>` 예) `feat/xrpl-core/credential-issue`
- 커밋: Conventional Commits (`feat(xrpl-core): add credential issue helper`)
- 태그: `v0.1.0-prelim` (예선), `v1.0.0-finals` (본선)

---

## 다음 액션

1. 오늘: 이 계획서 3인이 같이 30분 리뷰 → 의견 반영
2. D1 시작 시: T1, T4, T6 동시 시작
3. D3 회의: shared-types Zod 스키마 합의 (1시간)
4. 매주 월요일: 30분 진척 리뷰 + 위험 점검

---

> 핵심 메시지 (구현 관점): 이 프로젝트의 발표 임팩트는 "임대인이 공유 링크 클릭 → Explorer TX 직접 검증" 하나에 모인다. 모든 작업은 그 1초의 클릭이 매끄럽게 동작하기 위한 빌드업이다.
