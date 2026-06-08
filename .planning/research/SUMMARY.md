# Research Summary: Library Management System

**Project:** School/University Library Management System
**Domain:** Institutional library circulation and catalog management
**Researched:** 2026-06-09
**Confidence:** HIGH

---

## Executive Summary

A school/university Library Management System is a well-understood domain with clear data modeling conventions (Book/BookCopy separation, FIFO hold queues, loan-linked fines) documented by mature open-source reference implementations like Koha and Polaris. The recommended approach is a Next.js 16 (App Router) monorepo with PostgreSQL via Prisma ORM, Better Auth for RBAC, Resend + React Email for transactional notifications, and node-cron on Railway for scheduled overdue detection.

The most important architectural decision is the `Book`/`BookCopy` split — every loan, reservation, and availability check targets a physical copy, not a title. This must be locked in before writing any migration. The return transaction must atomically close the loan, calculate fines, advance the hold queue, and trigger the notification email. All date arithmetic must operate in UTC from day one.

The two highest-risk areas are: (1) concurrency in checkout — without Prisma interactive transactions and `SELECT FOR UPDATE`, simultaneous checkouts will race; (2) authorization — Next.js middleware alone is not a security boundary (CVE-2025-29927, CVSS 9.1) — every Server Action must independently verify role. Both are completely preventable if addressed from Phase 1.

---

## Recommended Stack

- **Next.js 16 + React 19** — App Router, Server Actions for mutations, Route Handlers for cron triggers
- **PostgreSQL 16 + Prisma 7.7** — relational model fits FK-heavy domain; tracked migrations, type-safe queries
- **Better Auth 1.x** — credentials auth + RBAC + Prisma adapter; endorsed by former Auth.js team
- **Resend + React Email 6.5** — transactional email; templates version-controlled as React components
- **Tailwind CSS 4 + shadcn/ui** — accessible Radix-backed components (tables, modals, forms, badges)
- **React Hook Form 7 + Zod 3** — single Zod schema validates client and server
- **Recharts 2** — SVG-native, SSR-safe charts for borrowing analytics
- **node-cron 3** — daily overdue scan; no Redis dependency; requires persistent process (Railway, not Vercel)
- **Railway** — hosting with persistent Node.js process and managed PostgreSQL add-on

---

## Table Stakes Features

Must have or the system is not usable:

- Book catalog CRUD (title, author, ISBN, genre, publisher, year)
- Copy/item tracking — per-physical-copy status: AVAILABLE, CHECKED_OUT, RESERVED, LOST, WITHDRAWN
- Catalog search with real-time availability (member-facing OPAC)
- Member management — librarian registers students and faculty
- Role-based access control — LIBRARIAN vs MEMBER roles
- Book checkout — availability validated, due date derived from member type
- Book return — closes loan, calculates fine if overdue, advances hold queue
- Loan history — active and past loans per member
- Fine calculation — daily rate × overdue days; librarian can waive
- Book reservation — FIFO hold queue; notification when copy available
- Loan renewal — blocked by active holds, max renewal count, unpaid fine threshold
- Email notifications — due-date reminder, overdue alert, hold-ready
- Librarian reports — overdue summary, popular books, borrowing activity
- Dashboard — at-a-glance stats for both roles

---

## Architecture Highlights

**Core data model — 8 entities:**
`Book` → `BookCopy` (physical copies) → `Loan` → `Fine`
`Book` ← `Reservation` (FIFO queue on title)
`User` → `Member` (student/faculty) ← `Loan`, `Reservation`, `Fine`
`NotificationLog` (delivery audit)

**Key rules:**
- Reservations queue on `Book` (title), copy assigned at fulfillment on return
- Return transaction atomically: closes loan → calculates fine → advances hold queue → triggers notification
- `requireRole()` called as first line of every mutating Server Action (not delegated to middleware)
- All date columns use `@db.Timestamptz`; all due-date logic in UTC

**Suggested build order (hard dependency graph):**
1. Auth + Schema + Catalog + Members (everything else has FK deps here)
2. Checkout + Return + Loan History (fines and reservations depend on the loan record)
3. Fines + Renewals + Reservation Queue (reservation fulfillment hooks into return flow — build together)
4. Notifications + Cron (all triggering events stable after Phase 3)
5. Analytics + Reports (read-only; needs real data volume)
6. Polish + Hardening + Deployment (connection pool config before any load)

---

## Critical Pitfalls

1. **Availability race condition** — Two concurrent checkouts both pass the "available" check. Fix: `prisma.$transaction` with `SELECT FOR UPDATE` on BookCopy row. Must be in Phase 2 from the start — retrofitting is painful.

2. **Auth bypass via middleware only** — CVE-2025-29927 (CVSS 9.1): one header bypasses all `middleware.ts` checks. Every Server Action needs independent `requireRole()`. Middleware is UX-only (redirects).

3. **Book = Copy schema mistake** — One Book row per physical copy produces duplicate catalog results and breaks availability queries. `Book`/`BookCopy` split must be in the first migration. Cannot be retrofitted.

4. **Timezone bugs in due dates** — Prisma `DateTime` without `@db.Timestamptz` stores without timezone. Cron in UTC + app in UTC+7 fires overdue alerts a day early. Fix: `@db.Timestamptz` on all date columns, always compute in UTC.

5. **No background job strategy** — `node-cron` doesn't run on Vercel. Design the secured `POST /api/cron/process-overdue` endpoint in Phase 4 and deploy to Railway. Deferring means automated overdue tracking never ships.

---

## Phase Implications

| Phase | Focus | Key Deliverable |
|-------|-------|-----------------|
| 1 | Foundation | Auth, full schema (Book/BookCopy split locked), catalog CRUD, member management |
| 2 | Circulation | Checkout with `SELECT FOR UPDATE`, return flow, loan history, fine creation |
| 3 | Fines, Renewals, Holds | Fine lifecycle + waiver, member self-service renewal, FIFO reservation queue |
| 4 | Notifications | Resend + React Email, secured cron endpoint on Railway, overdue/reminder/hold emails |
| 5 | Analytics | Recharts dashboards, librarian reports, DB indexes on `dueAt`/`status`/`memberId` |
| 6 | Polish + Deploy | Connection pool config, mobile audit, audit log, configurable loan/fine policies |

**Phases needing extra research during planning:** Phase 4 (Resend rate limits, Railway cron specifics), Phase 6 (connection pool sizing).
**Standard well-documented phases:** Phase 1, 2, 5.

---

## Open Questions for Stakeholder

- Deployment target: Railway (persistent node-cron) vs Vercel (Vercel Cron Jobs) — determines Phase 4 architecture
- Default loan durations: student (14 days?), faculty (30 days?)
- Fine rate per overdue day (e.g., $0.25/day?)
- Reservation pickup window expiry (48h standard?)

---

*Research completed: 2026-06-09*
*Ready for roadmap: yes*
