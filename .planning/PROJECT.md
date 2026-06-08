# Library Management System

## What This Is

A web-based library management system for a school or university. Librarians manage the book catalog, member accounts, loans, fines, and reservations. Students and faculty can search the catalog, check their active loans, make reservations, and renew books — all through a browser interface.

## Core Value

Librarians can issue books, track returns, and see who has what — without paper records or spreadsheets.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Librarian can manage the book catalog (add, edit, remove books)
- [ ] Librarian can register and manage member accounts (students and faculty)
- [ ] Librarian can check out books to members and record due dates
- [ ] Librarian can process book returns and mark loans as closed
- [ ] Librarian can calculate and record fines for overdue returns
- [ ] Member can search the book catalog and see availability
- [ ] Member can view their active loans and loan history
- [ ] Member can reserve a book that is currently checked out
- [ ] Member can renew a loan to extend the due date
- [ ] System sends email notifications for due-date reminders and overdue alerts
- [ ] Librarian can view reports: borrowing stats, popular books, overdue summary

### Out of Scope

- Mobile native app — web-first; mobile via responsive browser
- Payment processing — fines tracked as records, not collected online
- Inter-library loans — single institution only
- Self-checkout kiosk mode — librarian-assisted checkout only in v1

## Context

- School/university context means three distinct user roles: admin/librarian, students, faculty
- Faculty may have different borrowing limits or loan durations than students (to configure)
- Email notifications require a transactional email service (Resend or similar)
- Reports are read-only summaries, not exported spreadsheets in v1

## Constraints

- **Tech Stack**: Next.js (full-stack) + PostgreSQL + Prisma ORM — recommended for unified codebase, strong typing, and relational data fit
- **Auth**: Role-based access — librarian admin vs. member (student/faculty)
- **Email**: Transactional email via Resend or Nodemailer; no marketing/bulk email
- **Local Dev**: Docker-first — all local development runs through Docker containers; `Dockerfile` + `docker-compose.yml` required from Phase 1
- **Deployment**: Containerized — production deployment uses Docker images; Railway or self-hosted (not Vercel, incompatible with node-cron + Docker)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Next.js full-stack over React + separate API | Single repo, API routes co-located with UI, faster dev velocity | — Pending |
| PostgreSQL over NoSQL | Relational model fits loans, members, books, fines naturally | — Pending |
| Role-based auth (librarian vs. member) | Different capabilities for staff vs. patrons | — Pending |
| Docker from day one | Consistent dev environment, no "works on my machine" issues, mirrors production containers | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-09 after Docker constraint added*
