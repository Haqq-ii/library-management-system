---
status: testing
phase: 02-circulation-core
source: [02-VERIFICATION.md]
started: 2026-06-15T12:30:00Z
updated: 2026-06-15T13:00:00Z
---

## Blocker Resolved

**`/loans` Decimal serialization bug — FIXED 2026-06-15**
`fineDailyRate` and `maxUnpaidFineAmount` are now serialized to plain `number` in `loans/page.tsx` before being passed to `LoansTable`. Page loads cleanly. UAT can proceed.

## Current Test

number: 1
name: Full checkout flow
expected: |
  Sheet opens from /loans, type-ahead member search returns results, book search shows availability count, due-date preview renders for selected member type, Confirm Checkout creates a Loan and shows it in Active tab
awaiting: user response

## Tests

### 1. Full checkout flow
expected: Sheet opens from /loans, type-ahead member search returns results, book search shows availability count with greyed-out zero-copy titles, due-date preview renders for selected member type, Confirm Checkout creates a Loan and shows it in Active tab
result: [pending]

### 2. Concurrent checkout race
expected: Two simultaneous checkout requests for the last available copy result in exactly one SUCCESS and one NO_COPIES error (SELECT FOR UPDATE SKIP LOCKED enforced)
result: [pending]

### 3. On-time return
expected: Clicking Return on an on-time loan closes immediately without modal; Loan moves to All Loans tab; copy becomes AVAILABLE
result: [pending]

### 4. Overdue return
expected: ReturnModal shows "This book is X days overdue. A fine of $Y will be recorded on [MemberName]'s account."; confirming creates a Fine record with status UNPAID in the DB
result: [pending]

### 5. Return with PENDING reservation (hold advance)
expected: After return, if a PENDING reservation exists for the title, copy status becomes RESERVED, reservation advances to READY, and a hold notice appears on screen
result: [pending]

### 6. Member /my-loans layout
expected: /my-loans shows two distinct sections (Active Loans above, Loan History below), overdue rows are highlighted, history is in reverse-chronological order, no tabs
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
