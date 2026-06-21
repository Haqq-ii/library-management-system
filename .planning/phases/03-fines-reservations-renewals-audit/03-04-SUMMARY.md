---
phase: "03"
plan: "04"
subsystem: loans
tags: [fine-block, renewals, reservations, lazy-expiry, server-actions]
dependency_graph:
  requires: ["03-01", "03-03"]
  provides: ["renewLoan", "FINE_BLOCK in checkoutBook", "lazy expiry in returnBook"]
  affects: ["src/features/loans/actions.ts"]
tech_stack:
  added: []
  patterns: ["FINE_BLOCK aggregate check", "lazy expiry before hold-advance", "blocking-order transaction"]
key_files:
  modified:
    - src/features/loans/actions.ts
decisions:
  - "FINE_BLOCK check placed outside transaction (read-only, no concurrency risk) per plan spec"
  - "Lazy expiry uses same `now` timestamp already in returnBook transaction for consistency"
  - "renewLoan blocks checked inside transaction for atomicity: FINE_BLOCK -> MAX_RENEWALS -> RESERVATION_BLOCK"
  - "FORBIDDEN error case added to renewLoan catch block (not in PATTERNS.md catch — added as Rule 2)"
metrics:
  duration: "~10 minutes"
  completed: "2026-06-22"
  tasks_completed: 1
  files_modified: 1
---

# Phase 03 Plan 04: FINE_BLOCK, Lazy Expiry, and renewLoan Summary

**One-liner:** Extended loans/actions.ts with FINE_BLOCK checkout gate, READY-reservation lazy expiry on return, and renewLoan with three-block enforcement (FINE_BLOCK then MAX_RENEWALS then RESERVATION_BLOCK).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend checkoutBook with FINE_BLOCK + returnBook with lazy expiry + add renewLoan | 12794fa | src/features/loans/actions.ts |

## What Was Built

### checkoutBook — FINE_BLOCK enforcement (FINE-03)

Added a `prisma.fine.aggregate` call after the policy lookup but before the `$transaction`. If the member's total unpaid fines is >= `policy.maxUnpaidFineAmount`, returns `{ success: false, error: "FINE_BLOCK:X.XX" }` immediately, preventing the copy-lock transaction from starting.

### returnBook — Lazy expiry of READY reservations (RES-02 / D-12 / D-13)

Added a `tx.reservation.findMany` + per-reservation `tx.reservation.update` block inside the existing `$transaction`, placed after loan closure and before the `pendingReservation.findFirst` hold-advance logic. Any READY reservation whose `notifiedAt` is older than `PICKUP_WINDOW_HOURS` (48h) is set to CANCELLED before the queue is advanced. Reuses the existing `now` timestamp for consistency. `PICKUP_WINDOW_HOURS` imported from `@/lib/constants`.

### renewLoan — New export with three-block enforcement (RNW-01–04)

New `export async function renewLoan(loanId: string): Promise<ActionResult<{ newDueAt: Date }>>`:
1. Auth: `requireRole("MEMBER")` with session capture for ownership check.
2. Transaction: loads loan + member + copy; verifies `loan.member.userId === session.user.id`.
3. Policy lookup by `loan.member.memberType`.
4. Block 1 — FINE_BLOCK: `fine.aggregate` unpaid sum >= `maxUnpaidFineAmount`.
5. Block 2 — MAX_RENEWALS: `loan.renewCount >= policy.maxRenewals`.
6. Block 3 — RESERVATION_BLOCK: PENDING or READY reservation exists for the book.
7. Success: `newDueAt = loan.dueAt + loanDays * 24h` (UTC epoch math), `renewCount: { increment: 1 }`.
8. `revalidatePath("/my-loans")` on success.

## Acceptance Criteria Results

| Check | Result |
|-------|--------|
| `grep -c "export async function renewLoan"` | 1 |
| `grep -c "FINE_BLOCK"` | 5 (checkoutBook + renewLoan + error handlers) |
| `grep -c "MAX_RENEWALS"` | 3 |
| `grep -c "RESERVATION_BLOCK"` | 4 |
| `grep -c "PICKUP_WINDOW"` | 3 |
| `grep -c "renewCount.*increment"` | 1 |
| `grep -c "from.*constants"` | 1 |
| `npx tsc --noEmit` errors in loans/actions.ts | 0 |

## Deviations from Plan

### Auto-added (Rule 2 — Missing Critical Functionality)

**FORBIDDEN error passthrough in renewLoan catch block**
- **Found during:** Task 1 — implementing renewLoan
- **Issue:** PATTERNS.md catch block listed FINE_BLOCK, MAX_RENEWALS, RESERVATION_BLOCK, NOT_FOUND but omitted FORBIDDEN. Without it, the ownership-check `throw new Error("FORBIDDEN")` would fall through to `console.error + "DB_ERROR"`, masking IDOR attempts as generic errors and making debugging impossible.
- **Fix:** Added `if (err.message === "FORBIDDEN") return { success: false, error: "FORBIDDEN" };` to the catch block.
- **Files modified:** src/features/loans/actions.ts

## Known Stubs

None — all three changes are fully wired to real Prisma queries and policy data.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes introduced. All STRIDE mitigations in the plan's threat register (T-03-04-01 through T-03-04-06) are implemented:
- T-03-04-01/02: `requireRole("MEMBER")` + `loan.member.userId !== session.user.id` ownership check
- T-03-04-03/04: All blocks checked server-side in transaction; `maxUnpaidFineAmount` from DB policy
- T-03-04-05: UTC epoch math used throughout (`getTime() + ms`)
- T-03-04-06: Lazy expiry runs inside `returnBook`'s `prisma.$transaction`

## Self-Check: PASSED

- `src/features/loans/actions.ts` — exists and modified
- Commit 12794fa — verified in git log
- TypeScript: 0 errors in loans/actions.ts
