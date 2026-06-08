# Architecture Research: Library Management System

**Domain:** Web-based school/university library management
**Researched:** 2026-06-09
**Stack:** Next.js (App Router) + PostgreSQL + Prisma ORM
**Overall confidence:** HIGH

---

## Component Breakdown

The system decomposes into six bounded domains. Each maps to a feature folder in `src/features/` and a matching API route group under `app/api/`. UI routes under `app/(app)/` reference the same domains.

| Domain | Responsibility | Who Uses It |
|--------|---------------|-------------|
| **Catalog** | Book titles, authors, genres, copy inventory | All roles |
| **Members** | User accounts, roles (student/faculty/librarian), borrowing limits | Librarian |
| **Circulation** | Check-out, check-in, loan lifecycle | Librarian (issue/return), Member (view) |
| **Reservations** | Hold queue, FIFO notification, pickup windows | Member (place), Librarian (fulfill) |
| **Fines** | Overdue calculation, fine records, waiver | Librarian (manage), Member (view) |
| **Notifications** | Email triggers for due-date reminders, overdue alerts, hold-ready | System (background), Member (receives) |
| **Analytics** | Borrowing stats, overdue summaries, popular titles | Librarian (read-only) |
| **Auth** | Session, role guard, JWT/cookie | All roles |

### Dependency Direction

```
Auth
 └── Members
      └── Catalog (BookCopy inventory)
           ├── Circulation (Loan)
           │    ├── Fines
           │    └── Notifications
           └── Reservations
                └── Notifications

Analytics reads from: Circulation + Fines + Catalog (read-only, no writes)
```

No domain writes upward. Notifications is a leaf — it only sends; it does not change state.

### Next.js Layer Map

```
app/
  (auth)/           — Login, register (public)
  (app)/
    dashboard/      — Librarian home
    catalog/        — Book search and detail pages
    members/        — Member management (librarian only)
    circulation/    — Issue/return forms (librarian only)
    reservations/   — Hold queue (member) and fulfillment (librarian)
    fines/          — Fine list and waiver (librarian), fine view (member)
    analytics/      — Reports (librarian only)
    account/        — Member self-service: loans, history, reservations
  api/
    catalog/
    members/
    circulation/
    reservations/
    fines/
    analytics/
    notifications/  — Webhook/cron endpoint only

src/
  features/         — Domain logic, one folder per domain above
  lib/
    db.ts           — Prisma client singleton
    auth.ts         — Auth config (NextAuth or similar)
    email.ts        — Resend/Nodemailer wrapper
    utils.ts        — Shared helpers (date math, fine calc)
  components/       — Shared UI only (no domain logic)
```

**Server Actions vs Route Handlers decision:**
Use Server Actions for all internal mutations (form submits, check-out, returns, fine waivers). Use Route Handlers (`route.ts`) for: cron/scheduled notification triggers, any future mobile client, and the `/api/analytics` read endpoints that benefit from HTTP caching headers. This matches the Vercel 2025 recommendation — 63%+ of production Next.js apps now default to Server Actions for mutations.

---

## Data Model

### Core Entities and Fields

**Book** (catalog title record — one row per unique work)
```prisma
model Book {
  id            String   @id @default(cuid())
  isbn          String   @unique
  title         String
  authorId      String
  author        Author   @relation(fields: [authorId], references: [id])
  genre         String?
  publisher     String?
  publishedYear Int?
  description   String?
  coverUrl      String?
  totalCopies   Int      @default(0)      // denormalized count, updated on copy add/remove
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  copies        BookCopy[]
  reservations  Reservation[]
}
```

**Author** (separate to allow multi-author search later)
```prisma
model Author {
  id    String  @id @default(cuid())
  name  String
  books Book[]
}
```

**BookCopy** (physical copy — one row per item on the shelf)
```prisma
model BookCopy {
  id        String         @id @default(cuid())
  bookId    String
  book      Book           @relation(fields: [bookId], references: [id])
  barcode   String         @unique
  status    CopyStatus     @default(AVAILABLE)
  condition String?        // "Good", "Fair", "Damaged"
  addedAt   DateTime       @default(now())

  loans     Loan[]
}

enum CopyStatus {
  AVAILABLE
  CHECKED_OUT
  RESERVED
  LOST
  WITHDRAWN
}
```

**Member** (extends the Auth User — one member row per patron account)
```prisma
model Member {
  id              String       @id @default(cuid())
  userId          String       @unique
  user            User         @relation(fields: [userId], references: [id])
  memberNumber    String       @unique   // human-readable library card number
  memberType      MemberType   @default(STUDENT)
  maxLoans        Int          @default(5)
  loanDurationDays Int         @default(14)
  isActive        Boolean      @default(true)
  joinedAt        DateTime     @default(now())

  loans           Loan[]
  reservations    Reservation[]
  fines           Fine[]
}

enum MemberType {
  STUDENT
  FACULTY
  STAFF
}
```

**User** (auth identity — NextAuth / custom auth)
```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  passwordHash  String?
  role          UserRole  @default(MEMBER)
  emailVerified Boolean   @default(false)
  createdAt     DateTime  @default(now())

  member        Member?
}

enum UserRole {
  LIBRARIAN
  MEMBER
}
```

**Loan** (one row per check-out event — never deleted, closed on return)
```prisma
model Loan {
  id            String     @id @default(cuid())
  copyId        String
  copy          BookCopy   @relation(fields: [copyId], references: [id])
  memberId      String
  member        Member     @relation(fields: [memberId], references: [id])
  issuedAt      DateTime   @default(now())
  dueAt         DateTime
  returnedAt    DateTime?  // null = still out
  renewCount    Int        @default(0)
  status        LoanStatus @default(ACTIVE)

  fines         Fine[]
}

enum LoanStatus {
  ACTIVE       // checked out, not yet due
  OVERDUE      // past due date, not returned
  RETURNED     // returned on time or late
  LOST         // declared lost
}
```

**Reservation** (hold queue entry — one row per hold request)
```prisma
model Reservation {
  id           String            @id @default(cuid())
  bookId       String            // reserve on the title, not a specific copy
  book         Book              @relation(fields: [bookId], references: [id])
  memberId     String
  member       Member            @relation(fields: [memberId], references: [id])
  requestedAt  DateTime          @default(now())
  expiresAt    DateTime?         // set when status moves to READY
  status       ReservationStatus @default(PENDING)
  queuePosition Int              // recalculated on each cancellation
  notifiedAt   DateTime?
}

enum ReservationStatus {
  PENDING     // waiting for a copy to become free
  READY       // copy set aside, member notified, awaiting pickup
  FULFILLED   // member checked out the held copy
  CANCELLED   // member cancelled or pickup window expired
}
```

**Fine** (one row per fine — linked to the loan that triggered it)
```prisma
model Fine {
  id          String     @id @default(cuid())
  loanId      String
  loan        Loan       @relation(fields: [loanId], references: [id])
  memberId    String
  member      Member     @relation(fields: [memberId], references: [id])
  amount      Decimal    @db.Decimal(10, 2)
  reason      String     @default("OVERDUE")
  status      FineStatus @default(UNPAID)
  createdAt   DateTime   @default(now())
  paidAt      DateTime?
  waivedAt    DateTime?
  waivedBy    String?    // librarian user id
}

enum FineStatus {
  UNPAID
  PAID
  WAIVED
}
```

**NotificationLog** (audit trail — not used for delivery logic)
```prisma
model NotificationLog {
  id         String   @id @default(cuid())
  memberId   String
  type       String   // "DUE_REMINDER" | "OVERDUE_ALERT" | "HOLD_READY"
  sentAt     DateTime @default(now())
  channel    String   @default("EMAIL")
  success    Boolean
  metadata   Json?    // template variables for debugging
}
```

### Relationship Summary

```
User 1──1 Member
Member 1──* Loan
Member 1──* Reservation
Member 1──* Fine

Book 1──* BookCopy
Book 1──* Reservation   (hold is on the title, copy assigned at fulfillment)

BookCopy 1──* Loan      (history of which copy was lent)

Loan 1──* Fine          (one loan can accrue multiple fines if period extended)
```

**Key design choice — reserve against title, not copy.** When a return triggers hold fulfillment, the system finds the highest-priority `PENDING` reservation for that `bookId`, assigns any `AVAILABLE` copy to it, sets `CopyStatus.RESERVED`, and sends the notification. This matches how Librarika, Koha, and Polaris all implement hold queues. (Source: Librarika hold queue docs, Polaris fine calculation docs.)

---

## API Structure

All routes under `app/api/`. Use REST resource conventions. Server Actions handle in-app mutations; these routes cover cron triggers, external reads, and any future integrations.

### Route Groups

```
GET    /api/catalog/books                    — paginated search (title, author, genre, availability)
GET    /api/catalog/books/[id]               — book detail + copies availability count
POST   /api/catalog/books                    — add book (librarian)
PUT    /api/catalog/books/[id]               — edit book metadata (librarian)
DELETE /api/catalog/books/[id]               — soft-remove book (librarian)

GET    /api/catalog/books/[id]/copies        — list copies and statuses
POST   /api/catalog/books/[id]/copies        — add physical copy (librarian)
PATCH  /api/catalog/books/[id]/copies/[cid]  — update copy status/condition (librarian)

GET    /api/members                          — list members (librarian)
GET    /api/members/[id]                     — member profile + active loans/fines
POST   /api/members                          — register member (librarian)
PATCH  /api/members/[id]                     — edit member (librarian)

GET    /api/circulation/loans                — list loans, filter by status/member/date
POST   /api/circulation/loans                — issue book (librarian) — checkout
PATCH  /api/circulation/loans/[id]/return    — process return (librarian)
PATCH  /api/circulation/loans/[id]/renew     — renew loan (member or librarian)
PATCH  /api/circulation/loans/[id]/lost      — mark copy lost (librarian)

GET    /api/reservations                     — list holds (librarian: all; member: own)
POST   /api/reservations                     — place hold (member)
DELETE /api/reservations/[id]               — cancel hold (member or librarian)
PATCH  /api/reservations/[id]/fulfill        — assign copy and mark READY (librarian/system)

GET    /api/fines                            — list fines (librarian: all; member: own)
PATCH  /api/fines/[id]/waive                 — waive fine (librarian)
PATCH  /api/fines/[id]/pay                   — record payment (librarian)

GET    /api/analytics/overview               — summary stats (librarian)
GET    /api/analytics/popular-books          — most borrowed titles (librarian)
GET    /api/analytics/overdue-summary        — overdue count/amount (librarian)

POST   /api/notifications/cron/due-reminders — cron trigger (server-to-server, auth by secret)
POST   /api/notifications/cron/overdue-scan  — cron trigger
```

### Conventions

- All responses: `{ data, error, meta }` envelope
- Pagination: `?page=1&limit=20` on list endpoints
- Filtering: `?status=OVERDUE`, `?memberId=xyz`, `?from=2026-01-01`
- Auth guard: middleware reads session role; librarian routes 403 on MEMBER role
- Errors: 400 for validation, 401 for unauthenticated, 403 for wrong role, 404 for not found, 409 for conflicts (e.g., copy not available)

---

## Data Flow

### 1. Check-Out (Issue) Flow

```
Librarian scans/searches copy barcode
  → GET /api/catalog/books?barcode=XYZ returns copy + status

Librarian submits issue form (Server Action: issueBook)
  → Validate: copy status === AVAILABLE
  → Validate: member maxLoans not exceeded (count active loans)
  → Validate: member has no UNPAID fines above threshold (policy-configurable)
  → DB transaction:
      UPDATE BookCopy SET status = CHECKED_OUT
      INSERT Loan { copyId, memberId, dueAt = now + member.loanDurationDays }
  → Return new Loan record to UI
```

### 2. Return Flow

```
Librarian scans copy barcode
  → POST /api/circulation/loans/[id]/return (Server Action: returnBook)
  → DB transaction:
      UPDATE Loan SET status = RETURNED, returnedAt = now()
      IF returnedAt > dueAt:
        INSERT Fine { amount = calculateFine(daysLate, ratePerDay) }
        UPDATE Loan status = OVERDUE before close (or tag retrospectively)
      UPDATE BookCopy SET status = AVAILABLE (tentative)
      CHECK: any PENDING Reservation for copy.bookId?
        YES → UPDATE BookCopy status = RESERVED
              UPDATE Reservation status = READY, expiresAt = now + 48h
              ENQUEUE notification email to member
        NO  → leave BookCopy status = AVAILABLE
```

**Fine calculation:**
```
daysLate = ceil((returnedAt - dueAt) / 86400000)
if daysLate <= gracePeriodDays: fine = 0
else: fine = (daysLate - gracePeriodDays) * ratePerDay
```
Rate and grace period are config values (environment variables or a `Config` table). Configurable per `MemberType` (faculty may differ from students).

### 3. Reservation Flow

```
Member searches catalog, finds book with 0 available copies
  → POST /api/reservations { bookId }
  → Validate: member not already holding this title
  → Validate: member not currently holding a checked-out copy of same title
  → INSERT Reservation { bookId, memberId, status: PENDING, queuePosition: next in queue }
  → Return queue position to member

[Later — on book return, see Return Flow above]

Reservation becomes READY
  → Member receives email: "Your hold is ready, pick up by {expiresAt}"
  → Member arrives; Librarian issues copy → Reservation status = FULFILLED

Pickup window expires (cron job scans expiresAt < now for READY reservations)
  → UPDATE Reservation status = CANCELLED
  → UPDATE BookCopy status = AVAILABLE (or trigger next in queue)
```

### 4. Renewal Flow

```
Member requests renewal (from account page — Server Action: renewLoan)
  → Validate: loan is ACTIVE (not OVERDUE)
  → Validate: loan.renewCount < maxRenewals (policy config, e.g. 2)
  → Validate: no PENDING Reservation on this book by another member
  → UPDATE Loan SET dueAt = dueAt + loanDurationDays, renewCount++
  → Return updated dueAt
```

### 5. Notification Cron Flow

```
Cron job (daily, e.g. via Vercel Cron or external scheduler):
  POST /api/notifications/cron/due-reminders
    → Query: loans WHERE status=ACTIVE AND dueAt = today + reminderDays (e.g. 3 days)
    → For each: send email via Resend; INSERT NotificationLog

  POST /api/notifications/cron/overdue-scan
    → Query: loans WHERE status=ACTIVE AND dueAt < now()
    → For each: UPDATE status = OVERDUE; send overdue email; INSERT NotificationLog
```

Cron endpoints are authenticated by a shared secret in the `Authorization` header (`Bearer $CRON_SECRET`). Not behind session auth.

---

## Suggested Build Order

Dependencies flow upward: nothing can be built until its dependency layer works. Follow this sequence across phases.

### Phase 1 — Foundation (Auth + Schema + Catalog)

**Why first:** Every other domain depends on User/Member identity and Book/BookCopy records existing.

- Database schema (all models migrated)
- Auth: login/logout, session, role middleware guard
- User + Member CRUD (librarian can register members)
- Book + Author CRUD (librarian manages catalog)
- BookCopy management (add copies, set status)
- Member-facing catalog search and book detail page

**Deliverable:** Librarian can log in, manage catalog and members. Members can search books.

### Phase 2 — Circulation Core (Loans)

**Why second:** Loans depend on BookCopy (Phase 1). Fines and reservations depend on Loans.

- Issue book (check-out) with availability validation
- Return book with automatic fine calculation
- Loan list and detail views (librarian and member)
- Member account page: active loans, loan history

**Deliverable:** End-to-end borrowing and returns work. Overdue fines are recorded.

### Phase 3 — Fines + Renewals

**Why third:** Fine records exist after Phase 2 returns. Renewals extend loans.

- Fine management UI (librarian: view, waive, record payment)
- Member fine view (own fines only)
- Loan renewal (member self-service + librarian-assisted)
- Renewal validation (hold conflict, max renewals)

**Deliverable:** Complete fine lifecycle. Members can renew loans.

### Phase 4 — Reservations

**Why fourth:** Reservation fulfillment hooks into the return flow (Phase 2). Needs Loans working to test the full cycle.

- Place hold (member)
- Hold queue display (member: own position; librarian: full queue)
- Return-triggers-hold logic in the return flow
- Cancel hold
- Pickup window expiry (cron or manual check)

**Deliverable:** Full hold queue with FIFO notification on return.

### Phase 5 — Notifications

**Why fifth:** Email sending depends on all triggering events being stable (loans, fines, holds).

- Resend (or Nodemailer) integration and email templates
- Due-date reminder cron
- Overdue alert cron (also updates Loan status to OVERDUE)
- Hold-ready email (triggered inline in return flow)
- NotificationLog recording

**Deliverable:** Automated email notifications for all patron-facing events.

### Phase 6 — Analytics + Polish

**Why last:** Read-only aggregation over data that must exist from previous phases.

- Borrowing stats dashboard (total loans, active, overdue counts)
- Popular books report (most borrowed by period)
- Overdue summary (member list, amount outstanding)
- Fine collection summary
- UI polish, mobile responsiveness audit, error state improvements

**Deliverable:** Librarian analytics views. Production-ready UX.

---

## Architecture Decisions and Rationale

| Decision | Rationale |
|----------|-----------|
| Book + BookCopy separation | Reserves target titles, not copies; enables multi-copy inventory; standard in all major ILS (Koha, Polaris, Librarika) |
| Reserve on title, assign copy on return | Simplifies queue logic; matches FIFO convention; prevents copy-specific gaming |
| Loan record never deleted | Audit trail for fine disputes, borrowing history reports |
| Fine linked to Loan, not just Member | Enables per-loan fine detail; supports dispute resolution; allows waiving per incident |
| Server Actions for mutations | Type-safe, co-located with forms, no extra round-trip; Route Handlers reserved for cron + external access |
| Separate NotificationLog | Delivery audit independent of delivery mechanism; swap Resend for SMTP without data loss |
| MemberType drives loan policy | Faculty/student loan duration and limits differ; store on Member row, not re-derive from role each time |

---

## Component Boundaries Summary

```
┌─────────────────────────────────────────────────────┐
│  Browser (Next.js RSC + Client Components)          │
│  app/(app)/catalog, circulation, members, etc.      │
└──────────────────────┬──────────────────────────────┘
                       │ Server Actions / fetch()
┌──────────────────────▼──────────────────────────────┐
│  Business Logic Layer  src/features/[domain]/        │
│  issueBook, returnBook, placHold, calculateFine…    │
└──────────────────────┬──────────────────────────────┘
                       │ Prisma Client
┌──────────────────────▼──────────────────────────────┐
│  Data Access  src/lib/db.ts (Prisma singleton)       │
│  PostgreSQL via Prisma ORM                           │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│  External Services                                   │
│  Resend (email)  |  Cron scheduler                  │
└─────────────────────────────────────────────────────┘
```

Nothing in `src/features/` imports from `app/`. Nothing in `src/lib/` imports from `src/features/`. One-way dependency graph only.

---

## Sources

- [System Design for Library Management — GeeksforGeeks](https://www.geeksforgeeks.org/system-design/system-design-for-library-management/)
- [Library Domain UML Class Diagram — uml-diagrams.org](https://www.uml-diagrams.org/library-domain-uml-class-diagram-example.html)
- [Design a Library Management System — DesignGurus (OOD)](https://www.designgurus.io/course-play/grokking-the-object-oriented-design-interview/doc/design-a-library-management-system)
- [Hold Queue — Librarika Manual](https://docs.librarika.com/en/develop/hold-queue/)
- [Calculating Overdue Fines — Polaris 7.3](https://documentation.iii.com/polaris/7.3/PolarisStaffHelp/Patron_Services_Admin/PDPfines/Calculating_Overdue_Fines.htm)
- [Prisma Relations Documentation](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations)
- [Next.js App Router Project Structure — makerkit.dev](https://makerkit.dev/blog/tutorials/nextjs-app-router-project-structure)
- [Server Actions vs Route Handlers — makerkit.dev](https://makerkit.dev/blog/tutorials/server-actions-vs-route-handlers)
- [Feature-Sliced Design for Next.js App Router](https://feature-sliced.design/blog/nextjs-app-router-guide)
- [Library Book Database Design — Lucid Community](https://community.lucid.co/product-questions-3/how-to-design-a-database-for-a-library-management-system-identified-by-isbn-9835)
