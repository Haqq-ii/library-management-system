---
status: testing
phase: 04-notifications-backups
source: [04-VERIFICATION.md]
started: 2026-06-22T16:30:00.000Z
updated: 2026-06-22T16:30:00.000Z
---

## Current Test

number: 1
name: Database backup sidecar produces a valid dump file
expected: |
  Running the db-backup sidecar (or triggering pg_dump manually) produces a
  non-zero `.dump` file in the `./backups/` directory. This confirms that the
  sidecar credentials, network, and pg_dump command are all wired correctly.
awaiting: user response

## Steps to verify

```bash
# Start the database and backup sidecar
docker compose up -d db db-backup

# Wait ~10 seconds for db to be healthy, then trigger a manual dump
docker compose exec db-backup sh -c "pg_dump -Fc library_dev > /backups/db-manual.dump"

# Confirm a non-zero file exists
ls -lh ./backups/
```

Expected output: a file like `db-manual.dump` with non-zero size (should be at least a few KB even on an empty DB).

## Automated coverage (already passing)

SC-1 NOTF-01/02 (due-date + overdue cron) — 6 tests green
SC-2 NOTF-02 (daily alert idempotency) — verified in overdue-scan tests
SC-3 NOTF-03 (hold-ready on return) — 4 tests green including no-throw isolation
SC-4 NOTF-04 (delivery log UI) — requireRole guard + NotificationLog write verified

## On pass

Reply "done" or "backup verified" — the orchestrator will mark Phase 4 complete.
