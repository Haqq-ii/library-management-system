---
phase: 05-reports-analytics
plan: "03"
subsystem: reports
tags: [popular-books, server-action, tdd, date-filter, useTransition]
dependency_graph:
  requires: ["05-02"]
  provides: ["popular-books-report"]
  affects: ["src/app/(app)/reports/page.tsx"]
tech_stack:
  added: []
  patterns: ["Server Action with safe date parsing", "In-JS groupBy aggregation over Prisma relations", "useTransition refetch pattern"]
key_files:
  created:
    - src/features/reports/popular.ts
    - src/features/reports/PopularBooksTable.tsx
    - tests/unit/report-popular.test.ts
  modified:
    - src/app/(app)/reports/page.tsx
decisions:
  - "Aggregated loan counts per book in JS (not Prisma groupBy) because Loan.copyId requires traversing the copy→book relation; JS Map accumulation is clearer and avoids raw SQL"
  - "Imported ActionResult from features/reports/actions.ts to keep type definitions DRY"
  - "End-of-day toDate set via setUTCHours(23,59,59,999) matching the audit/actions.ts pattern"
metrics:
  duration: "3 minutes"
  completed: "2026-06-22"
  tasks_completed: 2
  files_created: 3
  files_modified: 1
---

# Phase 05 Plan 03: Popular Books Report Summary

**One-liner:** Popular Books tab with getPopularBooks Server Action (LIBRARIAN-only, safe 30-day default window, JS-side rank aggregation) and PopularBooksTable client component with date-range filter + useTransition refetch.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Failing tests for getPopularBooks | f080710 | tests/unit/report-popular.test.ts |
| 1 (GREEN) | getPopularBooks Server Action | a9a5de5 | src/features/reports/popular.ts |
| 2 | PopularBooksTable + tab wiring | 230b4e6 | src/features/reports/PopularBooksTable.tsx, src/app/(app)/reports/page.tsx |

## What Was Built

### `getPopularBooks` Server Action (`src/features/reports/popular.ts`)

- Enforces `requireRole("LIBRARIAN")` before any DB access (T-05-07)
- Accepts optional `fromDate` / `toDate` strings; invalid strings silently fall back to the 30-day default window (T-05-08)
- `toDate` gets `setUTCHours(23,59,59,999)` for inclusive end-of-day
- Queries `prisma.loan.findMany` with `issuedAt` bounds, includes `copy.book.author`
- Aggregates borrow counts per `book.id` in a JS `Map` (avoids Prisma groupBy limitation when traversing copy→book)
- Returns `PopularBookRow[]` sorted by `borrowCount` descending, capped at 50 rows (T-05-09)

### `PopularBooksTable` (`src/features/reports/PopularBooksTable.tsx`)

- `"use client"` component accepting `{ initialRows, initialFrom, initialTo }`
- Filter bar: From / To date `<Input type="date">` with `text-xs text-muted-foreground font-medium` labels, Apply Filter `<Button variant="default">` using `useTransition`
- Button shows "Applying…" while pending; inputs disabled during transition
- Table columns: Rank (w-12 text-sm text-muted-foreground), Title, Author, Borrow Count
- Empty state at `colSpan={4}`: "No borrowing data" heading + "No loans were issued in the selected date range. Try a wider range."

### `/reports` page (`src/app/(app)/reports/page.tsx`)

- Computes default `fromStr` / `toStr` (last 30 days) on the server
- Calls `getPopularBooks` server-side for SSR initial data
- Passes `popularRows`, `fromStr`, `toStr` to `<PopularBooksTable>`; replaces the "Coming soon" placeholder

## TDD Gate Compliance

- RED gate commit: `f080710` — `test(05-03): add failing tests for getPopularBooks — RED phase`
- GREEN gate commit: `a9a5de5` — `feat(05-03): implement getPopularBooks Server Action — GREEN phase`
- All 5 tests pass after GREEN implementation

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

All threats in the plan's threat model are addressed:

| Threat ID | Mitigation Applied |
|-----------|-------------------|
| T-05-07 | `requireRole("LIBRARIAN")` at top of getPopularBooks; verified by Test 1 |
| T-05-08 | `new Date(param) + isNaN(getTime())` guard; valid dates only passed to Prisma as Date objects; verified by Test 4 |
| T-05-09 | Result limited to `.slice(0, 50)` |

No new security-relevant surface beyond the plan's threat model was introduced.

## Self-Check

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/features/reports/popular.ts | FOUND |
| src/features/reports/PopularBooksTable.tsx | FOUND |
| tests/unit/report-popular.test.ts | FOUND |
| src/app/(app)/reports/page.tsx | FOUND |
| .planning/phases/05-reports-analytics/05-03-SUMMARY.md | FOUND |
| Commit f080710 (RED) | FOUND |
| Commit a9a5de5 (GREEN) | FOUND |
| Commit 230b4e6 (Task 2) | FOUND |
