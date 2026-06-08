# Pitfalls Research: Library Management System

**Domain:** School/university library management
**Stack:** Next.js + PostgreSQL + Prisma
**Researched:** 2026-06-09
**Confidence:** HIGH (stack-specific pitfalls verified against official docs and CVE disclosures; domain pitfalls from real LMS post-mortems and community issue threads)

---

## Critical Mistakes

### 1. Treating Book Availability as a Non-Transactional Read

**What goes wrong:** The checkout flow reads `availableCopies > 0`, then decrements in a separate query. Two concurrent checkout requests both read the count, both see "available", and both succeed — producing a loan for a book that no longer has a free copy.

**Why it happens:** Developers treat availability as a simple GET before a POST. Without a database-level lock or atomic check-and-update, the window between read and write is a race condition.

**Stack-specific detail:** Prisma does not natively support `SELECT FOR UPDATE`. You must use `prisma.$transaction` with `$queryRaw` or set `isolationLevel: Prisma.TransactionIsolationLevel.Serializable`. The serializable approach is simpler to implement correctly but requires retry logic on `P2034` errors. The same race exists for reservation fulfillment (converting a reservation to a loan when a copy is returned).

**Consequences:** Double-loans. Book is marked checked out twice. One patron gets the book; the other has an active loan for a book they never held. Fines, disputes, reconciliation all cascade from this.

**Prevention:**
```typescript
// Correct pattern: check + decrement atomically
await prisma.$transaction(async (tx) => {
  const book = await tx.$queryRaw`
    SELECT id, available_copies FROM "Book"
    WHERE id = ${bookId} FOR UPDATE
  `;
  if (book[0].available_copies < 1) throw new Error('NO_COPIES');
  await tx.book.update({
    where: { id: bookId },
    data: { availableCopies: { decrement: 1 } }
  });
  await tx.loan.create({ data: { ... } });
});
```

---

### 2. Authorization Only in Next.js Middleware

**What goes wrong:** All role checks (`librarian only`, `member only`) live in `middleware.ts`. The Server Actions and Route Handlers that mutate data — creating loans, adjusting fines, deleting members — have no independent auth check.

**Why it happens:** Middleware feels like a central gatekeeping layer. It is not. CVE-2025-29927 (CVSS 9.1, disclosed March 2025, affects all Next.js versions prior to 14.2.25/15.2.3) demonstrates that the `x-middleware-subrequest` header completely bypasses middleware execution. Attackers who know any Route Handler URL can hit it directly with the bypass header.

**Consequences:** Any unauthenticated user can issue books, clear fines, or delete catalog entries. Self-hosted deployments without the patch are fully exposed. Patched versions close CVE-2025-29927 but the architectural problem (single auth layer) remains a risk for future similar issues.

**Prevention:**
- Verify session and role inside every Server Action and Route Handler, regardless of what middleware does.
- Treat middleware as a UX redirect layer (send unauthenticated users to `/login`), not as a security boundary.
- Pattern: extract a `requireRole(role)` helper that throws if the caller is not authenticated — call it at the top of every mutating server function.
- Keep Next.js updated; pin to 14.2.25+ or 15.2.3+.

---

### 3. Prisma Connection Pool Exhaustion on Serverless

**What goes wrong:** Deploying to Vercel without configuring connection limits. Each serverless function invocation spins up its own Prisma client with a default pool of `num_cpus * 2 + 1` connections. Under any meaningful traffic, PostgreSQL's default 100-connection ceiling is hit and the app hard-fails with `P1001` or similar.

**Why it happens:** The issue is invisible in development (single Node process, single pool). It only manifests under concurrent load in production or staging.

**Consequences:** Database refuses new connections. Every request fails. Incident requires emergency pool reconfiguration.

**Prevention:**
- Use the singleton pattern (globalThis guard) so hot-reload does not create multiple clients in development.
- For Vercel: set `connection_limit=1` in the DATABASE_URL query string (`?connection_limit=1`), then raise it incrementally with load testing.
- For Railway/self-hosted (persistent process): keep the default pool but ensure `prisma generate` runs on every deploy via a `postinstall` script — stale generated clients are the second most common deploy failure.
- Seriously evaluate PgBouncer or Prisma Accelerate before going live on Vercel.

```
DATABASE_URL="postgresql://user:pass@host/db?connection_limit=1&pool_timeout=20"
```

---

### 4. Storing and Comparing Dates Without a Timezone Convention

**What goes wrong:** Due dates are stored as `TIMESTAMP WITHOUT TIME ZONE` (plain Prisma `DateTime` which maps to Postgres `timestamp`), computed in the server's local timezone. The cron job that flags overdue loans runs in UTC. A book due at "end of day June 10 in UTC+7" shows as overdue at 17:00 on June 9 UTC. Patrons receive overdue emails hours before their actual deadline and incur fines incorrectly.

**Why it happens:** JavaScript `Date`, Prisma `DateTime`, and PostgreSQL `timestamp` each behave differently regarding timezone. `new Date()` is always UTC internally, but `toLocaleDateString()` uses the process timezone. Day-boundary arithmetic (is today past the due date?) behaves differently depending on where the comparison runs.

**Consequences:** Incorrect fine amounts. Patron disputes. If the institution spans multiple timezones (multi-campus), every due-date comparison is wrong for at least one campus.

**Prevention:**
- Use `TIMESTAMPTZ` (Postgres `timestamp with time zone`) for every date column — `dueDate`, `loanDate`, `returnedAt`, `reservationExpiry`.
- Store and compute all due-date arithmetic in UTC. Convert to local time only at display.
- Pick one authoritative "end of business day" definition (e.g., 23:59:59 UTC) and apply it consistently in both the checkout mutation and the overdue detection query.
- Never use JavaScript `new Date().toLocaleDateString()` for due-date comparison — use UTC epoch arithmetic or a library like `date-fns` with explicit timezone handling.

---

### 5. No Background Job Strategy for Overdue Detection

**What goes wrong:** Overdue status is computed on-demand (when a librarian opens a report or when a member views their loans). The system never proactively sends overdue emails or marks loans overdue — it relies on someone looking at the right screen at the right time.

**Why it happens:** Next.js is a request/response framework. There is no built-in background runner. Developers defer the cron job problem because it requires infrastructure outside the main app, and it feels like a "Phase 2" concern. It never gets built.

**Consequences:** Email notifications (a stated requirement) never fire. Fines are never auto-calculated. Librarians must manually check the dashboard each morning. The core value proposition — automated overdue tracking — is not delivered.

**Stack-specific detail:** `node-cron` does not work on Vercel (serverless processes are destroyed after each invocation). For Vercel deployments, use Vercel Cron Jobs (configured in `vercel.json`, fires a secured Route Handler on a schedule). For Railway/self-hosted, `node-cron` within the persistent server process works correctly.

**Prevention:**
- Design the overdue detection query from day one as a standalone idempotent function: `markOverdueLoans()` — select all loans where `dueDate < now()` AND `returnedAt IS NULL`, update status, enqueue emails.
- Add a `POST /api/cron/process-overdue` route protected by a secret header (`Authorization: Bearer ${CRON_SECRET}`). Call it on a schedule (Vercel Cron, external service like Upstash, or `node-cron`).
- Never rely on a page load to trigger overdue state changes.

---

### 6. Catalog Modeled as "Book = Copy" (No Copy Separation)

**What goes wrong:** The schema has one `Book` record per physical copy. When the library has 5 copies of a title, there are 5 `Book` rows with duplicate metadata (ISBN, title, author). Availability is tracked by counting books not currently in a loan, not with an explicit counter.

**Why it happens:** It seems simple. It mirrors physical thinking ("each book is a thing").

**Consequences:**
- Catalog search returns 5 identical results for one title — confusing to users.
- Adding a 6th copy requires duplicating all metadata — error-prone.
- Bulk metadata updates (wrong author spelling) require updating 5 rows.
- Querying "how many copies are available?" requires a JOIN across loans instead of a single column read — slow at scale.

**Prevention:** Separate `BookTitle` (metadata: ISBN, title, author, genre) from `BookCopy` (physical item: barcode, condition, locationShelf). Loans attach to `BookCopy`, not `BookTitle`. Availability is a count of `BookCopy` records not in an active loan. This is the standard library data model (MARC/FRBR-inspired) and must be established before any loan data is written.

```
BookTitle (1) ──< BookCopy (N) ──< Loan (N)
```

---

## Warning Signs

| Pitfall | Early Warning Sign |
|---------|--------------------|
| Availability race condition | Checkout works fine locally; duplicate loans appear under load testing or when two browser tabs submit simultaneously |
| Auth only in middleware | You can navigate to `/api/loans/create` in curl with no session cookie and get a 200 |
| Connection pool exhaustion | Works in dev/staging; first traffic spike in production returns database errors; Prisma logs show `P1001` or `too many connections` |
| Timezone bugs | Overdue report shows different counts depending on what time of day it is run; timezone-sensitive tests fail in CI (UTC) but pass locally |
| No background job | Email notification feature is "done" but emails never arrive; overdue status only updates when someone loads the admin dashboard |
| Copy/title confusion | Catalog search returns duplicate entries for the same title; adding a new copy of an existing book requires re-entering author/ISBN |
| Middleware-only auth | Removing the `cookie` header from a Postman request to a mutating endpoint still returns 200 |

---

## Prevention Strategies

### Concurrency: Interactive Transactions + Raw Lock

For checkout and return operations, use Prisma interactive transactions with raw SQL for the availability check:

```typescript
// services/loan.service.ts
export async function checkoutBook(memberId: string, copyId: string) {
  return prisma.$transaction(async (tx) => {
    // Lock the copy row for this transaction
    const copies = await tx.$queryRaw<BookCopy[]>`
      SELECT * FROM "BookCopy"
      WHERE id = ${copyId} AND status = 'AVAILABLE'
      FOR UPDATE
    `;
    if (copies.length === 0) throw new AppError('COPY_UNAVAILABLE');

    await tx.bookCopy.update({
      where: { id: copyId },
      data: { status: 'CHECKED_OUT' }
    });

    return tx.loan.create({
      data: { memberId, bookCopyId: copyId, dueDate: computeDueDate() }
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
```

### Auth: Defense-in-Depth Wrapper

```typescript
// lib/auth-guard.ts
export async function requireLibrarian() {
  const session = await getServerSession(authOptions);
  if (!session) throw new AuthError(401, 'NOT_AUTHENTICATED');
  if (session.user.role !== 'LIBRARIAN') throw new AuthError(403, 'FORBIDDEN');
  return session;
}

// In every mutating Server Action / Route Handler:
export async function POST(req: Request) {
  await requireLibrarian(); // first line, always
  // ... rest of handler
}
```

### Connection Pool: Singleton + Serverless Config

```typescript
// lib/prisma.ts
const globalForPrisma = global as unknown as { prisma: PrismaClient };
export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] });
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

In `package.json`:
```json
{ "scripts": { "postinstall": "prisma generate" } }
```

### Dates: UTC-Always Convention

- Schema: all date columns use `DateTime` with `@db.Timestamptz` (Prisma + PostgreSQL).
- Compute due dates server-side using UTC: `new Date(Date.now() + LOAN_DURATION_MS)`.
- The overdue query: `WHERE "dueDate" < NOW() AND "returnedAt" IS NULL` — runs correctly in any timezone because both sides are UTC-anchored.

### Background Jobs: Secured Cron Endpoint

```typescript
// app/api/cron/process-overdue/route.ts
export async function POST(req: Request) {
  if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  const overdue = await markOverdueLoansAndQueueEmails();
  return Response.json({ processed: overdue.count });
}
```

```json
// vercel.json (if deploying to Vercel)
{
  "crons": [{ "path": "/api/cron/process-overdue", "schedule": "0 6 * * *" }]
}
```

---

## Phase Mapping

| Phase Topic | Pitfall to Pre-empt | When to Address |
|-------------|---------------------|-----------------|
| Database schema / catalog | Copy vs. title confusion | Phase 1 (schema design) — fix before writing a single migration |
| Authentication setup | Middleware-only auth; CVE-2025-29927 | Phase 1 (auth foundation) — `requireRole()` helper before any route exists |
| Checkout / return workflows | Availability race condition; Prisma `SELECT FOR UPDATE` | Phase 2 (borrowing/returns) — write with transactions from day one |
| Fine calculation | Timezone bugs in overdue date comparison | Phase 2 or 3 (fines) — establish UTC convention in schema, not after |
| Email notifications | No background job strategy | Phase 3 (notifications) — design cron endpoint alongside email templates |
| Deployment / infrastructure | Connection pool exhaustion | Phase 4 or staging deploy — configure before first load test |
| Reporting / analytics | N+1 queries on loan history | Phase 4 (analytics) — add `include` eagerly or raw aggregate queries; add indexes |
| Renewals | Renewal blocked by active reservation (hold) — renewing a book that has a waiting patron silently extends the wait | Phase 3 (renewals) — check for active reservations before allowing renewal |

---

## Confidence Notes

| Area | Confidence | Basis |
|------|------------|-------|
| Concurrency / race conditions | HIGH | Verified via Prisma GitHub issues #1918, #17136, #10709; official transaction docs |
| Auth / middleware bypass | HIGH | CVE-2025-29927 publicly documented (CVSS 9.1); Next.js official advisory |
| Connection pool exhaustion | HIGH | Prisma official Next.js troubleshooting docs; Vercel deployment guide |
| Timezone pitfalls | HIGH | PostgreSQL official datetime docs; multiple corroborating sources |
| Background job architecture | HIGH | Vercel Cron official docs; node-cron serverless incompatibility confirmed |
| Copy vs. title schema design | MEDIUM | MARC/FRBR library data model standard; inferred from real LMS catalogs; no single primary source cited |
| Renewal + reservation conflict | MEDIUM | Real library policies documented (Metro Library, Denver Public Library) — implementation-level warning inferred |
