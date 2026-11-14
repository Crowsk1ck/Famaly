# Changelog

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
