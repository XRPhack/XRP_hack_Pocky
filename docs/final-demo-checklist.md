# Final Demo Checklist

Use this checklist before recording or presenting the local MVP.

## Local Commands

```bash
npm install
npm run build
npm run test
npm run test:e2e
```

For interactive rehearsal:

```bash
npm run dev:all
```

Open:

- Tenant: `http://127.0.0.1:5173/tenant/`
- Verify: `http://127.0.0.1:5173/verify/`
- Issuer: `http://127.0.0.1:5173/issuer/`
- API health: `http://127.0.0.1:8787/api/health`

## Primary Happy Path

1. Start at `/tenant/`.
2. Use mock Toss login.
3. Complete onboarding.
4. Start the trust pass wizard.
5. Confirm DID.
6. Verify documents with the default demo fixture.
7. Confirm credentials.
8. Confirm escrow.
9. Open the dashboard.
10. Open Toss mock unlock, then return.
11. Copy/open the verification report link.
12. On `/verify/report_*`, confirm Trust Grade, six badges, document authenticity, and XRPL Testnet evidence.
13. Click landlord confirmation.

Expected visible document cues:

- `Authenticity check ready`
- retention copy saying the uploaded verification data expires
- landlord verify page card titled `2 authenticity checks`

## Edge Backup Path

1. Start a fresh tenant flow.
2. Select the expired visa fixture before starting the wizard.
3. Confirm DID.
4. Run document verification.
5. Confirm the wizard stops before credential issuance.

Expected visible edge cues:

- `Pass cannot be created`
- expired visa reason
- no dashboard
- no share report URL

## Issuer Console Check

After a tenant happy run, open `/issuer/` and log in if `ISSUER_CONSOLE_PASSWORD` is configured.

Check:

- latest logs include `Document verification`
- document log details show document kinds, review reason count, retention minutes, and replaced-previous status
- no raw document verification codes, QR URLs, full registration numbers, or uploaded document bodies appear in logs

## Scope Phrases

Use these phrases in the demo:

- "This is a local MVP."
- "No real Toss API call is made."
- "No real government lookup is made."
- "Document codes and QR URLs are hashed or omitted."
- "XRPL evidence is Testnet or dry-run fixture evidence."

Avoid these phrases:

- "real loan approval"
- "real identity verification"
- "government API connected"
- "production escrow"
- "mainnet transaction"
