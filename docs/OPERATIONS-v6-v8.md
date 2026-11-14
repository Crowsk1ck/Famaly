# GRIZZLY — production runbook (v6–v8)

## Deployment
- Source of truth: GitHub `main`.
- `.github/workflows/deploy-production.yml` runs on code changes to `main` and can be triggered manually.
- It checks syntax and `npm test` before deploying Worker `famaly`; **never** runs D1 migrations.
- Required GitHub Actions secrets: `CLOUDFLARE_API_TOKEN` (scoped to deploy only), `CLOUDFLARE_ACCOUNT_ID`. Set them in the repository or `production` environment.
- Treat `production` as a protected GitHub environment if reviews/approval are desired.
- Check `https://famaly.crowskick4133.workers.dev/api/health` and open the real domain after deployment. If a deployment fails, inspect Actions and use Cloudflare's version rollback controls.
- Run D1 schema migrations separately, using the existing manual migration workflow after reviewing pending SQL. Test migrations against a staging database.

## Encrypted private backups
- `.github/workflows/d1-private-backup.yml`: every Monday 03:17 UTC and manual invocation.
- It exports `grizzly-db` to a temporary SQL file, encrypts it with OpenSSL AES-256-CBC / PBKDF2 (310000 iterations), deletes plaintext, then uploads `.sql.enc` to a **private** Cloudflare R2 bucket. No SQL is ever uploaded as a GitHub Actions artifact.
- Required secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `GRIZZLY_BACKUP_R2_ACCESS_KEY_ID`, `GRIZZLY_BACKUP_R2_SECRET_ACCESS_KEY`, `GRIZZLY_BACKUP_PASSPHRASE` (long, randomly generated). Required GitHub variable: `GRIZZLY_BACKUP_BUCKET`.
- Create a **separate restricted private bucket** and R2 access credentials limited to that bucket; never expose them in chat, README or front-end code.
- Configure bucket lifecycle retention and access auditing in Cloudflare. Keep the passphrase in an independent secure credential store: without it, backups are unrecoverable.

### Restore procedure (staging first)
1. Download the desired encrypted backup from private R2 securely.
2. Decrypt locally in a restricted workspace:
   `openssl enc -d -aes-256-cbc -pbkdf2 -iter 310000 -in grizzly.sql.enc -out grizzly.sql -pass env:GRIZZLY_BACKUP_PASSPHRASE`
3. Create an isolated staging D1 database. Never test restores against live `grizzly-db`.
4. Restore with Wrangler D1 execute according to the installed Wrangler version and validate row counts, contracts, payouts, and permissions.
5. Securely delete the decrypted SQL after verification.

## Permissions
- Sensitive finance trends and audit events are gated by existing role-aware endpoints.
- Heads only receive permitted departmental activity from the scoreboard; standard members cannot access audit or detailed treasury transactions.
- Review access in four test accounts (leader, deputy, head, member) before promoting to production.

## Public pages
- Canonical public URLs: `/`, `/about/`, `/news/`, `/achievements/`, `/gallery/`, `/calendar/`, `/join/`.
- Historic `#about` and related links remain accepted in the JavaScript UI.
- The Worker serves distinct HTML title, description, canonical and static crawlable introductory content for these routes.
- Social preview graphic currently uses SVG; test Discord unfurling. If the platform rejects SVG, replace it with a PNG or JPEG and update `og:image`.

## Date convention
- Record form dates are stored as timezone-naive wall time, interpreted by the interface as **Europe/Kyiv** for scheduled events/deadlines.
- Do not append `Z` to these strings without converting them to UTC. Use consistent Kyiv-local values for creation and validation, including DST transitions.
