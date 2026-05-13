# NomokDon — 해커톤 구현 플랜 v2

> v1 (Next.js + Express + Supabase 풀스택 안)은 5각 적대적 검토(Oracle×3 + Librarian + Toss 전략) 결과 해커톤 일정 내 출시 불가로 판정됨. 본 v2는 검토 결과와 사용자 결정사항을 반영한 채택 안.
> v1 폐기 사유와 v2 채택 근거는 `## 11. v1 vs v2` 섹션 참조.

---

## 1. TL;DR

- **목표**: XRPL DID + Credential + (time-based) Escrow로 재한 외국인 주거 신뢰를 증명하는 데모를 해커톤 일정 내 출시
- **스택**: Vite + TypeScript (기존 유지) + xrpl.js + 미니 Node API 1개
- **화면**: 3개 분리 SPA (임차인 모바일웹 / 임대인 verify / Issuer 운영 콘솔)
- **Custody**: 풀 서버 custody + disposable Testnet wallet (Phase 2에 Regular Key 마이그레이션)
- **Toss 시너지**: 임차인 앱에 토스 모바일 디자인 언어 적용 + "Toss App-in-App에 탑재된 모습" 모의 화면 1장
- **데모**: Testnet 사전 서밋 + 라이브 표시. 시나리오 1 happy + 1 edge fallback + 녹화본
- **배포**: Vercel (자동). 별도 CI workflow 없음

---

## 2. 사용자 결정사항 (확정)

| # | 결정 | 내용 |
|---|---|---|
| D1 | 백엔드 | Vite SPA + 미니 Node API (Issuer 서명 전용 단일 파일 또는 Vercel serverless 1~2개) |
| D2 | Custody | 풀 서버 custody + disposable Testnet wallet. Phase 2: Regular Key 또는 Xaman |
| D3 | TX 서밋 | 사전 서밋 + 라이브 표시. 구현 후 데모 직전 최종 결정 |
| D4 | Toss 시너지 | 주거 중심 유지. App-in-App 모의 화면으로 시너지 시연 |
| D5 | 프론트엔드 | 3개 분리 SPA (랜딩 페이지 수준 회피) |
| D6 | 기존 src/ | 도메인 인터페이스만 보존, 구현은 새로 작성 |
| D7 | XRPL API | tech_stack.md + xrpl.js 공식 패턴 사용. v1의 의사코드 교체 |
| D8 | UX/누락 | 인증/세션/상태UX/공유/보호 등 별도 task로 분리 |
| D9 | Toss UI | 토스 모바일 디자인 언어 + App-in-App 모의 화면 |
| D10 | CI | Vercel 자동 배포. 별도 GitHub Actions 없음 |

---

## 3. Must Have / Must NOT Have (가드레일)

### Must Have
1. Testnet에 실제 DIDSet / CredentialCreate / CredentialAccept / EscrowCreate / Payment TX 제출 (사전 또는 라이브)
2. 3개 화면 모두 분리 라우트로 접근 가능 (/, /verify/:id, /issuer)
3. 토스 스타일 모바일 UI (임차인 앱 우선)
4. Toss App-in-App 모의 화면 1장 (대출 한도 unlock 시너지)
5. 사용자 로그인/세션 (Toss OAuth mock)
6. 한/영 i18n 토글 (외국인 타겟)
7. VC 평문 JSON 처리 (암호화는 별도 옵션 task)
8. Issuer 콘솔 비밀번호 게이트
9. 데모 녹화본 1개 (백업)

### Must NOT Have
1. `demo/` 폴더의 스타일/코드/문구를 절대 참조하거나 가져오지 않는다 (랜딩 페이지 수준 결과물 회피)
2. Next.js / Supabase / Express 풀스택 구조 도입 금지
3. Multisig Escrow / Crypto-condition Escrow 구현 금지 (Phase 2)
4. VC 암호화 구현은 별도 task 외 금지
5. DID Mainnet 강조 / RLUSD Escrow / TokenEscrow (XLS-85) 언급 금지
6. XRP 시세 가정 ("$1 per tenant") 데모 강조 금지
7. 별도 GitHub Actions workflow 추가 금지 (Vercel 자동)
8. 사용자 시드/비밀키 localStorage 영구 저장 금지
9. Issuer 비밀키를 브라우저에 노출 금지
10. 4개 데모 시나리오 시도 금지 (1 happy + 1 edge fallback만)
11. W3C VC 풀 타입 정의 금지 (간이 타입)
12. CredentialType 평문 길이 64바이트 초과 금지

---

## 4. 시스템 아키텍처

```
┌──────────────────────────────────────────────────────────────┐
│  Vite SPA (브라우저)                                          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐  │
│  │ /            │ │ /verify/:id  │ │ /issuer              │  │
│  │ Tenant App   │ │ Landlord     │ │ Ops Console          │  │
│  │ (모바일웹)    │ │ Verify SPA   │ │ (비밀번호 보호)       │  │
│  └──────┬───────┘ └──────┬───────┘ └──────────┬───────────┘  │
│         │                │                    │              │
│         └───── xrpl.js (조회/검증/draft) ─────┘              │
│                          │                                   │
└──────────────────────────┼───────────────────────────────────┘
                           │ REST
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  미니 Node API (단일 파일 server.ts 또는 Vercel serverless)    │
│  - 세션 관리 (Toss OAuth mock)                                │
│  - 사용자 ↔ disposable XRPL wallet 매핑 (in-memory Map)       │
│  - Issuer 키 보관 (env var)                                  │
│  - sign + submit + verify 라우트                             │
│  - 발급 로그 in-memory store                                 │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
                   XRPL Testnet
                   - DIDSet / Credential* / Escrow* / Payment+Memo
```

---

## 5. 온체인 설계 (XRPL Testnet)

> 모든 draft는 tech_stack.md의 xrpl.js 패턴을 따른다. `client.autofill(tx)` → `wallet.sign(autofilled)` → `client.submitAndWait(signed.tx_blob)`.

### 5-1. DIDSet
```
TransactionType: "DIDSet"
Account: tenantAccount
URI: hexEncode("https://nomokdon.app/did/{account}.json")
Data: hexEncode(JSON.stringify({ purpose: "nomokdon-housing-trust-pass", version: 1 }))
```
- Data 필드 256바이트 제한 — 개인정보 / 클레임 절대 금지
- DIDDocument 필드는 옵션 (~1KB). 본 MVP에서는 URI만 사용
- Testnet only. Mainnet 미활성 가능성 있으므로 데모/문서에서 메인넷 강조 금지

### 5-2. Credential (2종, v1 3종에서 축소)
| Type | 용도 | MVP 데이터 |
|---|---|---|
| `nomokdon-visa` | 비자 유형 + 만료일 anchor | mock fixture |
| `nomokdon-rent-reputation` | 월세 납부 평판 | rent history fixture |

`CredentialCreate` (Issuer 서명):
```
TransactionType: "CredentialCreate"
Account: issuerAccount
Subject: tenantAccount
CredentialType: hexEncode("nomokdon-visa")  // 평문 ≤ 64바이트
URI: hexEncode("https://nomokdon.app/vc/{credentialId}.json")
Expiration: isoTimeToRippleTime("2027-06-30T00:00:00.000Z")
```

`CredentialAccept` (임차인 서명):
```
TransactionType: "CredentialAccept"
Account: tenantAccount
Issuer: issuerAccount
CredentialType: hexEncode("nomokdon-visa")
```

### 5-3. Escrow (time-based만)
```
TransactionType: "EscrowCreate"
Account: tenantAccount
Destination: landlordAccount
Amount: "10000000"  // 10 XRP testnet
FinishAfter: rippleTime(now + 60s)   // 데모용
CancelAfter: rippleTime(now + 1h)
```
- Condition/Fulfillment(crypto-condition) 금지 — Phase 2
- Multisig EscrowFinish 금지 — Phase 2 (단일 서명)
- `EscrowFinish`/`EscrowCancel`은 validated `EscrowCreate`의 sequence를 OfferSequence로 채워서 생성

### 5-4. Payment + Memo (월세 이력 anchor)
```
TransactionType: "Payment"
Account: tenantAccount
Destination: landlordAccount
Amount: "1000000"  // 1 XRP testnet
Memos: [{ Memo: { MemoType: hex("nomokdon-rent"), MemoData: hex(sha256(rentData)) } }]
```
- 월세 원문(금액/날짜/주소)을 memo에 직접 넣지 않는다. SHA-256 hash만 anchor

---

## 6. 디렉토리 구조

```
XRP_hack_Pocky/
├── implementation_plan.md   (이 문서)
├── tech_stack.md
├── server/
│   └── server.ts            # 미니 Node API 단일 파일 (또는 Vercel serverless로 변환)
├── scripts/
│   ├── seed-demo.ts         # 사전 데모 TX 서밋
│   └── faucet-fund.ts       # 데모 wallet 펀딩
├── src/
│   ├── domain/              # 도메인 모듈 (인터페이스 보존, 구현 새로)
│   │   ├── xrplClient.ts
│   │   ├── xrplEncoding.ts
│   │   ├── xrplDid.ts
│   │   ├── xrplCredential.ts
│   │   ├── xrplEscrow.ts
│   │   ├── xrplPayment.ts
│   │   ├── vp.ts
│   │   ├── report.ts
│   │   ├── adapters/
│   │   │   ├── adapter.interface.ts
│   │   │   ├── visa.fixture.ts
│   │   │   ├── employment.fixture.ts
│   │   │   └── rent-ledger.fixture.ts
│   │   ├── types.ts          # 간이 VC/VP/Report 타입
│   │   └── *.test.ts
│   ├── shared/
│   │   ├── ui/               # 공통 컴포넌트 (Badge, Card, ExplorerLink, MobileShell)
│   │   ├── i18n/             # 한/영 messages
│   │   ├── auth/             # 세션 클라이언트
│   │   └── design-tokens.ts  # 토스 스타일 토큰
│   └── apps/
│       ├── tenant/           # 임차인 모바일웹
│       │   ├── index.html
│       │   ├── main.ts
│       │   └── screens/      # Login, Onboarding, Empty, Wizard, Dashboard, TossUnlock
│       ├── verify/           # 임대인 verify
│       │   ├── index.html
│       │   ├── main.ts
│       │   └── screens/
│       └── issuer/           # 운영 콘솔
│           ├── index.html
│           ├── main.ts
│           └── screens/
├── docs/
│   └── demo-script.md
└── vite.config.ts            # 멀티 엔트리
```

---

## 7. 실행 전략 (Wave 5+1)

```
Wave 1 (기초, 7 tasks, MAX 병렬)
  ├ 1. 클린 리셋 + 디렉토리 재구성
  ├ 2. xrpl.js client 래퍼
  ├ 3. xrplEncoding 유틸
  ├ 4. 디자인 토큰 + 라우팅/IA
  ├ 5. 도메인 타입 + 어댑터 인터페이스
  ├ 6. 어댑터 3 fixture
  └ 7. 인증/세션 모듈 인터페이스

Wave 2 (도메인 빌더, 6 tasks, MAX 병렬) — Wave 1 후
  ├ 8. xrplDid
  ├ 9. xrplCredential
  ├ 10. xrplEscrow (time-based)
  ├ 11. xrplPayment
  ├ 12. VP 조립/검증
  └ 13. Report 배지 계산

Wave 3 (서버 + 셸, 5 tasks) — Wave 2 후
  ├ 14. 미니 Node API
  ├ 15. 사전 데모 TX 서밋 스크립트
  ├ 16. Vite 멀티 엔트리
  ├ 17. 공통 UI + 모바일 셸
  └ 18. i18n 인프라 (한/영)

Wave 4 (3개 앱 동시 빌드, 11 tasks, MAX 병렬) — Wave 3 후
  ├ 19. 임차인: Toss OAuth mock 로그인 + 온보딩
  ├ 20. 임차인: 빈 상태/랜딩 + 신뢰 패스 CTA
  ├ 21. 임차인: 위저드 (3-step + 4상태)
  ├ 22. 임차인: 대시보드 + 공유 UX (QR/Copy/Share)
  ├ 23. 임차인: Toss App-in-App 모의 unlock 화면
  ├ 24. verify: 자동 검증 + 결과 화면
  ├ 25. verify: 임대인 확인 액션 + PDF/인쇄
  ├ 26. issuer: 비밀번호 게이트 + 보호 라우팅
  ├ 27. issuer: 실시간 로그 + TX 상태
  ├ 28. issuer: 발급 시뮬레이터 토글
  └ 29. issuer: 통계 카드

Wave 5 (통합/배포, 5 tasks) — Wave 4 후
  ├ 30. happy 시나리오 통합 (Playwright)
  ├ 31. edge fallback 시나리오
  ├ 32. 데모 녹화 + 시연 대본
  ├ 33. Vercel 배포 + 환경변수
  └ 34. (OPT) VC 암호화 task — 시간 남으면

Wave FINAL (4 reviews 병렬) — 모든 구현 후
  ├ F1. 플랜 준수 감사 (oracle)
  ├ F2. 코드 품질 리뷰 (unspecified-high)
  ├ F3. 실제 데모 QA (unspecified-high + playwright)
  └ F4. 스코프 충실도 (deep)
  → 사용자 명시 okay 후 종료
```

---

## 8. Task 명세

> 각 task = 1 모듈 = 1~3 파일. 5명 이상의 검토 통과 전 종료 금지.
> 각 task는 What to do / Must NOT do / References / Acceptance Criteria / QA Scenario를 갖는다.

### Wave 1 — 기초

- [x] **1. 클린 리셋 + 디렉토리 재구성** — `quick`
  - **What**: `src/main.ts`, `src/styles.css` 폐기. `src/domain/scenario.ts`, `src/domain/trust.ts`, `src/domain/xrplService.ts`, `src/domain/types.ts`는 인터페이스만 참고하고 구현 새로 작성용 빈 파일 생성. 신규 디렉토리 구조(section 6) 부트스트랩.
  - **Must NOT**: `demo/` 폴더 어떤 파일도 참조 / 복사 / 임포트 금지. `src/` 외부 어떤 dotfile도 건드리지 말 것.
  - **References**: 본 문서 section 6, tech_stack.md L46-52 (package install)
  - **Acceptance**: `git status`에 신규 디렉토리 보임 / `npm run build` 통과
  - **QA**: `bun run dev` → 브라우저 빈 페이지 로드, 콘솔 에러 0

- [x] **2. xrpl.js client 래퍼** — `quick`
  - **What**: `src/domain/xrplClient.ts` 생성. Testnet WS endpoint(`wss://s.altnet.rippletest.net:51233`) 연결. `getClient()`, `fundTestWallet()`, `submitAndWait(tx, wallet)` export.
  - **Must NOT**: Mainnet endpoint 사용 금지. seed를 코드 안에 하드코드 금지.
  - **References**: tech_stack.md L55-72, https://js.xrpl.org
  - **Acceptance**: vitest로 connect → fundWallet → balance 확인 통과
  - **QA**: `bun test xrplClient` PASS

- [x] **3. xrplEncoding 유틸** — `quick`
  - **What**: `src/domain/xrplEncoding.ts`. `hexEncode(str)`, `hexDecode(hex)`, `isoTimeToRippleTime(iso)`, `buildMemo({type, data})` export.
  - **Must NOT**: 자체 hex 구현 금지 (xrpl.js의 `convertStringToHex` 사용).
  - **References**: tech_stack.md, xrpl.js `convertStringToHex`
  - **Acceptance**: 모든 함수 단위 테스트 통과. memo 결과가 xrpl.js Memo 타입과 호환.
  - **QA**: `bun test xrplEncoding` PASS

- [x] **4. 디자인 토큰 + 라우팅/IA** — `visual-engineering`
  - **What**: `src/shared/design-tokens.ts`. 토스 모바일 디자인 언어 참고하여 primary(#0064FF 계열), neutral grayscale, success/warning/error, type scale, spacing, radius, shadow 토큰. 라우팅 IA: `/` = 임차인 / `/verify/:id` = 임대인 / `/issuer` = Issuer. Vite multi-entry config 미리 결정.
  - **Must NOT**: `demo/style.css` 참조 / 복사 금지. 다크모드 변형 만들지 말 것.
  - **References**: 토스(toss.im) 공식 디자인 참고 (직접 카피 X, 디자인 언어만)
  - **Acceptance**: 토큰 모듈 export 완성 / Vite config에 3 entry 정의
  - **QA**: `bun run build` 3개 번들 생성 확인

- [x] **5. 도메인 타입 + 어댑터 인터페이스** — `quick`
  - **What**: `src/domain/types.ts`에 `TenantProfile`, `Credential`, `VerifiablePresentation`, `Report`, `Badge` 간이 타입. `adapters/adapter.interface.ts`에 `VerificationAdapter<TInput, TResult>` 인터페이스.
  - **Must NOT**: W3C VC 풀 스펙 타입 정의 금지.
  - **References**: 본 문서 section 5
  - **Acceptance**: `tsc --noEmit` 통과
  - **QA**: 타입만 정의되므로 컴파일 통과로 검증

- [x] **6. 어댑터 3 fixture** — `quick`
  - **What**: `adapters/visa.fixture.ts`, `employment.fixture.ts`, `rent-ledger.fixture.ts`. 각각 1 happy + 1 edge case (예: 비자 만료, 미가입, 연체) fixture export.
  - **Must NOT**: 외부 API 호출 코드 작성 금지. CODEF/하이코리아 실제 호출 금지.
  - **References**: implementation_plan.md v1 section 4-3 (adapter 설계만 참고)
  - **Acceptance**: 각 fixture가 `AdapterResult` 타입에 맞음
  - **QA**: fixture import → 콘솔 출력 정상

- [x] **7. 인증/세션 모듈 인터페이스** — `quick`
  - **What**: `src/shared/auth/session.ts`. `Session = { userId, name, phone, locale, tenantWalletAddress? }` 타입. `getSession()`, `clearSession()`, `setSession()` localStorage 기반 (sessionId만 저장, 시드/키 저장 금지). Toss OAuth mock 인터페이스 정의 (실제 구현은 task 19에서).
  - **Must NOT**: 실제 OAuth 라이브러리 import 금지. 시드/키 localStorage 저장 금지.
  - **References**: 본 문서 section 4
  - **Acceptance**: 모듈 export 완성 / 단위 테스트
  - **QA**: `bun test session` PASS

### Wave 2 — 도메인 빌더

- [x] **8. xrplDid** — `unspecified-high`
  - **What**: `src/domain/xrplDid.ts`. `buildDidSet({account, purpose})` → DIDSet draft. `submitDidSet(wallet)` → autofill + sign + submitAndWait. `getDidDocumentUrl(account)` mock URL 반환.
  - **Must NOT**: 클레임/개인정보를 Data 필드에 포함 금지. 256B 초과 금지.
  - **References**: 본 문서 section 5-1, tech_stack.md L104-126
  - **Acceptance**: vitest로 draft 검증 (필드/사이즈/타입). Testnet submit 1회 성공
  - **QA**: `bun test xrplDid` PASS + 실제 Testnet TX 해시 1개 확보

- [x] **9. xrplCredential** — `unspecified-high`
  - **What**: `src/domain/xrplCredential.ts`. `buildCredentialCreate({issuer, subject, type, uri, expiration})`, `buildCredentialAccept({tenant, issuer, type})`, `submitCreate(issuerWallet)`, `submitAccept(tenantWallet)`.
  - **Must NOT**: CredentialType 평문 64바이트 초과 금지. 3종 구현 금지 (visa + rent 2종만).
  - **References**: 본 문서 section 5-2, tech_stack.md L128-160
  - **Acceptance**: 2종 발급 vitest + Testnet submit 4회 성공 (Create×2 + Accept×2)
  - **QA**: `bun test xrplCredential` PASS + Testnet TX 해시 4개

- [x] **10. xrplEscrow (time-based)** — `unspecified-high`
  - **What**: `src/domain/xrplEscrow.ts`. `buildEscrowCreate({account, destination, amount, finishAfter, cancelAfter})`, `buildEscrowFinish({owner, offerSequence})`, `buildEscrowCancel(...)`. submit 함수 포함.
  - **Must NOT**: Condition/Fulfillment(crypto-condition) 구현 금지. Multisig 구현 금지. `TokenEscrow` 코드 작성 금지.
  - **References**: 본 문서 section 5-3, tech_stack.md L168-188
  - **Acceptance**: vitest + Testnet에서 Create → 60s 대기 → Finish 1 사이클 성공
  - **QA**: `bun test xrplEscrow` PASS + Testnet TX 해시 2개

- [x] **11. xrplPayment** — `unspecified-high`
  - **What**: `src/domain/xrplPayment.ts`. `buildRentPayment({tenant, landlord, amount, rentData})` → memo에 SHA-256 hash anchor. submit 포함.
  - **Must NOT**: 월세 원문(금액/날짜/주소)을 memo에 직접 넣지 말 것.
  - **References**: 본 문서 section 5-4, tech_stack.md L190-216
  - **Acceptance**: vitest + Testnet 1회 submit
  - **QA**: `bun test xrplPayment` PASS

- [x] **12. VP 조립/검증** — `unspecified-high`
  - **What**: `src/domain/vp.ts`. `buildVp({tenant, credentials})` → reportId + VP JSON. `verifyVp(reportId)` → issuer 확인 + 만료 체크 + 결과.
  - **Must NOT**: 디지털 서명(JWS/JsonWebSignature2020) 구현 금지. issuer 확인은 XRPL `account_objects`로 충분.
  - **References**: 본 문서 section 4, W3C VP 개념(스펙 풀 구현 X)
  - **Acceptance**: vitest로 정상/만료 VP 검증 두 케이스 통과
  - **QA**: `bun test vp` PASS

- [x] **13. Report 배지 계산** — `unspecified-high`
  - **What**: `src/domain/report.ts`. `buildReport({vp, escrowState, rentHistory})` → 6 Badge (비자유효 / 고용확인 / 부담률 / Escrow / 납부이력 / 온체인검증) + 신뢰등급(A~D).
  - **Must NOT**: 배지 8개 이상 만들지 말 것.
  - **References**: implementation_plan.md v1 section 5-4 (배지 6개만)
  - **Acceptance**: 6 badge + grade 계산 vitest
  - **QA**: `bun test report` PASS

### Wave 3 — 서버 + 셸

- [x] **14. 미니 Node API** — `unspecified-high`
  - **What**: `server/server.ts` 단일 파일 (또는 Vercel `api/*.ts` serverless 1~2개). 라우트:
    - `POST /api/auth/toss-mock` — userId 발급 + disposable tenant wallet 생성 (서버 매핑)
    - `GET /api/session` — 현재 세션
    - `POST /api/sign-and-submit` — body의 draft를 Issuer 또는 tenant key로 서명 후 Testnet submit
    - `GET /api/report/:id` — VP + report 반환
    - `GET /api/logs` — 발급 로그 (Issuer 콘솔용)
  - **Must NOT**: Issuer seed를 응답 body에 노출 금지. CORS는 데모 도메인만 허용.
  - **References**: 본 문서 section 4, tech_stack.md L75-78 (key 처리 원칙)
  - **Acceptance**: `bun run server` → 5개 라우트 모두 200 응답 (curl)
  - **QA**: curl로 happy path E2E 1회 성공

- [x] **15. 사전 데모 TX 서밋 스크립트** — `unspecified-high`
  - **What**: `scripts/seed-demo.ts`. Mina P. 페르소나로 DIDSet + Credential×2(Create+Accept) + EscrowCreate + Payment 6+ TX 사전 서밋. 결과 해시를 `scripts/demo-fixtures.json`에 저장.
  - **Must NOT**: Mainnet 호출 금지.
  - **References**: tech_stack.md
  - **Acceptance**: 스크립트 1회 실행 → 6개 검증된 TX 해시 fixture 파일 생성
  - **QA**: 각 해시를 https://testnet.xrpl.org 에서 클릭 확인

- [x] **16. Vite 멀티 엔트리** — `quick`
  - **What**: `vite.config.ts` rollupOptions.input에 tenant/verify/issuer 3 entry 등록. dev server proxy를 `/api` → 미니 Node API로 설정.
  - **Must NOT**: Next.js / SSR 도입 금지.
  - **References**: vite 공식 multi-page 문서
  - **Acceptance**: `bun run build` → `dist/tenant/`, `dist/verify/`, `dist/issuer/` 3 폴더 생성. `bun run dev` 3개 라우트 모두 접근
  - **QA**: 브라우저로 3 라우트 진입 확인

- [x] **17. 공통 UI + 모바일 셸** — `visual-engineering`
  - **What**: `src/shared/ui/`에 `Badge`, `Card`, `ExplorerLink`, `MobileShell`(헤더+하단탭), `LoadingOverlay`, `EmptyState`, `ErrorState`, `Toast` 컴포넌트. 토스 디자인 토큰 사용.
  - **Must NOT**: `demo/` 폴더 어떤 CSS / HTML 구조도 가져오지 말 것. Tailwind 도입 금지 (CSS modules 또는 plain CSS).
  - **References**: section 4 (디자인 토큰), 토스 모바일 앱 일반적 패턴
  - **Acceptance**: 8개 컴포넌트 storybook 없이 데모 페이지로 시각 확인
  - **QA**: `bun run dev` → `/dev/components` 데모 라우트에서 모든 컴포넌트 시각 검수

- [x] **18. i18n 인프라 (한/영)** — `quick`
  - **What**: `src/shared/i18n/`에 ko.json / en.json messages + `t(key, locale)` 함수. 세션의 `locale` 필드와 연동.
  - **Must NOT**: i18next 같은 무거운 라이브러리 도입 금지 (자체 50줄 모듈).
  - **References**: 본 문서 section 3 (Must Have)
  - **Acceptance**: 임차인 앱 핵심 문구 한/영 토글 동작
  - **QA**: 헤더 언어 토글로 시각 확인

### Wave 4 — 3개 앱

#### 임차인 앱 (모바일웹)

- [x] **19. 임차인: Toss OAuth mock 로그인 + 온보딩** — `visual-engineering`
  - **What**: `src/apps/tenant/screens/Login.tsx`(혹은 vanilla TS) + `Onboarding.tsx`. 토스 로그인 UI 모방 (실제 OAuth 호출 X, `POST /api/auth/toss-mock` 호출). 로그인 성공 → 2~3 step 온보딩(가치제안: 외국인 + 주거 + 신뢰) → 홈.
  - **Must NOT**: 실제 Toss OAuth 엔드포인트 호출 금지. 토스 로고 직접 사용 금지(자체 마크로 표현).
  - **References**: section 4, /api/auth/toss-mock 라우트 (task 14)
  - **Acceptance**: 로그인 버튼 → 1.5s 내 세션 생성 → 온보딩 표시 → "시작하기" → 홈 라우트
  - **QA**: Playwright로 로그인 → 온보딩 → 홈 60초 안 완주

- [x] **20. 임차인: 빈 상태/랜딩 + CTA** — `visual-engineering`
  - **What**: `Home.tsx` 신뢰 패스 미발급 시 보이는 화면. 일러스트(SVG) + "아직 신뢰 패스가 없어요" 카피 + 큰 "신뢰 패스 만들기" CTA.
  - **Must NOT**: 카피에 demo/ 폴더 문구 재사용 금지.
  - **References**: section 4
  - **Acceptance**: 모바일 375px에서 시각 검수 PASS
  - **QA**: Playwright 모바일 viewport 캡처

- [x] **21. 임차인: 위저드 (3-step + 4상태)** — `visual-engineering`
  - **What**: `Wizard.tsx`. Step1 DID 생성 → Step2 Credential 발급(visa + rent) → Step3 Escrow 잠금. 각 step에 idle / loading / success / error 4상태. loading에 진행률 + 실시간 Explorer 링크.
  - **Must NOT**: TX 실패 무시 금지(반드시 error 상태로 안내 + 재시도 버튼). 시드/키를 화면에 표시 금지.
  - **References**: tasks 8-10, 14 (sign-and-submit)
  - **Acceptance**: 사전 서밋된 TX 해시를 받아 라이브 표시(D3 = 사전 + 라이브)
  - **QA**: Playwright happy → 60초 내 3-step 완주 + 6개 배지 표시

- [x] **22. 임차인: 대시보드 + 공유 UX** — `visual-engineering`
  - **What**: `Dashboard.tsx`. DID + 발급된 VC 리스트 + 6 배지 + 신뢰등급 + 공유 패널(QR 생성 + Copy Link + Web Share API). reportId 기반 공유 URL: `/verify/:id`.
  - **Must NOT**: 공유 URL에 시드/개인정보 인코딩 금지.
  - **References**: tasks 12-13, section 6
  - **Acceptance**: QR 스캔 → /verify/:id 로 이동 가능
  - **QA**: 모바일 캡처 + QR 스캔 라이브 데모

- [x] **23. 임차인: Toss App-in-App 모의 unlock 화면** — `visual-engineering`
  - **What**: `TossUnlock.tsx`. 발급 완료 직후 자연 전이되는 화면. "토스뱅크 외국인 대출 한도 +500만원 unlock" 모의 UI. 토스 카드 스타일.
  - **Must NOT**: 실제 토스뱅크 API 호출 금지. 토스 로고/상표 직접 사용 금지.
  - **References**: section 1 (Toss 시너지), D4 / D9
  - **Acceptance**: 대시보드 → CTA → unlock 화면 트랜지션
  - **QA**: 모바일 캡처. 데모 영상에서 임팩트 확인

#### 임대인 verify SPA

- [x] **24. verify: 자동 검증 + 결과 화면** — `visual-engineering`
  - **What**: `/verify/:reportId` 진입 즉시 `GET /api/report/:id` 호출. 로딩 → 결과(6 배지 + 신뢰등급 + 임차인 마스킹 정보 + Explorer 링크 6개). 모바일 + 데스크톱 반응형.
  - **Must NOT**: 비마스킹된 개인정보(여권번호/주민번호 등) 표시 금지. 임차인 시드/키 노출 금지.
  - **References**: tasks 12-13, 15
  - **Acceptance**: 사전 서밋 TX의 reportId로 3초 내 결과 표시
  - **QA**: Playwright 모바일(375px) + 데스크톱(1280px) 양쪽 캡처

- [x] **25. verify: 임대인 확인 액션 + PDF/인쇄** — `visual-engineering`
  - **What**: "확인했습니다" 버튼 → `POST /api/logs` 기록(이벤트 anchor). "PDF로 저장" / "인쇄" 버튼 → `window.print()` 또는 html2canvas.
  - **Must NOT**: 임대인 개인정보 수집 금지.
  - **References**: task 14 (logs 라우트)
  - **Acceptance**: 버튼 클릭 → 로그 기록 / PDF/인쇄 다이얼로그 트리거
  - **QA**: Playwright 버튼 클릭 + Issuer 콘솔에서 로그 확인

#### Issuer 운영 콘솔

- [x] **26. issuer: 비밀번호 게이트 + 보호 라우팅** — `unspecified-high`
  - **What**: `/issuer` 진입 시 비밀번호 입력 모달. env var `ISSUER_CONSOLE_PASSWORD`와 일치 시 세션 쿠키 발급. 새로고침 시 쿠키 검증.
  - **Must NOT**: 비밀번호를 URL/localStorage 평문 저장 금지. 비밀번호를 코드/이미지에 하드코드 금지.
  - **References**: section 3 (Must Have #8)
  - **Acceptance**: 잘못된 비밀번호 → 거부, 정확한 비밀번호 → 콘솔 접근
  - **QA**: Playwright 두 케이스 모두 검증

- [x] **27. issuer: 실시간 로그 + TX 상태** — `visual-engineering`
  - **What**: `Logs.tsx`. 5초 polling으로 `/api/logs` 조회. 최근 50건 표시(시각/유저/TX 타입/Hash 링크/상태 pending|validated|failed).
  - **Must NOT**: WebSocket 풀 구현 강요 금지(폴링이면 충분).
  - **References**: task 14 (logs 라우트)
  - **Acceptance**: 사전 서밋 TX 6개 모두 표시 + 새 발급 발생 시 10초 내 반영
  - **QA**: Playwright로 발급 후 콘솔에 표시 확인

- [x] **28. issuer: 발급 시뮬레이터 토글** — `visual-engineering`
  - **What**: `Simulator.tsx` 탭. 임차인 fixture 선택 → "발급 실행" → DIDSet + Credential×2 + Escrow 4 TX 자동 트리거(데모 직전 fixture 주입용).
  - **Must NOT**: 임의 입력으로 Issuer 키 노출하는 인풋 금지.
  - **References**: task 6 (fixture), task 14 (sign-and-submit)
  - **Acceptance**: 클릭 → 30초 내 4 TX validated + 로그에 표시
  - **QA**: 라이브 데모 직전 시뮬레이터로 fixture 1회 주입 성공

- [x] **29. issuer: 통계 카드** — `visual-engineering`
  - **What**: `Stats.tsx`. 발급 총수 / 활성 신뢰 패스 / 잠긴 Escrow 합산 / 검증 클릭 수 4 카드. 시간대별 간단 라인 차트(SVG inline, 라이브러리 X).
  - **Must NOT**: chart.js / d3 등 무거운 라이브러리 도입 금지.
  - **References**: task 14 (logs로부터 집계)
  - **Acceptance**: 4 카드 정확한 수치 + 라인 차트 시각 PASS
  - **QA**: 캡처

### Wave 5 — 통합/배포

- [x] **30. happy 시나리오 통합 (Playwright)** — `unspecified-high`
  - **What**: `tests/e2e/happy.spec.ts`. 로그인 → 온보딩 → 위저드 3-step → 대시보드 → Toss unlock → 공유 → verify(다른 컨텍스트) → 임대인 확인. Evidence: 각 step 캡처.
  - **Must NOT**: 시나리오를 hand-wave 금지(모든 assertion 구체).
  - **References**: Wave 4
  - **Acceptance**: Playwright PASS, 캡처 8장 이상 `.sisyphus/evidence/happy/`
  - **QA**: 자체 검증

- [x] **31. edge fallback 시나리오** — `unspecified-high`
  - **What**: 비자 만료 fixture로 위저드 실행 → Credential 발급 단계에서 검증 실패 → "패스 생성 불가" 안내 + 갱신 가이드 화면. Playwright 시나리오 + evidence.
  - **Must NOT**: 실패를 무시하고 강제 발급 금지.
  - **References**: task 6 (edge fixture), task 21 (error 상태)
  - **Acceptance**: Playwright PASS, 캡처 `.sisyphus/evidence/edge/`
  - **QA**: 자체 검증

- [x] **32. 데모 녹화 + 시연 대본** — `writing`
  - **What**: `docs/demo-script.md` (3분 대본, 영/한 병기). 화면 녹화 1개(`docs/demo-video.mp4` 또는 외부 호스팅 링크). 백업용.
  - **Must NOT**: 대본에서 메인넷 / RLUSD / Mainnet TokenEscrow 강조 금지. XRP 시세 가정 금지.
  - **References**: 본 문서 section 1
  - **Acceptance**: 대본 + 영상 파일 존재
  - **QA**: 영상 재생 가능 + 대본 3분 내 완독

- [x] **33. Vercel 배포 + 환경변수** — `quick`
  - **What**: Vercel 프로젝트 연결. 환경변수 `ISSUER_SEED`, `ISSUER_CONSOLE_PASSWORD`, `XRPL_TESTNET_WS` 설정. 자동 배포 활성. 도메인: `nomokdon.vercel.app`(또는 임의).
  - **Must NOT**: 별도 GitHub Actions workflow 작성 금지. 환경변수에 키/시크릿 평문 커밋 금지.
  - **References**: D10
  - **Acceptance**: 배포 URL에서 3개 라우트 모두 200, API healthcheck 200
  - **QA**: curl + 브라우저 라이브 확인

- [x] **34. (OPT) VC 암호화 task** — `unspecified-high` — *Wave 5 시간 남으면, 없으면 Phase 2*
  - **What**: AES-256-GCM으로 VC JSON 암호화 후 서버 메모리에 저장. 키는 `VC_ENCRYPTION_KEY` env var. 복호화는 GET 시 자동.
  - **Must NOT**: 키를 코드/로그에 노출 금지.
  - **References**: 본 문서 section 3 (Must Have #7)
  - **Acceptance**: 평문 모드와 동일 동작 + 메모리 store에 ciphertext만 존재
  - **QA**: 메모리 덤프에 평문 PII 부재 확인

---

## 9. Final Verification Wave (필수)

- [x] **F1. 플랜 준수 감사** — `oracle`
  Must Have 9개 검증(파일/엔드포인트/TX 해시). Must NOT Have 12개 grep으로 부재 검증. demo/ 참조 grep. 사전 서밋 TX 해시 6+개 Testnet Explorer 라이브 확인. Toss unlock 화면 / Issuer 콘솔 / verify 페이지 존재 확인.
  Output: `Must Have [N/N] | Must NOT [N/N] | demo참조 [CLEAN/N건] | TX [N/6] | VERDICT: APPROVE/REJECT`

- [x] **F2. 코드 품질 리뷰** — `unspecified-high`
  `tsc --noEmit` + `vitest run` + `eslint`(있을 시). `as any`, `@ts-ignore`, 빈 catch, `console.log`(prod), 사용 안 하는 import, 주석 처리된 죽은 코드 grep. AI slop(generic 변수명, 과한 주석, 불필요한 추상화) 검사.
  Output: `Build [PASS/FAIL] | Tests [N/N] | Files [N clean/N issues] | VERDICT`

- [x] **F3. 실제 데모 QA** — `unspecified-high` + `playwright`
  3개 앱 모두 클린 상태에서 happy + edge 시나리오 풀 실행. 모바일(375px) + 데스크톱(1280px) 양쪽 캡처. 모든 Explorer 링크 라이브 클릭 검증. 한/영 토글 확인. Toss unlock 화면 캡처.
  Output: `Scenarios [N/N] | Mobile [PASS] | Desktop [PASS] | Explorer [N/6 live] | i18n [PASS/FAIL] | VERDICT`

- [x] **F4. 스코프 충실도** — `deep`
  각 task의 What to do vs `git log` / `git diff` 1:1 매칭. Must NOT 위반 grep(Next.js / Supabase / Express / multisig / condition / crypto-condition / token-escrow). cross-task 오염(task N이 task M 파일 건드림) 검사.
  Output: `Tasks [N/N compliant] | Violations [CLEAN/N] | Contamination [CLEAN/N] | VERDICT`

→ 4개 모두 APPROVE → 사용자에게 결과 제시 → 사용자의 명시적 "okay" 받고 종료. 거절 시 fix → 재실행.

---

## 10. 커밋 전략 + 성공 기준

### 커밋
- Wave 단위 커밋 권장 (의미 있는 묶음)
- 메시지 컨벤션: `feat({scope}): {desc}` / `chore: {desc}` / `fix: {desc}`
- 데모 직전 마지막: `chore: pre-demo snapshot`

### 성공 기준
```
npm run dev                                 # 3개 앱 로컬 실행
npm test                                    # 도메인 + 통합 PASS
curl https://nomokdon.vercel.app/api/health # 200
# 사전 서밋 TX 해시 6+개 Explorer 라이브 확인
```

### 최종 체크리스트
- [x] Must Have 9개 모두 충족
- [x] Must NOT Have 12개 모두 부재
- [x] 3개 앱 라우트 살아있음
- [x] 사전 서밋 TX ≥6개 Testnet 검증
- [x] 데모 녹화본 존재
- [x] Vercel 배포 라이브
- [x] Final Verification 4개 모두 APPROVE
- [x] 사용자 명시 okay

---

## 11. v1 (구 implementation_plan.md) vs v2 (현재)

| 영역 | v1 | v2 | 사유 |
|---|---|---|---|
| 프레임워크 | Next.js 16 + App Router | **Vite + TS 유지** | Next.js 마이그레이션 = 1일 손실 (Oracle #3) |
| 백엔드 | Express 별도 서버 | **단일 server.ts 또는 Vercel serverless** | 풀스택 불필요 (Oracle #1) |
| DB | Supabase + RLS | **in-memory Map + URL fragment** | 온체인 anchor면 충분 (Oracle #1) |
| Credential | 3종 (visa/employment/rent) | **2종 (visa/rent)** | TX 수 절감, 시간 절약 (Oracle #3) |
| Escrow | Multisig + Condition | **time-based 단일 서명** | Phase 2 (Oracle #3, 사용자 D6 결정) |
| VC 암호화 | 필수 | **평문 + 별도 옵션 task** | 키관리 지옥 회피 (Oracle #1, 사용자 결정 #6) |
| Demo 시나리오 | 4개 (G1-G4) | **1 happy + 1 edge** | 3분 시연 현실성 (Oracle #3) |
| Issuer Console | 발급 어드민 | **운영 모니터링 + 시뮬레이터 하이브리드** | 사용자 결정 #2 |
| 프론트엔드 | 3개 (원안) | **3개 분리 유지** | 사용자 결정 #1 / D5 |
| CI | GitHub Actions | **Vercel 자동** | 사용자 결정 #3 / D10 |
| 인증/세션 | 미정 | **Toss OAuth mock + 세션** | 사용자 결정 #8 (UX 누락 보완) |
| i18n | 미정 | **한/영 토글** | 외국인 타겟이므로 필수 |
| 디자인 토큰 | 미정 | **토스 모바일 디자인 언어** | 사용자 결정 #9 / D4 / D9 |
| demo/ 참조 | 무관 | **명시적 금지** | 사용자 결정 #4 |
| DID Mainnet 강조 | 강조 | **금지** | Librarian: Mainnet 미활성 가능 |
| TX submit | 미정 | **사전 + 라이브 표시** | 사용자 D3 결정 |
| Task 수 | 30+ Phase A-H | **34 + Final 4 / Wave 5+1** | 병렬화 + UX 보완 (Oracle #3) |

---

## 12. Phase 2 (해커톤 후 로드맵)

- Regular Key 패턴 도입 → 사용자 마스터키 + 서버 보조키
- Xaman / Girin / GemWallet 외부 지갑 연동 (서명 push)
- Multisig EscrowFinish (중개사 + 플랫폼)
- Crypto-condition Escrow (preimage SHA-256)
- VC AES-256-GCM 암호화 + 키 회전
- Mainnet 배포 (DID amendment 활성 후)
- RLUSD Trust Line + Payment 연동
- CODEF 중계 API 또는 본인 인증 OCR (visa/employment 실데이터)
- 토스 App-in-App 실제 탑재 협의

---

(끝)
