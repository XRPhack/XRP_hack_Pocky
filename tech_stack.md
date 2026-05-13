# NomokDon XRPL 기술 스택 정리

작성일: 2026-05-12
대상 프로젝트: `XRP_hack_Pocky` / NomokDon 로컬 MVP

## 참고 소스

- Source 1: XRPL Korea GitHub 조직 - https://github.com/xrplkorea
- Source 1-1: XRPL Korea TypeScript 샘플 코드 저장소 - https://github.com/xrplkorea/XRPL
- Source 2: XRPL Dev Source - https://xrplkorea.oopy.io/2f4898c6-80bf-8043-9162-dded31508893
- 보조 공식 문서:
  - XRPL 공식 문서 - https://xrpl.org/docs
  - xrpl.js API 문서 - https://js.xrpl.org
  - xrpl-py 문서 - https://xrpl-py.readthedocs.io
  - XRPL transaction result codes - https://xrpl.org/docs/references/protocol/transactions/transaction-results
  - xrpl.js AccountSet flags - https://js.xrpl.org/enums/AccountSetAsfFlags.html

> 현재 Codex 세션에서는 GitHub API DNS 접근이 막혀 `xrplkorea` 조직의 전체 repo inventory를 직접 갱신하지 못했다. 따라서 source2가 명시한 `xrplkorea/XRPL` TypeScript 샘플 repo와 XRPL 공식 문서를 기준으로 해커톤 구현에 필요한 기술 스택을 정리한다.

## 결론

이번 해커톤 MVP는 **Vite + TypeScript + XRPL Testnet + xrpl.js** 조합이 가장 현실적이다.

현재 프로젝트는 이미 Vite/TypeScript 로컬 앱으로 구성되어 있고, `src/domain/xrplService.ts`에서 실제 지갑 서명에 넘길 수 있는 `EscrowCreate` transaction draft를 만들고 있다. 따라서 지금 단계에서 Next.js, 서버 배포, Vercel, Supabase, 실제 지갑 seed 저장, 실제 KRW 결제까지 넓히면 구현 리스크가 커진다.

우선순위는 다음 순서가 맞다.

1. 기존 Vite/TypeScript 앱 유지
2. `xrpl` 패키지를 붙여 XRPL Testnet 연결, faucet wallet, submit/verify 유틸 추가
3. DIDSet, CredentialCreate/CredentialAccept, EscrowCreate, Payment+Memo를 순서대로 unsigned draft 또는 testnet submit까지 구현
4. UI는 디자인 전까지 기본 동작 화면만 유지
5. 외부 지갑, 서버, 배포, 실명 인증, 실제 결제는 후순위

## 현재 프로젝트 기준 스택

| 영역 | 현재 상태 | 유지/변경 판단 |
|:---|:---|:---|
| Frontend | Vite + TypeScript | 유지. 해커톤 MVP에는 충분하다. |
| UI | `src/main.ts` 기반 로컬 화면 | 디자인 레퍼런스 전까지 기본 동작 화면만 구성한다. |
| XRPL 로직 | `src/domain/xrplService.ts`에서 Escrow draft 생성 | 확장 대상. `xrpl` SDK 연결을 추가한다. |
| 테스트 | Vitest | 유지. XRPL transaction draft와 edge case 테스트를 추가한다. |
| Backend | 없음 | 지금은 만들지 않는다. DID Document/VC URI는 mock URL 또는 local fixture로 처리한다. |
| DB | 없음 | 지금은 만들지 않는다. localStorage/fixture/hash anchor로 충분하다. |
| 배포 | 없음 | 지금은 미룬다. 로컬 데모 완성 후 Vercel 여부 결정한다. |

필요 패키지:

```bash
npm install xrpl
npm install -D @types/node
```

`xrpl`은 JavaScript/TypeScript에서 XRPL 계정 조회, 지갑 생성, 트랜잭션 작성/서명/제출, Escrow/Payment/DEX/AMM/Trust Line 등 핵심 기능을 다룰 때 쓰는 기본 SDK다. 브라우저와 Node.js 양쪽에서 사용할 수 있으므로 현재 Vite 앱과도 맞는다.

## XRPL 네트워크 선택

MVP는 **XRPL Testnet** 기준으로 구현한다.

추천 엔드포인트:

```ts
const XRPL_TESTNET_WS = "wss://s.altnet.rippletest.net:51233";
const XRPL_TESTNET_RPC = "https://s.altnet.rippletest.net:51234";
```

사용 목적:

- `Client.connect()`로 ledger 상태 확인
- `client.fundWallet()` 또는 faucet으로 테스트 계정 생성
- `client.autofill()`로 fee/sequence/ledger 자동 채움
- `client.submitAndWait()` 또는 `client.submit()` + 결과 조회
- `account_info`, `tx`, `ledger_entry`로 검증 화면 구성

주의:

- 앱에 seed/private key를 저장하지 않는다.
- 해커톤 데모에서만 임시 testnet wallet을 생성한다.
- 실제 운영에서는 Xaman/Girin/GemWallet 같은 외부 지갑 또는 서버 signer를 분리해야 한다.

## XRPL 기능별 적용 판단

| XRPL 기능 | source2 분류 | NomokDon 적용 | 우선순위 |
|:---|:---|:---|:---|
| Payment | 결제 & 금융 | 월세 납부 이력 hash memo anchor | 높음 |
| Escrow | 결제 & 금융 | 예약금 보호 핵심 기능 | 매우 높음 |
| Payment Channel | 결제 & 금융 | 실시간 소액 결제용. 현재 MVP 불필요 | 낮음 |
| Cross-Currency Payments | 결제 & 금융 | KRW/스테이블코인 확장 시 참고 | 낮음 |
| IOU Token | 토큰화 | 추후 KRW 포인트/스테이블코인 표현 가능 | 낮음 |
| Trust Line | 토큰화 | IOU/스테이블코인 수신 전제. MVP에서는 설명만 | 낮음 |
| NFT XLS-20 | 토큰화 | 주거 패스 NFT화는 가능하지만 현재 불필요 | 제외 |
| MPT XLS-33 | 토큰화 | 컴플라이언스 있는 토큰 확장안 | 낮음 |
| Orderbook DEX | DEX & 유동성 | 현재 MVP 불필요 | 제외 |
| Pathfinding / Auto-bridging | DEX & 유동성 | 다중 통화 결제 확장 시 참고 | 낮음 |
| AMM | DEX & 유동성 | 현재 MVP 불필요 | 제외 |
| Multi-sign | 계정 & 보안 | 운영 단계에서 issuer/escrow 권한 보호 | 중간 |
| Regular Key | 계정 & 보안 | 운영 단계 hot wallet 분리 | 중간 |
| Account Reserve/Delete | 계정 & 보안 | 사용자 안내/잔고 부족 edge case | 중간 |
| Oracle | 참고자료 | 임대료/환율/담보평가 확장 시 참고 | 낮음 |
| XRPL meta | 참고자료 | 토큰/NFT 메타데이터 조회용. 현재 불필요 | 제외 |
| Axelar Bridge | Integration | XRPL EVM sidechain 확장 시 참고 | 제외 |

## NomokDon MVP 온체인 설계

### 1. DIDSet

목적: 임차인 계정의 식별자 anchor.

MVP에서는 `DIDSet` transaction draft를 만들고, 가능하면 Testnet submit까지 한다.

```ts
{
  TransactionType: "DIDSet",
  Account: tenantAccount,
  URI: hexEncode("https://nomokdon.local/did/{account}.json"),
  Data: hexEncode(JSON.stringify({
    purpose: "nomokdon-housing-trust-pass",
    version: 1
  }))
}
```

주의:

- DIDSet에는 여권번호, 전화번호, 비자 정보 같은 개인정보를 넣지 않는다.
- 온체인에는 URI와 목적 태그만 둔다.
- 실제 DID Document는 후순위 서버/API 영역이다. MVP에서는 mock document JSON으로 충분하다.

### 2. CredentialCreate / CredentialAccept

목적: 비자, 고용/재학, 월세 평판 같은 신뢰 정보를 issuer가 발급했다는 anchor.

Credential 종류:

| Credential Type | 의미 | MVP 데이터 |
|:---|:---|:---|
| `nomokdon-visa` | 체류자격/만료일 확인 | mock fixture |
| `nomokdon-employment` | 고용/재학 확인 | mock fixture |
| `nomokdon-rent-reputation` | 월세 납부 평판 | 현재 rent history fixture |

MVP transaction draft:

```ts
{
  TransactionType: "CredentialCreate",
  Account: issuerAccount,
  Subject: tenantAccount,
  CredentialType: hexEncode("nomokdon-visa"),
  URI: hexEncode("https://nomokdon.local/vc/{credentialId}.json"),
  Expiration: rippleTime("2027-06-30T00:00:00.000Z")
}
```

```ts
{
  TransactionType: "CredentialAccept",
  Account: tenantAccount,
  Issuer: issuerAccount,
  CredentialType: hexEncode("nomokdon-visa")
}
```

주의:

- 실제 개인정보 원문은 off-chain에도 그대로 두지 않는다.
- 화면에는 “검증됨/주의/실패”와 hash anchor만 보여준다.
- Credential 관련 Testnet 지원 상태는 구현 시점에 `server_definitions` 또는 xrpl.js 타입 지원 여부로 확인한다. 지원이 불확실하면 transaction draft 화면까지만 구현한다.

### 3. EscrowCreate / EscrowFinish / EscrowCancel

목적: 임차인의 예약금을 임대인에게 바로 보내지 않고 XRPL escrow로 잠그는 핵심 기능.

현재 코드가 이미 하는 일:

- `EscrowCreate` unsigned transaction draft 생성
- `EscrowFinish` / `EscrowCancel` template 생성
- 계약 hash를 memo로 첨부
- testnet 기준 10 XRP 예약금 시연

다음 구현에서 추가할 것:

- `xrpl.Client` 연결 상태 확인
- faucet/testnet wallet 준비
- `client.autofill(createTx)`
- 사용자가 명시적으로 데모 실행을 누를 때만 submit
- 제출 후 validated tx hash, ledger index, sequence 표시
- `OfferSequence`를 실제 `EscrowCreate`의 validated sequence로 채워 `EscrowFinish`/`EscrowCancel` template 갱신

MVP에서 Condition/Fulfillment는 선택이다. 시간이 부족하면 `FinishAfter`/`CancelAfter` 기반 escrow만 먼저 구현한다. 해커톤 발표에서는 “조건부 해제는 다음 단계에서 preimage condition 또는 multi-sign으로 확장”이라고 설명하면 된다.

### 4. Payment + Memo

목적: 월세 납부 이력을 원문 없이 hash로 anchor.

MVP transaction draft:

```ts
{
  TransactionType: "Payment",
  Account: tenantAccount,
  Destination: landlordAccount,
  Amount: "1000000",
  Memos: [{
    Memo: {
      MemoType: hexEncode("nomokdon-rent"),
      MemoData: hexEncode(sha256(rentPaymentData))
    }
  }]
}
```

주의:

- 실제 월세 금액/날짜/집주소 원문을 memo에 넣지 않는다.
- memo에는 hash만 넣는다.
- UI에는 “최근 6개월 중 정상 납부율” 같은 요약 지표만 보여준다.

## 지갑 연동 전략

### 지금 MVP

1. 내부 testnet wallet 생성
2. unsigned transaction draft 출력
3. 사용자가 데모 실행 버튼을 눌렀을 때만 testnet submit
4. seed/private key는 localStorage에 저장하지 않음

### 다음 단계

| 지갑 | 용도 | 판단 |
|:---|:---|:---|
| Girin Wallet | XRPL Korea 자료에서 제시한 외부 지갑 연동 | 국내 해커톤 맥락상 우선 검토 |
| Xaman | XRPL 생태계 대표 모바일 지갑 | 실제 모바일 서명 UX 후보 |
| GemWallet | 브라우저 기반 XRPL 지갑 | 데스크톱 데모 후보 |

지금은 지갑 연동보다 **정확한 transaction draft와 Testnet 검증**이 먼저다.

## 구현 모듈 제안

현재 구조를 유지하면서 아래 파일을 추가/확장한다.

```text
src/domain/
├── xrplClient.ts          # Client 연결, faucet wallet, submit/verify
├── xrplEncoding.ts        # hexEncode, rippleTime, memo helpers
├── xrplDid.ts             # DIDSet draft builder
├── xrplCredential.ts      # CredentialCreate/Accept draft builder
├── xrplPayment.ts         # rent Payment+Memo draft builder
├── xrplService.ts         # Escrow draft builder 유지/정리
└── xrpl*.test.ts          # draft validation + edge cases
```

`src/main.ts`에는 다음 상태만 연결한다.

- Testnet 연결 상태
- 데모 지갑 생성/조회
- DIDSet draft
- Credential draft
- Escrow draft/submit result
- Rent Payment memo draft
- Explorer/tx hash 검증 링크

## 구현 순서

### Phase 0: SDK 준비

- `xrpl` 설치
- `xrplClient.ts` 추가
- Testnet 연결/해제 함수 추가
- faucet wallet 생성은 명시 버튼으로만 실행
- `account_info` 조회 화면 추가

완료 기준:

- 앱에서 Testnet 연결 상태가 보인다.
- 테스트 계정 주소와 잔고를 조회할 수 있다.
- 빌드와 테스트가 통과한다.

### Phase 1: Draft builders

- `xrplEncoding.ts` 추가
- DIDSet draft builder 추가
- CredentialCreate/Accept draft builder 추가
- Rent Payment memo draft builder 추가
- 기존 Escrow draft builder와 helper 중복 제거

완료 기준:

- 모든 draft가 deterministic하게 생성된다.
- memo hex, ripple time, amount drops 테스트가 있다.
- 개인정보 원문이 transaction JSON에 들어가지 않는다.

### Phase 2: Testnet submit

- EscrowCreate submit
- Payment submit
- 제출 결과 validated 확인
- tx hash/ledger index/sequence UI 표시
- 실패 시 XRPL result code를 그대로 표시하고 원인 링크 연결

완료 기준:

- 최소 1개 EscrowCreate가 Testnet에서 validated 된다.
- 최소 1개 Payment+Memo가 Testnet에서 validated 된다.
- 실패 케이스도 화면에서 이유를 볼 수 있다.

### Phase 3: 발표용 검증 화면

- 임대인 검증 페이지에 tx hash, account, memo hash, escrow state를 표시
- “원문 개인정보 없음”을 구조적으로 보여준다.
- mock 신뢰 점수와 온체인 anchor를 분리해서 보여준다.

완료 기준:

- 임대인이 공유 링크 화면에서 신뢰 리포트와 XRPL 근거를 함께 확인한다.
- Explorer 링크 또는 tx lookup 결과가 연결된다.

## 후순위로 미룰 것

아래는 해커톤 본 구현이 안정된 뒤에만 건드린다.

- Next.js 마이그레이션
- Express/Node 서버
- Supabase/SQLite 영구 DB
- Vercel 배포
- 실제 Xaman/Girin/GemWallet signing integration
- 실제 비자/고용보험 API
- 실제 KRW 결제
- 스테이블코인/IOU/Trust Line
- MPT
- DEX/AMM/Pathfinding
- Axelar/XRPL EVM sidechain
- Multi-sign 운영 계정
- Production-grade DID Document hosting

## 해커톤 발표 관점의 기술 메시지

NomokDon의 XRPL 사용 포인트는 “토큰을 하나 찍었다”가 아니라 다음 세 가지다.

1. **Trust Anchor**: DIDSet/Credential로 임차인의 신뢰 상태를 검증 가능한 anchor로 만든다.
2. **Deposit Protection**: Escrow로 예약금이 임대인에게 즉시 넘어가지 않게 보호한다.
3. **Privacy-Preserving Reputation**: 월세 이력 원문은 숨기고 Payment Memo hash로 평판의 근거만 남긴다.

따라서 MVP 화면도 이 세 가지가 바로 보이게 구성해야 한다.

## 외부 참고 링크

| 이름 | 링크 | 용도 |
|:---|:---|:---|
| XRPL Korea GitHub | https://github.com/xrplkorea | XRPL Korea 샘플/자료 출처 |
| XRPL Korea TypeScript 샘플 | https://github.com/xrplkorea/XRPL | 기능별 TypeScript 예제 참고 |
| XRPL Dev Source | https://xrplkorea.oopy.io/2f4898c6-80bf-8043-9162-dded31508893 | XRPL Korea 기술 자료 모음 |
| XRPL 공식 문서 | https://xrpl.org/docs | 프로토콜/트랜잭션 공식 기준 |
| xrpl.js 문서 | https://js.xrpl.org | TypeScript SDK API |
| xrpl-py 문서 | https://xrpl-py.readthedocs.io | Python SDK 참고 |
| XRPL Dev Console | https://xrplkorea.dev | 계정/트랜잭션/Flags 확인 |
| XRPL Explorer | https://livenet.xrpl.org | 계정/트랜잭션 조회 |
| Transaction Results | https://xrpl.org/docs/references/protocol/transactions/transaction-results | 실패 코드 해석 |
| Flags | https://js.xrpl.org/enums/AccountSetAsfFlags.html | AccountSet flag 참고 |
| XRPL meta | https://xrplmeta.org | 토큰/NFT 메타데이터 조회 |
| Ripple DevRel Hub | http://linktr.ee/rippledevrel | XRPL 개발자 자료 허브 |
