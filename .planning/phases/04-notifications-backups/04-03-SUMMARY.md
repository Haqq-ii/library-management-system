---
phase: "04"
plan: "03"
subsystem: notifications
tags: [hold-ready, email, notifications, tdd, NOTF-03]
dependency_graph:
  requires: [04-01, 04-02]
  provides: [NOTF-03]
  affects: [loans/actions, lib/notifications, emails/HoldReadyEmail]
tech_stack:
  added: []
  patterns: [post-transaction-email, idempotency-key, fire-and-forget-catch]
key_files:
  created: []
  modified:
    - src/lib/notifications.ts
    - src/features/loans/actions.ts
decisions:
  - Post-transaction sendHoldReady call with .catch() guard ensures email failure never rolls back the book return
  - idempotencyKey format is HOLD_READY/<reservationId> with no date component — reservation ID is globally unique, no date suffix needed
  - sendHoldReady is never called inside prisma.$transaction to avoid tx-rollback on email errors
metrics:
  duration: "~25 minutes"
  completed: "2026-06-22"
---

# Phase 04 Plan 03: Hold-Ready Notification Slice Summary

**One-liner:** Hold-ready email notification via `sendHoldReady()` wrapper triggered post-transaction when a returned copy advances a PENDING reservation to READY (NOTF-03).

## What Was Built

### `sendHoldReady()` — `src/lib/notifications.ts`

Added a third notification wrapper function alongside the existing `sendDueDateReminder` (NOTF-01) and `sendOverdueAlert` (NOTF-02):

- Accepts `SendHoldReadyOpts`: `memberId`, `memberEmail`, `memberName`, `bookTitle`, `pickupWindowHours`, `idempotencyKey`
- Builds a `HoldReadyEmail` React element and delegates to `sendAndLog` with type `HOLD_READY`
- Subject line: "Your reserved book is ready for pickup"
- Idempotency key format: `HOLD_READY/<reservationId>` — no date component, since reservation IDs are globally unique

### `returnBook` extension — `src/features/loans/actions.ts`

Extended the hold branch of `prisma.$transaction` to return additional fields needed for the notification:
- `holdMemberId` — from `pendingReservation.member.id`
- `holdMemberEmail` — from `pendingReservation.member.user.email`
- `bookTitle` — from `loan.copy.book.title`
- `reservationId` — from `pendingReservation.id`

Added post-transaction `sendHoldReady` call between `prisma.$transaction` completion and `revalidatePath` calls:
- Uses `.catch()` guard so email delivery failures never fail the book return
- idempotencyKey: `HOLD_READY/${data.reservationId}`

### NOTF-03 Tests — `tests/unit/loan-return.test.ts`

4 new tests (RED committed `ffd43fa`, GREEN committed `3e2bb04`):
- `NOTF-03-positive`: `sendHoldReady` called once with correct member/book info when PENDING reservation exists
- `NOTF-03-negative`: `sendHoldReady` NOT called when no PENDING reservation exists
- `NOTF-03-idempotency`: idempotencyKey exactly `HOLD_READY/<reservationId>` with no date component
- `NOTF-03-no-throw`: `returnBook` returns `success: true` even when `sendHoldReady` rejects

## Key Decisions

1. **Post-transaction call with `.catch()` guard**: `sendHoldReady` is called after `prisma.$transaction` resolves, not inside it. This ensures a Resend network error never rolls back the book return transaction. The `.catch()` handler logs errors without surfacing them to the caller.

2. **No date in idempotency key**: The key is `HOLD_READY/<reservationId>` without any date component. Each reservation ID is unique across all time — a date suffix would be unnecessary and would actually break deduplication if the same reservation triggered a retry on a different day.

3. **Extended return type**: The `returnBook` function's return type was widened to include optional `holdMemberId`, `holdMemberEmail`, `bookTitle`, and `reservationId` fields alongside the existing `holdTriggered` and `holdMemberName`. These are optional (undefined on the no-hold branch) and backward-compatible.

## Files Modified

| File | Change |
|------|--------|
| `src/lib/notifications.ts` | Added `sendHoldReady()` export + `HoldReadyEmail` import |
| `src/features/loans/actions.ts` | Extended hold branch return fields + post-transaction sendHoldReady call |
| `tests/unit/loan-return.test.ts` | 4 NOTF-03 tests added (RED phase from previous session) |

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED (test) | `ffd43fa` | PASSED — 4 failing tests written first |
| GREEN (feat) | `3e2bb04` | PASSED — all 9 tests pass |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

### Files exist

- `src/lib/notifications.ts` — confirmed, contains `sendHoldReady`
- `src/features/loans/actions.ts` — confirmed, post-transaction call present
- `tests/unit/loan-return.test.ts` — confirmed, 4 NOTF-03 tests present

### Commits exist

- `ffd43fa` — RED: failing NOTF-03 tests (cherry-picked from worktree)
- `3e2bb04` — GREEN: `sendHoldReady` + `returnBook` extension

### Test output

```
Test Files  1 passed (1)
     Tests  9 passed (9)
  Start at  23:13:35
  Duration  2.59s
```

### Acceptance criteria

- [x] `npm test -- tests/unit/loan-return.test.ts` passes (all 9 tests green)
- [x] `grep -c "export async function" src/lib/notifications.ts` returns 3
- [x] `sendHoldReady` called AFTER `prisma.$transaction` (line 301 vs transaction on line 169)
- [x] Idempotency key is `HOLD_READY/<reservationId>` with NO date component
