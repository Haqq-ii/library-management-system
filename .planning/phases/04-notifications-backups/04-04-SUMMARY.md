---
phase: 04-notifications-backups
plan: "04"
subsystem: notifications-ui
tags: [notifications, librarian, ui, server-action, pagination]
dependency_graph:
  requires: [04-01]
  provides: [notification-log-ui]
  affects: [AppSidebar]
tech_stack:
  added: []
  patterns: [server-component-page-guard, client-table-with-pagination, requireRole-guard, separate-member-lookup]
key_files:
  created:
    - src/features/notifications/actions.ts
    - src/features/notifications/NotificationLogTable.tsx
    - src/app/(app)/notifications/page.tsx
  modified:
    - src/components/layout/AppSidebar.tsx
decisions:
  - "NotificationLog has no Prisma relation to Member — resolve names via separate prisma.member.findMany query, fallback to memberId string if member not found"
  - "Type filter uses single-select <select> (not multi-select) — NotificationLog has 4 distinct types vs 9 AuditActions; simpler UX"
  - "No date-range filters in v1 — plan spec explicitly excludes them; type filter is sufficient for log inspection"
  - "Bell icon from lucide-react used for sidebar nav entry (already available, no new import package needed)"
metrics:
  duration: "~15 minutes"
  completed: "2026-06-22"
  tasks_completed: 2
  files_created: 3
  files_modified: 1
---

# Phase 04 Plan 04: Notification Delivery Log UI Summary

Librarian-only `/notifications` page with paginated, type-filterable delivery log showing every notification attempt (sent/failed) with member name, type, channel, and status badge. Mirrors the existing `/audit` vertical slice exactly, adapted for the `NotificationLog` schema (no Prisma relation, ordered by `sentAt` not `createdAt`).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | getNotificationLog server action | c89d694 | src/features/notifications/actions.ts |
| 2 | NotificationLogTable + /notifications page + sidebar nav | 5433a94 | src/features/notifications/NotificationLogTable.tsx, src/app/(app)/notifications/page.tsx, src/components/layout/AppSidebar.tsx |

## What Was Built

### Task 1: getNotificationLog Server Action

`src/features/notifications/actions.ts` — LIBRARIAN-only paginated query with:
- `requireRole("LIBRARIAN")` guard returning FORBIDDEN on unauthorized access (T-04-11)
- `VALID_NOTIFICATION_TYPES` allow-list filter that silently drops invalid type values (T-04-12)
- `Promise.all` for concurrent `findMany` + `count` queries ordered by `sentAt desc`
- Separate `prisma.member.findMany` to resolve member names (NotificationLog has no Prisma relation to Member)
- Member name/email fallback: memberName = memberId string, memberEmail = "" when member lookup misses
- `console.error("[getNotificationLog]", err)` error logging with `DB_ERROR` return

### Task 2: NotificationLogTable, /notifications page, sidebar nav

**NotificationLogTable** (`src/features/notifications/NotificationLogTable.tsx`):
- `"use client"` component mirroring AuditTable structure
- Single `<select>` type filter over 4 notification types + "All types" option
- `useTransition` + `startTransition` for non-blocking server action calls on filter/page change
- Success badge: green/"Sent" (success=true), red/"Failed" (success=false)
- `sentAt` formatted with exact UTC locale string pattern from AuditTable
- Prev/Next pagination with disabled states; empty-state messages for filtered vs unfiltered

**Notifications Page** (`src/app/(app)/notifications/page.tsx`):
- Server component with session guard (`auth.api.getSession`) and LIBRARIAN role redirect (T-04-11)
- Accepts `searchParams: Promise<{ type?: string; page?: string }>`
- Initial server-side fetch via `getNotificationLog`

**AppSidebar** (`src/components/layout/AppSidebar.tsx`):
- Added `Bell` to lucide-react imports
- Added `{ href: "/notifications", label: "Notification Log", icon: Bell }` to `LIBRARIAN_NAV` after Audit Log entry

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript implicit `any` errors in member mapping lambdas**
- **Found during:** Task 1 TypeScript check
- **Issue:** Prisma `findMany` results inferred as `any` in the member ID set construction and map operations, causing 5 TS errors
- **Fix:** Added explicit type annotations on the lambda parameters (`r: { memberId: string }`, `m: { id: string; user: { name: string; email: string } }`, and the `row` object destructure)
- **Files modified:** src/features/notifications/actions.ts
- **Commit:** c89d694 (fixed inline before commit)

## Verification

All acceptance criteria passed:

| Check | Result |
|-------|--------|
| `requireRole("LIBRARIAN")` present in actions.ts | 1 match |
| `createdAt` absent from actions.ts | 0 matches |
| `sentAt` present in actions.ts | 4 matches |
| `member.findMany` present in actions.ts | 1 match |
| `"use client"` in NotificationLogTable | 1 match |
| `role !== "LIBRARIAN"` in page.tsx | 1 match |
| `/notifications` in AppSidebar | 1 match |
| `sentAt` in NotificationLogTable | 1 match |
| TypeScript check for new/modified files | Clean |

## Known Stubs

None — all data is wired from real `prisma.notificationLog` queries. Member name fallback to memberId is intentional behavior, not a stub.

## Threat Flags

No new security-relevant surface introduced beyond the plan's threat model. The `/notifications` page and `getNotificationLog` action are covered by T-04-11 (EoP: requireRole + page redirect, defense in depth) and T-04-12 (Input Validation: type allow-list). Metadata field (`Json?`) is not rendered in the table (T-04-13: accepted).

## Self-Check: PASSED

- src/features/notifications/actions.ts — EXISTS (committed c89d694)
- src/features/notifications/NotificationLogTable.tsx — EXISTS (committed 5433a94)
- src/app/(app)/notifications/page.tsx — EXISTS (committed 5433a94)
- src/components/layout/AppSidebar.tsx — MODIFIED (committed 5433a94)
- Commit c89d694 — Task 1
- Commit 5433a94 — Task 2
