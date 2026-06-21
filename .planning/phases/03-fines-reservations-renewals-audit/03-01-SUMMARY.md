---
phase: "03"
plan: "01"
subsystem: "database/schema"
tags: [prisma, schema, migration, audit-log, fines]
dependency_graph:
  requires: []
  provides:
    - AuditLog model (table + Prisma client type)
    - AuditAction enum (9 values)
    - Fine.waivedReason String? field
    - User.auditLogs AuditLog[] relation
  affects:
    - All Phase 3 plans that write AuditLog entries (03-02, 03-03, 03-04, 03-05, 03-06)
    - Fine waiver workflow (waivedReason field now available)
tech_stack:
  added: []
  patterns:
    - Prisma schema extension (additive, non-breaking)
    - Migration with CREATE TYPE + ALTER TABLE + CREATE TABLE + ADD CONSTRAINT
key_files:
  created:
    - prisma/migrations/20260621140435_phase3_audit_fines/migration.sql
  modified:
    - prisma/schema.prisma
decisions:
  - AuditLog.createdAt uses @db.Timestamptz(3) consistent with all other DateTime fields in the schema (UTC convention)
  - AuditAction enum placed after ReservationStatus enum (logical grouping — all status/action enums together)
  - AuditLog model placed after NotificationLog model (end of schema — new models append)
  - waivedReason placed after waivedBy for logical grouping (waiver-related fields together)
metrics:
  duration: "~8 minutes"
  completed: "2026-06-21"
  tasks_completed: 2
  files_changed: 2
---

# Phase 03 Plan 01: Schema Extension — AuditLog, AuditAction, Fine.waivedReason Summary

**One-liner:** Added AuditLog model with AuditAction enum (9 values) and Fine.waivedReason field via migration `20260621140435_phase3_audit_fines`, enabling all downstream Phase 3 audit writes.

## What Was Built

Extended `prisma/schema.prisma` with three additive changes and applied the migration to the local PostgreSQL database:

1. **Fine.waivedReason** — `String?` field added to the Fine model after `waivedBy`. Enables librarians to record the reason for a fine waiver when using the waiver dialog (FINE-02).

2. **AuditAction enum** — 9-value enum: `CHECKOUT`, `RETURN`, `FINE_WAIVED`, `BOOK_ADDED`, `BOOK_EDITED`, `BOOK_DELETED`, `MEMBER_ADDED`, `MEMBER_EDITED`, `MEMBER_DEACTIVATED`. Covers all librarian mutation actions tracked in Phase 3 (AUD-01, AUD-02).

3. **AuditLog model** — Full audit trail table with: `id`, `actorId` (FK to User), `action` (AuditAction), `entityType`, `entityId`, `details` (Json?), `createdAt` (@db.Timestamptz). Actor relation added to User model (`auditLogs AuditLog[]`).

## Tasks

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Extend prisma/schema.prisma | c8dd504 | prisma/schema.prisma |
| 2 | Run migration and regenerate Prisma client | 2e372df | prisma/migrations/20260621140435_phase3_audit_fines/migration.sql |

## Verification Results

- `npx prisma validate` — exits 0 (schema valid)
- `npx prisma migrate status` — "Database schema is up to date!" (2 migrations applied, 0 pending)
- `grep "model AuditLog" prisma/schema.prisma` — matches
- `grep "waivedReason" prisma/schema.prisma` — matches
- `grep -l "AuditLog" src/generated/prisma/index.d.ts` — matches (AuditLog type in generated client)
- `grep -l "AuditAction" src/generated/prisma/index.d.ts` — matches (AuditAction enum in generated client)

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new network endpoints or auth paths introduced. Schema extension only. The AuditLog.actorId FK to User.id is enforced at DB level (RESTRICT on delete). The plan's threat model mitigations (T-03-01-01, T-03-01-03) are satisfied: schema was validated before migration, and actorId will be sourced from `session.user.id` inside `requireRole()` in all downstream plans.

## Known Stubs

None — this plan produces only schema/migration artifacts. No UI or application code stubs.

## Self-Check: PASSED

- [x] `prisma/schema.prisma` exists and contains model AuditLog
- [x] `prisma/migrations/20260621140435_phase3_audit_fines/migration.sql` exists
- [x] Commits c8dd504 and 2e372df exist in git log
- [x] `src/generated/prisma/index.d.ts` contains AuditLog and AuditAction
