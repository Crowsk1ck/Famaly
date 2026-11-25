## 17.2.0 — 2026-11-25

- Added public **/register/** page styled after the requested dark GTA RP portal: login, password, in-game nickname, numeric Static ID, Discord and Telegram.
- Public registration creates a **pending request** only, never an active session or elevated account. Leader-only moderation creates a regular member after explicit approval.
- Secure PBKDF2 password hashes are never returned by APIs and are cleared from reviewed registration requests; CSRF/header checks, IP rate limits and optimistic version checks protect moderation.
- Added Telegram as a private account field; no contact details appear in the public family roster.
- Added additive D1 migration `0009_public_account_registration.sql` and a strictly guarded one-time production migration before new Worker deployment.
- Responsive design, public SEO, tests (API and desktop/mobile Chromium), and production read-only registration smoke checks.

# Changelog

## 17.1.0 — 2026-11-15

- Scheduled, read-only production monitoring: public health, public API, anonymous access controls, and security headers.
- Weekly GitHub metadata check for successful private encrypted D1 backups after v17.0; does not access backup material or alter production.
- Node.js fixture tests cover privacy failures, missing authentication controls, and stale/failed backup runs.
- Closed superseded legacy PRs #1, #8, and #46 without merging old patches; all requested core features already exist in main.
- Production-account acceptance and actual encrypted R2 backup validation remain tracked in Issue #97.

## 17.0.0 — 2026-11-14

- **v16.1:** real Chromium acceptance for logged-in SPA: 4 roles × desktop/mobile, local synthetic API only; runs automatically in GitHub Verify.
- **v16.2:** accessible modal focus/scroll management and mobile form layout.
- **v16.3:** security headers consistently added to public assets/SEO HTML and JSON APIs.
- **v16.4:** encrypted D1 export is decrypted and restored into disposable local SQLite for integrity verification *before* private upload; CI runs a synthetic backup drill.
- **v16.5:** source/gzip size budgets prevent unexpected frontend bloat.
- **v16.6:** updated release/backup/rollback documentation and regression tests.
- **v17.0:** stable release candidate requires green Verify, production deploy and public browser smoke. Real authenticated production-account manual acceptance and next live backup run remain follow-up operational checks.
- No D1 migrations or changes to payout, contract, Discord delivery, and public image storage.

## 1.0.0 — 2026-11-12
- Separate Grizzly Family website and D1 management panel.
- Leader/bootstrap, roles, sessions, rate limiting, safe cookies and permission checks.
- 15 editable ranks; departments; roster, reports, promotion approvals, task/contract/CAPT flows.
- Atomic contract settlement; CAPT payout de-duplication; member balance and ledger.
- Public application form, ImgBB proofs, events RSVP, gallery, settings, audit and notifications.
- Ukrainian responsive Soft Dark Minimal UI, JSON export, basic CI tests.
