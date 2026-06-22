---
phase: 05-reports-analytics
reviewed: 2026-06-23T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - package.json
  - src/app/(app)/reports/page.tsx
  - src/components/layout/AppSidebar.tsx
  - src/features/reports/BorrowingActivityChart.tsx
  - src/features/reports/FineSummaryCards.tsx
  - src/features/reports/OverdueLoansTable.tsx
  - src/features/reports/PopularBooksTable.tsx
  - src/features/reports/actions.ts
  - src/features/reports/activity.ts
  - src/features/reports/overdue.ts
  - src/features/reports/popular.ts
  - tests/unit/report-activity.test.ts
  - tests/unit/report-fine-summary.test.ts
  - tests/unit/report-overdue.test.ts
  - tests/unit/report-popular.test.ts
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-06-23T00:00:00Z
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

The Phase 05 reports feature covers four server actions (`getFineSummary`, `getOverdueLoans`, `getPopularBooks`, `getBorrowingActivity`), four UI components, the reports page, and a sidebar update. The auth guard pattern (`requireRole`) is correctly applied server-side before every DB query. Date parsing defensively falls back to defaults on invalid input. The general structure is sound.

Two critical defects exist: the fine summary "outstanding" calculation silently includes PAID fines (making it a misnomer and a financial reporting error), and `ActionResult<T>` is declared in both `actions.ts` and `overdue.ts`, so `overdue.ts` exports an independent copy that future callers could import creating silent type drift. Four warnings cover: unbounded `getPopularBooks` in-memory aggregation on large tables, missing error feedback on filter failures in both interactive components, unassociated `<label>` elements breaking accessibility in the filter bars, and a date-range validation gap that allows from > to to be silently accepted. Three info items cover dead-code comments, a missing `"use client"` note on `FineSummaryCards`, and a minor interval-calculation rounding anomaly in the activity chart.

---

## Critical Issues

### CR-01: Fine "outstanding" includes PAID fines — wrong arithmetic

**File:** `src/features/reports/actions.ts:25-38`

**Issue:** `outstanding = recorded − waived`. The schema has three `FineStatus` values: `UNPAID`, `PAID`, and `WAIVED`. "Recorded" is the sum of ALL fines (no status filter), so it includes already-paid fines. As a result the outstanding figure overstates real debt by the sum of every paid fine. A librarian reading the card will see an inflated "outstanding" balance that does not match the actual receivable.

The correct calculation requires a third aggregate:

```sql
outstanding = SUM(amount WHERE status = 'UNPAID')
```

or equivalently:

```
outstanding = recorded − waived − paid
```

**Fix:**

```typescript
// actions.ts — getFineSummary()
const [recordedAgg, waivedAgg, paidAgg] = await Promise.all([
  prisma.fine.aggregate({ _sum: { amount: true } }),
  prisma.fine.aggregate({ _sum: { amount: true }, where: { status: "WAIVED" } }),
  prisma.fine.aggregate({ _sum: { amount: true }, where: { status: "PAID" } }),
]);

const recorded = Number(recordedAgg._sum.amount ?? 0);
const waived   = Number(waivedAgg._sum.amount ?? 0);
const paid     = Number(paidAgg._sum.amount ?? 0);
const outstanding = recorded - waived - paid;

return { success: true, data: { recorded, waived, outstanding } };
```

The description string in `FineSummaryCards.tsx` line 57 (`"Outstanding = Recorded minus Waived"`) also needs updating to match the corrected formula. The unit test in `report-fine-summary.test.ts` (Test 2) likewise asserts `outstanding: 70` from `recorded: 100, waived: 30` with no PAID fines mocked — the test still passes but it does not cover the broken case and will need a new test scenario.

---

### CR-02: `ActionResult<T>` type duplicated — `overdue.ts` exports its own independent copy

**File:** `src/features/reports/overdue.ts:6-8`

**Issue:** `overdue.ts` re-declares and exports `ActionResult<T>` as its own type, identical to the one already exported from `actions.ts`. `popular.ts` and `activity.ts` correctly import from `actions.ts`. Because the two declarations are structurally identical today TypeScript treats them as compatible, but:

1. If `actions.ts`'s `ActionResult` is ever extended (e.g., adding an `errorCode` field to the failure branch), `overdue.ts`'s copy diverges silently — callers who import from `overdue.ts` see the old shape.
2. Any external consumer importing `ActionResult` from `overdue.ts` (an easy mistake given the re-export) compiles fine today but is semantically wrong.
3. The reports page (`page.tsx`) imports `getOverdueLoans` from `overdue.ts` and consumes the result via the `success` discriminant — it works today only because both shapes are identical.

**Fix:** Remove the duplicate declaration from `overdue.ts` and import from `actions.ts`, matching the pattern used by `popular.ts` and `activity.ts`:

```typescript
// overdue.ts — replace lines 1-8 with:
"use server";

import { requireRole } from "@/lib/require-role";
import { prisma } from "@/lib/db";
import type { ActionResult } from "@/features/reports/actions";

export type OverdueLoanRow = { ... };
```

---

## Warnings

### WR-01: `getPopularBooks` aggregates in JS after fetching all loans in range — unbounded memory

**File:** `src/features/reports/popular.ts:51-103`

**Issue:** All loans within the date range are fetched into Node.js memory and grouped in a `Map`. For a production library with years of loan history and a wide date range (e.g., "all time"), this can load tens of thousands of rows. The top-50 result set is sliced only after the full in-memory sort.

This is a correctness concern as well as a performance one: if the Node process OOMs, the server action returns `DB_ERROR` and the user sees a silent failure. The correct approach is a single aggregated database query.

**Fix:** Replace the `findMany` + JS grouping with a `groupBy` query:

```typescript
const groups = await prisma.loan.groupBy({
  by: ["copyId"],
  where: { issuedAt: { gte: from, lte: to } },
  _count: { _all: true },
  orderBy: { _count: { copyId: "desc" } },
  take: 50,
});
// Then resolve book info for the top-50 copyIds with a single findMany
```

Alternatively, use a raw SQL `GROUP BY book.id` query via `prisma.$queryRaw`.

---

### WR-02: Filter failures are silently swallowed — user receives no feedback

**File:** `src/features/reports/PopularBooksTable.tsx:32-39`, `src/features/reports/BorrowingActivityChart.tsx:36-43`

**Issue:** Both interactive filter components call the server action and only update state on `r.success`. When the action returns `{ success: false }` (network error, auth expiry, DB error), the displayed data is stale with no indication to the user that the filter did not apply. The user can re-click "Apply Filter" repeatedly thinking the system is unresponsive.

```typescript
// PopularBooksTable.tsx — handleApply()
function handleApply() {
  startTransition(async () => {
    const r = await getPopularBooks({ fromDate, toDate });
    if (r.success) {
      setRows(r.data);
    }
    // r.success === false: nothing happens, old data stays, no toast
  });
}
```

**Fix:** Add an error state or use `sonner` (already a project dependency) to surface the failure:

```typescript
import { toast } from "sonner";

function handleApply() {
  startTransition(async () => {
    const r = await getPopularBooks({ fromDate, toDate });
    if (r.success) {
      setRows(r.data);
    } else {
      toast.error("Failed to load data. Please try again.");
    }
  });
}
```

Apply the same fix to `BorrowingActivityChart.tsx` `handleApply`.

---

### WR-03: `<label>` elements in filter bars are not associated with their inputs — accessibility failure

**File:** `src/features/reports/PopularBooksTable.tsx:46,56`, `src/features/reports/BorrowingActivityChart.tsx:58,68`

**Issue:** The "From" and "To" `<label>` elements have no `htmlFor` attribute and the corresponding `<Input>` elements have no `id`. Screen readers cannot announce which label belongs to which date picker. A user navigating by keyboard or assistive technology will hear "edit, date" with no label context.

```tsx
// Current — label not associated
<label className="text-xs text-muted-foreground font-medium">From</label>
<Input type="date" value={fromDate} ... />
```

**Fix:**

```tsx
<label
  htmlFor="popular-from-date"
  className="text-xs text-muted-foreground font-medium"
>
  From
</label>
<Input
  id="popular-from-date"
  type="date"
  value={fromDate}
  onChange={(e) => setFromDate(e.target.value)}
  className="w-36"
  disabled={isPending}
/>
```

Use distinct IDs per component (`popular-from-date`, `activity-from-date`, etc.) to avoid ID collisions when both components are rendered in the same DOM.

---

### WR-04: Date range allows `fromDate > toDate` without validation — inverted range silently queries DB

**File:** `src/features/reports/popular.ts:31-46`, `src/features/reports/activity.ts:28-47`

**Issue:** No check enforces `from <= to`. When a user sets From = 2025-12-31 and To = 2025-01-01, the query runs with `gte: 2025-12-31, lte: 2025-01-01` — PostgreSQL returns zero rows, which is displayed as "No data." The user cannot distinguish "no data in this correct range" from "your range is inverted." This is a silent logic error: the server action accepts and executes a nonsensical query.

**Fix:** Add a guard before constructing the query in both `popular.ts` and `activity.ts`:

```typescript
if (from > to) {
  return { success: false, error: "INVALID_DATE_RANGE" };
}
```

And surface the specific error in the UI components so users see "From date must be before To date" rather than an empty table.

---

## Info

### IN-01: `FineSummaryCards` is a Server Component but has no `"use server"` marker — unclear boundary

**File:** `src/features/reports/FineSummaryCards.tsx:1`

**Issue:** `FineSummaryCards` is a pure presentational component with no hooks or browser-only APIs, so it correctly renders as a Server Component. However, `PopularBooksTable.tsx`, `BorrowingActivityChart.tsx`, and `OverdueLoansTable.tsx` all start with `"use client"`. The absence of a directive on `FineSummaryCards` is correct behavior but is visually inconsistent and could confuse a future developer who adds a hook (e.g., for a "refresh" button) without realizing it needs `"use client"` added first.

**Fix:** Add a short comment to clarify intent:

```typescript
// Server Component — no client-side state needed; receives pre-fetched props from ReportsPage
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
```

---

### IN-02: `xAxisInterval` calculation is off by one for exactly 14 data points

**File:** `src/features/reports/BorrowingActivityChart.tsx:51`

**Issue:** `const xAxisInterval = data.length > 14 ? 6 : 0;` — for exactly 14 data points the interval is 0 (show every label), while for 15 data points it switches to 6 (show every 7th). The threshold comment says "when range exceeds 14 days," which is correct as written, but 14 data points in a 30-day chart card (≈14 day range) will render 14 crowded labels on a narrow card. The constant is arguably one day too late.

This is a display polish issue, not a logic bug, but it will produce an ugly chart for exactly-14-day ranges.

**Fix:** Change `> 14` to `>= 14` or adjust the threshold to match the desired breakpoint.

---

### IN-03: `console.error` in server actions leaks internal error details to server logs without structured context

**File:** `src/features/reports/actions.ts:45`, `src/features/reports/activity.ts:117`, `src/features/reports/overdue.ts:61`, `src/features/reports/popular.ts:108`

**Issue:** All four server actions use `console.error("[functionName]", err)` as their sole error logging. In production this sends raw Prisma error objects (which include query strings, table names, and column names) to stdout/stderr. For a school system this is a low-severity leak (internal infra details), but it will not correlate across requests and makes incident diagnosis harder.

**Fix:** This is acceptable for an early-stage application. Consider structured logging (e.g., adding a `requestId` or using a logging library) before production hardening. No immediate code change required.

---

_Reviewed: 2026-06-23T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
