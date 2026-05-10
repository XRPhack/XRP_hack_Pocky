# NomokDon (노목돈)

> **"목돈이 필요 없다"**  
> 재한 외국인을 위한 XRPL 기반 **주거 신뢰 패스** 로컬 MVP

이 저장소는 기존 문서와 static demo를 보존하면서, 루트에 Vite + TypeScript 기반 로컬 웹 앱을 추가합니다. MVP는 `docs/pitch/nomokdon_pitch_final.md` v3.1의 Phase 0 방향에 맞춰 **신뢰 리포트 + XRP 예약금 Escrow proof/fallback + 월세 이력 프로필**을 시연합니다.

## 로컬 실행

```bash
npm install
npm run test
npm run build
npm run dev
```

- `npm run dev`는 로컬 개발 서버만 실행합니다.
- 배포, 원격 서버, 외부 유료 서비스, 실제 자금 이동은 포함하지 않습니다.
- `.env`, seed, private key, API key가 필요하지 않으며 저장하지 않습니다.

## MVP 데모 플로우

1. **주거 신뢰 패스 발급**: mock 임차인/매물 데이터로 DID/Credential 스타일 증명을 만들고, 여권/전화번호 원문은 해시로만 반영합니다.
2. **임대인 공유 리포트**: 블랙박스 AI 점수가 아니라 비자, 고용/재학, 월세 부담률, 예약금 상태, 납부 이력을 설명 가능한 배지로 보여줍니다.
3. **예약금 보호**: XRP 예약금 Escrow proof/state를 결정론적 fallback으로 생성하고, 실제 KRW 이동과 명확히 구분합니다.
4. **월세 이력/프로필**: 납부 이력과 hashed anchor를 프로필 카드로 표시해 주거 신용 데이터 축적 흐름을 보여줍니다.

## 안전 경계

- XRPL 로직은 `src/domain/xrplService.ts`의 deterministic fallback service입니다.
- Testnet Explorer 링크는 demo proof를 설명하기 위한 fallback 링크이며, 실제 트랜잭션 제출을 요구하지 않습니다.
- Live Testnet 연결은 향후 TODO이며, 사용자 소유 signer를 주입하는 방식이어야 합니다.
- 실제 계약 배포, 실명 인증, 실제 KRW 결제, 지갑 seed 저장은 이 MVP 범위 밖입니다.
- Vault는 Phase 2 항목으로 남기고, 현재 MVP는 Phase 0: 신뢰 리포트와 예약금 보호에 집중합니다.

## 프로젝트 구조

```text
XRP_hack_Pocky/
├── index.html                     # Vite 앱 진입점
├── package.json                   # 로컬 앱 scripts/dependencies
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── main.ts                    # 네 가지 MVP 플로우 UI
│   ├── styles.css                 # 로컬 MVP 스타일
│   └── domain/
│       ├── hashing.ts             # SHA-256 hash/anchor 생성
│       ├── scenario.ts            # demo scenario/report state
│       ├── trust.ts               # 설명 가능한 trust checklist 계산
│       ├── trust.test.ts          # edge case tests
│       ├── types.ts
│       └── xrplService.ts         # safe XRPL fallback proof service
├── demo/                          # 기존 static demo 보존
└── docs/                          # 기획/리서치 문서 보존
```

## 해커톤 정보

- **해커톤**: 서울핀테크랩 × XRPL Korea — Korea Financial Innovation Program 2026
- **특별상**: 토스 특별상 (블록체인 기반 재한 외국인 금융생활 편의 개선)
- **팀**: Pocky
