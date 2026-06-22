---
phase: 04-notifications-backups
plan: "05"
subsystem: infra
tags: [docker, postgres, pg_dump, backup, docker-compose]

# Dependency graph
requires:
  - phase: 04-01
    provides: Email foundation (sendAndLog, NotificationLog) — this plan is infrastructure-only, no dependency
  - phase: 01-03
    provides: docker-compose.yml base structure (db service with healthcheck) that the backup sidecar mirrors
provides:
  - Daily automated pg_dump sidecar (db-backup service in docker-compose.yml)
  - ./backups host-mount for backup artifacts (gitignored)
  - README documentation for both self-hosted sidecar and Railway native managed backups
  - Human-verified proof that a real .dump file is produced
affects: [phase-05, ops, deployment]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "pg_dump sidecar pattern: postgres:16-alpine image with crond running daily pg_dump -Fc to host-mounted ./backups"
    - "Backup security: backups/ added to .gitignore — backup files contain plaintext PII and must never be committed"
    - "Healthcheck gate: db-backup depends_on db condition service_healthy to avoid dump on unavailable DB"

key-files:
  created: []
  modified:
    - docker-compose.yml
    - README.md
    - .gitignore

key-decisions:
  - "Self-hosted backup uses a sidecar container (same postgres:16-alpine image) with Alpine crond rather than a host cron job — keeps all infra in docker-compose.yml, no host-level setup"
  - "Backup schedule runs at 02:00 UTC daily — low-traffic window, matches conventional off-peak backup window"
  - "pg_dump -Fc (custom format) chosen over plain SQL — compressed, supports selective restore, smaller files"
  - "backups/ added to .gitignore; backup files contain full DB contents including PII and password hashes — never commit"
  - "Railway native managed backup (Dashboard -> PostgreSQL -> Settings -> Backups) documented as production path — zero code required"

patterns-established:
  - "Backup sidecar pattern: separate docker-compose service for scheduled pg_dump with host bind mount, healthcheck dependency, and doubled $$ to prevent Compose variable interpolation in the cron command"

requirements-completed: [INFRA-05]

# Metrics
duration: 15min
completed: 2026-06-22
---

# Phase 04 Plan 05: Backups Summary

**Daily pg_dump backup sidecar added to docker-compose.yml using postgres:16-alpine + Alpine crond, with host-mounted ./backups volume, gitignore protection, and README docs covering both self-hosted sidecar and Railway native managed backups — human-verified via manual pg_dump producing a non-zero .dump file**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-06-22
- **Completed:** 2026-06-22
- **Tasks:** 2 (1 auto, 1 human-verify checkpoint)
- **Files modified:** 3

## Accomplishments

- Added `db-backup` sidecar service to docker-compose.yml: `image: postgres:16-alpine`, daily `pg_dump -Fc` at 02:00 UTC via Alpine crond, `./backups:/backups` host bind mount, `depends_on: db: { condition: service_healthy }`
- Secured backup artifacts from accidental git commit: `backups/` added to `.gitignore` (backup files contain PII + password hashes)
- Documented both deployment paths in README.md: Railway native managed backups (Dashboard toggle, zero code) and self-hosted Docker sidecar with manual verification steps
- Human checkpoint passed: user confirmed a non-zero `.dump` file exists in `./backups/` after running manual `pg_dump`

## Task Commits

Each task was committed atomically:

1. **Task 1: pg_dump backup sidecar + README docs** - `fb0215a` (chore)
2. **Task 2: Human verify backup file exists** - human checkpoint (no code commit — verification only)

**Plan metadata:** (this SUMMARY commit)

## Files Created/Modified

- `docker-compose.yml` — Added `db-backup` sidecar service with pg_dump cron schedule and ./backups mount
- `README.md` — Added "## Database Backups" section covering Railway native backups and self-hosted sidecar with verification steps
- `.gitignore` — Added `backups/` entry to prevent backup files from being committed

## Decisions Made

- Self-hosted backup uses a sidecar container (same `postgres:16-alpine` image) with Alpine `crond` rather than a host cron job — keeps all infra declarative in `docker-compose.yml`, no host-level setup required
- `pg_dump -Fc` (custom format) chosen for compressed output with selective restore capability
- `$$PGDATABASE` and `$$(date +%F)` use doubled `$$` to prevent Docker Compose variable interpolation in the sidecar `command:` block
- Backup schedule at 02:00 UTC daily — conventional low-traffic window
- Railway native managed backup documented as the production path (zero-code, Dashboard-driven)

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

None — this plan is infrastructure-only (no UI, no data rendering).

## Threat Flags

No new threat surface beyond what the plan's threat model documented. The three threats (T-04-14, T-04-15, T-04-16) were all addressed:
- T-04-14 (backup committed to git): mitigated — `backups/` gitignored and verified
- T-04-15 (password hashes in backup): accepted — isolated volume/Railway service, not network-exposed
- T-04-16 (unbounded backup growth): accepted — single-institution scale; retention pruning deferred to v2 ops

## User Setup Required

None — no external service configuration required for the self-hosted path. For Railway production:
- Enable Daily backups in Railway Dashboard: PostgreSQL service -> Settings -> Backups -> Daily (retained 6 days)
- This is a dashboard toggle; no code changes needed.

## Next Phase Readiness

- INFRA-05 complete: automated daily backup configured and human-verified
- Phase 4 Wave 2 remaining: 04-02 (cron slice), 04-04 (delivery log UI), then Wave 3: 04-03 (hold-ready slice)
- No blockers introduced by this plan

---
*Phase: 04-notifications-backups*
*Completed: 2026-06-22*
