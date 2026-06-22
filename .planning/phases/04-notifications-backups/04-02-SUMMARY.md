---
phase: "04"
plan: "02"
subsystem: cron-notifications
tags: [node-cron, custom-server, overdue-scan, NOTF-01, NOTF-02, email, docker]
dependency_graph:
  requires:
    - src/lib/email.ts (sendAndLog helper — plan 01)
    - src/emails/DueDateReminderEmail.tsx (plan 01)
    - src/emails/OverdueAlertEmail.tsx (plan 01)
  provides:
    - server.ts (custom Next.js server with daily cron job)
    - src/jobs/overdue-scan.ts (scanAndNotify() handler)
    - src/lib/notifications.ts (sendDueDateReminder, sendOverdueAlert wrappers)
    - next.config.ts (standalone output removed)
  affects:
    - Dockerfile (runner stage rebuilt for standard Node.js build)
    - package.json (start script updated to custom server)
    - tests/unit/overdue-scan.test.ts (6 real NOTF-01/02 tests)
tech_stack:
  added: []
  patterns:
    - Custom Next.js server.ts pattern (http.createServer + next().prepare())
    - node-cron schedule registration inside app.prepare().then() callback
    - TDD RED/GREEN with vi.hoisted() for mock setup
    - UTC epoch math for due-date window calculation (getTime() arithmetic)
    - Date-scoped idempotency keys TYPE/loanId/YYYY-MM-DD for Resend deduplication
    - dueAt < now AND returnedAt IS NULL overdue query (not status-based)
key_files:
  created:
    - server.ts
    - src/jobs/overdue-scan.ts
    - src/lib/notifications.ts
  modified:
    - next.config.ts
    - Dockerfile
    - package.json
    - tests/unit/overdue-scan.test.ts
decisions:
  - "Used standard Node.js build (no standalone output) — instrumentation.ts + standalone is broken (Next.js issue #89377); custom server.ts is the correct mount point for node-cron"
  - "Dockerfile runner runs tsx server.ts directly — avoids esbuild bundling complexity while keeping tsx available as devDependency; production Docker image copies full node_modules"
  - "scanAndNotify() calls sendAndLog from @/lib/email directly — test mock intercepts at the email layer; notifications.ts wrappers provide the public API for future callers"
  - "Overdue scan uses dueAt < now AND returnedAt IS NULL filter — not loan.status = OVERDUE — to catch loans past due but not yet updated by the cron (Pitfall 4)"
metrics:
  duration: "~45 minutes"
  completed_date: "2026-06-22"
  tasks_completed: 2
  files_created: 3
  files_modified: 4
---

# Phase 04 Plan 02: Cron Slice Summary

**One-liner:** Custom server.ts registers a daily 06:00 UTC node-cron job that calls scanAndNotify(), which queries upcoming and overdue loans and dispatches due-date/overdue emails with date-scoped idempotency keys; standalone output conflict resolved.

## What Was Built

### Task 1: Remove Standalone Output + Custom server.ts + Dockerfile Runner

**Problem resolved:** `next.config.ts` had `output: "standalone"` which conflicts with `instrumentation.ts`-based cron registration (Next.js issue #89377 — instrumentation files are excluded from the standalone bundle). The existing Dockerfile runner copied `.next/standalone` and ran the built-in `server.js`.

**Changes:**

- `next.config.ts`: Removed `output: "standalone"`. Config is now an empty `NextConfig` object. Standard build output is used.
- `server.ts` (project root): Custom HTTP server wrapping Next.js App Router. Uses `createServer` from `http`, calls `next({ dev })`, and registers `cron.schedule("0 6 * * *", scanAndNotify, { timezone: "UTC" })` inside `app.prepare().then(...)`. The cron job fires once per day at 06:00 UTC in the persistent server process.
- `Dockerfile` runner stage: Replaced standalone-based runner with a standard Node.js runner. Builder stage runs `npm run build`. Runner stage copies `.next`, `public`, full `node_modules`, `src/`, and `server.ts`, then starts with `npx tsx server.ts`. Full `node_modules` is required because `node-cron` needs a persistent process.
- `package.json`: Updated `start` script to `NODE_ENV=production tsx server.ts`; added `start:dev` alias for `tsx server.ts`.

### Task 2: Notification Wrappers + Overdue-Scan Handler + NOTF-01/02 Tests (TDD)

**TDD RED:** Replaced the Wave 0 scaffold `tests/unit/overdue-scan.test.ts` with 6 real behavioral tests. Tests mock `@/lib/email` (sendAndLog spy) and `@/lib/db` (prisma.loan.findMany). Used `vi.hoisted()` to avoid "Cannot access before initialization" errors with mock factories. All 6 tests failed correctly before implementation (module not found — expected RED state).

**TDD GREEN:** Created the two implementation modules.

**`src/lib/notifications.ts`:** Exports `sendDueDateReminder()` and `sendOverdueAlert()`. Each wrapper builds the React Email element from loan/member/book fields and delegates to `sendAndLog` from `@/lib/email`. Pre-formats `dueDate` as `new Date(loan.dueAt).toISOString().slice(0, 10)` (UTC string, no `toLocaleDateString()`).

**`src/jobs/overdue-scan.ts`:** Exports `scanAndNotify(): Promise<void>`. Two query passes:
1. Upcoming loans: `{ status: "ACTIVE", dueAt: { lte: in3Days, gte: now }, returnedAt: null }` — dispatches `DUE_DATE_SAME` or `DUE_DATE_3DAY` based on `Math.round(daysUntilDue)`.
2. Overdue loans: `{ returnedAt: null, dueAt: { lt: now } }` — dispatches `OVERDUE_ALERT`. Query does NOT use `status: "OVERDUE"` (Pitfall 4: status is app-managed, not auto-updated by Postgres).

Idempotency keys: `<TYPE>/<loanId>/<YYYY-MM-DD>` format for both due-date and overdue sends (T-04-04 mitigation). Full scan body wrapped in try/catch; errors logged but do not abort the run (T-04-05 mitigation).

## Verification Results

- `npm test -- tests/unit/overdue-scan.test.ts`: **6/6 tests pass** (NOTF-01 + NOTF-02 covered)
- `grep -c "status: \"OVERDUE\"" src/jobs/overdue-scan.ts`: **0** (overdue query uses dueAt filter)
- `next.config.ts` has no `output: "standalone"` assignment: **verified**
- `server.ts` references `cron.schedule` and `scanAndNotify`: **verified**
- `Dockerfile` runner stage does not copy `.next/standalone`: **verified**
- `package.json` start script runs custom server: **verified**

Pre-existing test failures (9 tests across loan-actions, catalog-actions, loan-return, member-actions, isbn-fetch): present before this plan's changes. Out of scope per deviation rule scope boundary.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — server-side infrastructure only (cron, email dispatch). No UI components or data-binding stubs.

## Threat Flags

No new threat surface beyond what the plan's threat_model documents. All four T-04 threats mitigated as specified:
- T-04-04: Date-scoped idempotency keys implemented in scanAndNotify
- T-04-05: try/catch wraps entire scanAndNotify body
- T-04-06: Cron is in-process via server.ts — no HTTP endpoint exposed
- T-04-07: Overdue query uses `dueAt < now AND returnedAt IS NULL`, not status field

## TDD Gate Compliance

- RED gate: commit `e426bc4` — `test(04-02): add failing tests for scanAndNotify (RED phase — NOTF-01, NOTF-02)`
- GREEN gate: commit `8ee2e58` — `feat(04-02): implement scanAndNotify handler + notification wrappers (GREEN — NOTF-01, NOTF-02)`
- REFACTOR gate: not needed — implementation is clean

## Self-Check: PASSED

Files exist:
- server.ts: FOUND
- src/jobs/overdue-scan.ts: FOUND
- src/lib/notifications.ts: FOUND
- tests/unit/overdue-scan.test.ts: FOUND (6 tests passing)

Commits exist:
- fb61416: Task 1 — standalone removed, server.ts, Docker/build config
- e426bc4: TDD RED — 6 failing tests for overdue-scan
- 8ee2e58: TDD GREEN — scanAndNotify + notifications wrappers
