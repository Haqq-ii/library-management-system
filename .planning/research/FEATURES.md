# Features Research: Library Management System

**Domain:** School / University Library Management System
**Researched:** 2026-06-09
**Confidence:** HIGH — cross-validated against Koha (open-source reference implementation), Ex Libris Alma (enterprise benchmark), LIS Academy functional requirements, and multiple library policy sources.

---

## Table Stakes

Features that every librarian or patron expects. Missing any one of these makes the system feel incomplete or unusable.

| Feature | Why Expected | Complexity | Notes |
|---|---|---|---|
| **Book catalog — CRUD** | Core inventory. Librarians must add, edit, and remove titles and copies. | Low | Title, author, ISBN, genre, publisher, year, copy count. ISBN is the stable identifier for lookup. |
| **Copy/item tracking** | A title can have multiple physical copies with independent statuses (available, checked out, reserved). | Low-Medium | Each copy needs a unique accession/item ID separate from the ISBN. |
| **Catalog search (OPAC)** | Members must find books before they can borrow them. | Low | Search by title, author, ISBN, subject. Real-time availability status per result. |
| **Member management** | Librarians register students and faculty; accounts gate borrowing. | Low | Name, email, role (student/faculty), member ID, status (active/suspended). |
| **Role-based access control** | Librarians and patrons have fundamentally different capabilities. | Low | Two roles suffice for v1: `librarian` and `member`. |
| **Book checkout (issue)** | Core transaction. Librarian selects member + copy, records due date. | Low-Medium | Due date derived from role-based loan period. Must update copy status atomically. |
| **Book return** | Closes the loan, updates copy status, triggers fine calculation if overdue. | Low-Medium | Must handle: return on time, return late (auto-calculate fine), return with open reservation (notify next in queue). |
| **Loan history** | Members expect to see what they have borrowed and returned. | Low | Active loans + past loans per member. |
| **Fine calculation** | Overdue returns accrue fines. Librarian must see and record these. | Medium | Daily rate × overdue days. Fines are records, not payments (per project scope). Must handle edge case: fine waiver by librarian. |
| **Book reservation** | Members want to queue for a checked-out book. | Medium | FIFO queue per title. When copy returned → notify first in queue. Queue position visible to member. Reservation expires if member does not collect within N days. |
| **Loan renewal** | Members want to extend due dates without a physical visit. | Medium | Rules: block renewal if item has active holds from another member; block if max renewal count reached; block if member has unpaid fines above threshold. |
| **Email notifications** | Due-date reminders and overdue alerts are expected in any modern system. | Medium | Triggered events: 1–2 days before due, day of due, 1 day overdue, reservation ready. Transactional only (Resend or Nodemailer). |
| **Librarian reports** | Librarians need operational visibility without exporting spreadsheets. | Medium | Minimum: overdue summary, active loans list, popular books (most borrowed), borrowing activity by date range. |
| **Dashboard / home screen** | At-a-glance status for both roles. | Low | Librarian: total loans, overdue count, pending reservations. Member: active loans with due dates. |

---

## Differentiators

Features that are not expected by default but create real value and stand out from minimal implementations.

| Feature | Value Proposition | Complexity | Notes |
|---|---|---|---|
| **Role-differentiated loan rules** | Faculty get longer loan periods and higher limits than students — mirrors real university policy. | Low-Medium | Configurable per role: loan duration (e.g., 14 days students / 30 days faculty), max concurrent loans, max renewals. Stored as policy config, not hardcoded. |
| **ISBN auto-fill on catalog entry** | Librarian enters ISBN; system pre-fills title, author, publisher, cover image from an external API (Open Library or Google Books). | Medium | Reduces data entry errors. Requires external HTTP call; needs graceful fallback when ISBN not found. |
| **Cover image display in catalog** | Visual browsing is more engaging than text-only lists. | Low | Pull from ISBN lookup or allow manual URL upload. No file storage needed if URL-referenced. |
| **Reservation queue position display** | Members can see "You are #3 in line" — reduces anxiety and unnecessary librarian inquiries. | Low | Simple count query on reservations table. |
| **Fine waiver / adjustment by librarian** | Librarians frequently waive fines for legitimate reasons. A manual override with reason tracking is standard in real libraries. | Low | Add `waived_amount` and `waiver_note` columns to fine record. |
| **Member borrowing history export (CSV)** | Students and faculty sometimes need records for departmental or administrative purposes. | Low | Server-side CSV generation from loan history query. No complex reporting library needed. |
| **Configurable system parameters** | Loan durations, fine rates, max renewals, reservation expiry — configurable by librarian without a code deploy. | Medium | Admin settings screen backed by a `config` table. Avoids hardcoded magic numbers. |
| **Audit log for librarian actions** | Accountability trail: who issued, returned, waived a fine, or edited catalog records. | Low-Medium | Append-only log table. Essential for disputes ("I returned that book!"). |
| **Book condition tracking** | Mark copies as damaged, lost, or withdrawn from circulation. | Low | Status enum on the copy/item record: `available`, `checked_out`, `reserved`, `damaged`, `lost`, `withdrawn`. |
| **Overdue report with contact info** | Report listing all overdue loans with member email — makes it easy to send manual follow-ups. | Low | Simple query join, displayed in librarian dashboard. |

---

## Anti-Features

Features to deliberately exclude from v1. Each carries a warning about why including it early causes disproportionate cost.

| Anti-Feature | Why Avoid in v1 | What to Do Instead |
|---|---|---|
| **MARC21 / Z39.50 cataloging standards** | MARC21 is a bibliographic interchange standard designed for inter-library catalog sharing. It adds significant schema complexity (hundreds of fields) with zero benefit for a single-institution system. Z39.50 is a query protocol for cross-library lookup — overkill here. | Use a flat catalog record: title, author, ISBN, genre, publisher, year. Can be migrated to MARC later if needed. |
| **Online fine payment / payment gateway** | Integrating Stripe or any payment processor adds PCI-DSS scope, webhook handling, refund logic, and reconciliation complexity. The project spec explicitly excludes it. | Track fines as records. Librarian marks fines as paid manually after physical collection. |
| **Inter-library loans (ILL)** | ILL requires inter-institution identity, shared catalog protocols, shipping logistics, and complex return tracking across systems. Entire separate domain. | Single institution only. Explicitly out of scope in PROJECT.md. |
| **Self-checkout kiosk mode** | Requires barcode scanner hardware integration, session management for unattended terminals, and security against abuse. Adds hardware dependency to a web-first system. | Librarian-assisted checkout only. Web interface works from any browser. |
| **Mobile native app** | Separate codebase, app store deployment, push notification infrastructure, OS updates. Doubles maintenance burden before product is validated. | Responsive web design covers mobile access through the browser. |
| **Book recommendations / ML** | Collaborative filtering or content-based recommendations require sufficient borrowing history data (months of usage) before they produce useful results. Building it before data exists is speculative. | Surface "Most Borrowed" in the catalog as a simple sort — no ML needed, achieves 80% of the value. |
| **Serials / periodicals management** | Journals, magazines, and newspapers have subscription lifecycles, issue tracking, and routing rules completely different from monograph (book) borrowing. It's effectively a separate module. | Track only books and monographs in v1. |
| **Acquisitions / procurement module** | Ordering new books, managing vendor relationships, and budget tracking are back-office workflows separate from day-to-day circulation. Adds a full purchasing domain with supplier records, POs, and invoice matching. | Librarian adds books to catalog manually after physical purchase. |
| **SMS notifications** | SMS delivery requires a separate provider (Twilio, etc.), phone number verification, opt-in/opt-out compliance (TCPA/GDPR), and higher per-message cost. Adds meaningful complexity for marginal gain over email. | Email notifications cover the use case. Add SMS in v2 if patron engagement data shows email is insufficient. |
| **Bulk barcode/RFID scanning** | Hardware-dependent, requires driver integration or USB HID event capture. Useful for large collections but adds physical infrastructure dependency. | Librarians manually enter accession numbers or copy IDs in v1. |
| **OPAC customisation / theming engine** | Configurable themes, custom CSS injection, and branding controls are irrelevant until the base product is validated. Adds UI framework complexity. | Ship a clean, functional default design. Theming is a v3+ concern. |
| **Patron self-registration** | Unverified self-registration in a school/university context creates account management problems (fake students, duplicate accounts). Student accounts should be librarian-created or imported. | Librarian registers members. |

---

## Feature Dependencies

```
Auth (roles: librarian / member)
  └── Member management         ← Librarian creates member accounts
  └── Book catalog (CRUD)       ← Librarian creates catalog entries
        └── Copy/item tracking  ← Each catalog entry has ≥1 copy records
              └── Book checkout ← Requires an available copy + active member
                    └── Loan record
                          └── Fine calculation    ← Triggered on return if overdue
                          └── Loan renewal        ← Requires active loan; blocked by holds or fine threshold
                          └── Book return         ← Closes loan; triggers fine check; triggers reservation queue advance
              └── Book reservation ← Requires copy to be checked out (unavailable)
                    └── Email notification (reservation ready) ← Fires when copy returned and queue advances
  └── Email notifications        ← Requires member email on account
        ← Due-date reminder      ← Requires loan record with due_date
        ← Overdue alert          ← Requires loan past due_date
        ← Reservation ready      ← Requires reservation queue advance
  └── Reports / dashboard        ← Read-only queries across loans, copies, fines, reservations
```

**Key sequencing constraints:**

- Copy/item tracking must exist before checkout can be built. A title alone is not borrowable — a specific copy is.
- Reservation queue advance logic must be wired into the return flow, not built separately. Build them together.
- Email notifications depend on member email records being valid and a working transactional email integration (Resend). This is an external dependency that must be validated early with a real send.
- Fine calculation is triggered at return time, not as a scheduled job in v1. Scheduled overdue fine accrual (daily cron) is a v2 concern — it requires careful handling of library-closed days and holidays.
- Renewal blocking rules (holds exist, max renewals reached, fines above threshold) depend on the reservation table, loan renewal count, and fine records all being in place. Build renewal after those data models are stable.
- Reports are pure read queries — no write dependencies. Build last, after the transactional data is populated.

---

## MVP Recommendation

**Minimum for the system to be useful to a real librarian on day one:**

1. Auth + roles
2. Member management (librarian creates accounts)
3. Book catalog CRUD + copy/item tracking
4. Checkout (issue loan)
5. Return (close loan, calculate fine if overdue)
6. Catalog search with availability status (member-facing OPAC)
7. Active loans view (member-facing)

**Add in second pass (before first real users):**

8. Reservations (with queue advance on return)
9. Loan renewals (with blocking rules)
10. Email notifications (due-date reminder + overdue alert + reservation ready)
11. Librarian reports (overdue summary, popular books, borrowing activity)

**Defer with confidence:**

- ISBN auto-fill: nice but not blocking
- Configurable loan policies: hardcode sensible defaults first, make configurable later
- Audit log: add in a dedicated hardening phase
- Export CSV: add only when a librarian asks for it

---

## Sources

- [Libero LMS — Understanding the Library Management System](https://liberolms.com/understanding-the-library-management-system/)
- [LIS Academy — Essential System and Functional Requirements for Library Software](https://lis.academy/ict-applications/essential-system-functional-library-software/)
- [Koha Community Manual — Circulation](https://koha-community.org/manual/20.11/en/html/circulationpreferences.html)
- [Koha 23.05 — Circulation, Fines and Fees, Hold Requests](https://bywatersolutions.com/education/koha-23-05-circulation-fines-and-fees-hold-requests)
- [DevOpsSchool — Top 10 Library Management Systems Features](https://www.devopsschool.com/blog/top-10-library-management-systems-features-pros-cons-comparison/)
- [GeeksforGeeks — System Design for Library Management](https://www.geeksforgeeks.org/system-design-for-library-management/)
- [LISEduNetwork — Understanding Book Reservation Systems in the Library](https://www.lisedunetwork.com/understanding-book-reservation-systems-in-the-library/)
- [Softlink IC — 4 Important Email Notifications You Should Be Sending Your Library Users](https://ic.softlinkint.com/blog/4-important-email-notifications-you-should-be-sending-your-library-users/)
- [OCLC Support — Loan Policy](https://help.oclc.org/Library_Management/WorldShare_Circulation/OCLC_Service_Configuration_WMS_Circulation/Loans/030Loan_Policy)
- [UCLA Library — Unifies Loan Periods to Better Serve Faculty, Staff, Students](https://newsroom.ucla.edu/dept/faculty/ucla-library-unifies-loan-periods-to-better-serve-faculty-staff-students)
- [American Libraries — 2025 Library Systems Report](https://americanlibrariesmagazine.org/2025/05/01/2025-library-systems-report/)
