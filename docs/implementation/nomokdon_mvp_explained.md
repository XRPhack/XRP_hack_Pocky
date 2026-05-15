# 노목돈 v2 MVP 구현 설명

이 문서는 현재 저장소의 v2 로컬 MVP가 무엇을 시연하는지 설명합니다. 과거 아이디어 메모나 정적 시안이 아니라, 루트 Vite + TypeScript 앱과 mini Node API 기준입니다.

## 1. 현재 만든 것

노목돈은 재한 외국인이 임대인에게 주거 신뢰를 설명할 수 있도록 돕는 모바일 trust pass 데모입니다. 현재 구현은 세 화면과 하나의 로컬 API로 구성됩니다.

1. `/tenant/`: 임차인 모바일 앱입니다. mock Toss 로그인, 온보딩, trust pass wizard, 대시보드, 공유 QR, Toss mock unlock을 보여줍니다.
2. `/verify/`: 임대인 검증 페이지입니다. 로그인 없이 공개 리포트 ID, Trust Grade, 검증 배지, XRPL Testnet 링크를 확인합니다.
3. `/issuer/`: 발급자 콘솔입니다. happy fixture와 edge fixture로 DID, Credential, Payment, Escrow evidence를 생성하거나 검증합니다.
4. `server/server.ts`: 세 화면이 공유하는 로컬 API입니다. 세션, fixture, 리포트, issuer 이벤트 로그를 메모리에서 다룹니다.

현재 데모 경로는 위 항목입니다. 삭제된 정적 시안 폴더는 보존 대상도 실행 대상도 아닙니다.

## 2. 데모 플로우

임차인은 mock Toss 로그인으로 시작합니다. 앱은 여권번호, 전화번호, seed, private key를 저장하지 않는다는 안내를 먼저 보여줍니다.

그다음 3단계 wizard에서 공개 DID, 비자 credential, 월세 평판 credential, 예약금 보호 evidence를 확인합니다. 정상 fixture에서는 Trust Grade와 여섯 개 배지가 만들어지고, edge fixture에서는 만료된 비자 때문에 pass 생성이 막힙니다.

대시보드에서는 공유 링크와 QR을 제공합니다. 임대인은 `/verify/report_*`에서 리포트를 확인하고, 확인 버튼을 눌러 검증 상태를 기록합니다.

Issuer console은 발표자가 evidence 상태를 보여주는 운영자 화면입니다. dry run이 기본이며, live submit은 별도 환경이 준비된 경우에만 사용합니다.

문서 업로드 기반 비자/고용 검증은 `POST /api/verification-documents`에서 처리합니다. API 요청/응답, `reviewReasons`, `retention`, `authenticity`, 감사 로그 계약은 `docs/document-verification-api.md`를 기준으로 설명합니다.

스캔 PDF나 이미지처럼 자동 파싱이 어려운 문서는 현재 실제 OCR을 수행하지 않고 수동검토 ticket만 생성합니다. 이 확장 지점은 `src/domain/adapters/document-review.ts`의 `DocumentReviewQueueAdapter`로 분리되어 있어, 추후 OCR 또는 운영자 승인 큐를 연결할 때 원문을 API 응답에 노출하지 않는 방식으로 교체할 수 있습니다.

## 3. XRPL 범위

현재 MVP는 XRPL Testnet evidence를 중심으로 합니다. DIDSet, CredentialCreate/Accept, Payment memo, Escrow 관련 데이터는 데모 fixture와 도메인 모듈에서 생성됩니다.

이 MVP가 하지 않는 일도 명확합니다.

1. 실제 사용자 지갑 seed 저장
2. 실제 KRW 결제나 정산
3. 실제 Toss API 호출
4. 운영용 배포나 원격 서버 의존
5. 운영 금융상품 판매

발표에서는 XRPL Testnet 증거와 로컬 API 흐름만 현재 기능으로 설명해야 합니다.

## 4. Toss mock unlock

Toss 관련 구현은 실제 Toss 연동이 아닙니다. 사용자가 신뢰 패스를 만들면 어떤 식으로 금융생활 혜택 설명 화면으로 이어질 수 있는지 보여주는 mock 화면입니다.

이 화면은 외부 API를 호출하지 않습니다. 목적은 사용자가 블록체인 세부사항을 직접 이해하지 않아도, 임대인 검증과 금융생활 설명으로 이어지는 UX를 보여주는 것입니다.

## 5. 주요 파일

```text
tenant/index.html
verify/index.html
issuer/index.html
src/main.ts
src/verify.ts
src/issuer.ts
src/domain/report.ts
src/domain/trust.ts
src/domain/xrplDid.ts
src/domain/xrplCredential.ts
src/domain/xrplPayment.ts
src/domain/xrplService.ts
server/server.ts
scripts/demo-fixtures.json
docs/demo-script.md
docs/document-verification-api.md
docs/demo-video.mp4
```

화면 코드는 각 entry 파일에서 시작하고, 신뢰 판단과 evidence 생성은 `src/domain/*`에 분리되어 있습니다. 로컬 API는 `server/server.ts`에서만 다룹니다.

## 6. 검증 포인트

처음 보는 사람이 랜딩페이지가 아닌 기능형 MVP인지 확인하려면 다음을 보면 됩니다.

1. happy fixture와 edge fixture가 서로 다른 결과를 만듭니다.
2. 만료된 비자는 pass 생성을 막습니다.
3. 검증 배지는 입력 evidence에서 계산됩니다.
4. 공개 verify page는 임대인용 리포트 상태를 따로 보여줍니다.
5. Issuer console은 evidence 로그와 fixture 상태를 따로 보여줍니다.
6. Playwright e2e와 unit test가 tenant, verify, issuer 흐름을 검증합니다.

## 7. 실행 방법

```bash
npm install
npm run test
npm run build
npm run server
npm run dev
```

개발 중에는 Vite가 `/api` 요청을 `http://127.0.0.1:8787`로 프록시합니다. `npm run server`와 `npm run dev`를 함께 실행하면 tenant, verify, issuer 흐름을 로컬에서 볼 수 있습니다.

## 8. 한 문장 요약

현재 구현은 완성된 금융 서비스가 아니라, 재한 외국인의 주거 신뢰 정보를 임차인 앱에서 만들고 임대인이 공개 페이지로 검증하는 v2 로컬 MVP입니다.
