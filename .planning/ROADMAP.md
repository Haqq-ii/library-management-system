# Roadmap: Library Management System

## Overview

Five phases build the system from the ground up, each delivering an end-to-end user capability. Phase 1 locks in the Docker environment, full database schema, authentication, catalog, and member management — everything downstream has a foreign-key dependency here. Phase 2 adds the core circulation loop (checkout and return). Phase 3 completes the borrowing ruleset: fines, reservations, renewals, and the audit trail. Phase 4 automates communication via email and scheduled jobs. Phase 5 closes the loop with librarian-facing dashboards and reports.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Docker environment, auth, full schema, catalog CRUD, member management
- [ ] **Phase 2: Circulation Core** - Checkout, return flow, loan history for librarian and member
- [ ] **Phase 3: Fines, Reservations, Renewals & Audit** - Fine lifecycle, hold queue, self-service renewal, audit log
- [ ] **Phase 4: Notifications & Backups** - Transactional email, scheduled overdue detection, delivery log, DB backup
- [ ] **Phase 5: Reports & Analytics** - Librarian dashboards, borrowing charts, all four report types

## Phase Details

### Phase 1: Foundation

**Goal**: Librarians and members can log in with enforced roles, librarians can manage the full book catalog and member accounts, and the entire development environment runs in Docker from the first commit.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, CAT-01, CAT-02, CAT-03, CAT-04, MBR-01, MBR-02, MBR-03, INFRA-01, INFRA-02, INFRA-03, INFRA-04
**Success Criteria** (what must be TRUE):

  1. A new developer can run `docker compose up` and reach a working login page with seeded data — no manual DB setup required
  2. Librarian can log in, add a book title with multiple physical copies, edit it, and soft-delete it — the record stays in the database with a `deletedAt` timestamp
  3. Librarian can register a member (student or faculty), edit their profile, and deactivate the account without losing their loan history
  4. Member can log in and search the catalog, seeing real-time copy availability per title
  5. Attempting to access a librarian-only page as a member returns an access-denied response verified at the Server Action level, not only middleware

**Plans**: 8 plansPlans:
**Wave 1**

- [x] 01-01-PLAN.md — Scaffold Next.js 16 + shadcn, full Prisma schema, test harness, initial migration (Walking Skeleton)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Core lib (db/auth/require-role), Better Auth handler, seed data (Walking Skeleton)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 01-03-PLAN.md — Docker stack + env configs + entrypoint; BLOCKING docker compose up smoke test (Walking Skeleton)
- [ ] 01-04-PLAN.md — Auth UI: login card, session-gated shell, role-aware sidebar, dashboard (Walking Skeleton)

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 01-05-PLAN.md — Catalog CRUD: Server Actions + ISBN auto-fill, sortable table, slide-over form
- [ ] 01-07-PLAN.md — Member management CRUD: actions, table, slide-over register/edit form
- [ ] 01-08-PLAN.md — Member-facing: catalog search with availability, profile, my-loans empty state

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] 01-06-PLAN.md — Book detail page + copies sub-table (copy management)

**UI hint**: yes

### Phase 2: Circulation Core

**Goal**: Librarians can perform the complete checkout-and-return cycle with concurrency-safe availability checks, and both librarians and members can see current and past loans.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: CIRC-01, CIRC-02, CIRC-03, CIRC-04
**Success Criteria** (what must be TRUE):

  1. Librarian can check out a specific physical copy to a member — the copy status changes to CHECKED_OUT and a due date is recorded based on member type
  2. Two simultaneous checkout attempts on the last available copy result in exactly one success and one "no copy available" error (SELECT FOR UPDATE enforced)
  3. Librarian can process a return — the loan closes, copy status returns to AVAILABLE (or triggers hold queue), and an overdue fine record is created if the return is late
  4. Librarian can view all active loans sorted by due date; member can view their own active loans and full loan history

**Plans**: 3 plans
Plans:

**Wave 1**

- [x] 02-01-PLAN.md — Checkout slice: shadcn tabs/popover/command, loan-search, checkoutBook (SELECT FOR UPDATE + due-date), CheckoutSheet, LoansTable Active tab, /loans page, sidebar activation
- [x] 02-03-PLAN.md — Member my-loans slice: two-section Active + History layout with overdue highlighting

**Wave 2** *(blocked on 02-01)*

- [ ] 02-02-PLAN.md — Return slice: returnBook (close loan, overdue fine, hold advance), ReturnModal, Return action + All Loans tab in LoansTable

**UI hint**: yes

### Phase 3: Fines, Reservations, Renewals & Audit

**Goal**: Members can manage their own reservations and renewals within policy rules, librarians can handle the full fine lifecycle, and every librarian action is recorded in a searchable audit log.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: FINE-01, FINE-02, FINE-03, RES-01, RES-02, RES-03, RES-04, RNW-01, RNW-02, RNW-03, RNW-04, AUD-01, AUD-02
**Success Criteria** (what must be TRUE):

  1. On return of an overdue book, a fine is automatically calculated (daily rate × overdue days) and attached to the loan — the rate is configurable via environment config
  2. A member with unpaid fines above the threshold cannot check out a new book or renew an existing loan — the system enforces this at the Server Action level
  3. Member can place a reservation on a fully checked-out title; when any copy is returned, the system atomically assigns that copy to the earliest pending reservation and notifies the member
  4. Member can renew a loan only if no active reservation exists on the title, the renewal count is within the configured maximum, and fines are below the threshold
  5. Librarian can view and filter the audit log by date range and action type, seeing every catalog change, checkout, return, and fine waiver with actor and timestamp

**Plans**: TBD
**UI hint**: yes

### Phase 4: Notifications & Backups

**Goal**: Members receive timely email reminders and alerts without manual librarian action, the system detects overdue loans automatically via a scheduled job, and database backups are configured.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: NOTF-01, NOTF-02, NOTF-03, NOTF-04, INFRA-05
**Success Criteria** (what must be TRUE):

  1. A member with a loan due in 3 days receives a reminder email; a member with a loan due today receives a same-day reminder — both sent automatically without librarian action
  2. A member with an overdue loan receives a daily alert email each day it remains unreturned
  3. When a reservation is fulfilled on return, the member receives a hold-ready email with pickup instructions
  4. Every notification attempt (due-date reminder, overdue alert, hold-ready) is recorded with sent/failed status, member, and event type — librarian can inspect the delivery log
  5. Database backups run on a configured schedule (pg_dump or managed provider backup) — a backup can be verified to exist after the scheduled window

**Plans**: TBD

### Phase 5: Reports & Analytics

**Goal**: Librarians have a dashboard with key operational metrics and can run four report types to understand circulation patterns, overdue exposure, and fine collection.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: RPT-01, RPT-02, RPT-03, RPT-04
**Success Criteria** (what must be TRUE):

  1. Librarian can view a list of all currently overdue loans sortable by days late, with member name and book title visible at a glance
  2. Librarian can view the most-borrowed book titles over a selected date range
  3. Librarian can view a borrowing activity chart showing loans issued and returned over time, rendered as an interactive chart
  4. Librarian can view a fine summary showing total fines recorded, total waived, and total outstanding

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 2/8 | In Progress|  |
| 2. Circulation Core | 2/3 | In Progress|  |
| 3. Fines, Reservations, Renewals & Audit | 0/TBD | Not started | - |
| 4. Notifications & Backups | 0/TBD | Not started | - |
| 5. Reports & Analytics | 0/TBD | Not started | - |
