---
phase: "03"
plan: "03"
subsystem: "reservations/member-self-service"
tags: [reservations, cancel, lazy-expiry, my-reservations, bookcard, server-action, member]
dependency_graph:
  requires:
    - "03-01 (AuditLog schema, waivedReason — not used here but schema must exist)"
    - "Phase 2 returnBook (hold-advance pattern understood)"
    - "src/features/catalog/actions.ts reserveBook (extended in this plan)"
    - "src/components/catalog/BookCard.tsx (verified in this plan)"
  provides:
    - cancelReservation Server Action (src/features/reservations/actions.ts)
    - MyReservationsClient component (src/features/reservations/MyReservationsClient.tsx)
    - /my-reservations route (src/app/(app)/my-reservations/page.tsx)
    - reserveBook lazy expiry + transaction wrapper (src/features/catalog/actions.ts)
    - PICKUP_WINDOW_HOURS = 48 constant (src/lib/constants.ts)
    - RES-01 traceability comment in BookCard.tsx
  affects:
    - Catalog: reserveBook now atomically expires READY reservations + advances PENDING queue
    - Member experience: /my-reservations page accessible; cancel available on PENDING rows
    - AppSidebar: My Reservations link enabled in Plan 06 (not this plan)
tech_stack:
  added: []
  patterns:
    - MEMBER-session capture in Server Action (requireRole returns session)
    - IDOR ownership check (reservation.member.userId !== session.user.id → FORBIDDEN)
    - prisma.$transaction wrapping multi-step reservation mutation (lazy expiry + hold-advance + create)
    - UTC epoch math for pickup window (no setDate — PICKUP_WINDOW_HOURS * 60 * 60 * 1000)
    - Dialog + useTransition + toast pattern for destructive confirmation (mirrors ReturnModal.tsx)
    - Server Component page passing data to Client Component (matches my-loans pattern)
key_files:
  created:
    - src/features/reservations/actions.ts
    - src/features/reservations/MyReservationsClient.tsx
    - src/app/(app)/my-reservations/page.tsx
    - src/lib/constants.ts
  modified:
    - src/features/catalog/actions.ts (reserveBook extended with lazy expiry + transaction)
    - src/components/catalog/BookCard.tsx (RES-01 traceability comment added)
decisions:
  - reserveBook wrapped in prisma.$transaction for atomicity (lazy expiry + hold-advance + create PENDING in single tx)
  - cancelReservation uses prisma.$transaction to safely check ownership before mutation
  - Queue position gaps after cancellation are acceptable for v1 (T-03-03-05 accepted)
  - MyReservationsClient uses PICKUP_WINDOW_HOURS import for consistent 48h constant (not hardcoded)
  - /my-reservations page has no role check — any authenticated member can view their own reservations
metrics:
  duration: "~20 minutes"
  completed: "2026-06-21"
  tasks_completed: 3
  files_changed: 6
---

# Phase 03 Plan 03: Reservations Vertical Slice Summary

**One-liner:** Built cancelReservation Server Action with IDOR protection, /my-reservations page with cancellation dialog, and extended reserveBook with atomic lazy expiry of expired READY reservations before new PENDING placement.

## What Was Built

### Task 1: cancelReservation Server Action + reserveBook lazy expiry (b633db5)

**src/features/reservations/actions.ts** — New file. Exports `cancelReservation(reservationId: string): Promise<ActionResult<void>>`.
- MEMBER auth guard with session capture; LIBRARIAN sessions rejected
- prisma.$transaction: findUnique with member.user include → ownership check → status check → update to CANCELLED
- Error codes: NOT_FOUND, FORBIDDEN, NOT_CANCELLABLE, DB_ERROR
- revalidatePath("/my-reservations") on success

**src/lib/constants.ts** — New file. `export const PICKUP_WINDOW_HOURS = 48` (D-11).

**src/features/catalog/actions.ts** — Extended reserveBook:
- Added `import { PICKUP_WINDOW_HOURS } from "@/lib/constants"`
- Wrapped reservation creation in `prisma.$transaction` (T-03-03-03 atomicity)
- Lazy expiry step: find READY reservations where `notifiedAt + 48h < now()`, cancel each
- Hold-advance step: if any expired, find next PENDING + first RESERVED copy, advance PENDING to READY with `notifiedAt = now()` (D-13)
- Queue position step: compute `last.queuePosition + 1` inside transaction for accuracy

### Task 2: MyReservationsClient + /my-reservations page (6c3c563)

**src/features/reservations/MyReservationsClient.tsx** — Client component.
- Table: Book Title (font-semibold), Status badge (semantic colors), Queue Position ("Position X in queue" on PENDING only), Date Requested (en-US short format), Expires (READY rows only, UTC epoch math), Actions (Cancel button on PENDING only)
- Cancellation Dialog: "Cancel Reservation" title, "Keep Reservation" / "Yes, Cancel" buttons (destructive), useTransition + toast feedback
- Empty state with heading "No reservations" and guidance text

**src/app/(app)/my-reservations/page.tsx** — Server Component.
- Auth guard (session required, no role check — T-03-03-04)
- Member lookup with reservations include (book included, ordered by requestedAt desc)
- No-member fallback message
- Page title "My Reservations" + count span + MyReservationsClient

### Task 3: BookCard.tsx Reserve button verification (47bc64f)

All 6 D-07 conditions confirmed present and correct in existing BookCard.tsx:
1. `import { reserveBook } from "@/features/catalog/actions"` — line 15
2. `const [isPending, startTransition] = useTransition()` — line 19
3. `handleReserve` calls `startTransition(async () => { const result = await reserveBook(book.id); ... })`
4. Toast messages match UI-SPEC copywriting contract exactly (all 3 cases)
5. `disabled={book.availableCount > 0 || isPending}` — line 59
6. `onClick={handleReserve}` — line 60

Added traceability comment: `// RES-01 (D-07): Reserve button wired to reserveBook — verified Phase 3 Plan 03`

## Tasks

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | cancelReservation + reserveBook lazy expiry + constants | b633db5 | src/features/reservations/actions.ts, src/features/catalog/actions.ts, src/lib/constants.ts |
| 2 | MyReservationsClient + /my-reservations page | 6c3c563 | src/features/reservations/MyReservationsClient.tsx, src/app/(app)/my-reservations/page.tsx |
| 3 | BookCard.tsx Reserve button verification | 47bc64f | src/components/catalog/BookCard.tsx |

## Verification Results

- `npx tsc --noEmit` — 0 errors across all new and modified files
- `grep "export async function cancelReservation" src/features/reservations/actions.ts` — matches
- `grep "NOT_CANCELLABLE" src/features/reservations/actions.ts` — 3 matches (error throw + catch + return)
- `grep "PICKUP_WINDOW_HOURS" src/features/catalog/actions.ts` — 2 matches (import + usage)
- `grep "export const PICKUP_WINDOW_HOURS = 48" src/lib/constants.ts` — 1 match
- `grep "export function MyReservationsClient" src/features/reservations/MyReservationsClient.tsx` — matches
- `grep "userId: session.user.id" src/app/(app)/my-reservations/page.tsx` — matches
- `grep "import.*reserveBook.*from.*catalog/actions" src/components/catalog/BookCard.tsx` — matches
- `grep "RES-01" src/components/catalog/BookCard.tsx` — matches

## Deviations from Plan

None — plan executed exactly as written.

- Task 1: cancelReservation and reserveBook lazy expiry implemented as specified. No structural changes needed.
- Task 2: MyReservationsClient and page match spec. Empty state uses multi-line content (heading + body) as per UI-SPEC copywriting contract.
- Task 3: All 6 D-07 conditions were already met in BookCard.tsx. Traceability comment added, no code changes.

## Known Stubs

None. All data paths are wired:
- cancelReservation reads from and writes to the real Prisma Reservation table
- /my-reservations fetches real member reservations via prisma.member.findUnique with reservations include
- reserveBook lazy expiry queries real READY reservations with notifiedAt filter
- BookCard.tsx Reserve button calls real reserveBook Server Action

## Threat Surface Scan

All threat mitigations from the plan's threat register are implemented:

| Threat ID | Mitigation Status |
|-----------|-------------------|
| T-03-03-01 | DONE — requireRole("MEMBER") in cancelReservation; LIBRARIAN sessions return FORBIDDEN |
| T-03-03-02 | DONE — IDOR check: reservation.member.userId !== session.user.id → FORBIDDEN |
| T-03-03-03 | DONE — lazy expiry + hold-advance + create PENDING all inside prisma.$transaction |
| T-03-03-04 | DONE — page filters by userId: session.user.id; members see only their own reservations |
| T-03-03-05 | ACCEPTED — queue position gaps after cancellation acceptable for v1 (noted in code comment) |
| T-03-03-06 | DONE — reserveBook calls requireRole("MEMBER") server-side; bookId from rendered book data |

No new network endpoints or auth paths outside the plan's threat model introduced.

## Self-Check: PASSED

- [x] src/features/reservations/actions.ts exists and exports cancelReservation
- [x] src/features/reservations/MyReservationsClient.tsx exists and exports MyReservationsClient
- [x] src/app/(app)/my-reservations/page.tsx exists with member auth guard
- [x] src/lib/constants.ts exists with PICKUP_WINDOW_HOURS = 48
- [x] src/features/catalog/actions.ts imports PICKUP_WINDOW_HOURS and uses it in reserveBook
- [x] src/components/catalog/BookCard.tsx has RES-01 traceability comment
- [x] Commits b633db5, 6c3c563, 47bc64f exist in git log
- [x] TypeScript: 0 errors in all new/modified files
