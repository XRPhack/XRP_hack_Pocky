# 최종 데모 체크리스트

로컬 MVP를 녹화하거나 발표하기 전에 이 checklist를 사용합니다.

## 로컬 Command

```bash
npm install
npm run build
npm run test
npm run test:e2e
```

Interactive rehearsal에는 다음 command를 사용합니다.

```bash
npm run dev:all
```

열어볼 URL:

- Tenant: `http://127.0.0.1:5173/tenant/`
- Verify: `http://127.0.0.1:5173/verify/`
- Issuer: `http://127.0.0.1:5173/issuer/`
- API health: `http://127.0.0.1:8787/api/health`

## Primary Happy Path

1. `/tenant/`에서 시작합니다.
2. mock Toss login을 사용합니다.
3. onboarding을 완료합니다.
4. trust pass wizard를 시작합니다.
5. DID를 확인합니다.
6. 기본 demo fixture로 document를 검증합니다.
7. credential을 확인합니다.
8. escrow를 확인합니다.
9. dashboard를 엽니다.
10. Toss mock unlock을 열었다가 돌아옵니다.
11. verification report link를 복사하거나 엽니다.
12. `/verify/report_*`에서 Trust Grade, six badges, document authenticity, XRPL Testnet evidence를 확인합니다.
13. landlord confirmation을 클릭합니다.

화면에 보여야 할 document cue:

- `Authenticity check ready`
- 업로드된 verification data가 만료된다는 retention copy
- `2 authenticity checks` 제목의 landlord verify page card

## Edge Backup Path

1. 새로운 tenant flow를 시작합니다.
2. wizard를 시작하기 전에 expired visa fixture를 선택합니다.
3. DID를 확인합니다.
4. document verification을 실행합니다.
5. wizard가 credential issuance 전에 멈추는지 확인합니다.

화면에 보여야 할 edge cue:

- `Pass cannot be created`
- expired visa reason
- dashboard 없음
- share report URL 없음

## Issuer Console 확인

tenant happy run 이후 `/issuer/`를 열고, `ISSUER_CONSOLE_PASSWORD`가 설정되어 있으면 로그인합니다.

확인 항목:

- 최신 log에 `Document verification`이 포함됩니다.
- document log detail에 document kind, review reason count, retention minute, replaced-previous status가 표시됩니다.
- 원본 document verification code, QR URL, full registration number, uploaded document body가 log에 나타나지 않습니다.

## Scope Phrase

데모에서 사용할 phrase:

- "This is a local MVP."
- "No real Toss API call is made."
- "No real government lookup is made."
- "Document codes and QR URLs are hashed or omitted."
- "XRPL evidence is Testnet or dry-run fixture evidence."

피해야 할 phrase:

- "real loan approval"
- "real identity verification"
- "government API connected"
- "production escrow"
- "mainnet transaction"
