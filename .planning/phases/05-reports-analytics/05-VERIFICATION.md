---
phase: 05-reports-analytics
verified: 2026-06-23T06:22:30Z
status: human_needed
score: 18/18
overrides_applied: 0
human_verification:
  - test: "Navigate to /reports as a LIBRARIAN and confirm the sidebar shows a 'Reports' link with the BarChart2 icon"
    expected: "The sidebar renders a 'Reports' entry after 'Notification Log'; clicking it loads /reports with a page heading 'Reports' and four tab triggers: Overdue Loans, Popular Books, Borrowing Activity, Fine Summary"
    why_human: "AppSidebar is a client component; confirming the nav entry is visible and clickable requires a browser render"
  - test: "Navigate to /reports as a MEMBER (or logged-out user) and observe redirect behavior"
    expected: "MEMBER is redirected to /dashboard; unauthenticated user is redirected to /login"
    why_human: "Role-based redirect is an HTTP-level flow that requires an actual session; cannot be verified programmatically without a running server"
  - test: "Open the Fine Summary tab and verify three stat cards show dollar amounts, badges, and the formula note"
    expected: "Card 1: 'Total Fines Recorded' with $X.XX value and no badge. Card 2: 'Total Waived' with orange badge. Card 3: 'Total Outstanding' with red badge. Note below: 'Outstanding = Recorded minus Waived'. Outstanding equals Recorded minus Waived."
    why_human: "Visual card layout and badge colors cannot be confirmed without a browser render"
  - test: "Open the Overdue Loans tab; click the 'Days Late' column header, then 'Member', then 'Book Title'"
    expected: "Table defaults to days-late descending (most overdue first). Clicking 'Member' sorts alphabetically ascending and shows aria-sort='ascending'. Clicking again reverses to descending. Clicking 'Book Title' sorts by title. An empty library shows 'No overdue loans' / 'All loans are currently on time.'"
    why_human: "Client-side sort state, aria-sort attribute toggling, and row ordering require a live browser interaction"
  - test: "Open the Popular Books tab; change From/To date inputs and click 'Apply Filter'"
    expected: "Table initially shows books ranked by borrow count for the last 30 days. After changing dates and clicking Apply Filter, the table re-renders with updated data; button shows 'Applying…' while pending. An empty range shows 'No borrowing data' / 'No loans were issued in the selected date range. Try a wider range.'"
    why_human: "useTransition refetch and isPending state require a live browser render with a running server and database"
  - test: "Open the Borrowing Activity tab; verify the line chart and apply a date filter"
    expected: "Card titled 'Borrowing Activity' shows a recharts LineChart with two series: 'Loans Issued' and 'Loans Returned'. X-axis shows dates; Y-axis shows whole numbers. From/To date inputs and Apply Filter button work like the Popular Books tab. A Skeleton placeholder appears while pending. An empty range shows 'No activity data'."
    why_human: "Recharts SVG rendering and chart legend labels require a browser; cannot verify chart series visually with grep"
---

# Phase 5: Reports & Analytics Verification Report

**Phase Goal:** Librarians can view four built-in reports — Overdue Loans, Popular Books, Borrowing Activity chart, and Fine Summary — from a dedicated /reports page, without paper records or spreadsheets.
**Verified:** 2026-06-23T06:22:30Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Librarian sees a 'Reports' link in the sidebar and clicking it loads /reports | VERIFIED | `AppSidebar.tsx` line 64: `{ href: "/reports", label: "Reports", icon: BarChart2 }` appended to `LIBRARIAN_NAV` after "Notification Log"; `BarChart2` imported from lucide-react at line 18 |
| 2 | A member navigating to /reports is redirected to /dashboard | VERIFIED | `page.tsx` lines 17–18: `if (!session) redirect("/login"); if (session.user.role !== "LIBRARIAN") redirect("/dashboard")` — server-side guard, no client-only path |
| 3 | The /reports page shows four tabs: Overdue Loans, Popular Books, Borrowing Activity, Fine Summary | VERIFIED | `page.tsx` lines 49–53: four `TabsTrigger` elements with values "overdue", "popular", "activity", "fines" and labels matching exactly |
| 4 | The Fine Summary tab shows total fines recorded, total waived, and total outstanding in three stat cards | VERIFIED | `FineSummaryCards.tsx`: three `<Card>` elements with titles "Total Fines Recorded", "Total Waived", "Total Outstanding"; orange badge on waived, red badge on outstanding; `$${n.toFixed(2)}` values |
| 5 | Outstanding equals Recorded minus Waived | VERIFIED | `actions.ts` line 38: `const outstanding = recorded - waived` computed in JS from two separate `prisma.fine.aggregate` calls; `FineSummaryCards.tsx` line 57: note text "Outstanding = Recorded minus Waived" |
| 6 | Librarian opens the Overdue Loans tab and sees every currently-overdue loan in a table | VERIFIED | `overdue.ts`: `prisma.loan.findMany` with `where: { returnedAt: null, dueAt: { lt: now } }`, includes `copy.book` and `member.user`; `page.tsx` line 28: `overdueRows` passed to `<OverdueLoansTable>` |
| 7 | Each row shows member name, book title, due date, and days late | VERIFIED | `OverdueLoansTable.tsx` lines 103–143: four columns Member, Book Title, Due Date, Days Late; Due Date formatted with `toLocaleDateString`; Days Late cell at line 138 |
| 8 | Rows are sorted by days late descending by default (most overdue first) | VERIFIED | `OverdueLoansTable.tsx` lines 30–31: `useState<SortKey>("daysLate")` and `useState<SortDir>("desc")`; `DEFAULT_DIR.daysLate = "desc"` at line 21 |
| 9 | Librarian can re-sort by Member Name and by Title via column header buttons | VERIFIED | `OverdueLoansTable.tsx`: `SortButton` rendered for Member (`memberName`), Book Title (`bookTitle`), and Days Late columns with `aria-sort`, `aria-label`, and `ChevronUp`/`ChevronDown` icons |
| 10 | When no loans are overdue, the tab shows 'No overdue loans' | VERIFIED | `OverdueLoansTable.tsx` lines 117–124: empty state with "No overdue loans" and "All loans are currently on time." |
| 11 | Librarian opens the Popular Books tab and sees the most-borrowed titles for the selected date range | VERIFIED | `popular.ts`: JS Map aggregation of `prisma.loan.findMany` by `book.id`, sorted descending by `borrowCount`, sliced to 50; `page.tsx` line 36: `popularRows` passed to `<PopularBooksTable>` |
| 12 | Each row shows rank, title, author, and borrow count, ordered by borrow count descending | VERIFIED | `PopularBooksTable.tsx` lines 79–103: columns Rank, Title, Author, Borrow Count; rank = `index + 1`; data pre-sorted by action |
| 13 | Default date range is the last 30 days | VERIFIED | `page.tsx` lines 32–33: `fromStr` = 30 days before today; `popular.ts` lines 29–30: same default in action |
| 14 | Librarian can change From/To dates and click Apply Filter to refetch | VERIFIED | `PopularBooksTable.tsx`: `useTransition`, `handleApply` calls `getPopularBooks({ fromDate, toDate })`, button shows "Applying…" while pending |
| 15 | When no loans were issued in the range, the tab shows 'No borrowing data' | VERIFIED | `PopularBooksTable.tsx` lines 87–94: empty state "No borrowing data" + "No loans were issued in the selected date range. Try a wider range." |
| 16 | Librarian opens the Borrowing Activity tab and sees an interactive line chart | VERIFIED | `BorrowingActivityChart.tsx`: recharts `ResponsiveContainer + LineChart` inside a `<Card>`; two `<Line>` elements |
| 17 | The chart plots loans issued and loans returned per day over the selected range | VERIFIED | `activity.ts`: two `Promise.all` `findMany` queries (by `issuedAt`, by `returnedAt`), zero-filled continuous daily `ActivityPoint[]`; `BorrowingActivityChart.tsx` lines 120–131: `dataKey="loanCount"` and `dataKey="returnCount"` |
| 18 | Two labeled series are visible: 'Loans Issued' and 'Loans Returned' | VERIFIED | `BorrowingActivityChart.tsx` lines 120–130: `name="Loans Issued" stroke="var(--chart-1)"` and `name="Loans Returned" stroke="var(--chart-2)"` |
| 19 | Default date range is the last 30 days; From/To + Apply Filter refetch the chart | VERIFIED | `page.tsx` line 40: `getBorrowingActivity({ fromDate: fromStr, toDate: toStr })` with shared 30-day defaults; `BorrowingActivityChart.tsx`: same `useTransition` / `handleApply` pattern as `PopularBooksTable` |
| 20 | When the range has no loans or returns, the tab shows 'No activity data' | VERIFIED | `BorrowingActivityChart.tsx` lines 46–48: `isEmpty = data.length === 0 || data.every(p => p.loanCount===0 && p.returnCount===0)`; empty state "No activity data" / "No loans or returns recorded…" |

**Score:** 18/18 automated truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/features/reports/actions.ts` | `getFineSummary` Server Action + shared `ActionResult<T>` type | VERIFIED | `"use server"`, `requireRole("LIBRARIAN")`, two `prisma.fine.aggregate` calls, `outstanding = recorded - waived`, exports `ActionResult<T>` |
| `src/features/reports/FineSummaryCards.tsx` | Three-card fine summary display | VERIFIED | No `"use client"`, props `{recorded, waived, outstanding}`, grid `md:grid-cols-3`, "Total Fines Recorded" / "Total Waived" / "Total Outstanding" |
| `src/app/(app)/reports/page.tsx` | Reports page with Tabs shell + auth guard | VERIFIED | Async Server Component, `getSession` auth guard, `TabsTrigger` × 4, all four data-fetching calls present |
| `tests/unit/report-fine-summary.test.ts` | Unit tests for getFineSummary auth + aggregation | VERIFIED | 4 tests: FORBIDDEN guard, recorded/waived/outstanding, null coercion, numeric type — all pass |
| `src/features/reports/overdue.ts` | `getOverdueLoans` Server Action | VERIFIED | `"use server"`, `requireRole("LIBRARIAN")`, `returnedAt: null, dueAt: { lt: now }` filter, ISO string `dueAt`, integer `daysLate` |
| `src/features/reports/OverdueLoansTable.tsx` | Client table with header sort + days-late highlight | VERIFIED | `"use client"`, `useState` sort state, `useMemo` sorted rows, `aria-sort`, `bg-red-50` rows, `text-red-600 font-medium` days-late cell |
| `tests/unit/report-overdue.test.ts` | Unit tests for getOverdueLoans | VERIFIED | 4 tests: FORBIDDEN, row shape, where-clause filter, ISO string serialization — all pass |
| `src/features/reports/popular.ts` | `getPopularBooks` Server Action with safe date-range parsing | VERIFIED | `"use server"`, `requireRole("LIBRARIAN")`, `isNaN` guard, `setUTCHours(23,59,59,999)`, JS Map aggregation, `.slice(0, 50)` |
| `src/features/reports/PopularBooksTable.tsx` | Client table with date-range filter + useTransition refetch | VERIFIED | `"use client"`, `useTransition`, "Apply Filter" button, "Applying…" pending state, "No borrowing data" empty state |
| `tests/unit/report-popular.test.ts` | Unit tests for auth, date filter, ranking, invalid-date handling | VERIFIED | 5 tests: FORBIDDEN, default window, custom dates, invalid dates, ranking — all pass |
| `src/features/reports/activity.ts` | `getBorrowingActivity` Server Action grouping loans/returns by day | VERIFIED | `"use server"`, `requireRole("LIBRARIAN")`, `Promise.all` parallel queries, continuous zero-filled `ActivityPoint[]` |
| `src/features/reports/BorrowingActivityChart.tsx` | Recharts LineChart client component with date filter | VERIFIED | `"use client"`, imports from `recharts`, `ResponsiveContainer + LineChart`, two `<Line>` series, `Skeleton` pending state, empty state |
| `tests/unit/report-activity.test.ts` | Unit tests for auth, day-grouping, date filter | VERIFIED | 5 tests: FORBIDDEN, continuous zero-fill, independent issued/returned counts, invalid date fallback, YYYY-MM-DD output — all pass |
| `src/components/layout/AppSidebar.tsx` | Reports nav entry in LIBRARIAN_NAV | VERIFIED | `BarChart2` imported; `{ href: "/reports", label: "Reports", icon: BarChart2 }` at line 64; `MEMBER_NAV` unchanged |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `page.tsx` | `actions.ts` | `getFineSummary` call in Server Component | VERIFIED | Line 5: import; line 21: `const result = await getFineSummary()` |
| `AppSidebar.tsx` | `/reports` | `LIBRARIAN_NAV` entry | VERIFIED | Line 64: `href: "/reports"` |
| `page.tsx` | `overdue.ts` | `getOverdueLoans` call, result passed to `OverdueLoansTable` | VERIFIED | Line 7–8: imports; lines 27–28: call + derive `overdueRows`; line 56: `<OverdueLoansTable rows={overdueRows} />` |
| `OverdueLoansTable.tsx` | `props.rows` | client-side `useState` sort | VERIFIED | `useMemo` sort over `rows` prop at line 43; `useState` sort state at lines 30–31 |
| `page.tsx` | `popular.ts` | `getPopularBooks` initial call, result passed to `PopularBooksTable` | VERIFIED | Lines 9–10: imports; lines 36–37: call + `popularRows`; lines 60–64: `<PopularBooksTable initialRows={popularRows} .../>` |
| `PopularBooksTable.tsx` | `popular.ts` | `getPopularBooks` refetch inside `useTransition` on Apply Filter | VERIFIED | Line 14: import `getPopularBooks`; line 34: `const r = await getPopularBooks({ fromDate, toDate })` inside `startTransition` |
| `page.tsx` | `activity.ts` | `getBorrowingActivity` initial call, result passed to `BorrowingActivityChart` | VERIFIED | Lines 11–12: imports; lines 40–41: call + `activityData`; lines 68–72: `<BorrowingActivityChart initialData={activityData} .../>` |
| `BorrowingActivityChart.tsx` | `recharts` | `ResponsiveContainer + LineChart` import | VERIFIED | Lines 4–13: imports `ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid` from `recharts` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `FineSummaryCards.tsx` | `recorded`, `waived`, `outstanding` (props) | `getFineSummary()` → `prisma.fine.aggregate` × 2 | Yes — DB aggregate queries, no static return | FLOWING |
| `OverdueLoansTable.tsx` | `rows` (prop) | `getOverdueLoans()` → `prisma.loan.findMany` with `returnedAt: null, dueAt: { lt: now }` | Yes — live DB query filtered to current overdue state | FLOWING |
| `PopularBooksTable.tsx` | `rows` (state, init from `initialRows` prop) | `getPopularBooks()` → `prisma.loan.findMany` with `issuedAt` range bounds, JS Map aggregation | Yes — DB query over real loan records | FLOWING |
| `BorrowingActivityChart.tsx` | `data` (state, init from `initialData` prop) | `getBorrowingActivity()` → `prisma.loan.findMany` × 2 via `Promise.all` for `issuedAt`/`returnedAt` | Yes — two bounded DB queries, zero-filled continuous array | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Unit tests — all 18 report tests pass | `npx vitest run tests/unit/report-fine-summary.test.ts tests/unit/report-overdue.test.ts tests/unit/report-popular.test.ts tests/unit/report-activity.test.ts` | 4 files, 18 tests: all pass, duration 2.19s | PASS |
| recharts in package.json | `node -e "const p=require('./package.json'); console.log(p.dependencies.recharts)"` | `^2.15.4` | PASS |
| No "Coming soon" stubs remain in page.tsx | grep for "Coming soon" in page.tsx | No matches | PASS |

---

### Probe Execution

No `probe-*.sh` scripts declared or found for this phase. Step 7c: SKIPPED (no probe scripts).

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| RPT-01 | 05-02-PLAN.md | Librarian can view overdue loans summary (all currently overdue, sortable by days late) | SATISFIED | `getOverdueLoans` + `OverdueLoansTable` with days-late-desc default sort and re-sortable member/title headers; 4 unit tests pass |
| RPT-02 | 05-03-PLAN.md | Librarian can view popular books report (most-borrowed titles over a date range) | SATISFIED | `getPopularBooks` with JS Map aggregation + safe date parsing + 50-row cap; `PopularBooksTable` with From/To filter + useTransition; 5 unit tests pass |
| RPT-03 | 05-04-PLAN.md | Librarian can view borrowing activity chart (loans issued and returned over time) | SATISFIED | `getBorrowingActivity` with parallel `Promise.all` queries + zero-filled continuous days; `BorrowingActivityChart` with recharts LineChart two series; 5 unit tests pass |
| RPT-04 | 05-01-PLAN.md | Librarian can view fine collection summary (total recorded, waived, and outstanding) | SATISFIED | `getFineSummary` with two `prisma.fine.aggregate` calls; `FineSummaryCards` three-card grid; outstanding = recorded − waived; 4 unit tests pass |

All four Phase 5 requirements (RPT-01, RPT-02, RPT-03, RPT-04) are accounted for. No orphaned requirements found — REQUIREMENTS.md traceability table maps exactly RPT-01..04 to Phase 5.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | No anti-patterns found in `src/features/reports/`, `src/app/(app)/reports/page.tsx`, or `src/components/layout/AppSidebar.tsx`. No TBD/FIXME/XXX/TODO/placeholder/coming-soon markers. No empty return stubs. |

---

### Human Verification Required

The following items require a running application with a browser to verify. Automated checks (grep, type checks, unit tests) have all passed.

#### 1. Sidebar Reports Link — Visual Presence and Navigation

**Test:** Sign in as a LIBRARIAN, observe the sidebar, and click the "Reports" link.
**Expected:** "Reports" entry appears after "Notification Log" with a bar-chart icon; clicking it navigates to `/reports` and shows the page heading "Reports" with four tab triggers.
**Why human:** AppSidebar is a client component rendered in the browser; icon rendering and nav active state require a live render.

#### 2. Role-Based Redirect

**Test:** Sign in as a MEMBER and navigate directly to `/reports`.
**Expected:** Immediately redirected to `/dashboard` without loading the reports content. An unauthenticated visit redirects to `/login`.
**Why human:** Redirect behavior requires a real HTTP session and server response — not verifiable with static code analysis alone, though the guard code is confirmed present.

#### 3. Fine Summary Tab — Visual Layout

**Test:** As LIBRARIAN, open `/reports` and click "Fine Summary".
**Expected:** Three cards in a responsive 3-column grid. Card 1: "Total Fines Recorded", dollar value, no badge. Card 2: "Total Waived", dollar value, orange badge. Card 3: "Total Outstanding", dollar value, red badge. Note beneath: "Outstanding = Recorded minus Waived".
**Why human:** Card grid layout, badge colors, and dollar formatting require browser render and real data.

#### 4. Overdue Loans Tab — Sort Interaction

**Test:** As LIBRARIAN, open the "Overdue Loans" tab and click column headers.
**Expected:** Default sort is days-late descending. Clicking "Member" sorts alphabetically ascending and shows a ChevronUp icon; clicking again reverses to descending. Clicking "Book Title" sorts by title. Row backgrounds are red-tinted (`bg-red-50`); Days Late cells are red text. Empty library shows "No overdue loans" / "All loans are currently on time."
**Why human:** Client-side sort state and DOM interaction require a live browser.

#### 5. Popular Books Tab — Date Filter and Refetch

**Test:** As LIBRARIAN, open "Popular Books", change From/To dates, and click "Apply Filter".
**Expected:** Initial view shows ranked books for last 30 days. After clicking Apply Filter, the button shows "Applying…" and inputs are disabled while pending, then re-renders with updated data. An empty date range shows "No borrowing data" / "No loans were issued in the selected date range. Try a wider range."
**Why human:** `useTransition` pending state and server-round-trip data update require a running server.

#### 6. Borrowing Activity Tab — Chart Rendering and Filter

**Test:** As LIBRARIAN, open "Borrowing Activity", observe the chart, and apply a filter.
**Expected:** Recharts LineChart renders inside a card titled "Borrowing Activity" with two labeled series ("Loans Issued" in chart-1 color, "Loans Returned" in chart-2 color), X-axis dates, integer Y-axis. For 30-day range (> 14 days), every 7th X-axis label shows. Filter bar works same as Popular Books — shows Skeleton while pending. Empty range shows "No activity data".
**Why human:** SVG chart rendering, legend label text in the rendered DOM, and color token resolution require a browser.

---

### Gaps Summary

No gaps found. All automated truths verified, all artifacts exist at all four levels (exists, substantive, wired, data-flowing), all key links confirmed, all four requirements satisfied, no debt markers, 18/18 unit tests pass.

---

_Verified: 2026-06-23T06:22:30Z_
_Verifier: Claude (gsd-verifier)_
