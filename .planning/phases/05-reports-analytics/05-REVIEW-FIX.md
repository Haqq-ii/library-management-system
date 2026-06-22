---
phase: 05-reports-analytics
fixed_at: 2026-06-23T00:00:00Z
review_path: .planning/phases/05-reports-analytics/05-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 05: Code Review Fix Report

**Fixed at:** 2026-06-23T00:00:00Z
**Source review:** .planning/phases/05-reports-analytics/05-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (2 Critical, 4 Warning)
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-01: Fine "outstanding" includes PAID fines — wrong arithmetic

**Files modified:** `src/features/reports/actions.ts`, `src/features/reports/FineSummaryCards.tsx`
**Commit:** ee28dd3
**Applied fix:** Added a third `prisma.fine.aggregate()` for PAID fines, run in parallel with the existing WAIVED aggregate via `Promise.all`. Changed `outstanding = recorded - waived` to `outstanding = recorded - waived - paid`. Updated the description string in `FineSummaryCards.tsx` from "Outstanding = Recorded minus Waived" to "Outstanding = Recorded minus Waived minus Paid (UNPAID fines only)". Also added the Server Component comment to `FineSummaryCards.tsx` (addressing IN-01 context).

---

### CR-02: `ActionResult<T>` type duplicated — `overdue.ts` exports its own independent copy

**Files modified:** `src/features/reports/overdue.ts`
**Commit:** 3745ff3
**Applied fix:** Removed the local `export type ActionResult<T>` declaration from `overdue.ts` and replaced it with `import type { ActionResult } from "@/features/reports/actions"`, matching the pattern used by `popular.ts` and `activity.ts`. Single source of truth for the type.

---

### WR-01: `getPopularBooks` aggregates in JS after fetching all loans in range — unbounded memory

**Files modified:** `src/features/reports/popular.ts`
**Commit:** fe87752
**Applied fix:** Replaced the `prisma.loan.findMany()` + in-memory Map grouping with `prisma.loan.groupBy({ by: ["copyId"], _count: { _all: true }, orderBy: ..., take: 50 })`. Follows with a single `prisma.bookCopy.findMany({ where: { id: { in: copyIds } } })` to resolve book info for the top-50 copy IDs. A small in-memory merge step combines counts for multiple copies of the same book. This eliminates the unbounded memory issue by pushing aggregation to PostgreSQL. WR-04 date range guard (from > to) is also included in this commit.

---

### WR-02: Filter failures are silently swallowed — user receives no feedback

**Files modified:** `src/features/reports/PopularBooksTable.tsx`, `src/features/reports/BorrowingActivityChart.tsx`
**Commit:** f9684bd
**Applied fix:** Added `import { toast } from "sonner"` to both components. In each `handleApply()` function, added an `else` branch on `r.success === false` that calls `toast.error()`. Shows "From date must be before To date." for `INVALID_DATE_RANGE` errors, and "Failed to load data. Please try again." for all other errors.

---

### WR-03: `<label>` elements in filter bars are not associated with their inputs — accessibility failure

**Files modified:** `src/features/reports/PopularBooksTable.tsx`, `src/features/reports/BorrowingActivityChart.tsx`
**Commit:** f9684bd
**Applied fix:** Added `htmlFor` attributes to all four `<label>` elements and matching `id` attributes to the corresponding `<Input>` elements. Used distinct IDs per component to prevent DOM collisions: `popular-from-date`, `popular-to-date` in `PopularBooksTable`, and `activity-from-date`, `activity-to-date` in `BorrowingActivityChart`.

---

### WR-04: Date range allows `fromDate > toDate` without validation — inverted range silently queries DB

**Files modified:** `src/features/reports/popular.ts` (commit fe87752), `src/features/reports/activity.ts` (commit f9684bd)
**Commit:** fe87752 (popular.ts), f9684bd (activity.ts)
**Applied fix:** Added `if (from > to) { return { success: false, error: "INVALID_DATE_RANGE" }; }` before the DB query in both `getPopularBooks` and `getBorrowingActivity`. The UI components (WR-02 fix) surface this as "From date must be before To date." via toast.

---

_Fixed: 2026-06-23T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
