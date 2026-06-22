---
phase: 04-notifications-backups
plan: "04-03"
status: findings
reviewed_at: 2026-06-22
severity_counts:
  high: 1
  medium: 2
  low: 1
---

# Code Review — Phase 04 Wave 3 (04-03)

Files changed: `src/features/loans/actions.ts`, `src/lib/notifications.ts`, `tests/unit/loan-return.test.ts`, `tests/unit/loan-actions.test.ts`

## Findings

### HIGH — Fire-and-forget sendHoldReady: email and NotificationLog write may be silently lost

**File:** `src/features/loans/actions.ts` line ~301  
**Finding:** `sendHoldReady(...).catch(...)` is called without `await`. The detached promise includes `resend.emails.send()` and `prisma.notificationLog.create()` inside `sendAndLog`. If the process recycles after `returnBook` returns its `ActionResult` (serverless, edge, or a Railway container restart mid-flight), both the email and the log row are silently dropped.

**Fix options:**
1. `await sendHoldReady(...)` — `sendAndLog` is already non-throwing so this won't surface email failures to the UI; it ensures both the email and log complete before returning.
2. Use Next.js `unstable_after()` / `waitUntil()` to extend the request lifetime for the background work while still returning early to the client.

Option 1 is simplest and fully correct for a persistent Node.js/Railway deployment.

---

### MEDIUM — `HOLD_READY/undefined` idempotency key if `reservationId` is absent

**File:** `src/features/loans/actions.ts` line ~307  
**Finding:** `` idempotencyKey: `HOLD_READY/${data.reservationId}` `` — `data.reservationId` is typed `string | undefined`. The enclosing `if` checks `data.holdMemberEmail` but not `data.reservationId`. If `reservationId` is ever absent while `holdMemberEmail` is present, the key becomes the literal string `"HOLD_READY/undefined"`. Resend deduplicates on this key: the first broken call succeeds, every subsequent hold-ready email for any reservation is silently suppressed, and `NotificationLog` shows `success:true` masking the bug.

**Fix:** Extend the guard: `if (data.holdTriggered && data.holdMemberEmail && data.reservationId)`. Or make the hold-branch return type a discriminated union so `holdMemberEmail`, `holdMemberId`, and `reservationId` are `string` (not `string | undefined`) when `holdTriggered: true`.

---

### MEDIUM — `data.holdMemberId!` non-null assertion unguarded by enclosing `if`

**File:** `src/features/loans/actions.ts` line ~302  
**Finding:** The `if` guard checks `holdMemberEmail` but not `holdMemberId` (both typed `string | undefined`). The `!` assertion suppresses the TypeScript error without a runtime check. If `holdMemberId` were undefined, `sendAndLog` writes `undefined` to `NotificationLog.memberId` (a FK column), throwing a Prisma constraint violation. The `.catch()` swallows it — the return shows success, the log row is missing, and the email status is unknown.

**Fix:** Include `data.holdMemberId` in the guard, or use a discriminated union (same fix as above collapses both issues).

---

### LOW — Unnecessary `as NotificationType` cast silences future type errors

**File:** `src/lib/notifications.ts` line ~144  
**Finding:** `"HOLD_READY" as NotificationType` — `NotificationType` already includes `"HOLD_READY"` as a member; the literal is assignable without the cast. If `"HOLD_READY"` is ever removed from `NotificationType` (e.g., renamed), the cast suppresses the resulting type error and the broken call continues to compile silently.

**Fix:** Remove the `as NotificationType` cast. The literal is already the correct type.

---

## Self-Check

All 4 findings are CONFIRMED by the verifier. The HIGH finding (fire-and-forget) is the most actionable: a one-line `await` addition is a safe, complete fix that works on Railway's persistent Node.js process without any architecture change.
