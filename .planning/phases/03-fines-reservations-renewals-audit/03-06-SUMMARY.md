---
plan: "03-06"
phase: "03"
status: complete
wave: 4
completed_at: "2026-06-22"
commits:
  - hash: "8214335"
    message: "feat(03-06): add ActiveLoansClient with Renew button to /my-loans"
  - hash: "84df4ed"
    message: "feat(03-06): FINE_BLOCK inline error in CheckoutSheet + Fines/Audit nav"
---

## What was built

### Task 1: ActiveLoansClient + /my-loans page

**`src/features/loans/ActiveLoansClient.tsx`** (new) — `"use client"` component. Props: `loans: ActiveLoan[]`. Uses `useTransition` to call `renewLoan(loanId)` and shows per-error toast:
- Success: `Loan renewed. New due date: {dateStr}.`
- `FINE_BLOCK:X.XX` → `Renewal blocked: $X.XX in unpaid fines.`
- `MAX_RENEWALS:N` → `Renewal blocked: maximum renewals (N) reached.`
- `RESERVATION_BLOCK` → `Renewal blocked: another member has a hold on this title.`
- Fallback: `Couldn't renew loan. Please try again.`

Table has 6 columns: Book, Author, Issued, Due, Status, Actions. Renew button in Actions column; disabled while transition is pending. Overdue row styling (`bg-red-50`/`text-red-600`) preserved.

**`src/app/(app)/my-loans/page.tsx`** (updated) — Replaced inline active loans table with `<ActiveLoansClient loans={sortedActive} />`. Loan History section (server-rendered) unchanged.

### Task 2: CheckoutSheet inline error + AppSidebar nav

**`src/features/loans/CheckoutSheet.tsx`** (updated) — Added `fineBlockError` state. Reset on `handleOpenChange(false)` and `handleSelectMember`. On `FINE_BLOCK:X.XX` error from `checkoutBook`: sets inline error (no toast). Renders `<p className="text-sm text-destructive mt-2">` below member search dropdown. All other errors continue using `toast.error`.

**`src/components/layout/AppSidebar.tsx`** (updated) — Added `Receipt` and `ClipboardList` to lucide-react imports. Extended `LIBRARIAN_NAV` with:
- `{ href: "/fines", label: "Fines", icon: Receipt }`
- `{ href: "/audit", label: "Audit Log", icon: ClipboardList }`

Final LIBRARIAN_NAV order: Dashboard → Books → Members → Loans → Fines → Audit Log.

`MEMBER_NAV` My Reservations already had `disabled` removed in the Wave 2 UAT fix — no change needed.

## Build

`npm run build` exits 0. All 4 modified/created files pass TypeScript compilation.

## Requirements closed

- RNW-01: Renew button on /my-loans active loans table
- RNW-02: Renewal blocked by FINE_BLOCK — toast with amount
- RNW-03: Renewal blocked by MAX_RENEWALS — toast with limit
- RNW-04: Renewal blocked by RESERVATION_BLOCK — toast message
- FINE-03 (UI): CheckoutSheet shows inline FINE_BLOCK error instead of generic toast
