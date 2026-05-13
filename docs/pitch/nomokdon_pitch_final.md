# 노목돈(NomokDon) v2 Pitch

> 목돈이 필요 없다
> 재한 외국인을 위한 모바일 주거 신뢰 패스

## 1. 문제

재한 외국인은 한국에서 집을 구할 때 신뢰를 설명하기 어렵습니다. 비자 상태, 고용 또는 재학 상태, 월세 납부 이력, 예약금 보호 상태가 흩어져 있고, 임대인은 이 정보를 빠르게 확인하기 어렵습니다.

그 결과 임차인은 과도한 보증금과 반복 서류 제출을 겪고, 임대인은 외국인 임차인의 리스크를 보수적으로 판단합니다.

## 2. 해결책

노목돈은 임차인이 모바일에서 주거 신뢰 패스를 만들고, 임대인이 공개 리포트로 확인하는 로컬 MVP입니다.

핵심 흐름은 단순합니다.

1. 임차인이 mock Toss 로그인으로 들어옵니다.
2. 3단계 wizard에서 DID, credential, 월세 평판, 예약금 보호 evidence를 확인합니다.
3. 앱이 Trust Grade와 여섯 개 검증 배지를 만듭니다.
4. 임차인이 QR 또는 링크로 리포트를 공유합니다.
5. 임대인은 로그인 없이 verify page에서 리포트를 확인합니다.

## 3. 현재 데모에서 보여주는 것

현재 구현은 다음 기능을 실제 로컬 앱으로 보여줍니다.

1. Tenant mobile app: mock 로그인, 온보딩, trust pass wizard, 대시보드, 공유 QR
2. Verify page: 공개 리포트 확인, Trust Grade, 여섯 개 배지, XRPL Testnet 링크
3. Issuer console: happy/edge fixture, evidence 생성, dry run 또는 live submit 상태 표시
4. Toss mock unlock: 실제 Toss API 없이 금융생활 혜택 설명 화면만 시연
5. Demo package: `docs/demo-script.md`, `docs/demo-video.mp4`, Playwright evidence, `scripts/demo-fixtures.json`

## 4. 왜 XRPL인가

이 MVP에서 XRPL은 임차인 신뢰 정보를 검증 가능한 evidence로 설명하기 위해 사용됩니다.

DID와 credential은 임차인의 비자, 고용 또는 재학, 월세 평판 정보를 검증 가능한 구조로 보여줍니다. Payment memo와 Escrow evidence는 예약금 보호와 월세 평판을 임대인이 확인할 수 있는 링크와 해시로 연결합니다.

현재 발표 범위는 XRPL Testnet evidence입니다. 운영 자금 이동, 운영 금융상품, 실제 Toss API, 실제 KRW 정산은 현재 MVP 기능이 아닙니다.

## 5. Toss와의 접점

Toss mock unlock은 블록체인 세부사항을 사용자에게 길게 설명하지 않습니다. 대신 사용자가 신뢰 패스를 만든 뒤, 어떤 금융생활 혜택 안내로 이어질 수 있는지 보여줍니다.

토스 관점의 가치는 세 가지입니다.

1. 외국인 사용자가 주거 신뢰를 쉽게 설명합니다.
2. 임대인은 공개 리포트로 최소 정보를 빠르게 확인합니다.
3. 월세 평판은 향후 대안 신용 설명의 출발점이 될 수 있습니다.

## 6. 범위 밖

다음 항목은 현재 MVP 또는 데모 발표의 현재 기능으로 말하지 않습니다.

1. 운영 배포
2. 실제 Toss API 연동
3. 실제 KRW 결제나 정산
4. 실제 사용자 지갑 seed 저장
5. 운영 금융상품 판매
6. 삭제된 정적 데모 폴더 사용

## 7. 한 문장 피치

노목돈은 재한 외국인이 모바일에서 주거 신뢰 패스를 만들고, 임대인이 공개 리포트로 검증하는 XRPL Testnet 기반 로컬 MVP입니다.
