---
phase: 02-circulation-core
plan: "03"
subsystem: member-loans-view
tags: [loans, member-portal, ui, display-helpers, tdd-light]
dependency_graph:
  requires: []
  provides:
    - src/features/loans/loan-display.ts (isLoanOverdue, partitionLoans helpers)
    - src/app/(app)/my-loans/page.tsx (two-section member loans view)
  affects:
    - member /my-loans route
tech_stack:
  added: []
  patterns:
    - Pure display helper module (no "use server") co-located in feature folder
    - Generic T extends Record<string,any> to preserve full Prisma type through partition
key_files:
  created:
    - src/features/loans/loan-display.ts
    - tests/unit/my-loans-sections.test.ts
  modified:
    - src/app/(app)/my-loans/page.tsx
decisions:
  - "Used Record<string,any> generic constraint for partitionLoans to avoid TypeScript narrowing the return type to only the constraint fields when Prisma types flow through — preserves full loan type on active/history arrays"
  - "No tabs on /my-loans — single scrollable page with two <section> blocks per D-12"
  - "Active loans sorted by dueAt ascending (soonest due first); history inherits reverse-chronological issuedAt desc from query"
metrics:
  duration: "~15 minutes"
  completed: "2026-06-15"
  tasks_completed: 1
  tasks_total: 1
  files_created: 2
  files_modified: 1
---

# Phase 02 Plan 03: My-Loans Two-Section Layout Summary

**One-liner:** Member /my-loans page split into Active Loans (overdue highlighted bg-red-50, soonest due first) and Loan History (returned, reverse-chronological) sections with tested pure helpers.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Rewrite /my-loans into Active + History sections with tested partition helper | 0701a5c | loan-display.ts, my-loans/page.tsx, my-loans-sections.test.ts |

## What Was Built

**`src/features/loans/loan-display.ts`** — Pure helper module (no `"use server"`) with two exported functions:
- `isLoanOverdue(loan)` — returns true for OVERDUE status or ACTIVE loans past their dueAt
- `partitionLoans(loans)` — splits a loan array into `{ active, history }` where active = ACTIVE+OVERDUE, history = non-null returnedAt

**`src/app/(app)/my-loans/page.tsx`** — Rewritten from single flat table to two `<section>` blocks:
- **Active Loans** (top): sorted by dueAt ascending, overdue rows receive `bg-red-50` row highlight + red date text, Badge variants Active (green) / Overdue (destructive). Empty state: "No active loans".
- **Loan History** (below): inherits reverse-chronological order from query, every row shows outline "Returned" badge. Empty state: "No past loans".
- No Tabs import — single scrollable page per D-12.
- Session guard and member findUnique scope preserved (T-02-11/T-02-12 mitigations).

**`tests/unit/my-loans-sections.test.ts`** — 10 unit tests covering:
- partitionLoans: ACTIVE → active, OVERDUE → active, RETURNED → history, mixed arrays, empty input
- isLoanOverdue: OVERDUE status, ACTIVE+past dueAt, ACTIVE+future dueAt, RETURNED status, string date inputs

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript generic inference narrowing**
- **Found during:** Task 1 TypeScript check
- **Issue:** `partitionLoans<T extends { status, returnedAt, dueAt }>` caused TypeScript to resolve `T` to only the constraint fields on the return value, stripping `id`, `copy`, `issuedAt` and other Prisma fields from `active[]` and `history[]` at use sites.
- **Fix:** Changed generic constraint to `T extends Record<string, any>` with eslint-disable comment. This allows TypeScript to infer `T` as the full Prisma loan type at the call site, preserving all fields. `isLoanOverdue` parameter updated to `Record<string, any>` for the same reason.
- **Files modified:** `src/features/loans/loan-display.ts`
- **Commit:** 0701a5c (included in same task commit)

## Known Stubs

None — both sections display real Prisma data from the session-scoped member query.

## Threat Flags

None — no new network endpoints or auth paths introduced. Existing session guard (`auth.api.getSession` + `redirect("/login")`) and member scope (`findUnique where userId: session.user.id`) are preserved from the original stub (T-02-11, T-02-12 mitigated).

## Self-Check: PASSED

- `src/features/loans/loan-display.ts` — exists, exports `isLoanOverdue` and `partitionLoans`, no `"use server"` directive
- `src/app/(app)/my-loans/page.tsx` — imports `partitionLoans` and `isLoanOverdue`, renders "Active Loans" and "Loan History" headings, uses `bg-red-50`, no Tabs import
- `tests/unit/my-loans-sections.test.ts` — 10/10 tests pass
- `npx tsc --noEmit` — no errors in plan-owned files (pre-existing errors in seed.ts, catalog-search.ts, db.ts are out of scope)
- Commit 0701a5c verified
