# Production cutover runbook

This runbook is an operator checklist, not an automated deployment. DNS, Railway,
database, Apple, Google, Firebase, Stripe, Cloudinary, email, and mobile-store
actions require the relevant account owner to approve and perform them. The
repository scripts never run automatically.

## Preconditions and ownership

- Name one release lead, database operator, Railway owner, DNS owner, secrets
  owner, and mobile-release owner. Record a rollback decision deadline.
- Confirm CI is green on the exact commit and record its SHA.
- Install Node 20, Yarn 1, PostgreSQL client tools (`pg_dump`, `pg_restore`,
  `psql`), and authenticated provider CLIs where applicable.
- Copy `.env.example` into the Railway variable inventory; never commit a filled
  environment file or paste secrets into tickets/chat.

## 1. Freeze releases

1. Announce the release freeze and stop merging server, admin, and mobile changes.
2. Pause scheduled/manual deployments. Do not configure deployment from every
   push; deploy only the recorded SHA.
3. Record current server image/SHA, Railway deployment ID, mobile build, DNS
   values, database target, and the last known-good health responses.

## 2. Snapshot and verify

From this directory, load the intended production `DATABASE_URL` (or all legacy
`DB`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, and `DB_PORT` variables), then run:

```sh
yarn production:backup --confirm-backup --output=backups/pre-cutover.dump
pg_restore --list backups/pre-cutover.dump >/dev/null
```

The script refuses a target that does not look production-like. Only after
independently checking host and database name may a database operator append
`--allow-non-production`. Copy the verified snapshot to approved encrypted
storage and record its checksum and retention date.

## 3. Rotate and load secrets

The account owner must create new values, load them into Railway, and revoke old
values only after verification. Inventory:

- PostgreSQL credentials and TLS trust (`DATABASE_URL`, CA/system-CA choice)
- JWT access, refresh, signup, and reset secrets
- Stripe secret key and webhook signing secret
- Firebase service-account JSON
- Gmail/app-password credentials
- Cloudinary API key and secret
- Apple Service ID and Google OAuth client ID/credentials
- one-time admin bootstrap password and token

JWT rotation invalidates existing sessions unless the application temporarily
supports old and new keys; plan user reauthentication. Never log or echo values.

## 4. DNS and Railway configuration

1. The DNS owner lowers TTL in advance, then creates/updates `api.dinewell.ca`
   to the Railway-provided target. Do not guess the CNAME.
2. The Railway owner attaches and verifies the custom domain and TLS certificate.
3. Add every production-required variable from `.env.example`. Set
   `ALLOWED_ORIGINS` to exact HTTPS origins, with no wildcard.
4. Ensure the PostgreSQL URL points to the production service and configure TLS
   with `DB_CA_CERT_PATH` or `DB_SSL_ALLOW_SYSTEM_CA=true`.
5. Keep `railway.json` start and health settings. Startup runs idempotent SQL
   migrations under a PostgreSQL advisory lock before listening.

## 5. Reset and migrate the database

This rollout intentionally resets all application data. Reconfirm the verified
snapshot, written approval, maintenance window, and exact database target.

Exact destructive sequence:

```sh
export NODE_ENV=production
# Load DATABASE_URL and all required production variables without printing them.
yarn production:backup --confirm-backup --output=backups/immediate-pre-reset.dump
pg_restore --list backups/immediate-pre-reset.dump >/dev/null
yarn production:reset --confirm-reset=RESET-PRODUCTION-DATABASE
```

`production:reset` runs `DROP SCHEMA public CASCADE`, recreates `public`, and
then applies all migrations. Do not run `yarn migrate` separately after this.
For a non-destructive future rollout, use:

```sh
yarn production:migrate --confirm-migrate
```

## 6. Bootstrap the first admin

Set a unique temporary password and a random one-time token of at least 32
characters, then run:

```sh
yarn bootstrap:admin
```

Confirm login, force the password handoff/change, then immediately remove
`BOOTSTRAP_ADMIN_PASSWORD`, `ADMIN_BOOTSTRAP_TOKEN`,
`BOOTSTRAP_ADMIN_EMAIL`, and `BOOTSTRAP_ADMIN_NAME` from Railway. Leave
`ALLOW_ADDITIONAL_ADMIN=false`. The consumed token is hashed in the database.

## 7. Deploy and health-check the server

The Railway owner deploys the recorded SHA manually. Do not promote if startup
migrations fail. Verify:

```sh
curl --fail --silent --show-error https://api.dinewell.ca/health
curl --fail --silent --show-error https://api.dinewell.ca/ready
```

`/health` proves the process responds; `/ready` also authenticates to PostgreSQL.
Review Railway startup/runtime logs for errors while ensuring no secret values
appear.

## 8. Internal mobile release and smoke tests

The mobile owner produces an internal-only build configured for
`https://api.dinewell.ca`. TestFlight/Play Console signing, review, and tester
distribution require account-owner action.

Smoke-test with dedicated non-owner accounts:

- customer and merchant signup, login, refresh, logout, and password reset
- Apple and Google sign-in
- merchant image upload and Cloudinary retrieval
- admin login, merchant approval, settings, and dashboard
- Stripe test/approved low-value flow and signed webhook delivery
- points issue/scan/share and transaction history
- email delivery and Firebase push notification
- WebSocket authentication/reconnect and CORS rejection from an unapproved origin

Check database records, provider dashboards, error rates, and logs after each
critical flow. Do not use live customer payment details for testing.

## 9. Promote

After release-lead signoff, restore normal deployment controls, raise DNS TTL,
promote mobile builds through the account owners, and announce completion.
Monitor readiness, errors, latency, payment/webhook failures, email, push, and
database capacity through the agreed observation window.

## 10. Rollback

If the application fails but data remains valid, redeploy the recorded
last-known-good server SHA. If the reset/migration or new writes make the
database invalid:

1. Enter maintenance mode and stop all server instances/writers.
2. Take a final forensic backup; do not overwrite pre-cutover snapshots.
3. Have the database owner recreate/clean the target and restore the verified
   custom-format snapshot with `pg_restore --clean --if-exists --no-owner`.
4. Redeploy the last-known-good SHA and restore its matching secrets/config.
5. Re-run `/health`, `/ready`, and the critical smoke tests before reopening.

Database restoration is intentionally not scripted here because it is
destructive and must be performed by the database/account owner after selecting
the exact approved snapshot and target.
