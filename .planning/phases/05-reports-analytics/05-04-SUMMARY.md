---
phase: 05-reports-analytics
plan: "04"
subsystem: reports
tags: [borrowing-activity, recharts, line-chart, server-action, tdd, date-filter, useTransition]
dependency_graph:
  requires: ["05-01", "05-03"]
  provides: ["borrowing-activity-report", "RPT-03"]
  affects: ["src/app/(app)/reports/page.tsx"]
tech_stack:
  added: []
  patterns: ["Server Action with safe date parsing + Promise.all parallel queries", "Recharts ResponsiveContainer + LineChart client component", "useTransition refetch pattern (same as PopularBooksTable)"]
key_files:
  created:
    - src/features/reports/activity.ts
    - src/features/reports/BorrowingActivityChart.tsx
    - tests/unit/report-activity.test.ts
  modified:
    - src/app/(app)/reports/page.tsx
decisions:
  - "Used Promise.all for parallel issuedAt + returnedAt findMany queries — two bounded range queries with no N+1 (T-05-12)"
  - "Continuous zero-filled day array from fromDay to toDay inclusive ensures chart x-axis has no gaps regardless of activity"
  - "Empty state triggers when data.length === 0 OR all points have both loanCount and returnCount at zero — avoids showing flat zero chart"
  - "xAxisInterval = data.length > 14 ? 6 : 0 — shows every 7th label when range > 14 days, every label otherwise (matches UI-SPEC)"
metrics:
  duration: "8 minutes"
  completed: "2026-06-23"
  tasks_completed: 3
  files_created: 3
  files_modified: 1
---

# Phase 05 Plan 04: Borrowing Activity Report Summary

**One-liner:** Borrowing Activity tab (RPT-03) with getBorrowingActivity Server Action (LIBRARIAN-only, Promise.all parallel queries, continuous zero-filled daily ActivityPoints) and BorrowingActivityChart recharts LineChart client component with From/To filter + useTransition refetch — completing Phase 5.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Failing tests for getBorrowingActivity | 431dc6e | tests/unit/report-activity.test.ts |
| 1 (GREEN) | getBorrowingActivity Server Action | f5b5b95 | src/features/reports/activity.ts |
| 2 | BorrowingActivityChart + tab wiring | d46158c | src/features/reports/BorrowingActivityChart.tsx, src/app/(app)/reports/page.tsx |

## What Was Built

### `getBorrowingActivity` Server Action (`src/features/reports/activity.ts`)

- Enforces `requireRole("LIBRARIAN")` before any DB access (T-05-10)
- Accepts optional `fromDate` / `toDate` strings; invalid strings silently fall back to the 30-day default window (T-05-11)
- `toDate` gets `setUTCHours(23,59,59,999)` for inclusive end-of-day (same pattern as popular.ts)
- Runs two `prisma.loan.findMany` calls in `Promise.all`: one bounded by `issuedAt` range, one bounded by `returnedAt` range (T-05-12 — no N+1)
- JS Map accumulation: loanCount incremented per `issuedAt` day, returnCount incremented per `returnedAt` day — counts are independent (a single loan can contribute to both its issued-day and its returned-day)
- Generates a continuous ordered array of `ActivityPoint` from the `from` UTC day to the `to` UTC day inclusive, filling gaps with zero counts so the chart x-axis is unbroken
- Exports `ActivityPoint = { date: string; loanCount: number; returnCount: number }` type
- Returns `ActionResult<ActivityPoint[]>` — `{ success: true, data }` or `{ success: false, error }`

### `BorrowingActivityChart` (`src/features/reports/BorrowingActivityChart.tsx`)

- `"use client"` component accepting `{ initialData, initialFrom, initialTo }`
- Filter bar: From / To date `<Input type="date">` with `text-xs text-muted-foreground font-medium` labels, Apply Filter `<Button variant="default">` using `useTransition` — identical structure to `PopularBooksTable`
- Button shows "Applying…" while pending; inputs disabled during transition
- Chart card: `<Card>` with `<CardHeader><CardTitle>Borrowing Activity</CardTitle></CardHeader>`
- Loading state: `<Skeleton className="h-[320px] w-full rounded-md" />` while isPending
- Empty state when `data.length === 0` OR all points have zero loanCount AND returnCount: `py-12 text-center` with "No activity data" heading + "No loans or returns recorded…" body
- Chart: `<figure>` with sr-only figcaption; `<ResponsiveContainer width="100%" height={320}>` wrapping `<LineChart>`
  - `CartesianGrid`, `XAxis dataKey="date"` with interval={6} when data.length > 14 else interval={0}
  - `YAxis allowDecimals={false}`, `Tooltip contentStyle={{ fontSize: "12px" }}`, `Legend`
  - Two `<Line>` series: `loanCount` named "Loans Issued" with `stroke="var(--chart-1)"`, `returnCount` named "Loans Returned" with `stroke="var(--chart-2)"`

### `/reports` page (`src/app/(app)/reports/page.tsx`)

- Reuses existing `fromStr` / `toStr` default-30-day strings (avoids recomputing)
- Calls `getBorrowingActivity` server-side for SSR initial data
- Passes `activityData`, `fromStr`, `toStr` to `<BorrowingActivityChart>`; replaces the "Coming soon" placeholder in the "activity" TabsContent

## TDD Gate Compliance

- RED gate commit: `431dc6e` — `test(05-04): add failing tests for getBorrowingActivity — RED phase`
- GREEN gate commit: `f5b5b95` — `feat(05-04): implement getBorrowingActivity Server Action — GREEN phase`
- All 5 tests pass after GREEN implementation

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

All threats in the plan's threat model are addressed:

| Threat ID | Mitigation Applied |
|-----------|-------------------|
| T-05-10 | `requireRole("LIBRARIAN")` at top of getBorrowingActivity; verified by Test 1 |
| T-05-11 | `new Date(param) + isNaN(getTime())` guard; valid dates only passed to Prisma as Date objects; verified by Test 4 |
| T-05-12 | Two bounded `findMany` selects in `Promise.all`; continuous day expansion bounded by window size |

No new security-relevant surface beyond the plan's threat model was introduced.

## Known Stubs

None — all four report tabs (RPT-01..04) are fully wired with real data sources.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/features/reports/activity.ts | FOUND |
| src/features/reports/BorrowingActivityChart.tsx | FOUND |
| tests/unit/report-activity.test.ts | FOUND |
| src/app/(app)/reports/page.tsx | FOUND |
| .planning/phases/05-reports-analytics/05-04-SUMMARY.md | FOUND |
| Commit 431dc6e (RED) | FOUND |
| Commit f5b5b95 (GREEN) | FOUND |
| Commit d46158c (Task 2) | FOUND |
