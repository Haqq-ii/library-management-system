---
phase: 05-reports-analytics
plan: "02"
subsystem: reports
tags: [reports, overdue, server-action, tdd, table, sorting]
dependency_graph:
  requires: ["05-01"]
  provides: ["RPT-01"]
  affects: ["src/app/(app)/reports/page.tsx"]
tech_stack:
  added: []
  patterns: ["TDD RED/GREEN", "Server Action with requireRole guard", "client-side sort with useMemo"]
key_files:
  created:
    - src/features/reports/overdue.ts
    - src/features/reports/OverdueLoansTable.tsx
    - tests/unit/report-overdue.test.ts
  modified:
    - src/app/(app)/reports/page.tsx
decisions:
  - "Explicit loan map type annotation added to overdue.ts to resolve implicit-any TS error caused by Prisma types not being generated in the worktree"
  - "SortButton implemented as inline function component within OverdueLoansTable to co-locate sort state and handler"
  - "Default sort direction per key: desc for daysLate (most urgent first), asc for memberName/bookTitle (alphabetical)"
metrics:
  duration: "~4 minutes"
  completed: "2026-06-23"
  tasks_completed: 2
  files_created: 3
  files_modified: 1
---

# Phase 05 Plan 02: Overdue Loans Report Summary

Delivered RPT-01: the Overdue Loans report. A `getOverdueLoans` Server Action returns all currently-overdue active loans with computed days-late; an `OverdueLoansTable` client component renders them with days-late-descending default sort and re-sortable column headers for Member and Title.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Failing tests for getOverdueLoans | 22cad6c | tests/unit/report-overdue.test.ts |
| 1 (GREEN) | Implement getOverdueLoans Server Action | 904715c | src/features/reports/overdue.ts |
| 2 | OverdueLoansTable component and tab wiring | 9fd7a18 | src/features/reports/OverdueLoansTable.tsx, src/app/(app)/reports/page.tsx, src/features/reports/overdue.ts (type fix) |

## What Was Built

### `getOverdueLoans` Server Action (`src/features/reports/overdue.ts`)

- Enforces LIBRARIAN-only access via `requireRole("LIBRARIAN")` — returns `{ success: false, error: "FORBIDDEN" }` if not authorized (T-05-04)
- Queries `prisma.loan.findMany` with `where: { returnedAt: null, dueAt: { lt: now } }` — loans not yet returned and past their due date
- Includes nested `copy.book` (for title) and `member.user` (for name)
- Maps results to `OverdueLoanRow[]` with ISO string `dueAt` and integer `daysLate` computed as `Math.floor((now - dueAt) / 86_400_000)`
- Wraps DB access in try/catch — logs `[getOverdueLoans]` and returns `DB_ERROR` on failure

### `OverdueLoansTable` Component (`src/features/reports/OverdueLoansTable.tsx`)

- Client component (`"use client"`) accepting `{ rows: OverdueLoanRow[] }` props
- State: `sortKey` (default `"daysLate"`) and `sortDir` (default `"desc"`)
- Sort logic via `useMemo`: numeric compare for daysLate, `localeCompare` for string keys
- Sort buttons on Member, Book Title, Days Late headers with:
  - `aria-sort="ascending"/"descending"/"none"` per column state
  - `aria-label` describing next action ("Sort ascending"/"Sort descending")
  - `ChevronUp`/`ChevronDown` icons (h-4 w-4, aria-hidden)
  - `min-h-[44px]` minimum touch target
- Table rows use `className="bg-red-50"` (red-tinted background for overdue)
- Days Late cell uses `text-red-600 font-medium`
- Due Date cell formats via `toLocaleDateString("en-US", { timeZone:"UTC", ... })`
- Empty state: `colSpan={4}` cell with "No overdue loans" heading and "All loans are currently on time." body

### Reports Page (`src/app/(app)/reports/page.tsx`)

- Added `getOverdueLoans()` call server-side alongside existing `getFineSummary()`
- Derives `overdueRows = overdueResult.success ? overdueResult.data : []`
- Replaced "overdue" TabsContent placeholder with `<OverdueLoansTable rows={overdueRows} />`

## Verification Results

- `npx vitest run tests/unit/report-overdue.test.ts` — 4/4 tests pass
- `npx tsc --noEmit` — no new errors introduced; pre-existing errors in `@/generated/prisma` and other files are out of scope
- All plan artifact checks pass: `"use client"`, `aria-sort`, `"No overdue loans"`, `getOverdueLoans` present in expected files

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added explicit type annotation to `loans.map()` callback in `overdue.ts`**
- **Found during:** Task 2 (tsc verification)
- **Issue:** `loan` parameter implicitly had `any` type because `@/generated/prisma` types aren't resolved in the worktree environment (pre-existing Prisma setup issue)
- **Fix:** Added explicit inline type annotation `(loan: { id: string; dueAt: Date; member: { user: { name: string } }; copy: { book: { title: string } } })` to the map callback
- **Files modified:** `src/features/reports/overdue.ts`
- **Commit:** 9fd7a18

## TDD Gate Compliance

- RED gate: `test(05-02)` commit `22cad6c` — 4 failing tests written before implementation
- GREEN gate: `feat(05-02)` commit `904715c` — implementation passes all 4 tests

## Known Stubs

None — the Overdue Loans tab is fully wired with live data from `getOverdueLoans`. The Popular Books and Borrowing Activity tabs remain as "Coming soon" placeholders, but those are out of scope for this plan (covered by 05-03 and 05-04).

## Threat Flags

No new security surface introduced beyond what is documented in the plan's threat model. `getOverdueLoans` is librarian-gated, returns only name + title + due/days-late data, and has no injectable parameters.

## Self-Check

- [x] `src/features/reports/overdue.ts` — exists
- [x] `src/features/reports/OverdueLoansTable.tsx` — exists
- [x] `tests/unit/report-overdue.test.ts` — exists
- [x] Commits `22cad6c`, `904715c`, `9fd7a18` — exist
- [x] All 4 tests pass
