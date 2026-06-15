---
phase: 02-circulation-core
plan: 01
subsystem: loans
tags: [checkout, server-actions, tdd, tabs, type-ahead, race-safe]
dependency_graph:
  requires:
    - 01-catalog-core (Book, BookCopy, LoanPolicy schema)
    - 01-member-management (Member model, requireRole pattern)
  provides:
    - checkoutBook server action with SELECT FOR UPDATE SKIP LOCKED
    - searchMembers / searchBooks type-ahead server actions
    - /loans librarian page with Active tab + overdue highlighting
    - CheckoutSheet slide-over with member/book type-ahead and due-date preview
  affects:
    - AppSidebar (Loans link now active)
    - /loans page (new librarian route)
    - /my-loans page (loans now appear after checkout)
tech_stack:
  added:
    - src/components/ui/tabs.tsx (@base-ui/react/tabs)
    - src/components/ui/popover.tsx (@base-ui/react/popover)
    - src/components/ui/command.tsx (lightweight search list, no external dep)
  patterns:
    - SELECT FOR UPDATE SKIP LOCKED via prisma.$queryRaw inside prisma.$transaction
    - requireRole("LIBRARIAN") as first call in all server actions (T-02-01)
    - UTC due-date: Date.now() + loanDays * 24*60*60*1000 (no local timezone)
    - Due-date preview prop-passed from server to avoid extra round-trip (D-04)
key_files:
  created:
    - src/features/loans/loan-search.ts
    - src/features/loans/actions.ts
    - src/features/loans/CheckoutSheet.tsx
    - src/features/loans/LoansTable.tsx
    - src/app/(app)/loans/page.tsx
    - src/components/ui/tabs.tsx
    - src/components/ui/popover.tsx
    - src/components/ui/command.tsx
    - tests/unit/loan-actions.test.ts
  modified:
    - src/components/layout/AppSidebar.tsx
decisions:
  - "Used @base-ui/react for Tabs/Popover/Command primitives instead of npx shadcn add (project uses base-ui not Radix; shadcn CLI would install Radix which conflicts)"
  - "LoanPolicy passed as prop from /loans page to LoansTable->CheckoutSheet (D-04: no extra server round-trip for due-date preview)"
  - "Return button in Active tab is disabled placeholder; wired in plan 02-02 (plan boundary respected)"
  - "command.tsx built as lightweight custom component — no cmdk dependency needed since CheckoutSheet uses simple positioned list pattern"
metrics:
  duration: ~35 minutes
  completed: 2026-06-15
  tasks_completed: 3
  files_created: 9
  files_modified: 1
---

# Phase 02 Plan 01: Checkout Vertical Slice Summary

**One-liner:** Race-safe checkout with SELECT FOR UPDATE SKIP LOCKED, type-ahead member/book search, and librarian loans page with Active tab and overdue highlighting.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add shadcn primitives and loan-search server actions | 7423416 | tabs.tsx, popover.tsx, command.tsx, loan-search.ts |
| 2 (RED) | Failing tests for checkoutBook | b08e004 | tests/unit/loan-actions.test.ts |
| 2 (GREEN) | Implement checkoutBook server action | f770b33 | src/features/loans/actions.ts |
| 3 | Build CheckoutSheet, LoansTable, /loans page, sidebar | c12f224 | CheckoutSheet.tsx, LoansTable.tsx, page.tsx, AppSidebar.tsx |

## What Was Built

### Server Actions

**`src/features/loans/loan-search.ts`**
- `searchMembers(query)` — filters by name, email, memberNumber with `requireRole("LIBRARIAN")`; returns `MemberSearchResult[]`
- `searchBooks(query)` — filters by title, isbn, author.name; computes `availableCount` from AVAILABLE copies; returns `BookSearchResult[]`

**`src/features/loans/actions.ts`**
- `checkoutBook(raw)` — race-safe checkout via `SELECT id FROM "BookCopy" WHERE ... FOR UPDATE SKIP LOCKED` inside `prisma.$transaction`
- Due date: `new Date(Date.now() + loanDays * 24 * 60 * 60 * 1000)` (UTC epoch math, no timezone drift)
- Error handling: FORBIDDEN, INVALID_INPUT, NO_POLICY, NO_COPIES, DB_ERROR

### UI Components

**`CheckoutSheet.tsx`** — slide-over with:
- Member type-ahead (name, email, memberNumber search)
- Book type-ahead (title, ISBN search; availableCount=0 books greyed out and non-selectable)
- Due-date preview computed from `policies` prop (no extra server round-trip, D-04)
- `checkoutBook` on confirm; distinct NO_COPIES vs generic error toasts

**`LoansTable.tsx`** — tabbed table with:
- Active tab: filters ACTIVE/OVERDUE, sorted by dueAt ASC
- Overdue rows: `bg-red-50` via `cn()`; due-date cell in `text-red-600`
- "X days overdue" indicator in due-date cell
- Pagination (PAGE_SIZE=20)
- Check Out button opens CheckoutSheet
- Return button placeholder (disabled; wired in plan 02-02)

**`/loans page`** — librarian-only server component:
- Auth: `auth.api.getSession` + redirect non-LIBRARIAN to /dashboard
- Fetches loans with full include (copy->book->author, member->user)
- Fetches loanPolicies and passes to LoansTable for client-side due-date preview
- Shows active loan count in header

### Infrastructure

- **`tabs.tsx`** — base-ui/react Tabs wrapper (Root, List, Tab, Panel)
- **`popover.tsx`** — base-ui/react Popover wrapper (Root, Trigger, Positioner, Popup)
- **`command.tsx`** — lightweight search list component (no cmdk dependency)
- **AppSidebar** — removed `disabled: true` from Loans nav entry; link now active

## Deviations from Plan

### Auto-fixed Issues

**[Rule 3 - Blocking] Used base-ui instead of shadcn CLI for Tabs/Popover/Command**
- **Found during:** Task 1
- **Issue:** `npx shadcn add tabs popover command` would install Radix UI primitives, conflicting with `@base-ui/react` already in use
- **Fix:** Created shadcn-style wrapper components using `@base-ui/react/tabs` and `@base-ui/react/popover`; created lightweight custom `command.tsx` since base-ui Combobox has different API
- **Files modified:** src/components/ui/tabs.tsx, src/components/ui/popover.tsx, src/components/ui/command.tsx

**[Rule 1 - Bug] Fixed empty interface lint errors in command.tsx**
- **Found during:** Task 3 lint check
- **Issue:** `interface CommandProps extends HTMLAttributes<HTMLDivElement> {}` flagged by `@typescript-eslint/no-empty-object-type`
- **Fix:** Changed empty interface extends to `type` aliases

**[Rule 1 - Bug] Fixed Date.now() impure-function-in-render lint errors**
- **Found during:** Task 3 lint check
- **Issue:** `Date.now()` called in render body flagged as impure function
- **Fix:** CheckoutSheet uses `useMemo` for due-date preview; LoansTable uses `new Date()` stored in `const now` before map callback

**[Rule 2 - Missing] Added explicit TypeScript types to Prisma map callbacks**
- **Found during:** Task 1, 2, 3
- **Issue:** Prisma client not generated in this environment; map callbacks had implicit `any`
- **Fix:** Added inline type annotations matching schema shape (same approach as pre-existing catalog-search.ts pattern)

## TDD Gate Compliance

- RED commit: `b08e004` — `test(02-01): add failing tests for checkoutBook server action` (5 tests, all failed: module not found)
- GREEN commit: `f770b33` — `feat(02-01): implement checkoutBook server action` (5 tests, all pass)
- No REFACTOR needed

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| Return button (disabled) | src/features/loans/LoansTable.tsx | `returnBook` action implemented in plan 02-02; placeholder preserves UI layout |
| All Loans tab placeholder text | src/features/loans/LoansTable.tsx | Full history table wired in plan 02-02 per plan boundary |

## Threat Surface Scan

All mitigations from threat model implemented:
- T-02-01: `requireRole("LIBRARIAN")` is first call in all three actions
- T-02-02: `CheckoutSchema.safeParse` validates memberId/bookId before any DB write
- T-02-03: `SELECT ... FOR UPDATE SKIP LOCKED` inside `prisma.$transaction`
- T-02-04: `searchMembers` gated by `requireRole("LIBRARIAN")`
- T-02-SC: Used base-ui (already in repo) instead of new npm packages — zero new runtime dependencies

No new threat surface beyond plan scope detected.

## Self-Check: PASSED

All key files verified present. All 4 task commits verified:
- 7423416: feat(02-01): add shadcn Tabs/Popover/Command primitives and loan-search server actions
- b08e004: test(02-01): add failing tests for checkoutBook server action (RED)
- f770b33: feat(02-01): implement checkoutBook server action (GREEN, 5/5 tests pass)
- c12f224: feat(02-01): build CheckoutSheet, LoansTable Active tab, /loans page, activate sidebar
