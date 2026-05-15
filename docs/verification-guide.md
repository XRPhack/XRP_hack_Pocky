# NomokDon verification guide

This guide is the hand-check list for the current NomokDon MVP state. It separates what is already implemented from what the project owner should verify before demo submission.

## 1. Commit split recommendation

Do not make one giant commit. Split the dirty working tree into reviewable chunks:

1. `feat(domain): add xrpl trust pass primitives`
   - Include `src/domain/**`, domain tests, and `scripts/demo-fixtures.json`.
   - Purpose: hashing, trust scoring, report building, XRPL DID/Credential/Payment/Escrow helpers, and fixture evidence.

2. `feat(apps): add tenant verify issuer demo surfaces`
   - Include `tenant/`, `verify/`, `issuer/`, `src/apps/**`, `src/shared/**`, `src/main.ts`, `src/styles.css`, and root HTML entry changes.
   - Purpose: separated tenant mobile app, landlord verify page, issuer console, i18n, Toss mock flow, and responsive demo UI.

3. `feat(api): add local api and secure report handling`
   - Include `server/**`, `api/[...path].ts`, API tests, and related TypeScript config changes.
   - Purpose: Toss mock auth, issuer auth, report APIs, logging, Vercel catch-all API, dry-run signing, and optional VC encryption.

4. `chore(deploy): configure vite and vercel runtime`
   - Include `vite.config.ts`, `vercel.json`, `package.json`, `package-lock.json`, `.gitignore`, `.env.example`, and `scripts/dev-all.mjs`.
   - Purpose: multi-entry Vite build, API proxy, Vercel rewrite, local full-stack startup, and safe env conventions.

5. `docs(demo): add demo script and verification docs`
   - Include `README.md`, `docs/demo-script.md`, `docs/verification-guide.md`, and cleaned product docs under `docs/implementation/`, `docs/pitch/`, `docs/research/`, `docs/strategy/`.
   - Purpose: current v2 scope, demo operation, and stale v1/demo-folder wording cleanup.

6. `chore(demo): add demo recording artifact` only if the repository is expected to carry the video.
   - Include `docs/demo-video.mp4`.
   - If the video is too large for normal git review, keep it outside git and replace it with an external link in docs.

7. Usually do not commit agent-internal artifacts.
   - Review before adding `.sisyphus/**`, `test-results/**`, and generated screenshots.
   - Keep only evidence screenshots if the submission explicitly needs local proof artifacts in the repo.

## 2. Environment variables and gitignore

`.gitignore` currently blocks local secret files:

- `.env`
- `.env.*`
- `.vercel`
- `node_modules/`
- `dist/`
- `*.log`

It explicitly allows `.env.example`, so safe variable names can be committed while real values stay local or in Vercel.

Use this local pattern:

```bash
cp .env.example .env.local
```

Then fill only the values you need. Do not commit `.env.local`.

### Required or useful variables

| Variable | Local need | Vercel need | Notes |
|---|---:|---:|---|
| `ISSUER_CONSOLE_PASSWORD` | yes for `/issuer/` login | yes | Server-only. Do not expose to browser code. |
| `ISSUER_SEED` | only for live Testnet signing | yes if live signing is required | Keep unset for dry-run demo. Never print or commit. |
| `XRPL_TESTNET_WS` | optional metadata right now | optional/project convention | Current code uses the fixed Testnet endpoint in `src/domain/xrplClient.ts`. |
| `NOMOKDON_ENABLE_LIVE_SUBMIT` | optional | optional | Set `true` only when live Testnet submit is intended. |
| `XRPL_NETWORK` | optional | optional | Use `testnet`; `mainnet` disables live submit in the API. |
| `VC_ENCRYPTION_KEY` | optional | optional | Enables AES-256-GCM report storage. Must be 32 bytes after parsing. |
| `ISSUER_ADDRESS` | optional | optional | Dry-run display fallback when no issuer seed is configured. |

Vercel production env metadata was previously observed for `ISSUER_CONSOLE_PASSWORD`, `ISSUER_SEED`, and `XRPL_TESTNET_WS`. Values are encrypted and should not be printed. If you change Vercel env values, trigger a new deployment because old deployments do not automatically change their runtime environment.

Useful read-only checks:

```bash
npx vercel env ls production
npx vercel inspect https://nomokdon.vercel.app
```

## 3. Why `npm run dev` looked empty

`npm run dev` starts only Vite. The app uses Vite proxy rules to send `/api` to `http://127.0.0.1:8787`, but that API server is a separate process.

Use this instead for local demo work:

```bash
npm run dev:all
```

It starts both:

- API server: `http://127.0.0.1:8787/api/health`
- Vite app: `http://127.0.0.1:5173`

Open the actual demo surfaces directly:

- Tenant app: `http://127.0.0.1:5173/tenant/`
- Verify app: `http://127.0.0.1:5173/verify/`
- Issuer app: `http://127.0.0.1:5173/issuer/`

The root `/` route is not the main demo journey. Treat it as a launcher/placeholder. The deployed Vercel app follows the same shape: use `/tenant/`, `/verify/`, and `/issuer/` directly.

## 4. Wave 5 status check

Wave 5 included integration, demo material, deployment/env, and optional VC encryption.

Verified local evidence:

- Demo script exists at `docs/demo-script.md` and references `docs/demo-video.mp4`.
- Demo video file exists at `docs/demo-video.mp4` and is an MP4 container.
- Vercel deployment route checks previously returned 200 for `/`, `/tenant/`, `/verify/`, `/issuer/`, and `/api/health`.
- `vercel.json` rewrites `/api/:path*` to the Vercel catch-all API function.
- `api/[...path].ts` delegates to `server/server.js`.
- VC encryption exists in `server/server.ts` through `VC_ENCRYPTION_KEY` and AES-256-GCM.
- `server/server.test.ts` verifies encrypted in-memory report storage, preserved report API responses, invalid-key failure, and no key leakage.

Important nuance:

- `/api/health` currently reports `mode: "dry-run"` unless live submit is explicitly enabled with a valid seed and opt-in env.
- Dry-run mode is acceptable for the planned demo if you rely on pre-submitted Testnet fixtures.
- If you want live Testnet submit on stage, verify the env and redeploy before the demo.

## 5. Full verification sequence

Run these from the repository root.

### Static checks

```bash
git status --short --untracked-files=all
npm test
npm run build
npm run test:e2e
```

Expected results:

- Tests pass.
- Build emits root, tenant, verify, and issuer HTML entries.
- Review `git status` before committing so internal/generated artifacts are not accidentally staged.

### Local app checks

Start the full local stack:

```bash
npm run dev:all
```

Then open:

```text
http://127.0.0.1:5173/tenant/
http://127.0.0.1:5173/verify/
http://127.0.0.1:5173/issuer/
http://127.0.0.1:8787/api/health
```

Check manually:

1. Tenant mock Toss login starts from `/tenant/`.
2. Onboarding advances through all steps.
3. Happy fixture creates a DID, verifies documents, issues credentials, locks escrow, and opens the dashboard.
4. Document step shows authenticity-ready status and retention copy.
5. Toss unlock screen appears from the dashboard.
6. Share/QR opens a verify report link.
7. Verify page shows Trust Grade, six badges, document authenticity, and Testnet links.
8. Issuer page asks for a password if `ISSUER_CONSOLE_PASSWORD` is configured.
9. Issuer simulator/logs work after login, including `document.verification` audit events after a tenant run.

### E2E checks

```bash
npm run test:e2e:happy
npm run test:e2e:edge
```

Or run both:

```bash
npm run test:e2e
```

Expected results:

- Happy path passes.
- Edge path with expired visa fixture passes.
- Screenshots/evidence may be regenerated under `.sisyphus/evidence/` or test output paths depending on the test.

### Vercel checks

```bash
/usr/bin/curl -sS -o /dev/null -w '%{http_code} %{url_effective}\n' https://nomokdon.vercel.app/
/usr/bin/curl -sS -o /dev/null -w '%{http_code} %{url_effective}\n' https://nomokdon.vercel.app/tenant/
/usr/bin/curl -sS -o /dev/null -w '%{http_code} %{url_effective}\n' https://nomokdon.vercel.app/verify/
/usr/bin/curl -sS -o /dev/null -w '%{http_code} %{url_effective}\n' https://nomokdon.vercel.app/issuer/
/usr/bin/curl -sS https://nomokdon.vercel.app/api/health
```

Expected results:

- Each page route returns 200.
- `/api/health` returns JSON with `ok: true`.
- `mode` is `dry-run` unless live Testnet submit is intentionally enabled.

### Vercel env checks

```bash
npx vercel env ls production
```

Expected names for production demo readiness:

- `ISSUER_CONSOLE_PASSWORD`
- `ISSUER_SEED` if live signing is required
- `XRPL_TESTNET_WS` if kept as deployment metadata/convention
- `VC_ENCRYPTION_KEY` if encrypted report storage is required in production

Do not print values. Only confirm names and target environment.

## 6. Final owner checklist

Before saying final okay, verify:

- The current branch contains only files you intend to commit.
- No real `.env`, seed, password, private key, or Vercel project metadata is staged.
- The demo video is intentionally committed or intentionally hosted outside git.
- The Vercel deployment you will submit is the `Ready` production deployment you inspected.
- The stage/demo mode is clear: dry-run with pre-submitted Testnet evidence, or live Testnet submit with explicit env opt-in.
