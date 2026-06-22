---
phase: 04-notifications-backups
fixed_at: 2026-06-22T23:51:00Z
review_path: .planning/phases/04-notifications-backups/04-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 04: Code Review Fix Report

**Fixed at:** 2026-06-22T23:51:00Z
**Source review:** .planning/phases/04-notifications-backups/04-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (1 HIGH, 2 MEDIUM, 1 LOW)
- Fixed: 4
- Skipped: 0

## Fixed Issues

### HIGH: Fire-and-forget sendHoldReady

**Files modified:** `src/features/loans/actions.ts`
**Commit:** ea4c994
**Applied fix:** Added `await` before `sendHoldReady(...)` so the email delivery and `NotificationLog` write complete before `returnBook` returns. The existing `.catch()` ensures email errors are logged but do not propagate to the UI. Also removed the `!` non-null assertions on `holdMemberId` and `holdMemberEmail` (now narrowed by the strengthened guard — see MEDIUM fixes).

### MEDIUM: HOLD_READY/undefined idempotency key

**Files modified:** `src/features/loans/actions.ts`
**Commit:** ea4c994
**Applied fix:** Extended the if-guard from `data.holdTriggered && data.holdMemberEmail` to `data.holdTriggered && data.holdMemberEmail && data.holdMemberId && data.reservationId`. This prevents the template literal from ever producing `"HOLD_READY/undefined"`, which would cause Resend to silently suppress all subsequent hold-ready emails via idempotency deduplication.

### MEDIUM: data.holdMemberId! non-null assertion unguarded

**Files modified:** `src/features/loans/actions.ts`
**Commit:** ea4c994
**Applied fix:** Added `data.holdMemberId` to the if-guard (same commit as above). With `holdMemberId` narrowed to `string` inside the block, the `!` assertion on `memberId` and `memberEmail` were both removed — the values are now typed as `string` by TypeScript's narrowing, eliminating the risk of a Prisma FK constraint violation from an `undefined` memberId.

### LOW: Unnecessary `as NotificationType` cast

**Files modified:** `src/lib/notifications.ts`
**Commit:** e62ff4b
**Applied fix:** Removed the `as NotificationType` cast from `type: "HOLD_READY" as NotificationType`. The string literal `"HOLD_READY"` is already a member of the `NotificationType` union and is assignable without coercion. Keeping the cast would suppress any future type error if `"HOLD_READY"` were renamed or removed from the union.

## Test Results

All 64 tests passed (11 test files, 3.86s) after applying fixes:

```
Test Files  11 passed (11)
Tests       64 passed (64)
```

No regressions introduced.

---

_Fixed: 2026-06-22T23:51:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
