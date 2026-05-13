# NomokDon 3-minute demo script

Video artifact: `docs/demo-video.mp4`

Target runtime: about 2 minutes 30 seconds to 2 minutes 55 seconds when both Korean and English lines are read.

## 0:00 to 0:20, opening

**KO**: 노목돈은 재한 외국인을 위한 모바일 주거 신뢰 패스입니다. 로컬 데모에서 임차인이 패스를 만들고, 임대인이 공개 리포트로 확인하는 흐름을 보여드립니다.

**EN**: NomokDon is a mobile housing trust pass for foreign residents in Korea. This local demo shows a tenant creating a pass and a landlord verifying the public report.

## 0:20 to 0:45, Toss mock login and onboarding

**KO**: Toss App-in-App을 상상한 mock 로그인으로 시작합니다. 사용자는 익숙한 모바일 진입점에서 원문 개인정보를 노출하지 않는 안내를 보고, 세 단계 온보딩을 지나갑니다.

**EN**: We start with a mock login that imagines a Toss App-in-App entry point. The onboarding explains privacy, housing readiness, and trust through clear reasons.

## 0:45 to 1:20, 3-step trust pass wizard

**KO**: 이제 3-step wizard에서 패스를 만듭니다. DIDSet으로 공개 DID를 확인하고, 비자와 월세 평판 credential을 확인한 뒤, 예약금 보호 기록과 리포트 배지를 확인합니다. seed, private key, 여권 원문은 저장하지 않습니다.

**EN**: In the 3-step wizard, we confirm the DIDSet, review visa and rent-reputation credentials, then confirm reservation protection and report badges. The MVP stores no seed, private key, raw passport, or raw phone number.

## 1:20 to 1:55, dashboard and Toss benefit mock

**KO**: 대시보드에는 Trust Grade B, 여섯 개 검증 배지, DID, 공개 Testnet 주소, 공유 QR이 보입니다. Toss mock unlock 화면은 신뢰 패스가 금융생활 혜택 설명으로 이어질 수 있음을 보여줍니다. 외부 API 호출은 없습니다.

**EN**: The dashboard shows Trust Grade B, six badges, the DID, public Testnet address, and a QR share link. The Toss mock unlock screen shows how the pass can explain financial readiness. It makes no external API calls.

## 1:55 to 2:30, share, verify, and landlord confirmation

**KO**: 임차인은 리포트 링크나 QR을 공유합니다. 임대인은 로그인 없이 리포트 ID, Trust Grade, 여섯 개 배지, XRPL Testnet 링크를 확인합니다. "I have confirmed"를 누르면 확인 상태가 기록됩니다.

**EN**: The tenant shares the report link or QR code. The landlord verifies the report ID, trust grade, six badges, and XRPL Testnet links without logging in. Clicking "I have confirmed" records the confirmation.

## 2:30 to 2:55, edge fallback backup

**KO**: 백업 시연은 만료된 비자 fixture입니다. 이 경우 wizard는 "Pass cannot be created"를 보여주고, 대시보드와 공유 리포트를 만들지 않습니다. 갱신 후 다시 시도해야 합니다.

**EN**: The backup demo uses an expired-visa fixture. The wizard shows "Pass cannot be created" and does not create a dashboard or share report. The tenant must renew evidence before retrying.

## Operator notes

- Primary path: `/tenant/` mock login, onboarding, trust pass wizard, dashboard, App-in-App mock unlock, share link, `/verify/report_*`, landlord confirmation.
- Backup path: choose the expired visa fallback fixture in the wizard and show the renewal guide.
- Recording scope: local app only, no live identity provider, no paid service, no real fund movement.
