# 노목돈 MVP 구현 설명

이 문서는 `NomokDon` 로컬 MVP가 단순 랜딩페이지와 무엇이 다른지 처음 보는 사람도 이해할 수 있도록 설명합니다.

결론부터 말하면, 현재 구현은 아직 실제 지갑 서명이나 XRPL Testnet 트랜잭션 제출까지 하지는 않습니다. 대신 해커톤 데모에서 안전하게 보여줄 수 있는 Phase 0 핵심 흐름을 로컬 앱 안에 구현했습니다.

- 임차인/매물/월세 이력 mock 데이터가 있습니다.
- 개인정보 원문을 그대로 보여주지 않고 SHA-256 해시로 바꿉니다.
- 비자, 고용, 월세 부담률, 예약금 잠금 상태, 납부 이력을 기준으로 신뢰 배지를 계산합니다.
- 임대인에게 공유할 수 있는 리포트 데이터를 만듭니다.
- XRPL 예약금 Escrow처럼 보이는 proof/state를 결정론적으로 생성합니다.
- 비자 만료나 월세 부담 과다 같은 edge case에서는 리포트 등급을 자동으로 낮춥니다.

즉, 화면은 랜딩페이지처럼 보일 수 있지만 내부에는 “데이터 -> 검증 -> 해시 -> 리포트 -> fallback XRPL proof -> UI 표시” 흐름이 연결되어 있습니다.

---

## 1. 무엇을 만든 것인가

이번 구현물은 `docs/pitch/nomokdon_pitch_final.md`의 Phase 0을 코드로 옮긴 로컬 MVP입니다.

Phase 0의 목표는 다음입니다.

1. 외국인 임차인의 신뢰 패스를 만든다.
2. 임대인이 이해할 수 있는 신뢰 리포트를 만든다.
3. 예약금이 보호되고 있다는 XRPL-style proof를 보여준다.
4. 월세 이력을 주거 신용 프로필처럼 보여준다.
5. 위험한 케이스는 좋은 리포트처럼 포장하지 않는다.

이 작업은 루트에 새 Vite + TypeScript 앱을 추가하는 방식으로 구현했습니다.

```text
index.html
src/main.ts
src/styles.css
src/domain/types.ts
src/domain/hashing.ts
src/domain/scenario.ts
src/domain/trust.ts
src/domain/xrplService.ts
src/domain/trust.test.ts
```

기존 `demo/` 폴더는 보존했습니다. 다만 새 MVP의 메인 구현은 루트 앱입니다.

파일별 역할은 이렇게 나뉩니다.

| 파일 | 역할 | 랜딩페이지와 다른 점 |
|---|---|---|
| `src/main.ts` | UI 렌더링 | 계산 결과를 화면에 보여주는 역할. 신뢰 판단 자체는 여기서 하지 않음 |
| `src/domain/types.ts` | 데이터 구조 정의 | 임차인, 매물, proof, escrow, badge, report의 타입을 분리 |
| `src/domain/scenario.ts` | 데모 시나리오와 최종 리포트 조립 | mock 데이터에서 privacy proof, escrow proof, checklist, rent hash를 합쳐 `ShareableReport` 생성 |
| `src/domain/trust.ts` | 신뢰 배지 계산 | 비자 만료, 고용 확인, 월세 부담률, 예약금 상태, 납부 이력으로 등급 계산 |
| `src/domain/hashing.ts` | 해시/앵커 생성 | 개인정보와 월세 이력을 SHA-256 기반 hash로 변환 |
| `src/domain/xrplService.ts` | XRPL fallback proof 생성 | 실제 트랜잭션 제출 없이 Testnet-style escrow proof/state 생성 |
| `src/domain/trust.test.ts` | 검증 테스트 | 정상/비자만료/월세부담과다 케이스가 기대대로 동작하는지 확인 |

정리하면 `src/main.ts`는 보기 좋게 보여주는 층이고, 실제 판단과 데이터 생성은 `src/domain/*`에 있습니다.

---

## 2. 화면만 있는 랜딩페이지와의 차이

단순 랜딩페이지는 보통 정적인 문구와 버튼만 있습니다.

현재 MVP는 다릅니다. 화면에 보이는 내용이 TypeScript 로직에서 생성됩니다.

```text
mock 임차인/매물 데이터
        ↓
개인정보 해시 및 Credential-style proof 생성
        ↓
신뢰 배지 계산
        ↓
XRPL 예약금 proof/fallback 생성
        ↓
임대인 공유 리포트 생성
        ↓
UI 렌더링
```

예를 들어 “월세 부담률 24%”는 그냥 적어둔 문구가 아니라 아래 데이터로 계산됩니다.

```text
월세 / 월소득 = 월세 부담률
680,000 / 2,750,000 = 약 24.7%
```

비자 만료일이 지나면 “비자 유효” 배지는 통과가 아니라 실패로 바뀝니다. 월세 부담률이 45%를 넘으면 “월세 부담률” 배지도 실패로 바뀝니다.

---

## 3. 전체 사용자 흐름

앱에는 네 가지 핵심 흐름이 있습니다.

### Flow 1. 주거 신뢰 패스 발급

화면에서는 임차인의 DID, Credential ID, 개인정보 해시, 발급자를 보여줍니다.

뒤에서는 `src/domain/scenario.ts`의 `issuePrivacyProof()`가 실행됩니다.

이 함수는 다음 일을 합니다.

1. 여권번호, 전화번호, 국적을 합칩니다.
2. 이 값을 SHA-256 해시로 바꿉니다.
3. 비자 유형, 비자 만료일, 고용 확인 여부를 Credential payload로 만듭니다.
4. Credential hash와 DID anchor hash를 만듭니다.
5. 화면에 보여줄 `PrivacyProof` 객체를 반환합니다.

중요한 점은 여권번호와 전화번호 원문을 화면에 보여주지 않는다는 것입니다. 화면에는 짧게 줄인 해시만 표시합니다.

### Flow 2. 임대인 공유 리포트

화면에서는 임대인에게 공유할 수 있는 리포트를 보여줍니다.

뒤에서는 `src/domain/trust.ts`의 `calculateTrustChecklist()`가 실행됩니다.

이 함수는 다음 배지를 계산합니다.

| 배지 | 판단 기준 |
|---|---|
| 비자 유효 | 비자 만료일이 지났는지 확인 |
| 고용/재학 확인 | mock 데이터의 `employmentVerified` 확인 |
| 월세 부담률 | 월세가 소득 대비 몇 퍼센트인지 계산 |
| 예약금 잠금 상태 | XRPL fallback proof가 locked 상태인지 확인 |
| 과거 납부 이력 | 미납/지연 납부가 있는지 확인 |

각 배지는 `pass`, `warning`, `fail` 중 하나가 됩니다.

전체 리포트 등급도 계산됩니다.

| 상태 | 의미 |
|---|---|
| `share-ready` | 임대인에게 공유 가능 |
| `review-needed` | 공유 가능하지만 설명 필요 |
| `not-shareable` | 공유 전 핵심 리스크 해결 필요 |

### Flow 3. 예약금 보호

화면에서는 기존 보증금, 노목돈 제안 보증금, 예약금, XRPL proof, memo hash, fallback TX 링크를 보여줍니다.

뒤에서는 `src/domain/xrplService.ts`의 `createDeterministicReservationProof()`가 실행됩니다.

이 함수는 실제 XRPL 트랜잭션을 제출하지 않습니다. 대신 같은 입력이면 항상 같은 결과가 나오는 deterministic fallback proof를 만듭니다.

생성되는 값은 다음과 같습니다.

- `mode`: `deterministic-fallback`
- `ledger`: `XRPL Testnet`
- `state`: `locked`
- `escrowSequence`: fallback sequence
- `txHash`: fallback transaction hash
- `explorerUrl`: Testnet Explorer 형식 링크
- `amountXrp`: 데모 환산 XRP 수량
- `memoHash`: 예약금 상태를 설명하는 hash

왜 이렇게 했는가?

해커톤 데모에서 seed/private key를 저장하거나 실제 지갑 서명을 요구하면 위험합니다. 그래서 지금은 “XRPL에 올릴 수 있는 형태의 proof/state”를 안전하게 보여주는 단계입니다.

실제 Testnet 제출은 나중에 사용자 소유 signer를 주입하는 방식으로 붙여야 합니다.

### Flow 4. 월세 이력/프로필

화면에서는 월세 납부 이력과 주거 신용 프로필을 보여줍니다.

뒤에서는 `buildShareableReport()`가 월세 이력을 `rentAnchorHash`로 묶습니다.

이때 월세 원장 전체를 그대로 올리는 것이 아니라, 납부일, 금액, 상태만 골라 해시 앵커를 만듭니다.

```text
월세 이력 원본
  -> 필요한 필드만 추출
  -> stable JSON 변환
  -> SHA-256 hash
  -> rentAnchorHash
```

---

## 4. 데이터는 어디서 시작되는가

데모 데이터는 `src/domain/scenario.ts`의 `demoScenario`에서 시작됩니다.

여기에는 세 가지 데이터가 있습니다.

1. 임차인 정보
2. 매물 정보
3. 월세 납부 이력

예시 임차인 데이터는 다음 의미를 가집니다.

```text
이름: Mina P.
국적: Vietnam
비자: E-9
비자 만료일: 2027-06-30
월소득: 2,750,000원
고용 확인: true
```

예시 매물 데이터는 다음 의미를 가집니다.

```text
기존 보증금: 20,000,000원
노목돈 제안 보증금: 3,000,000원
예약금: 2,000,000원
월세: 680,000원
```

이 데이터가 `buildShareableReport()`로 들어가면 최종 리포트가 만들어집니다.

---

## 5. 핵심 함수 하나로 보면

가장 중요한 함수는 `src/domain/scenario.ts`의 `buildShareableReport()`입니다.

이 함수가 전체 MVP 흐름을 조립합니다.

```text
buildShareableReport(scenario)
  1. issuePrivacyProof(tenant)
  2. createDeterministicReservationProof(tenant, property, 'locked')
  3. calculateTrustChecklist(tenant, property, rentHistory, escrow)
  4. createHashAnchor('rent-history', payments)
  5. ShareableReport 반환
```

결과로 만들어지는 `ShareableReport`에는 다음이 들어갑니다.

```text
tenantLabel
propertyLabel
proof
escrow
checklist
rentAnchorHash
generatedAt
```

`src/main.ts`는 이 결과를 받아 화면에 그립니다.

---

## 6. 개인정보는 어떻게 처리되는가

현재 MVP는 실제 개인정보를 다루지 않습니다. 모두 mock 데이터입니다.

그래도 구조상 개인정보 원문을 그대로 보여주지 않도록 만들었습니다.

`src/domain/hashing.ts`의 `sha256Hex()`가 브라우저 Web Crypto API로 SHA-256 해시를 만듭니다.

```text
passportNumber + phoneNumber + nationality
        ↓
SHA-256
        ↓
subjectHash
```

화면에는 전체 해시도 길기 때문에 `shortHash()`로 줄여서 보여줍니다.

이 구조는 “원문 개인정보를 그대로 노출하지 않고, 검증에는 해시를 사용한다”는 피치 방향을 코드로 표현한 것입니다. 실제 암호화 저장소나 키 관리는 아직 구현하지 않았고, 운영 단계에서 별도로 설계해야 합니다.

---

## 7. XRPL은 실제로 어디까지 구현됐는가

현재 구현은 실제 XRPL 트랜잭션 제출이 아닙니다.

정확히 말하면 다음을 구현했습니다.

| 항목 | 현재 구현 여부 |
|---|---|
| XRPL Testnet-style proof 생성 | 구현됨 |
| Escrow 상태값 `locked` 표현 | 구현됨 |
| fallback TX hash 생성 | 구현됨 |
| Explorer 형식 링크 생성 | 구현됨 |
| seed/private key 저장 | 안 함 |
| 실제 XRPL Testnet submit | 아직 안 함 |
| 실제 KRW 이동 | 안 함 |
| 실제 Vault | 안 함 |

왜 실제 제출을 바로 하지 않았는가?

이번 범위에서 사용자가 명시적으로 제외한 것이 있었습니다.

- 컨트랙트 실제 배포
- 서버 배포
- 외부 유료 서비스 설정
- 지갑/키/시크릿 같은 되돌리기 어려운 작업

그래서 현재는 안전한 로컬 MVP로 구현했습니다. 나중에 실제 Testnet 제출을 붙일 때는 `src/domain/xrplService.ts`의 TODO처럼 사용자 소유 signer를 주입하는 방식으로 확장해야 합니다.

---

## 8. Toss 관련 구현은 무엇인가

앱에는 `Toss Strategy` 섹션이 있습니다.

여기서 말하는 핵심은 다음입니다.

```text
Toss = 쉬운 금융 UX, 동의/공유/파트너 라우팅
XRPL = 제3자가 검증 가능한 예약금 상태 proof
규제권 파트너 = 실제 KRW 결제/정산/보증 처리
```

즉, Toss가 모든 블록체인 세부사항을 사용자에게 보여주는 구조가 아닙니다.

사용자에게는 다음 세 단계로 보이도록 설계했습니다.

1. 주거 신뢰 패스 발급
2. 임대인 리포트 공유
3. 예약금 보호 상태 확인

복잡한 DID, Credential, Escrow, hash는 뒤에서 근거로 작동하고, 사용자는 “내가 집을 구하는 데 필요한 신뢰 증명”으로 이해하게 만드는 방향입니다.

---

## 9. 엣지 케이스는 어떻게 확인하는가

앱 하단에는 “엣지 케이스 확인” 버튼이 있습니다.

이 버튼을 누르면 두 개의 나쁜 시나리오가 실행됩니다.

### 1. 비자 만료 시나리오

`createExpiredVisaScenario()`가 비자 만료일을 과거 날짜로 바꿉니다.

결과:

```text
비자 유효 배지: fail
전체 리포트: not-shareable
```

### 2. 월세 부담 과다 시나리오

`createHighRentBurdenScenario()`가 월소득을 낮춥니다.

결과:

```text
월세 부담률 배지: fail
전체 리포트: not-shareable
```

이게 중요한 이유는, 앱이 무조건 좋은 리포트만 보여주는 홍보 페이지가 아니라는 점입니다. 조건이 나쁘면 실제로 리포트 등급이 내려갑니다.

---

## 10. 테스트는 무엇을 검증하는가

테스트 파일은 `src/domain/trust.test.ts`입니다.

현재 세 가지를 검증합니다.

### 테스트 1. 정상 리포트 생성

확인하는 것:

- 기본 시나리오는 `share-ready`가 된다.
- 개인정보 hash는 64자리다.
- hash에 여권번호 원문이 포함되지 않는다.
- Escrow proof mode는 `deterministic-fallback`이다.
- Escrow state는 `locked`다.

### 테스트 2. 비자 만료 시 리포트 강등

확인하는 것:

- 비자 만료 시 전체 등급은 `not-shareable`이다.
- 비자 배지는 `fail`이다.

### 테스트 3. 월세 부담 과다 시 리포트 강등

확인하는 것:

- 월세 부담률이 45%를 넘으면 전체 등급은 `not-shareable`이다.
- 월세 부담률 배지는 `fail`이다.

실행 명령:

```bash
npm run test
```

---

## 11. 현재 구현에서 아직 안 한 것

아직 하지 않은 것도 명확히 구분해야 합니다.

| 항목 | 상태 |
|---|---|
| 실제 XRPL Testnet 트랜잭션 제출 | 아직 안 함 |
| 실제 지갑 연결 | 아직 안 함 |
| 실제 Toss API 연동 | 아직 안 함 |
| 실제 고용보험 API 연동 | 아직 안 함 |
| 실제 Credential 발급기관 연동 | 아직 안 함 |
| 실제 KRW 결제/정산 | 아직 안 함 |
| Vault 구현 | Phase 2로 보류 |
| 최종 UI polish | 보류 |

이 MVP의 목적은 “완성된 금융 서비스”가 아니라 “핵심 로직이 어떤 식으로 연결되는지 보여주는 안전한 로컬 데모”입니다.

---

## 12. 처음 보는 사람이 확인할 포인트

이 앱이 단순 랜딩페이지인지 아닌지 확인하려면 아래를 보면 됩니다.

### 확인 1. 테스트가 있다

```bash
npm run test
```

단순 랜딩페이지라면 보통 신뢰 배지 계산 테스트가 없습니다. 이 앱은 비자 만료와 월세 부담률 edge case를 테스트합니다.

### 확인 2. Domain 로직이 분리돼 있다

```text
src/domain/trust.ts
src/domain/scenario.ts
src/domain/hashing.ts
src/domain/xrplService.ts
```

화면 코드와 계산 로직이 분리되어 있습니다.

### 확인 3. 데이터가 바뀌면 결과도 바뀐다

예를 들어 `monthlyIncomeKrw`를 낮추면 월세 부담률 배지가 `fail`로 바뀝니다.

`visaExpiresAt`을 과거로 바꾸면 비자 배지가 `fail`로 바뀝니다.

### 확인 4. 개인정보 원문을 그대로 노출하지 않는다

여권번호와 전화번호는 화면에 직접 나오지 않고 hash로 변환됩니다.

### 확인 5. XRPL proof도 입력값에서 만들어진다

예약금, 임차인 ID, 매물 ID, 상태값으로 memo hash와 fallback TX hash를 만듭니다.

---

## 13. 실행 방법

```bash
npm install
npm run test
npm run build
npm run dev
```

브라우저에서 Vite가 알려주는 로컬 주소를 열면 됩니다.

---

## 14. 한 문장으로 요약

현재 구현은 완성된 금융 서비스가 아니라, 노목돈 Phase 0의 핵심 가설인 “외국인 임차인의 신뢰 정보를 해시/배지/XRPL-style proof로 만들어 임대인에게 공유한다”를 로컬에서 안전하게 보여주는 기능형 MVP입니다.
