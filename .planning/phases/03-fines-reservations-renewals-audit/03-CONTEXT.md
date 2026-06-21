# Phase 3: Fines, Reservations, Renewals & Audit - Context

**Gathered:** 2026-06-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 activates the policy enforcement and management layer on top of the Phase 2 circulation core. Members get self-service reservation placement and cancellation, and self-service loan renewal (with policy-enforced blocking). Librarians get a dedicated fine management page with waiver capability, and a searchable audit trail of all librarian mutations. Phase 3 also adds lazy pickup-window enforcement for expired READY reservations and retrofits audit writes into Phase 2's checkout/return Server Actions.

**In scope:** Fine management UI (`/fines` page, waiver dialog, FINE-02, FINE-03), reservation placement from catalog (RES-01), reservation cancellation by member (RES-04), `/my-reservations` page, pickup window expiry with lazy cancellation and hold-advance (RES-03), loan renewal from `/my-loans` (RNW-01–04), audit log model + `/audit` page (AUD-01, AUD-02), audit writes retrofitted into Phase 2 `checkoutBook`/`returnBook` actions.

**Out of scope for this phase:** Email notification when reservation becomes READY (Phase 4 — NOTF-03), proactive cron-based pickup-window cleanup (Phase 4), fine payment collection (out of scope v1), reports and analytics (Phase 5).

</domain>

<decisions>
## Implementation Decisions

### Fine Management (/fines page)
- **D-01:** Dedicated `/fines` page — librarian-only, peer-level route alongside `/loans` and `/members`. Listed in the librarian sidebar.
- **D-02:** Table columns: Member name | Book title (from the associated loan) | Fine amount | Status badge (UNPAID / PAID / WAIVED) | Created date | Actions (Waive button on UNPAID rows only).
- **D-03:** Waiver UX — clicking Waive opens an inline Dialog/modal: reason textarea (required, min 1 character) + Confirm Waive button. Uses the existing `src/components/ui/dialog.tsx` component. Same pattern as the Phase 2 overdue return confirmation.
- **D-04:** Filter tabs: **Unpaid** (default) | **All**. Same `Tabs` component pattern as `/loans` (Active | All Loans). Unpaid tab shows only UNPAID fines — what the librarian acts on. All tab shows full history including PAID and WAIVED.
- **D-05 (Schema):** Add `waivedReason String?` field to the `Fine` model via migration. Keep existing `reason String @default("OVERDUE")` for the auto-fine reason. `waivedReason` is populated when the librarian submits the waiver dialog.

### Member Fine Blocking (FINE-03)
- **D-06:** Blocking enforced at Server Action level — `checkoutBook` and renewal Server Action check `SUM(Fine.amount WHERE status = UNPAID)` for the member against `LoanPolicy.maxUnpaidFineAmount`. Rejection returns a `FINE_BLOCK` error code with the outstanding amount shown to the librarian/member.

### Reservations
- **D-07:** Reserve button lives on the catalog book card (`src/components/catalog/BookCard.tsx`) — only rendered when `availableCopies === 0`. When copies are available, the card shows the Available badge and no Reserve button.
- **D-08:** Reserve action: single click on the Reserve button triggers the `placeReservation` Server Action (member auth required). No slide-over or form — just a confirmation toast on success.
- **D-09:** `/my-reservations` page — flat list (not sectioned), columns: Book title | Queue position | Status badge (PENDING / READY / FULFILLED / CANCELLED) | Date requested | Expires (shown only for READY rows, formatted as "Pick up by Jun 23") | Cancel button (PENDING rows only). No separate History section — status badges distinguish active from historical.
- **D-10:** Member cancels reservation via inline Dialog/modal: "Cancel your reservation for [Book Title]?" with Cancel and Confirm buttons. Uses existing `dialog.tsx`.

### Pickup Window & Expiry (RES-03)
- **D-11:** Pickup window: **48 hours** from `Reservation.notifiedAt` (when reservation advances to READY). Stored as a constant `PICKUP_WINDOW_HOURS = 48` in `src/lib/constants.ts` (not in DB — changing it requires a code deploy, which is acceptable for v1).
- **D-12:** Lazy cancellation — no background job in Phase 3. Expired READY reservations are detected and cancelled on the next relevant trigger: (a) inside `returnBook` before advancing the hold queue, (b) inside `placeReservation` before adding a new reservation for that book title.
- **D-13:** When an expired READY reservation is cancelled, immediately advance the next PENDING reservation to READY atomically in the same transaction — identical hold-advance logic as `returnBook`. Sets copy status to RESERVED, updates next PENDING to READY, sets `notifiedAt`. Phase 4 cron will run this proactively on a schedule.

### Renewals (RNW-01–04)
- **D-14:** Renew button on `/my-loans` active loan rows — member-facing. Calls `renewLoan(loanId)` Server Action. New due date = current `dueAt` + `LoanPolicy.loanDays` (same duration as original loan).
- **D-15:** Renewal blocking logic (checked in this order in `renewLoan` Server Action):
  1. **FINE_BLOCK**: Member has unpaid fines ≥ `maxUnpaidFineAmount` (RNW-04)
  2. **MAX_RENEWALS**: `Loan.renewCount >= LoanPolicy.maxRenewals` (RNW-03)
  3. **RESERVATION_BLOCK**: An active PENDING or READY reservation exists for any copy of this book title (RNW-02)
- **D-16:** Blocking feedback — specific error toast per block type: "Renewal blocked: you have $X.XX in unpaid fines" / "Renewal blocked: maximum renewals reached" / "Renewal blocked: another member has a hold on this title."
- **D-17:** On successful renewal: increment `Loan.renewCount`, update `Loan.dueAt`, keep `Loan.status` as ACTIVE (or OVERDUE if currently overdue — renewal resets the due date but doesn't clear overdue status if still past the new date).

### Audit Log (AUD-01, AUD-02)
- **D-18:** New `AuditLog` model (schema migration required):
  ```
  model AuditLog {
    id         String   @id @default(cuid())
    actorId    String                          -- librarian's User.id
    action     AuditAction                     -- enum
    entityType String                          -- "Loan" | "Fine" | "Book" | "Member"
    entityId   String                          -- ID of the affected record
    details    Json?                           -- extra context (amounts, titles, names)
    createdAt  DateTime @default(now()) @db.Timestamptz(3)
    actor      User     @relation(fields: [actorId], references: [id])
  }
  
  enum AuditAction {
    CHECKOUT
    RETURN
    FINE_WAIVED
    BOOK_ADDED
    BOOK_EDITED
    BOOK_DELETED
    MEMBER_ADDED
    MEMBER_EDITED
    MEMBER_DEACTIVATED
  }
  ```
- **D-19:** Audit scope — all Phase 3 librarian Server Actions emit `AuditLog` entries. Phase 2 `checkoutBook` and `returnBook` are retrofitted with audit writes in this phase (AUD-01 explicitly lists checkout and return). Catalog and member action writes were in Phase 1 scope but their Server Actions are also updated here.
- **D-20:** `/audit` page — librarian-only. Chronological table, newest first. Columns: Timestamp | Librarian name | Action badge (color-coded by action type) | Description (e.g., "Checked out The Great Gatsby to John Smith"). Filter controls: date range picker (from / to) + action type dropdown (multi-select). AUD-02 specifies both filters.

### Claude's Discretion
- Exact layout/spacing of the `/fines`, `/my-reservations`, `/audit` pages — standard shadcn/ui table + card patterns.
- Pagination strategy for `/fines` and `/audit` — standard offset pagination (same as `/loans`).
- `/fines` sidebar placement — add as a sub-item under Loans, or as a peer entry; Claude picks what's consistent with the existing AppSidebar structure.
- Queue position display on `/my-reservations` — "Position X in queue" label next to PENDING entries.
- `details` JSON structure for `AuditLog` — Claude defines a sensible schema per action type (e.g., CHECKOUT includes `{ memberId, memberName, bookTitle, copyBarcode, dueAt }`).
- Loading/error states — standard skeleton/toast patterns.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — core value, constraints (Docker-first, soft delete, UTC dates, Railway), out-of-scope items (fine payment collection)
- `.planning/REQUIREMENTS.md` — FINE-01–03, RES-01–04, RNW-01–04, AUD-01–02 definitions
- `.planning/STATE.md` — pre-locked decisions: requireRole() enforcement, SELECT FOR UPDATE, Timestamptz convention, Docker+Railway

### Prior Phase Decisions
- `.planning/phases/01-foundation/01-CONTEXT.md` — D-07 (member sidebar "My Reservations" active Phase 3), D-09 (data table pattern), D-11 (catalog card with Reserve placeholder), D-12 (slide-over panel pattern), D-15/D-16 (LoanPolicy table + seeded defaults)
- `.planning/phases/02-circulation-core/02-CONTEXT.md` — D-08 (overdue fine created on return), D-09 (reservation advances to READY on return — hold-advance logic to extend in Phase 3), D-10/D-11/D-12 (loans page + my-loans layout)

### Schema & Stack
- `.planning/research/ARCHITECTURE.md` — full Prisma schema (Fine, Reservation, Loan, LoanPolicy, Member, BookCopy models), component boundaries
- `.planning/research/PITFALLS.md` — requireRole() enforcement (CVE-2025-29927), UTC timestamp convention, SELECT FOR UPDATE pattern
- `.planning/research/STACK.md` — stack versions (Next.js 16, Prisma 7.7, Better Auth 1.x, shadcn/ui)

### Roadmap
- `.planning/ROADMAP.md` — Phase 3 goal, success criteria, requirement list (FINE-01–03, RES-01–04, RNW-01–04, AUD-01–02)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/dialog.tsx` — Fine waiver dialog, reservation cancellation confirmation (same Dialog used for Phase 2 return confirmation)
- `src/components/ui/badge.tsx` — Status badges: UNPAID/PAID/WAIVED (fines), PENDING/READY/FULFILLED/CANCELLED (reservations)
- `src/components/ui/table.tsx` + `TableHead/Body/Row/Cell` — `/fines` table, `/my-reservations` list, `/audit` table
- `src/components/ui/tabs.tsx` — Filter tabs on `/fines` (Unpaid | All) — same pattern as `/loans` (Active | All Loans)
- `src/components/ui/sheet.tsx` — Not needed for fine waiver (dialog preferred), available if a slide-over is needed elsewhere in this phase
- `src/lib/require-role.ts` — `requireRole("LIBRARIAN")` or `requireRole("MEMBER")` — first call in every Server Action
- `src/lib/db.ts` — Prisma singleton for all queries
- `src/features/loans/actions.ts` — `returnBook` action to extend with: (a) audit write, (b) lazy expired-READY cancellation before hold-advance
- `src/components/catalog/BookCard.tsx` — Add conditional Reserve button (shown when `availableCopies === 0`)

### Established Patterns
- **Server Actions** (`"use server"`, `requireRole()` first, Zod validation, `prisma.$transaction` for multi-step mutations)
- **Feature folders**: `src/features/[domain]/` — new domains: `fines/`, `reservations/`, `audit/`
- **Slide-over panels** for add/edit forms — but Phase 3 uses dialogs for confirmation/waiver flows (lighter than slide-overs)
- **Data tables** with row actions — sortable columns, inline action buttons
- **`ActionResult<T>` return type** — `{ success: true; data: T } | { success: false; error: string }` — established in `actions.ts`
- **Sonner toasts** (`src/components/ui/sonner.tsx`) for success/error feedback

### Integration Points
- `src/features/loans/actions.ts` — Retrofit `checkoutBook` + `returnBook` with `AuditLog` writes; add expired-READY lazy cancellation inside `returnBook`
- `src/features/catalog/actions.ts` — Retrofit `addBook`, `updateBook`, `deleteBook` with `AuditLog` writes
- `src/features/members/actions.ts` — Retrofit `addMember`, `updateMember`, `deactivateMember` with `AuditLog` writes
- `src/app/(app)/my-loans/page.tsx` — Add Renew button to active loan rows
- `src/components/catalog/BookCard.tsx` — Add Reserve button (conditional on `availableCopies === 0`)
- `src/components/layout/AppSidebar.tsx` — Activate "My Reservations" member link + add "Fines" and "Audit" librarian links
- New routes: `src/app/(app)/fines/page.tsx` (librarian), `src/app/(app)/my-reservations/page.tsx` (member), `src/app/(app)/audit/page.tsx` (librarian)
- `prisma/schema.prisma` — Two migrations needed: (1) add `waivedReason String?` to `Fine`, (2) add `AuditLog` model + `AuditAction` enum

</code_context>

<specifics>
## Specific Ideas

- **Fine waiver dialog wording:** "Waive fine of $[amount] for [Member Name]?" with a required reason textarea and Confirm Waive button.
- **Pickup window display on /my-reservations:** READY rows show "Pick up by [date]" in the Expires column; this date = `notifiedAt + 48h`. Overdue pickup rows (past 48h, not yet cleaned up by lazy expiry) shown with red text.
- **Renewal blocked toast messages:** "Renewal blocked: $X.XX in unpaid fines" / "Renewal blocked: maximum renewals (2) reached" / "Renewal blocked: another member has a hold on this title."
- **Audit log description format:** Human-readable text in `details.description` JSON field — e.g., "Checked out 'The Great Gatsby' (copy #42) to Jane Smith, due Jun 28" — rendered directly in the audit table's Description column.
- **FINE_BLOCK error on checkout:** When `checkoutBook` rejects due to unpaid fines, the CheckoutSheet shows an inline error: "This member has $X.XX in outstanding fines. Clear fines before checkout."

</specifics>

<deferred>
## Deferred Ideas

- Hold-ready email notification when reservation advances to READY — Phase 4 (NOTF-03)
- Proactive cron-based pickup window cleanup (run hourly/daily to cancel all expired READY reservations) — Phase 4
- Fine payment collection / integration with payment processor — Out of scope v1
- Configurable pickup window via admin UI — Out of scope v1 (hardcoded 48h constant)
- Audit log export to CSV — Out of scope v1 (read-only filtered view per AUD-02)

</deferred>

---

*Phase: 3-Fines, Reservations, Renewals & Audit*
*Context gathered: 2026-06-21*
