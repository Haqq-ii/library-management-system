---
phase: 02-circulation-core
verified: 2026-06-15T12:31:00Z
status: human_needed
score: 13/13 must-haves verified
overrides_applied: 0
re_verification: false
human_verification:
  - test: "Librarian opens /loans, opens Check Out sheet, types a member name, selects a member, types a book title, selects a book with available copies, observes due date preview, confirms checkout, and the new loan appears in the Active tab"
    expected: "Loan created, copy status changes to CHECKED_OUT, Active tab shows the new loan row with correct member name, book title, and due date"
    why_human: "End-to-end UI flow through Sheet open/close, type-ahead debounce, and server action round-trip cannot be verified with grep"
  - test: "Two browser tabs both attempt to check out the last available copy of the same book simultaneously"
    expected: "Exactly one succeeds; the second returns a 'No copies available' toast. No duplicate loan is created."
    why_human: "Concurrency proof requires two simultaneous HTTP requests to the same server action; cannot simulate with static analysis"
  - test: "Librarian returns an on-time loan via the Return button in the Active tab"
    expected: "No modal appears; loan row disappears from Active tab; copy status returns to AVAILABLE; success toast shown"
    why_human: "UI flow (direct returnBook call without modal) and table refresh require a running app"
  - test: "Librarian returns an overdue loan via the Return button"
    expected: "ReturnModal opens showing correct days overdue and fine amount; on Confirm Return the loan closes, an UNPAID Fine record is created in the database with amount = fineDailyRate × overdue days, and the row leaves the Active tab"
    why_human: "Modal open/confirm interaction and database fine record creation verification require a running app and database access"
  - test: "Librarian returns a book that has a PENDING reservation for the same title"
    expected: "Copy status becomes RESERVED, earliest PENDING reservation becomes READY, and a toast shows 'Returned. Hold triggered for [MemberName] — copy reserved.'"
    why_human: "Requires seeded reservation data and running app to exercise the hold-advance path"
  - test: "Member with active and returned loans visits /my-loans"
    expected: "Two clearly separate sections: 'Active Loans' at top (overdue rows highlighted in red/bg-red-50) and 'Loan History' below (Returned badge); no tabs present"
    why_human: "Visual layout and section rendering require a running browser session with real loan data"
---

# Phase 02: Circulation Core Verification Report

**Phase Goal:** Librarians can perform the complete checkout-and-return cycle with concurrency-safe availability checks, and both librarians and members can see current and past loans.
**Verified:** 2026-06-15T12:31:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Librarian can open /loans from the sidebar (Loans nav item no longer disabled) | VERIFIED | `AppSidebar.tsx` LIBRARIAN_NAV entry `{ href: "/loans", label: "Loans", icon: BookMarked }` has no `disabled` property; grep on the Loans entry returns no `disabled` |
| 2 | Librarian can open the Check Out slide-over and type-ahead search a member by name or member number | VERIFIED | `CheckoutSheet.tsx` calls `searchMembers(q)` on input change; `loan-search.ts` searchMembers filters on `user.name`, `user.email`, `memberNumber` with OR/contains/insensitive |
| 3 | Books with zero AVAILABLE copies appear greyed out and are not selectable | VERIFIED | `CheckoutSheet.tsx` line 96: `if (b.availableCount === 0) return;` prevents selection; `opacity-50 cursor-not-allowed` CSS applied; "No copies available" label shown |
| 4 | Slide-over shows a read-only calculated due date (today + loanPolicy.loanDays) once member selected | VERIFIED | `CheckoutSheet.tsx` `dueDatePreview` useMemo (lines 104-111) computes `Date.now() + policy.loanDays * 24*60*60*1000` from the `policies` prop passed from the page; rendered as read-only `bg-muted/40` div |
| 5 | Confirming checkout creates a Loan, sets the first AVAILABLE copy to CHECKED_OUT, and the loan appears in the Active tab | VERIFIED | `actions.ts` checkoutBook: `$queryRaw` locks first AVAILABLE copy, `tx.bookCopy.update` sets CHECKED_OUT, `tx.loan.create` creates loan, `revalidatePath("/loans")` called; unit test 1 passes |
| 6 | Two concurrent checkouts on the last available copy result in exactly one success; the second returns NO_COPIES | VERIFIED (automated logic) | `actions.ts` lines 58-64: `SELECT id FROM "BookCopy" WHERE ... FOR UPDATE SKIP LOCKED` inside `prisma.$transaction`; unit test 2 confirms empty result returns NO_COPIES; concurrent safety requires human test |
| 7 | The Active tab lists ACTIVE/OVERDUE loans sorted by due date ascending with overdue rows highlighted | VERIFIED | `LoansTable.tsx` `ActiveLoansTab` filters `status === "ACTIVE" || "OVERDUE"`, sorts by `dueAt` ascending (line 103), applies `className={cn(isOverdue ? "bg-red-50" : undefined)}` to TableRow |
| 8 | Librarian can click Return on an ACTIVE/OVERDUE loan row in the Active tab | VERIFIED | `LoansTable.tsx` Active tab Actions column renders a live `<Button size="sm" variant="outline">Return</Button>` that calls `handleReturn` (line 215); `returnBook` is imported from `./actions` |
| 9 | Returning an on-time loan closes it and sets the copy back to AVAILABLE | VERIFIED | `actions.ts` returnBook: overdueDays = 0 path skips fine, closes loan with `status: "RETURNED"`, sets copy `status: "AVAILABLE"`; unit test 1 passes |
| 10 | Returning an overdue loan shows confirmation modal with fine amount, and on confirm creates an UNPAID Fine | VERIFIED | `ReturnModal.tsx` renders D-08 wording ("N days overdue", "fine of $Y will be recorded"); `actions.ts` creates `Fine` with `reason: "OVERDUE"`, `status: "UNPAID"`, `amount: fineDailyRate * overdueDays`; unit test 2 passes |
| 11 | If a PENDING reservation exists, copy is set to RESERVED and earliest PENDING advances to READY with hold notice | VERIFIED | `actions.ts` lines 211-227: `tx.reservation.findFirst` by `bookId + status PENDING` ordered `queuePosition ASC, requestedAt ASC`; sets copy `RESERVED`, reservation `READY`; returns `holdTriggered: true`; toast "Hold triggered for {name} — copy reserved." in both `ReturnModal.tsx` and `LoansTable.tsx`; unit test 3 passes |
| 12 | The All Loans tab shows the full loan history (read-only, no actions) | VERIFIED | `LoansTable.tsx` `AllLoansTab` renders all loans sorted by `issuedAt` DESC, all status badges via `LoanStatusBadge`, Actions cell shows `—` (line 324); no Return button |
| 13 | Member visiting /my-loans sees two distinct sections: Active Loans (top) and Loan History (below) with overdue rows highlighted and status badges | VERIFIED | `my-loans/page.tsx` calls `partitionLoans(loans)`, renders `<section>` "Active Loans" sorted by dueAt ASC with `bg-red-50` on overdue rows, and `<section>` "Loan History" in reverse-chronological order; no Tabs import; unit test (10/10) passes |

**Score:** 13/13 truths verified (automated logic)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/features/loans/loan-search.ts` | searchMembers and searchBooks server actions | VERIFIED | Exists, exports both functions, begins with `"use server"`, both call `requireRole("LIBRARIAN")` |
| `src/features/loans/actions.ts` | checkoutBook + returnBook with SELECT FOR UPDATE | VERIFIED | Exists, exports both, `FOR UPDATE SKIP LOCKED` present at line 63, `prisma.$transaction` used for both actions |
| `src/features/loans/CheckoutSheet.tsx` | Checkout slide-over with type-ahead and due-date preview | VERIFIED | Exists, calls `searchMembers`, `searchBooks`, `checkoutBook`; due-date preview from `policies` prop; greyed-out zero-availability books |
| `src/features/loans/LoansTable.tsx` | Loans table with Active tab, All Loans tab, Return button | VERIFIED | Exists, imports Tabs from `@/components/ui/tabs`, Active tab has live Return button, All Loans tab populated |
| `src/features/loans/ReturnModal.tsx` | Overdue return confirmation dialog | VERIFIED | Exists, calls `returnBook`, renders D-08 wording, holdTriggered toast present |
| `src/app/(app)/loans/page.tsx` | Librarian-only loans page server component | VERIFIED | Exists, session check + role guard (`role !== "LIBRARIAN"` redirect), fetches loans + policies, passes both to LoansTable |
| `src/features/loans/loan-display.ts` | isLoanOverdue and partitionLoans pure helpers | VERIFIED | Exists, exports both, no `"use server"` directive |
| `src/app/(app)/my-loans/page.tsx` | Two-section member loans view | VERIFIED | Exists, imports and uses both helpers, renders "Active Loans" and "Loan History" headings, `bg-red-50` on overdue rows, no Tabs import |
| `tests/unit/loan-actions.test.ts` | 5 checkoutBook tests | VERIFIED | Exists, 5 tests, all pass |
| `tests/unit/loan-return.test.ts` | 5 returnBook tests | VERIFIED | Exists, 5 tests, all pass |
| `tests/unit/my-loans-sections.test.ts` | Partition + overdue helper tests | VERIFIED | Exists, 10 tests, all pass |
| `src/components/ui/tabs.tsx` | Tabs primitive | VERIFIED | Exists, imported by LoansTable |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `CheckoutSheet.tsx` | `actions.ts` | `checkoutBook(` call | VERIFIED | Line 117: `await checkoutBook({ memberId, bookId })` |
| `CheckoutSheet.tsx` | `loan-search.ts` | `searchMembers` / `searchBooks` calls | VERIFIED | Lines 73, 89: both called on input change; imported at line 16-17 |
| `actions.ts` (checkoutBook) | BookCopy / Loan tables | `FOR UPDATE SKIP LOCKED` raw query + tx.loan.create | VERIFIED | Lines 58-89: raw query with lock, bookCopy.update, loan.create all inside `prisma.$transaction` |
| `actions.ts` (returnBook) | Fine / Reservation / BookCopy tables | `prisma.$transaction` wrapping all writes | VERIFIED | Lines 122-242: single transaction wraps loan.findUnique, fine.create, loan.update, reservation.findFirst, reservation.update, bookCopy.update |
| `LoansTable.tsx` | `ReturnModal.tsx` | `ReturnModal` import + state open | VERIFIED | Line 19: `import { ReturnModal } from "./ReturnModal"`; lines 258-265: `<ReturnModal>` rendered with open state |
| `ReturnModal.tsx` | `actions.ts` | `returnBook(` call | VERIFIED | Line 35: `await returnBook(loanId)` inside `useTransition` |
| `loans/page.tsx` | `prisma.loan` | `findMany` with include | VERIFIED | Lines 19-28: `prisma.loan.findMany({ include: { copy, member } })` |
| `my-loans/page.tsx` | `prisma.member` | `findUnique` with loans include | VERIFIED | Lines 20-28: `prisma.member.findUnique({ where: { userId: session.user.id }, include: { loans } })` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `LoansTable.tsx` | `loans` prop | `prisma.loan.findMany` in `loans/page.tsx` with full copy/book/author/member include | Yes — real DB query | FLOWING |
| `CheckoutSheet.tsx` | `memberResults`, `bookResults` | `searchMembers`/`searchBooks` server actions → `prisma.member.findMany` / `prisma.book.findMany` | Yes — real DB queries | FLOWING |
| `my-loans/page.tsx` | `member.loans` | `prisma.member.findUnique` scoped to `session.user.id` with loans include | Yes — session-scoped real DB query | FLOWING |
| `ReturnModal.tsx` | `loan` prop (daysOverdue, fineAmount) | Computed in `LoansTable.tsx` `handleReturn` from live loan data + policies prop | Yes — derived from real loan data | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 5 checkoutBook unit tests | `npx vitest run tests/unit/loan-actions.test.ts` | 5/5 passed, exit 0 | PASS |
| 5 returnBook unit tests | `npx vitest run tests/unit/loan-return.test.ts` | 5/5 passed, exit 0 | PASS |
| 10 my-loans helper tests | `npx vitest run tests/unit/my-loans-sections.test.ts` | 10/10 passed, exit 0 | PASS |
| FOR UPDATE SKIP LOCKED present | grep on `actions.ts` | Found at line 63 | PASS |
| `addedAt` (not `createdAt`) in raw query | grep on `actions.ts` | Found `ORDER BY "addedAt" ASC` at line 61 | PASS |
| UTC epoch math for due date | grep on `actions.ts` | `Date.now() + loanDays * 24 * 60 * 60 * 1000` at line 79 | PASS |
| UTC epoch math for overdue days | grep on `actions.ts` | `Math.max(0, Math.ceil(overdueMs / (24 * 60 * 60 * 1000)))` at line 180 | PASS |
| No `disabled` on Loans sidebar nav | grep on `AppSidebar.tsx` | LIBRARIAN_NAV Loans entry has no `disabled` property | PASS |

---

### Probe Execution

Step 7c: SKIPPED — no probe scripts found in `scripts/*/tests/probe-*.sh`; no probes declared in phase PLAN files.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CIRC-01 | 02-01-PLAN.md | Librarian can check out a specific book copy to a member with a calculated due date | SATISFIED | `checkoutBook` in `actions.ts`: SELECT FOR UPDATE SKIP LOCKED assigns first AVAILABLE copy; due date = `Date.now() + loanDays * 24*60*60*1000` from LoanPolicy; unit tests pass |
| CIRC-02 | 02-02-PLAN.md | Librarian can process a book return — closes loan, triggers fine if overdue, advances hold queue | SATISFIED | `returnBook` in `actions.ts`: single transaction closes loan, creates UNPAID Fine (fineDailyRate × overdueDays), sets copy RESERVED if PENDING reservation exists and advances it to READY; unit tests pass |
| CIRC-03 | 02-01-PLAN.md + 02-02-PLAN.md | Librarian can view all active loans with member and due date | SATISFIED | `/loans` page with Active tab (ACTIVE/OVERDUE, sorted dueAt ASC, overdue rows bg-red-50) and All Loans tab (full history, read-only) both implemented and wired to real DB query |
| CIRC-04 | 02-03-PLAN.md | Member can view their active loans and due dates | SATISFIED | `/my-loans` page: two `<section>` blocks (Active Loans + Loan History), session-scoped `prisma.member.findUnique`, overdue rows highlighted bg-red-50, status badges; unit tests for helpers pass |

All 4 requirements mapped to Phase 2 in REQUIREMENTS.md are covered. No orphaned requirements.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `CheckoutSheet.tsx` | 105, 107 | `return null` | Info | Guard clauses inside `useMemo` for due-date preview — not stubs; `null` means "no preview yet" (member not selected), which is correct behavior |
| `LoansTable.tsx` | (multiple) | `new Date()` in render | Info | `new Date()` called inside map callback for overdue calculation; flagged during plan 02-01 lint run and accepted — `const now = new Date()` stored before the map (line 177) mitigates the impure-function concern at the map level |

No `TBD`, `FIXME`, or `XXX` markers found in any phase-modified file. No unreferenced debt markers. No placeholder or stub implementations.

---

### UAT Bug — Decimal Serialization (Found 2026-06-15, Fixed)

**Bug:** `/loans` threw `Only plain objects can be passed to Client Components — Decimal objects are not supported` on every page load, blocking all UAT.

**Root cause:** `prisma.loanPolicy.findMany()` returns `fineDailyRate` and `maxUnpaidFineAmount` as Prisma `Decimal` instances. These were passed directly to `<LoansTable policies={policies} />` (a `"use client"` component) without serialization.

**Fix applied to `loans/page.tsx`:** Map over `rawPolicies` and call `.toNumber()` on both Decimal fields before passing to the Client Component.

**Fix applied to `LoansTable.tsx`:** Narrowed `LoanPolicy.fineDailyRate` type from `number | { toNumber: () => number }` to `number`; removed the now-unnecessary `getFineRate` wrapper and inlined `policy.fineDailyRate` directly.

**Static analysis gap:** The original verification used grep/read-based analysis. The Prisma `Decimal` type satisfies TypeScript's structural typing — it has `toString`, `valueOf`, and numeric coercions — so no type error fires at build time. The failure only surfaces at Next.js serialization across the Server→Client boundary at runtime. This class of bug (non-plain-object props) requires a running app to catch.

**Status:** FIXED — `/loans` now loads cleanly.

---

### Human Verification Required

Six items require a running application with a seeded database. All are end-to-end UI/UX or concurrency behaviors that cannot be verified with static analysis.

#### 1. Full Checkout Flow

**Test:** Log in as a librarian, navigate to /loans, click "Check Out", type a partial member name, select a member from the dropdown, type a partial book title, confirm the availability count appears correctly, select a book with available copies, observe the read-only due date preview matches today + loanDays, click "Confirm Checkout"
**Expected:** Success toast "Book checked out successfully."; the new loan row appears immediately in the Active tab with the correct member, book title, barcode, and due date; copy status in DB is CHECKED_OUT
**Why human:** Sheet open/close, type-ahead debounce timing, toast rendering, and Active tab refresh require a running app

#### 2. Concurrent Checkout Race Safety

**Test:** Open two browser tabs both targeting the same book with exactly one AVAILABLE copy; trigger checkout in both tabs within the same second
**Expected:** Exactly one tab shows "Book checked out successfully."; the other shows "No copies available for this title."; database has exactly one ACTIVE loan and zero AVAILABLE copies for that book
**Why human:** SELECT FOR UPDATE SKIP LOCKED behavior requires two simultaneous HTTP requests against a real PostgreSQL instance

#### 3. On-time Return (Direct, No Modal)

**Test:** In the Active tab, click Return on a loan whose due date is in the future
**Expected:** No modal opens; the loan row immediately disappears from the Active tab; success toast "Book returned successfully."; in the All Loans tab the loan now shows "Returned" badge; copy is AVAILABLE in DB
**Why human:** Direct `returnBook` call without modal, table revalidation via revalidatePath, and the absence of a modal all require a running browser

#### 4. Overdue Return (Modal + Fine Creation)

**Test:** In the Active tab, click Return on a loan whose due date is in the past
**Expected:** ReturnModal opens displaying "{N} days overdue" and "$Y will be recorded on {MemberName}'s account" with correct values; clicking "Confirm Return" closes the modal, loan disappears from Active tab, an UNPAID Fine record exists in DB with `amount = fineDailyRate × overdueDays`
**Why human:** Modal interaction, fine amount accuracy against real DB LoanPolicy, and database Fine record creation require a running app

#### 5. Return with PENDING Reservation (Hold Advance)

**Test:** Create a scenario where a book has one ACTIVE loan and one PENDING reservation; return the loan
**Expected:** Copy status becomes RESERVED (not AVAILABLE); reservation status becomes READY; toast shows "Returned. Hold triggered for [ReservationMemberName] — copy reserved."
**Why human:** Requires seeded reservation data, running app, and database state verification for the hold-advance path

#### 6. Member /my-loans Two-Section Layout

**Test:** Log in as a member who has at least one ACTIVE loan and at least one RETURNED loan; navigate to /my-loans
**Expected:** "Active Loans" section at top with overdue rows highlighted in red (bg-red-50), green Active or red Overdue badge; "Loan History" section below with all returned loans in reverse-chronological order, Returned badge; no tabs present; single scrollable page
**Why human:** Visual layout, section separation, overdue row highlight color, and reverse-chronological ordering require a running browser session with real loan data

---

### Gaps Summary

No automated gaps found. All 13 must-have truths verified against actual codebase files. All 4 requirement IDs (CIRC-01 through CIRC-04) are fully covered. All unit tests pass (20/20). No debt markers, no stubs, no missing artifacts, no broken key links.

Status is `human_needed` because 6 end-to-end behaviors require a running application with a real PostgreSQL database — these are inherently untestable by static analysis.

---

_Verified: 2026-06-15T12:31:00Z_
_Verifier: Claude (gsd-verifier)_
