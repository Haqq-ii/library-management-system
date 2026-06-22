---
phase: 05-reports-analytics
plan: "01"
subsystem: reports
tags: [reports, analytics, recharts, fine-summary, server-actions, tdd]
dependency_graph:
  requires: []
  provides:
    - getFineSummary()
    - ActionResult<T>
    - FineSummaryCards
    - /reports page route with four-tab shell
    - recharts ^2.15.4 in package.json
  affects:
    - src/components/layout/AppSidebar.tsx (Reports nav entry added)
    - package.json (recharts dependency added)
tech_stack:
  added:
    - recharts ^2.15.4 (SVG-native chart library for future RPT-03 borrowing activity chart)
  patterns:
    - Server Component auth guard (getSession + redirect) — matches notifications/page.tsx pattern
    - ActionResult<T> discriminated union — mirrors audit/actions.ts
    - Prisma Decimal → Number serialization via Number(agg._sum.amount ?? 0)
key_files:
  created:
    - src/features/reports/actions.ts
    - src/features/reports/FineSummaryCards.tsx
    - src/app/(app)/reports/page.tsx
    - tests/unit/report-fine-summary.test.ts
  modified:
    - src/components/layout/AppSidebar.tsx
    - package.json
    - package-lock.json
decisions:
  - "Install recharts ^2.15.4 (latest 2.x) instead of 3.x — CLAUDE.md recommends 2.x; npm install resolved to 3.x which was overridden to pin to the vetted major version"
  - "Pre-existing TypeScript error in src/lib/email.ts (null vs InputJsonValue) is out of scope — confirmed pre-existing before Task 1, logged as deferred"
metrics:
  duration: "6m"
  completed_date: "2026-06-22"
  tasks_completed: 3
  files_created: 4
  files_modified: 3
---

# Phase 05 Plan 01: Reports Bootstrap — Fine Summary (RPT-04) Summary

**One-liner:** Bootstrapped the Reports feature with recharts install, /reports page shell with four tabs, librarian-only sidebar nav, and RPT-04 Fine Summary showing live all-time fine totals via TDD Server Action.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install recharts + sidebar nav entry | 4948f90 | package.json, package-lock.json, AppSidebar.tsx |
| 2 (RED) | Failing tests for getFineSummary | a64caf1 | tests/unit/report-fine-summary.test.ts |
| 2 (GREEN) | Implement getFineSummary Server Action | cc8d324 | src/features/reports/actions.ts |
| 3 | FineSummaryCards + /reports page shell | 715cc50 | src/features/reports/FineSummaryCards.tsx, src/app/(app)/reports/page.tsx |

---

## What Was Built

### recharts Installation (Task 1)

- Installed `recharts ^2.15.4` (latest stable 2.x — pinned to CLAUDE.md recommended 2.x per CLAUDE.md, not the 3.x that `npm install recharts` resolved to by default)
- Added `BarChart2` icon to AppSidebar.tsx lucide-react imports
- Appended `/reports` entry to `LIBRARIAN_NAV` (after "Notification Log"), labeled "Reports" with BarChart2 icon
- `MEMBER_NAV` unchanged — reports are librarian-only

### getFineSummary Server Action (Task 2 — TDD)

Located at `src/features/reports/actions.ts`:

- `"use server"` directive at top
- Exports `ActionResult<T>` discriminated union (identical shape to `audit/actions.ts`)
- `getFineSummary()` flow:
  1. `await requireRole("LIBRARIAN")` in try/catch → returns `{ success: false, error: "FORBIDDEN" }` on unauthorized (T-05-02)
  2. `prisma.fine.aggregate({ _sum: { amount: true } })` for total recorded
  3. `prisma.fine.aggregate({ _sum: { amount: true }, where: { status: "WAIVED" } })` for waived
  4. `Number(agg._sum.amount ?? 0)` converts Prisma Decimal to JS number, null coerced to 0
  5. `outstanding = recorded - waived` (no third DB query)
  6. DB errors caught → `console.error` + `{ success: false, error: "DB_ERROR" }`

**TDD Gate Compliance:**
- RED commit: `a64caf1` (test file only, import fails — confirmed failing before implementation)
- GREEN commit: `cc8d324` (implementation added — all 4 tests pass)

### FineSummaryCards Component (Task 3)

Located at `src/features/reports/FineSummaryCards.tsx`:

- Server Component (no `"use client"`)
- Props: `{ recorded: number; waived: number; outstanding: number }`
- Renders `grid gap-4 md:grid-cols-3` with three Cards
- Card 1 "Total Fines Recorded" — value `$X.XX`, no badge
- Card 2 "Total Waived" — value `$X.XX`, badge `bg-orange-100 text-orange-800`
- Card 3 "Total Outstanding" — value `$X.XX`, badge `bg-red-100 text-red-800`
- Summary note: `"Outstanding = Recorded minus Waived"` in `text-sm text-muted-foreground`

### /reports Page Shell (Task 3)

Located at `src/app/(app)/reports/page.tsx`:

- Async Server Component
- Auth guard: `getSession` → redirect `/login` if no session; redirect `/dashboard` if role !== "LIBRARIAN" (T-05-01)
- Calls `getFineSummary()` server-side; falls back to zeros on failure
- Four-tab shell: Overdue Loans / Popular Books / Borrowing Activity / Fine Summary
- Fine Summary tab renders `<FineSummaryCards />` with live data
- Other three tabs show "Coming soon" placeholder (intentional stubs for plans 05-02, 05-03, 05-04)

---

## Verification Results

- `npm install recharts @^2.15.4` — success, package.json updated
- `npx vitest run tests/unit/report-fine-summary.test.ts` — 4/4 tests pass
- `npx tsc --noEmit` — no errors in plan-related files (pre-existing error in src/lib/email.ts is out-of-scope — see Deferred Issues)
- Grep checks all pass: BarChart2, /reports href, "Total Fines Recorded", "getFineSummary", "Outstanding = Recorded minus Waived"

---

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Deviations Logged

**1. [Rule 1 - Deviation] recharts version pinned to 2.x instead of defaulting to 3.x**
- **Found during:** Task 1
- **Issue:** `npm install recharts` resolved to `recharts ^3.8.1` (latest) instead of `recharts ^2.x` as specified in CLAUDE.md recommended stack
- **Fix:** Re-ran `npm install recharts@^2.15.4` to pin to latest 2.x release matching CLAUDE.md spec
- **Files modified:** package.json, package-lock.json

---

## Known Stubs

| File | Stub | Reason |
|------|------|--------|
| src/app/(app)/reports/page.tsx | `<p>Coming soon</p>` in overdue/popular/activity TabsContent | Intentional placeholder per plan spec — plans 05-02, 05-03, 05-04 will replace each tab with real content |

These stubs do not block the plan's goal (RPT-04 Fine Summary is fully implemented). The other three tabs are out of scope for this plan.

---

## Threat Surface Scan

All security-relevant surfaces are covered by the plan's threat model:

| Threat ID | Surface | Mitigation Verified |
|-----------|---------|---------------------|
| T-05-01 | /reports page auth | Server Component checks role !== "LIBRARIAN" → redirect("/dashboard") |
| T-05-02 | getFineSummary Server Action | requireRole("LIBRARIAN") before any DB access — verified by Test 1 |
| T-05-03 | Fine aggregate response | Returns only totals (no PII, no per-record IDs) |

No new threat surface beyond what the plan's threat model covers.

---

## TDD Gate Compliance

- RED gate: commit `a64caf1` — test file created, tests fail (import error — implementation absent)
- GREEN gate: commit `cc8d324` — implementation added, all 4 tests pass
- REFACTOR: not needed — implementation is clean

---

## Self-Check: PASSED

Files exist:
- FOUND: src/features/reports/actions.ts
- FOUND: src/features/reports/FineSummaryCards.tsx
- FOUND: src/app/(app)/reports/page.tsx
- FOUND: tests/unit/report-fine-summary.test.ts

Commits exist:
- FOUND: 4948f90 (recharts + sidebar nav)
- FOUND: a64caf1 (TDD RED)
- FOUND: cc8d324 (TDD GREEN)
- FOUND: 715cc50 (FineSummaryCards + reports page)
