# NomokDon (노목돈)

> **"목돈이 필요 없다"**  
> 재한 외국인을 위한 XRPL 기반 **주거 신뢰 패스** 로컬 MVP

이 저장소는 Vite + TypeScript 프런트엔드와 작은 Node API로 구성된 v2 로컬 MVP입니다. 현재 데모는 임차인 모바일 앱, 공개 검증 페이지, 발급자 콘솔, XRPL Testnet 증거, Toss mock unlock, 로컬 데모 대본과 영상을 중심으로 동작합니다.

## 로컬 실행

```bash
npm install
npm run test
npm run build
npm run dev
```

- `npm run dev`는 Vite 개발 서버를 실행합니다.
- `npm run server`는 `/api`를 제공하는 로컬 Node 서버를 실행합니다.
- 배포, 원격 서버, 외부 유료 서비스, 실제 자금 이동은 포함하지 않습니다.
- `.env`, seed, private key, API key가 필요하지 않으며 저장하지 않습니다.

## MVP 데모 플로우

1. **임차인 모바일 앱**: mock Toss 로그인, 온보딩, 3단계 trust pass wizard, 대시보드, 공유 QR을 제공합니다.
2. **임대인 verify page**: 로그인 없이 공개 리포트 ID, Trust Grade, 여섯 개 검증 배지, XRPL Testnet 링크를 확인합니다.
3. **Issuer console**: happy/edge fixture로 DID, Credential, Payment, Escrow evidence를 dry run 또는 live submit 형태로 기록합니다.
4. **Toss mock unlock**: 실제 Toss API 없이, 신뢰 패스가 금융생활 혜택 설명으로 이어지는 화면만 보여줍니다.
5. **데모 자료**: `docs/demo-script.md`, `docs/demo-video.mp4`, Playwright evidence, `scripts/demo-fixtures.json`을 사용합니다.

## 안전 경계

- XRPL 로직은 `src/domain/*`와 `server/server.ts`에서 Testnet fixture/live evidence를 생성하거나 검증합니다.
- 앱은 seed/private key를 저장하지 않습니다. 실제 제출은 사용자 소유 지갑 또는 signer를 주입해 처리해야 합니다.
- 현재 MVP는 외부 유료 API, 실제 Toss API, 실제 KRW 이동을 포함하지 않습니다.
- 실제 계약 배포, 실명 인증, 실제 KRW 결제, 지갑 seed 저장은 이 MVP 범위 밖입니다.
- 이전 정적 시안 폴더는 현재 v2 데모 경로가 아니며, 문서와 발표는 이 루트 앱 기준으로만 진행합니다.

## 프로젝트 구조

```text
XRP_hack_Pocky/
├── index.html                     # Vite 앱 진입점
├── tenant/                        # 임차인 모바일 앱 entry
├── verify/                        # 임대인 공개 검증 entry
├── issuer/                        # 발급자 콘솔 entry
├── package.json                   # 로컬 앱 scripts/dependencies
├── server/                        # mini Node API
├── scripts/                       # demo fixtures
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── main.ts                    # tenant app UI
│   ├── styles.css                 # 로컬 MVP 스타일
│   └── domain/
│       ├── adapters/              # visa, employment, rent ledger fixtures
│       ├── report.ts              # shareable report builder
│       ├── trust.ts               # 설명 가능한 trust checklist 계산
│       ├── types.ts
│       └── xrpl*.ts               # DID, Credential, Payment, Escrow helpers
└── docs/                          # current demo docs plus quarantined research
```

## 해커톤 정보

- **해커톤**: 서울핀테크랩 × XRPL Korea, Korea Financial Innovation Program 2026
- **특별상**: 토스 특별상 (블록체인 기반 재한 외국인 금융생활 편의 개선)
- **팀**: Pocky
