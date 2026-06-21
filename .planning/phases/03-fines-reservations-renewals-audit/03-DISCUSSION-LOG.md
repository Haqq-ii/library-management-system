# Phase 3: Fines, Reservations, Renewals & Audit - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-21
**Phase:** 3-Fines, Reservations, Renewals & Audit
**Areas discussed:** Fine management page, Reservation UX, Pickup window & expiry, Audit log scope

---

## Fine Management Page

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated /fines page | Standalone librarian page; peer-level route alongside /loans and /members; sidebar link | ✓ |
| Embedded in /loans as a tab | Fines tab alongside Active \| All Loans; no new sidebar entry | |
| Per-member only | Accessible only from member profile; no system-wide view | |

**User's choice:** Dedicated /fines page

---

| Option | Description | Selected |
|--------|-------------|----------|
| Member + Book + Amount + Status + Date + Actions | Full context columns; Waive button on UNPAID rows | ✓ |
| Minimal: Member + Amount + Status + Actions | Leaner; book title requires click-through | |
| You decide | Claude picks defaults | |

**User's choice:** Member + Book + Amount + Status + Date + Actions

---

| Option | Description | Selected |
|--------|-------------|----------|
| Inline dialog/modal with reason field | Small confirmation dialog; reason textarea (required); reuses dialog.tsx | ✓ |
| Slide-over panel | Full fine context + waiver form; heavier UX | |
| Inline expand (row expands in place) | Row expands to reveal reason input; new pattern not in codebase | |

**User's choice:** Inline dialog/modal with reason field

---

| Option | Description | Selected |
|--------|-------------|----------|
| Filter tabs: Unpaid \| All | Unpaid default (actionable); All tab for full history; same as /loans tabs | ✓ |
| Dropdown filter | More granular status filtering | |
| No filtering — show all fines | Flat list; cluttered over time | |

**User's choice:** Filter tabs: Unpaid | All

---

## Reservation UX

| Option | Description | Selected |
|--------|-------------|----------|
| Catalog card 'Reserve' button | Phase 1 D-11 placeholder activated; only when availableCopies === 0 | ✓ |
| Book detail page only | /books/[id] with full copy status table; catalog cards stay read-only | |
| Both catalog card and book detail page | Reserve on both; consistent Server Action | |

**User's choice:** Catalog card 'Reserve' button (only when no available copies)

---

| Option | Description | Selected |
|--------|-------------|----------|
| List with status badges + cancel action | Flat list; status badges; Cancel on PENDING rows | ✓ |
| Two sections: Active and History | Mirrors /my-loans two-section layout (D-12, Phase 2) | |
| You decide | Claude picks most consistent with /my-loans patterns | |

**User's choice:** List with status badges + cancel action

---

| Option | Description | Selected |
|--------|-------------|----------|
| Inline confirmation dialog | "Cancel your reservation for [Title]?"; reuses dialog.tsx | ✓ |
| Optimistic: immediate cancel with undo toast | Snappier UX; requires new optimistic update pattern | |
| No confirmation | Direct action; risky for accidental clicks | |

**User's choice:** Inline confirmation dialog

---

| Option | Description | Selected |
|--------|-------------|----------|
| Reserve button hidden/disabled when copies available | Only shown when availableCopies === 0 | ✓ |
| Always visible, server rejects if copies available | Error toast when misused; unnecessary error paths | |
| You decide | Claude picks consistent with catalog card design | |

**User's choice:** Reserve button hidden/disabled when copies are available

---

## Pickup Window & Expiry

| Option | Description | Selected |
|--------|-------------|----------|
| 48 hours | STATE.md default; reasonable for school library | ✓ |
| 72 hours | More forgiving for irregular student/faculty schedules | |
| Configurable per member type | Students 48h, Faculty 72h; requires LoanPolicy schema change | |

**User's choice:** 48 hours

---

| Option | Description | Selected |
|--------|-------------|----------|
| Lazy cancellation on next trigger | Check on returnBook and placeReservation; no background job needed in Phase 3 | ✓ |
| Defer entirely to Phase 4 | No cancellation logic until cron; READY reservations may linger | |
| Cleanup in returnBook action only | Narrow scope; misses cases with no return | |

**User's choice:** Lazy cancellation on next trigger

---

| Option | Description | Selected |
|--------|-------------|----------|
| Immediately advance next PENDING to READY | Atomic; same hold-advance pattern as returnBook | ✓ |
| Free copy to AVAILABLE, no auto-advance | Simpler; queue doesn't self-heal | |
| You decide | Claude picks consistent with returnBook hold-advance logic | |

**User's choice:** Immediately advance next PENDING to READY (atomic)

---

## Audit Log Scope

| Option | Description | Selected |
|--------|-------------|----------|
| All librarian mutations: Phase 2 + Phase 3 | Retrofit checkout/return in Phase 2 actions; complete log from go-live | ✓ |
| Phase 3 new actions only (fine waivers) | Existing actions untouched; log has gaps for historical checkouts/returns | |
| You decide | Claude picks approach matching AUD-01 stated scope | |

**User's choice:** All librarian mutations: Phase 2 + Phase 3 (retrofit checkout/return)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Generic AuditLog table | Single model; one enum for action types; single query for audit page | ✓ |
| Action-specific tables | 5+ new models; UNION queries required; over-engineered | |
| Append to existing records | No new table; adds columns to core tables; doesn't scale | |

**User's choice:** Generic AuditLog table

---

| Option | Description | Selected |
|--------|-------------|----------|
| Chronological table with date + actor filter | Newest first; date range picker + action type filter per AUD-02 | ✓ |
| Timeline-style view grouped by day | Grouped under day headers; no grouping component in codebase | |
| You decide | Claude picks consistent with /loans and /fines table patterns | |

**User's choice:** Chronological table with date range and action type filters

---

## Claude's Discretion

- Exact layout/spacing of `/fines`, `/my-reservations`, `/audit` pages — standard shadcn/ui table + card patterns
- Pagination strategy — standard offset pagination (same as `/loans`)
- `/fines` sidebar placement — peer entry or sub-item under Loans; Claude picks consistent with AppSidebar
- Queue position display format on `/my-reservations` — "Position X in queue" next to PENDING entries
- `details` JSON schema per AuditLog action type — Claude defines sensible per-action structure
- Loading/error states — standard skeleton/toast patterns

## Deferred Ideas

- Hold-ready email when reservation advances to READY — Phase 4 (NOTF-03)
- Proactive cron-based pickup window cleanup — Phase 4
- Fine payment collection — Out of scope v1
- Configurable pickup window via admin UI — Out of scope v1
- Audit log CSV export — Out of scope v1
