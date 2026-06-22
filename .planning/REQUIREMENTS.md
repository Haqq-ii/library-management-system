# Requirements: Library Management System

**Defined:** 2026-06-09
**Core Value:** Librarians can issue books, track returns, and see who has what — without paper records or spreadsheets.

## v1 Requirements

### Authentication

- [ ] **AUTH-01**: User can log in with email and password
- [ ] **AUTH-02**: User session persists across browser refresh
- [ ] **AUTH-03**: Role-based access enforced — LIBRARIAN and MEMBER (student/faculty) roles with distinct capabilities

### Catalog

- [ ] **CAT-01**: Librarian can add, edit, and soft-delete books (title, author, ISBN, genre, publisher, year)
- [ ] **CAT-02**: Librarian can manage physical copies per book with status tracking (AVAILABLE, CHECKED_OUT, RESERVED, LOST, WITHDRAWN)
- [ ] **CAT-03**: Member can search the catalog and see real-time availability per title
- [ ] **CAT-04**: Librarian can auto-fill book metadata from Open Library API by entering an ISBN

### Members

- [ ] **MBR-01**: Librarian can register member accounts (student or faculty role, name, email)
- [ ] **MBR-02**: Librarian can edit and soft-delete member accounts (deactivate without removing records)
- [ ] **MBR-03**: Member can view their own profile, active loans, and full loan history

### Circulation

- [ ] **CIRC-01**: Librarian can check out a specific book copy to a member with a calculated due date
- [ ] **CIRC-02**: Librarian can process a book return — closes the loan, triggers fine if overdue, advances hold queue
- [ ] **CIRC-03**: Librarian can view all active loans with member and due date
- [ ] **CIRC-04**: Member can view their active loans and due dates

### Fines

- [ ] **FINE-01**: System calculates fine on return (daily rate × overdue days, configurable rate)
- [ ] **FINE-02**: Librarian can waive a fine with a required reason (recorded for audit)
- [ ] **FINE-03**: Member with unpaid fines above the threshold is blocked from new checkouts and renewals

### Reservations

- [ ] **RES-01**: Member can place a reservation on a book title that has no available copies
- [ ] **RES-02**: On return, system atomically assigns a copy to the earliest pending reservation and sends hold-ready email
- [ ] **RES-03**: System cancels a reservation not picked up within the pickup window (default 48h)
- [ ] **RES-04**: Member can cancel their own pending reservation

### Renewals

- [ ] **RNW-01**: Member can renew an active loan to extend the due date
- [ ] **RNW-02**: Renewal blocked if another member has an active reservation on any copy of the book
- [ ] **RNW-03**: Renewal blocked if member has reached the maximum renewal count (configurable)
- [ ] **RNW-04**: Renewal blocked if member has unpaid fines above the threshold

### Notifications

- [ ] **NOTF-01**: System sends a due-date reminder email 3 days before and on the due date
- [ ] **NOTF-02**: System sends an overdue alert email daily while a loan is overdue
- [ ] **NOTF-03**: System sends a hold-ready email when a reserved copy is assigned to a member
- [x] **NOTF-04**: System logs notification delivery status (sent/failed) per member per event

### Reports

- [ ] **RPT-01**: Librarian can view overdue loans summary (all currently overdue, sortable by days late)
- [ ] **RPT-02**: Librarian can view popular books report (most-borrowed titles over a date range)
- [ ] **RPT-03**: Librarian can view borrowing activity chart (loans issued and returned over time)
- [ ] **RPT-04**: Librarian can view fine collection summary (total recorded, waived, and outstanding)

### Audit Log

- [ ] **AUD-01**: System records every librarian mutation with timestamp, actor, action type, and affected record (checkout, return, fine waiver, catalog changes, member changes)
- [ ] **AUD-02**: Librarian can view and filter the audit log by date range and action type

### Infrastructure

- [ ] **INFRA-01**: Application runs locally via Docker — `Dockerfile` + `docker-compose.yml` orchestrate Next.js app and PostgreSQL from the first commit
- [ ] **INFRA-02**: Separate environment configs for dev, staging, and prod (`.env.development`, `.env.staging`, `.env.production`) with no secrets in version control
- [ ] **INFRA-03**: Database includes seed data for development (sample books, members, loans, fines)
- [ ] **INFRA-04**: All domain records use soft delete (`deletedAt` timestamp) — no hard deletes in application code
- [ ] **INFRA-05**: Automated database backups configured (pg_dump schedule or managed backup on Railway/hosting provider)

## v2 Requirements

### Authentication

- **AUTH-v2-01**: OAuth login (Google, GitHub)
- **AUTH-v2-02**: Two-factor authentication

### Catalog

- **CAT-v2-01**: Bulk import catalog from CSV
- **CAT-v2-02**: Book cover image upload

### Notifications

- **NOTF-v2-01**: In-app notification bell (no email required)
- **NOTF-v2-02**: SMS notifications

### Members

- **MBR-v2-01**: Patron self-registration with email verification

### Admin

- **ADMIN-v2-01**: Configurable loan durations and fine rates through the UI (v1 uses env/seed config)
- **ADMIN-v2-02**: Multiple librarian accounts with permission scopes

## Out of Scope

| Feature | Reason |
|---------|--------|
| Online fine payment | PCI-DSS scope, payment gateway complexity — fines are records only |
| Mobile native app | Web-first; responsive browser covers mobile |
| Inter-library loans | Single institution scope |
| Self-checkout kiosk | Librarian-assisted checkout only in v1 |
| MARC21 / Z39.50 | Hundreds of schema fields with no value for a single institution |
| Serials / periodicals | Different borrowing model from books — separate domain |
| Acquisitions module | Vendor/PO/invoice domain — unrelated to circulation |
| Book recommendations | Requires months of data before results are useful |
| Hard deletes | All deletions are soft; only a manual DB admin operation can purge |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| CAT-01 | Phase 1 | Pending |
| CAT-02 | Phase 1 | Pending |
| CAT-03 | Phase 1 | Pending |
| CAT-04 | Phase 1 | Pending |
| MBR-01 | Phase 1 | Pending |
| MBR-02 | Phase 1 | Pending |
| MBR-03 | Phase 1 | Pending |
| INFRA-01 | Phase 1 | Pending |
| INFRA-02 | Phase 1 | Pending |
| INFRA-03 | Phase 1 | Pending |
| INFRA-04 | Phase 1 | Pending |
| CIRC-01 | Phase 2 | Pending |
| CIRC-02 | Phase 2 | Pending |
| CIRC-03 | Phase 2 | Pending |
| CIRC-04 | Phase 2 | Pending |
| FINE-01 | Phase 3 | Pending |
| FINE-02 | Phase 3 | Pending |
| FINE-03 | Phase 3 | Pending |
| RES-01 | Phase 3 | Pending |
| RES-02 | Phase 3 | Pending |
| RES-03 | Phase 3 | Pending |
| RES-04 | Phase 3 | Pending |
| RNW-01 | Phase 3 | Pending |
| RNW-02 | Phase 3 | Pending |
| RNW-03 | Phase 3 | Pending |
| RNW-04 | Phase 3 | Pending |
| AUD-01 | Phase 3 | Pending |
| AUD-02 | Phase 3 | Pending |
| NOTF-01 | Phase 4 | Pending |
| NOTF-02 | Phase 4 | Pending |
| NOTF-03 | Phase 4 | Pending |
| NOTF-04 | Phase 4 | Complete |
| INFRA-05 | Phase 4 | Pending |
| RPT-01 | Phase 5 | Pending |
| RPT-02 | Phase 5 | Pending |
| RPT-03 | Phase 5 | Pending |
| RPT-04 | Phase 5 | Pending |

**Coverage:**

- v1 requirements: 40 total
- Mapped to phases: 40
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-09*
*Last updated: 2026-06-09 — traceability confirmed during roadmap creation*
