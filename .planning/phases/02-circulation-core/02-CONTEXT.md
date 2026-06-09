# Phase 2: Circulation Core - Context

**Gathered:** 2026-06-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 delivers the complete checkout-and-return cycle: librarians can check out a specific book copy to a member, process returns (with overdue fine creation and reservation queue advancement), and view all active loans. Members can view their active loans and loan history. Concurrency-safe availability checks via `SELECT FOR UPDATE` prevent double-checkout races.

**In scope:** Checkout Server Action (SELECT FOR UPDATE, auto-assign copy, due date calculation), return Server Action (loan close, fine creation on overdue, copy status update, reservation queue advance), librarian `/loans` page (tabs: Active | All), member `/my-loans` page (two sections: active + history), checkout slide-over form, return confirmation modal.

**Out of scope for this phase:** Fine waiving / management UI (Phase 3), reservation management (Phase 3), renewals (Phase 3), audit log (Phase 3), email notifications (Phase 4), reports (Phase 5).

</domain>

<decisions>
## Implementation Decisions

### Checkout UI Flow
- **D-01:** Checkout initiated from the `/loans` page via a "Check Out" button that opens a slide-over panel — consistent with the Phase 1 slide-over pattern (D-12, D-13 from Phase 1 CONTEXT.md). No separate `/loans/new` route needed.
- **D-02:** Member search inside the slide-over uses type-ahead by name or member number — matching results appear as a dropdown list as the librarian types.
- **D-03:** Book search inside the slide-over uses type-ahead by title or ISBN — same pattern as member search.
- **D-04:** Due date preview shown before confirming — once a member is selected, display the calculated due date (today + `loanDays` from `LoanPolicy` based on `memberType`). Librarian sees it before clicking Confirm.

### Copy Selection
- **D-05:** System auto-assigns the first AVAILABLE copy — librarian does not pick a barcode. The Server Action selects the first AVAILABLE copy for the searched book using `SELECT FOR UPDATE` to prevent races.
- **D-06:** Books with no AVAILABLE copies appear greyed out in search results with a "No copies available" label — they are not selectable but remain visible to confirm the title exists in the catalog.

### Return Flow
- **D-07:** Return is processed via a "Return" row action on the Active Loans tab of `/loans`. No return action on the book detail page in Phase 2.
- **D-08:** For overdue returns, show a confirmation modal before completing the return: "This book is X days overdue. A fine of $Y will be recorded." Librarian clicks Confirm to proceed. Fine amount = `fineDailyRate × overdue_days` from `LoanPolicy`.
- **D-09:** On return, if a PENDING reservation exists for the book title, set the copy status to RESERVED and show an on-screen notice: "Hold triggered for [Member Name] — copy reserved." The notification email and full reservation queue logic are Phase 3/4 scope; Phase 2 only updates `BookCopy.status` to `RESERVED` and advances the earliest PENDING reservation to `READY`.

### Loans Page Layout
- **D-10:** Librarian `/loans` page uses tabs: **Active** (default) | **All Loans**. Active tab shows only ACTIVE/OVERDUE loans sorted by due date ascending (soonest first), with overdue rows highlighted. All Loans tab shows the full history.
- **D-11:** Active Loans tab columns: Member, Book Title, Copy (barcode), Due Date, Status badge (ACTIVE/OVERDUE), Actions (Return button). Overdue rows use a destructive/red variant.
- **D-12:** Member `/my-loans` page updated to two sections: **Active Loans** (top, overdue highlighted) and **Loan History** (below, all returned loans in reverse-chronological order). No tabs — single scrollable page.

### Claude's Discretion
- Exact layout/spacing of the checkout slide-over — standard shadcn/ui form layout is fine.
- Pagination strategy for the All Loans tab — standard offset pagination is acceptable.
- Loading/error states — standard shadcn/ui skeleton/toast patterns.
- Column sort behavior — default sort by due date; other column sorts are optional.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — core value, constraints (Docker-first, soft delete, UTC dates, Railway)
- `.planning/REQUIREMENTS.md` — CIRC-01, CIRC-02, CIRC-03, CIRC-04 definitions
- `.planning/STATE.md` — pre-locked decisions: `SELECT FOR UPDATE` for checkout, `requireRole()` enforcement, Timestamptz convention

### Prior Phase Decisions
- `.planning/phases/01-foundation/01-CONTEXT.md` — D-12 (slide-over panel pattern), D-15/D-16 (LoanPolicy table + default values), D-05/D-06 (sidebar nav, Loans section), D-09 (data table pattern)

### Schema & Stack
- `.planning/research/ARCHITECTURE.md` — full Prisma schema (Loan, BookCopy, LoanPolicy, Fine, Reservation models), component boundaries
- `.planning/research/PITFALLS.md` — SELECT FOR UPDATE pattern, requireRole() enforcement (CVE-2025-29927), UTC timestamp convention
- `.planning/research/STACK.md` — stack versions (Next.js 16, Prisma 7.7, Better Auth 1.x, shadcn/ui)

### Roadmap
- `.planning/ROADMAP.md` — Phase 2 goal, success criteria, requirement list

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/badge.tsx` — Badge variants; use `variant="destructive"` for OVERDUE status
- `src/components/ui/table.tsx`, `TableHead`, `TableBody`, `TableRow`, `TableCell` — established table pattern from books/members pages
- `src/components/ui/dialog.tsx` — Dialog component for the overdue fine confirmation modal
- `src/lib/require-role.ts` — `requireRole("LIBRARIAN")` must be called first in checkout and return Server Actions
- `src/lib/db.ts` — Prisma singleton; use `prisma.$transaction` for checkout
- `src/app/(app)/my-loans/page.tsx` — existing stub; update in Phase 2 to the two-section layout
- `src/components/layout/AppSidebar.tsx` — Loans nav item already wired; will activate in Phase 2

### Established Patterns
- **Server Actions** for all mutations — no separate API routes (established in Phase 1)
- **Server Components** for data fetching — no SWR/React Query
- **Slide-over panels** for forms — right-side drawer with table visible in background (D-12 Phase 1)
- **Data tables** with row actions — sortable columns, inline action buttons (books/members pattern)
- **`requireRole()`** as first line of every Server Action — non-negotiable security invariant
- **Feature folders**: `src/features/[domain]/` — new circulation feature goes in `src/features/loans/`

### Integration Points
- `src/app/(app)/loans/page.tsx` — new route for librarian loans management (create in Phase 2)
- `src/app/(app)/my-loans/page.tsx` — existing stub to update with active/history sections
- `prisma/schema.prisma` — `Loan`, `BookCopy`, `LoanPolicy`, `Fine`, `Reservation` models all exist; no schema changes needed for Phase 2 core (Fine.reason and Fine.status already present for overdue fine creation)
- `src/components/layout/AppSidebar.tsx` — Loans link already in sidebar (activate/link to `/loans`)

</code_context>

<specifics>
## Specific Ideas

- **Checkout slide-over fields:** Member search (type-ahead, shows name + member number), Book/title search (type-ahead, shows title + availability count), Due Date preview (auto-calculated, read-only field showing the calculated date), Confirm button.
- **Overdue fine modal wording:** "This book is {X} days overdue. A fine of ${Y} will be recorded on {MemberName}'s account." with Cancel and Confirm Return buttons.
- **Hold notice after return:** Toast or inline notice: "Hold triggered for {MemberName} — copy reserved." The copy's `BookCopy.status` updates to `RESERVED` and the earliest PENDING `Reservation` advances to `READY`.
- **Active loans table overdue highlight:** Entire row gets a `bg-red-50` or similar subtle highlight, not just the status badge, so overdue loans stand out at a glance.
- **Due date column format:** Display as a date string (e.g., "Jun 24, 2026"); overdue rows show the date in red with a text indicator like "3 days overdue".

</specifics>

<deferred>
## Deferred Ideas

- Fine waiving and fine management UI — Phase 3 (FINE-02)
- Member fine blocking on checkout — Phase 3 (FINE-03)
- Reservation placement and cancellation — Phase 3 (RES-01–04)
- Renewal flow — Phase 3 (RNW-01–04)
- Audit log for checkout/return actions — Phase 3 (AUD-01–02)
- Email notification when reservation becomes READY — Phase 4 (NOTF-03)

</deferred>

---

*Phase: 2-Circulation Core*
*Context gathered: 2026-06-10*
