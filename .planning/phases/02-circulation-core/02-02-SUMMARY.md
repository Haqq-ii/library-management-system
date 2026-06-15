---
phase: 02-circulation-core
plan: 02
subsystem: loans
tags: [return, fines, hold-advance, tdd, modal, server-actions]
dependency_graph:
  requires:
    - 02-01 (checkoutBook, LoansTable with Active tab, /loans page, LoanPolicy prop pattern)
    - 01-foundation (Loan, Fine, Reservation, BookCopy schema; LoanPolicy.fineDailyRate)
  provides:
    - returnBook server action (close loan, overdue fine from policy, hold advance)
    - ReturnModal overdue confirmation dialog
    - LoansTable Return action (Active tab) + All Loans history tab
  affects:
    - /loans page (Return button now live; All Loans tab populated)
    - /my-loans page (revalidated after return)
    - BookCopy.status (AVAILABLE or RESERVED on return)
    - Reservation.status (PENDING → READY on hold advance)
tech_stack:
  added: []
  patterns:
    - prisma.$transaction wrapping loan close + fine create + copy update + reservation advance (T-02-08)
    - Math.max(0, Math.ceil(overdueMs / day)) for UTC epoch overdue-day math (PITFALLS §4)
    - requireRole("LIBRARIAN") first call in returnBook (T-02-06, CVE-2025-29927)
    - ALREADY_RETURNED guard prevents double-fine / double-return (T-02-07)
    - Fine amount derived server-side from LoanPolicy.fineDailyRate (T-02-10)
    - Overdue returns: open ReturnModal; on-time returns: call returnBook directly via useTransition
    - holdTriggered toast: "Returned. Hold triggered for {name} — copy reserved." (D-09)
key_files:
  created:
    - src/features/loans/ReturnModal.tsx
    - tests/unit/loan-return.test.ts
  modified:
    - src/features/loans/actions.ts (returnBook appended)
    - src/features/loans/LoansTable.tsx (Return button live + All Loans tab)
decisions:
  - "returnBook appended to existing actions.ts rather than new file — matches checkoutBook co-location and avoids split ActionResult type"
  - "fineDailyRate extended to LoanPolicy prop type in LoansTable for client-side fine preview (modal shows amount before confirm)"
  - "On-time returns skip modal and call returnBook directly via useTransition — one-click UX per D-07/D-08"
  - "Fallback documented: if LoanPolicy deleted after loan issued, fine skipped but loan still closed"
metrics:
  duration: ~30 minutes
  completed: 2026-06-15
  tasks_completed: 2
  files_created: 2
  files_modified: 2
---

# Phase 02 Plan 02: Return Vertical Slice Summary

**One-liner:** Atomic return action with UTC overdue-fine calculation from LoanPolicy, hold-queue advancement, overdue confirmation modal, and full loan-history All Loans tab.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Failing tests for returnBook | 78a6649 | tests/unit/loan-return.test.ts |
| 1 (GREEN) | Implement returnBook server action | 706542c | src/features/loans/actions.ts |
| 2 | Build ReturnModal + wire LoansTable | fadd9d7 | ReturnModal.tsx, LoansTable.tsx |

## What Was Built

### Server Action

**`src/features/loans/actions.ts` — `returnBook(loanId)`**
- `requireRole("LIBRARIAN")` as first call (T-02-06)
- Single `prisma.$transaction` wraps: loan load, ALREADY_RETURNED guard, overdue-day math, optional fine create, loan close, reservation check, copy status update (T-02-08)
- Overdue days: `Math.max(0, Math.ceil(overdueMs / (24*60*60*1000)))` — UTC epoch only (PITFALLS §4)
- Fine: `fineDailyRate × overdueDays`, `reason: "OVERDUE"`, `status: "UNPAID"` (T-02-10)
- Hold path: `tx.reservation.findFirst` by `bookId + status PENDING` ordered by `queuePosition ASC, requestedAt ASC` → copy `RESERVED`, reservation `READY`, returns `holdTriggered: true` (D-09)
- No-hold path: copy `AVAILABLE`, returns `holdTriggered: false`
- Error mapping: ALREADY_RETURNED, NOT_FOUND → typed errors; others → DB_ERROR

### UI Components

**`src/features/loans/ReturnModal.tsx`**
- shadcn `Dialog` wrapper for overdue return confirmation
- D-08 wording: "This book is {N} days overdue. A fine of ${Y} will be recorded on {MemberName}'s account."
- Footer: Cancel + destructive "Confirm Return"
- On confirm: calls `returnBook(loanId)` via `useTransition`
- Success toast: hold-triggered variant includes "Hold triggered for {name} — copy reserved." (D-09)

**`src/features/loans/LoansTable.tsx` (updated)**
- Active tab: Return button live — overdue loans open ReturnModal with precomputed `daysOverdue` and `fineAmount` (from `policies` prop); on-time loans call `returnBook` directly via `useTransition`
- All Loans tab: full history table (all statuses) sorted by `issuedAt` DESC, columns: Member, Book Title, Copy, Issued, Due, Status badge, Actions "—" (read-only, D-11)
- `LoanPolicy` type extended with `fineDailyRate` for client-side fine preview

## TDD Gate Compliance

- RED commit: `78a6649` — `test(02-02): add failing tests for returnBook server action (RED)` (5 tests, all failed: module not found)
- GREEN commit: `706542c` — `feat(02-02): implement returnBook server action (GREEN, 5/5 tests pass)`
- No REFACTOR needed

## Deviations from Plan

### Auto-fixed Issues

**[Rule 3 - Blocking] Merged main before implementation to get wave 1 files**
- **Found during:** Task 1 GREEN phase
- **Issue:** Worktree branched before 02-01 was merged to main; `src/features/loans/actions.ts` did not exist in worktree
- **Fix:** `git merge main --no-edit` to bring in 02-01 and 02-03 work; then appended `returnBook` to existing `actions.ts`
- **Files affected:** All wave 1 files now present in worktree

**[Rule 2 - Missing] Extended LoanPolicy type with fineDailyRate**
- **Found during:** Task 2
- **Issue:** Original `LoanPolicy` prop type in `LoansTable.tsx` only had `memberType` and `loanDays`; fine preview in ReturnModal requires `fineDailyRate`
- **Fix:** Added `fineDailyRate: number | { toNumber: () => number }` to `LoanPolicy` interface (Prisma Decimal compatibility); `getFineRate()` helper normalises to number

## Known Stubs

None — Return button is live for both overdue (via modal) and on-time (direct) cases. All Loans tab shows full history. No stubs remain from this plan.

## Threat Surface Scan

All mitigations from threat model implemented:
- T-02-06: `requireRole("LIBRARIAN")` is first call in `returnBook`
- T-02-07: `ALREADY_RETURNED` guard — loan with `returnedAt !== null` throws before any writes
- T-02-08: All reads/writes in single `prisma.$transaction` — hold advance is atomic with loan closure
- T-02-09: Accepted (audit log Phase 3); fine row carries `createdAt`/`memberId` as partial trail
- T-02-10: Fine amount computed server-side from `LoanPolicy.fineDailyRate × server-computed overdueDays`

No new threat surface beyond plan scope detected.

## Self-Check: PASSED

Files verified present:
- src/features/loans/actions.ts (returnBook exported)
- src/features/loans/ReturnModal.tsx (created)
- src/features/loans/LoansTable.tsx (Return button + All Loans tab)
- tests/unit/loan-return.test.ts (5 tests, all pass)

Commits verified:
- 78a6649: test(02-02): add failing tests for returnBook server action (RED)
- 706542c: feat(02-02): implement returnBook server action (GREEN, 5/5 tests pass)
- fadd9d7: feat(02-02): build ReturnModal and wire Return action + All Loans tab into LoansTable
