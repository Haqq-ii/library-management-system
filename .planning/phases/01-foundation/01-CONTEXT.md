# Phase 1: Foundation - Context

**Gathered:** 2026-06-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 delivers a fully working web application with a Docker-based development environment, role-enforced authentication, complete book catalog management (titles + physical copies), and member account management. After this phase: a developer can run `docker compose up` and reach a working app with seeded data; a librarian can log in and manage books and members; a member can log in and search the catalog.

**In scope:** Auth (login, session, RBAC), book catalog CRUD + copy tracking, member management (register/edit/deactivate), catalog search for members, Docker dev environment, seed data, soft delete, env config files, `LoanPolicy` table seeded with defaults.

**Out of scope for this phase:** Checkout/return (Phase 2), fines (Phase 3), reservations (Phase 3), renewals (Phase 3), notifications (Phase 4), reports (Phase 5).

</domain>

<decisions>
## Implementation Decisions

### Docker Dev Workflow
- **D-01:** Hot reload via volume mount + polling — `WATCHPACK_POLLING=true` in Next.js container. Ensures reliable hot reload on Windows/WSL2 without inotify issues.
- **D-02:** Migrations run automatically on container startup — entrypoint executes `prisma migrate deploy` before starting the Next.js app. No manual migration steps.
- **D-03:** Seed data runs only on empty DB — entrypoint checks if the `User` table is empty before running `prisma db seed`. Safe to restart without wiping data.
- **D-04:** PostgreSQL uses a named Docker volume (not a bind mount) — data persists across `docker compose up/down`; `docker compose down -v` wipes it for a clean reset.

### App Navigation & Layout
- **D-05:** Persistent left sidebar navigation — collapses on mobile. Same sidebar shell for both librarian and member; sections differ by role.
- **D-06:** Librarian sidebar sections: **Dashboard** (overview stats), **Books** (catalog + copies), **Members**, **Loans** (checkout/return — active in Phase 2).
- **D-07:** Member sidebar sections: **Search Catalog**, **My Loans**, **My Reservations** (active Phase 3), **My Profile**.
- **D-08:** Login page: centered card layout on a plain/subtle background — no split layout.

### Catalog Display
- **D-09:** Librarian book catalog: **data table** with sortable columns (title, author, ISBN, copy count, availability) and inline row actions (edit, soft-delete). No card grid.
- **D-10:** Copy management: clicking a book row navigates to `/books/[id]` — a detail page with book info at top and a copies sub-table showing each copy's status (AVAILABLE/CHECKED_OUT/RESERVED/LOST/WITHDRAWN), barcode/identifier, and actions.
- **D-11:** Member catalog: **search + card results** — prominent search input, results displayed as book cards with title, author, availability badge, and a "Reserve" action (active Phase 3).
- **D-12:** Add/edit book form: **slide-over panel** (right-side drawer) — catalog table stays visible in background. Includes ISBN field with an "Auto-fill" button that calls Open Library API to populate title, author, publisher, year.

### Member Management
- **D-13:** Add/edit member form: **slide-over panel** — consistent with book form pattern. Fields: name, email, role (STUDENT / FACULTY), status (active/inactive).
- **D-14:** Deactivating a member sets `deletedAt` timestamp — account is hidden from active lists but loan history is preserved. No hard deletes.

### Loan Policy Configuration
- **D-15:** Loan policy stored in a **`LoanPolicy` DB table** seeded with defaults — not hardcoded constants or env vars. One row per member type (STUDENT, FACULTY). Fields: `memberType`, `loanDays`, `maxRenewals`, `fineDailyRate`, `maxUnpaidFineAmount`.
- **D-16:** Default seeded values: **Student = 14 days / Faculty = 30 days / Fine = $0.25/day**. Editable via seed script before first deploy; UI configuration is v2 scope.

### Claude's Discretion
- Specific color scheme / brand for the UI — open to standard shadcn/ui defaults (slate/neutral palette).
- Sidebar collapse behavior on mobile — standard responsive pattern (hamburger menu or bottom nav).
- Pagination strategy for catalog and member tables — standard offset pagination with page size selector is fine.
- Exact copy barcode/identifier format — auto-incrementing numeric ID is acceptable.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — project description, constraints (Docker-first, soft delete, UTC dates, Railway deployment), key decisions
- `.planning/REQUIREMENTS.md` — 40 v1 requirements with REQ-IDs; Phase 1 covers AUTH-01–03, CAT-01–04, MBR-01–03, INFRA-01–04
- `.planning/research/STACK.md` — recommended stack with specific versions: Next.js 16, Prisma 7.7, Better Auth 1.x, Tailwind v4, shadcn/ui
- `.planning/research/ARCHITECTURE.md` — full Prisma schema (Book, BookCopy, User, Member, LoanPolicy entities), component boundaries, build order rationale
- `.planning/research/PITFALLS.md` — critical: auth bypass (CVE-2025-29927), Book/Copy schema split, UTC timestamp convention, connection pool config

### Roadmap & State
- `.planning/ROADMAP.md` — Phase 1 success criteria (5 criteria), requirement list, phase dependencies
- `.planning/STATE.md` — pre-locked decisions: Book/BookCopy split, requireRole() enforcement, Timestamptz, SELECT FOR UPDATE, Docker+Railway

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None yet — greenfield project. Phase 1 establishes all foundational patterns.

### Established Patterns
- All patterns are being established in this phase. Key patterns to set:
  - `src/lib/db.ts` — Prisma singleton (globalThis pattern for dev hot-reload safety)
  - `src/lib/auth.ts` — Better Auth server instance
  - `src/lib/require-role.ts` — `requireRole(role)` helper called as first line of every mutating Server Action
  - `src/features/[domain]/` — feature-based folder structure (catalog, members, auth)

### Integration Points
- Docker entrypoint script wires together: Postgres health check → `prisma migrate deploy` → seed check → `next start`
- `.env.development` consumed by docker-compose.yml via `env_file`
- Better Auth session cookie read by `requireRole()` in Server Actions

</code_context>

<specifics>
## Specific Ideas

- **ISBN auto-fill**: "Auto-fill" button on book form calls Open Library API (`https://openlibrary.org/api/books?bibkeys=ISBN:...`) — populates title, author, publisher, year. Field stays editable after fill.
- **Seed data**: Should include at least 20 books (with 1–3 copies each), 10 student accounts, 5 faculty accounts, 1 librarian account — enough to make search and catalog browsing feel realistic.
- **Copy status badges**: Use shadcn/ui `Badge` component with color variants — green (AVAILABLE), yellow (CHECKED_OUT), blue (RESERVED), red (LOST/WITHDRAWN).
- **Soft delete visibility**: Soft-deleted books and members hidden from default list views (filter `WHERE deletedAt IS NULL`); librarian can toggle "Show inactive" to see them.

</specifics>

<deferred>
## Deferred Ideas

- Configurable loan policy via admin UI — deferred to v2 (ADMIN-v2-01). v1 uses seeded `LoanPolicy` table.
- Book cover image upload — deferred to v2 (CAT-v2-02). v1 shows a placeholder icon.
- Member self-registration — deferred to v2 (MBR-v2-01). v1: librarian-only registration.
- Bulk CSV book import — deferred to v2 (CAT-v2-01). v1: manual entry with ISBN auto-fill.

</deferred>

---

*Phase: 1-Foundation*
*Context gathered: 2026-06-09*
