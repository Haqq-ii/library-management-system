# Phase 2: Circulation Core - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-10
**Phase:** 02-circulation-core
**Areas discussed:** Checkout entry point, Copy selection, Return + overdue fine UX, Loans page layout

---

## Checkout Entry Point

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated /loans/new page | A dedicated checkout form — librarian searches for a member AND searches/selects a book/copy in one place | ✓ |
| From book detail page | The copies sub-table on /books/[id] gets a 'Check out' button on AVAILABLE rows | |
| From member profile | Member's profile/detail page gets a 'Check out book' action | |

**User's choice:** Dedicated `/loans` page with checkout via slide-over panel

| Option | Description | Selected |
|--------|-------------|----------|
| Slide-over panel | Consistent with Phase 1 book and member forms | ✓ |
| Full page form | Dedicated /loans/new page with larger form layout | |
| Modal dialog | Centered modal overlay | |

**User's choice:** Slide-over panel

| Option | Description | Selected |
|--------|-------------|----------|
| Type-ahead search by name or member number | Results appear as dropdown as librarian types | ✓ |
| Dropdown list of all active members | Scrollable dropdown of all members | |
| Separate member lookup step | Two-step form: confirm member first, then pick book | |

**User's choice:** Type-ahead search by name or member number

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — show calculated due date | Preview due date before confirming; auto-calculated from LoanPolicy | ✓ |
| No — show due date only after checkout | Due date appears in confirmation message after action | |
| You decide | Claude's discretion | |

**User's choice:** Show calculated due date preview before confirming

**Notes:** None beyond selections.

---

## Copy Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-assign the first AVAILABLE copy | System picks the first AVAILABLE copy automatically | ✓ |
| Librarian picks by barcode/copy ID | Search field for copy barcode or ID | |
| Librarian picks from a list of available copies | List of AVAILABLE copies shown; librarian picks one | |

**User's choice:** Auto-assign the first AVAILABLE copy

| Option | Description | Selected |
|--------|-------------|----------|
| Type-ahead by title or ISBN | Matching books appear in dropdown as librarian types | ✓ |
| Full catalog search with results list | Mini-catalog view inside slide-over | |
| ISBN barcode scan only | Librarian scans ISBN barcode | |

**User's choice:** Type-ahead by title or ISBN

| Option | Description | Selected |
|--------|-------------|----------|
| Show greyed out with "No copies available" | Book appears but is disabled with label | ✓ |
| Exclude books with no available copies | Only show books with ≥1 AVAILABLE copy | |
| Allow checkout anyway with a warning | Show warning on confirm — not recommended | |

**User's choice:** Show the book greyed out with "No copies available"

**Notes:** None beyond selections.

---

## Return + Overdue Fine UX

| Option | Description | Selected |
|--------|-------------|----------|
| Row action on the active loans table | Return button on each row of /loans page | ✓ |
| From the book detail page (copies sub-table) | Return action on CHECKED_OUT copies in /books/[id] | |
| Both locations | Return action available in both places | |

**User's choice:** Row action on the active loans table

| Option | Description | Selected |
|--------|-------------|----------|
| Confirmation modal showing the fine amount | Modal before confirming: "X days overdue. $Y fine will be recorded." | ✓ |
| Silent fine creation, no modal | Fine created in background; return completes immediately | |
| Fine creation is a separate step | Return closes loan first; 'Apply fine' action appears after | |

**User's choice:** Confirmation modal showing the fine amount

| Option | Description | Selected |
|--------|-------------|----------|
| Set copy to RESERVED and show a notice | If reservation exists, copy → RESERVED + on-screen notice | ✓ |
| Set copy to AVAILABLE — reservation queue is Phase 3 | Return always sets copy to AVAILABLE | |
| Block return until reservation is handled | Force librarian to resolve reservation first | |

**User's choice:** Set copy to RESERVED and show on-screen notice (reservation queue advancement Phase 3, but status change happens in Phase 2)

**Notes:** None beyond selections.

---

## Loans Page Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Active loans only, sorted by due date | Single operational view for daily work | |
| All loans with status filter | Single table with filter dropdown | |
| Tabs: Active \| All Loans | Tab 1: active sorted by due date; Tab 2: full history | ✓ |

**User's choice:** Tabs: Active | All Loans

| Option | Description | Selected |
|--------|-------------|----------|
| Member, Book Title, Copy, Due Date, Status, Actions | Core operational columns; overdue rows highlighted in red | ✓ |
| Member, Book Title, Due Date, Days Remaining, Actions | Days remaining instead of status badge | |
| You decide | Claude picks columns | |

**User's choice:** Member, Book Title, Copy, Due Date, Status, Actions (with overdue row highlight)

| Option | Description | Selected |
|--------|-------------|----------|
| Two sections: Active Loans + Loan History | Active at top, history below; single scrollable page | ✓ |
| Tabs: Active \| History | Mirror librarian tab pattern for members | |
| Single table with status column | All loans in one table with Status column | |

**User's choice:** Two sections (Active + History) on the member's My Loans page

**Notes:** None beyond selections.

---

## Claude's Discretion

- Exact layout/spacing of the checkout slide-over
- Pagination strategy for the All Loans tab
- Loading/error states (skeleton, toast patterns)
- Column sort behavior beyond default due-date sort

## Deferred Ideas

- Fine waiving and fine management UI → Phase 3
- Member fine blocking on checkout → Phase 3
- Reservation placement and cancellation → Phase 3
- Renewals → Phase 3
- Audit log for checkout/return → Phase 3
- Email notification when reservation becomes READY → Phase 4
