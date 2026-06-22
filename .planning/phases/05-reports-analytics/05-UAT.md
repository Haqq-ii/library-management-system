---
status: testing
phase: 05-reports-analytics
source: [05-VERIFICATION.md]
started: 2026-06-23T06:22:30Z
updated: 2026-06-23T06:22:30Z
---

## Current Test

number: 1
name: Sidebar Reports Link
expected: |
  BarChart2 icon and "Reports" label appear in the sidebar nav under the LIBRARIAN section.
  Clicking the link navigates to /reports without error.
awaiting: user response

---

## Pending Tests

number: 2
name: Role-Based Redirect
expected: |
  A logged-in MEMBER visiting /reports is redirected to /dashboard.
  An unauthenticated user visiting /reports is redirected to /login.

number: 3
name: Fine Summary Tab
expected: |
  The "Fine Summary" tab shows three cards: Recorded Fines, Waived Fines, Outstanding Fines.
  Dollar values are formatted correctly (e.g., $12.50, not 12.5 or null).
  Badge colors match the card type.

number: 4
name: Overdue Loans Tab — Sort Interaction
expected: |
  Clicking a column header (Member, Title, Days Late) sorts the table.
  Clicking again toggles sort direction.
  The aria-sort attribute updates on the header.
  Overdue rows have bg-red-50 background; Days Late cell is text-red-600 font-medium.
  Empty state shows "No overdue loans — All loans are currently on time." when none exist.

number: 5
name: Popular Books Tab — Date Filter
expected: |
  The From/To date inputs are present and accept date values.
  Clicking "Apply Filter" triggers a refetch (useTransition pending state visible briefly).
  The table updates to reflect the filtered date range.
  Empty state is shown when no loans match the filter.

number: 6
name: Borrowing Activity Tab — Chart Render
expected: |
  A recharts LineChart renders with two labeled series: "Checked Out" and "Returned".
  The chart shows data points for the default 30-day range.
  From/To filter inputs are present and Apply Filter refetches the chart data.
  A Skeleton loader is visible while data is pending.
  Empty state is shown when no activity exists in the range.
