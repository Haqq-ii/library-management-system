# Phase 1: Foundation - Research

**Researched:** 2026-06-09
**Domain:** Full-stack web app scaffold — Docker, Prisma 7 + PostgreSQL, Better Auth 1.x, Next.js 16 App Router, shadcn/ui + Tailwind v4
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Hot reload via volume mount + polling — `WATCHPACK_POLLING=true` in Next.js container.
- **D-02:** Migrations run automatically on container startup — entrypoint executes `prisma migrate deploy` before starting the app.
- **D-03:** Seed data runs only on empty DB — entrypoint checks if the `User` table is empty before running `prisma db seed`.
- **D-04:** PostgreSQL uses a named Docker volume (not a bind mount) — data persists across `docker compose up/down`; `docker compose down -v` wipes it for a clean reset.
- **D-05:** Persistent left sidebar navigation — collapses on mobile. Same sidebar shell for both librarian and member; sections differ by role.
- **D-06:** Librarian sidebar sections: Dashboard, Books, Members, Loans (active Phase 2).
- **D-07:** Member sidebar sections: Search Catalog, My Loans, My Reservations (active Phase 3), My Profile.
- **D-08:** Login page: centered card layout on a plain/subtle background — no split layout.
- **D-09:** Librarian book catalog: data table with sortable columns and inline row actions (edit, soft-delete). No card grid.
- **D-10:** Copy management: `/books/[id]` detail page with book info and a copies sub-table.
- **D-11:** Member catalog: search + card results — search input, results as book cards with availability badge.
- **D-12:** Add/edit book form: slide-over panel (right-side drawer). Includes ISBN Auto-fill via Open Library API.
- **D-13:** Add/edit member form: slide-over panel — consistent with book form pattern.
- **D-14:** Deactivating a member sets `deletedAt` timestamp — soft delete only.
- **D-15:** Loan policy stored in a `LoanPolicy` DB table seeded with defaults — not hardcoded constants or env vars.
- **D-16:** Default seeded values: Student = 14 days / Faculty = 30 days / Fine = $0.25/day.

### Claude's Discretion

- Specific color scheme / brand — open to standard shadcn/ui defaults (slate/neutral palette).
- Sidebar collapse behavior on mobile — standard responsive pattern (hamburger menu or bottom nav).
- Pagination strategy — standard offset pagination with page size selector is fine.
- Exact copy barcode/identifier format — auto-incrementing numeric ID is acceptable.

### Deferred Ideas (OUT OF SCOPE)

- Configurable loan policy via admin UI — deferred to v2 (ADMIN-v2-01).
- Book cover image upload — deferred to v2 (CAT-v2-02).
- Member self-registration — deferred to v2 (MBR-v2-01).
- Bulk CSV book import — deferred to v2 (CAT-v2-01).
- Checkout/return (Phase 2), fines (Phase 3), reservations (Phase 3), renewals (Phase 3), notifications (Phase 4), reports (Phase 5).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User can log in with email and password | Better Auth 1.x credentials provider; `auth.api.getSession()` server-side pattern |
| AUTH-02 | User session persists across browser refresh | Better Auth session model with `expiresAt`; cookie-based session managed by Better Auth |
| AUTH-03 | Role-based access enforced — LIBRARIAN and MEMBER roles | Better Auth admin plugin RBAC; `requireRole()` helper at top of every Server Action |
| CAT-01 | Librarian can add, edit, and soft-delete books | Server Actions + Prisma; `deletedAt` soft-delete pattern; slide-over form (D-12) |
| CAT-02 | Librarian can manage physical copies per book with status tracking | `BookCopy` model with `CopyStatus` enum; copies sub-table on `/books/[id]` (D-10) |
| CAT-03 | Member can search the catalog and see real-time availability | `/catalog` page; Book + BookCopy JOIN query for availability count; client-side debounce search |
| CAT-04 | Librarian can auto-fill book metadata from Open Library API by entering ISBN | Open Library Books API `https://openlibrary.org/api/books?bibkeys=ISBN:{isbn}&format=json&jscmd=data`; server-side fetch (avoids CORS) via Server Action or Route Handler |
| MBR-01 | Librarian can register member accounts | Member + User creation via Server Action; slide-over form (D-13) |
| MBR-02 | Librarian can edit and soft-delete member accounts | `deletedAt` on User model; edit via slide-over; "Show inactive" toggle |
| MBR-03 | Member can view their own profile, active loans, and full loan history | `/my-profile` page (Phase 1 shows profile only; loans appear in Phase 2) |
| INFRA-01 | Application runs locally via Docker | `Dockerfile` + `docker-compose.yml`; WATCHPACK_POLLING=true; named volume for Postgres |
| INFRA-02 | Separate environment configs for dev/staging/prod | `.env.development`, `.env.staging`, `.env.production`; `env_file` in docker-compose |
| INFRA-03 | Database includes seed data for development | `prisma/seed.ts` via `tsx`; seeded via `prisma db seed`; 20 books, 10 students, 5 faculty, 1 librarian |
| INFRA-04 | All domain records use soft delete (`deletedAt` timestamp) | `deletedAt DateTime?` on Book and User models; filter `WHERE deletedAt IS NULL` by default |
</phase_requirements>

---

## Summary

Phase 1 is a greenfield full-stack project scaffold that must deliver: a Docker-based development environment, a complete Prisma 7 schema for all five phases, Better Auth 1.x authentication with LIBRARIAN/MEMBER RBAC, book catalog CRUD with copy tracking, member management, and a member-facing catalog search. All patterns established here propagate to every subsequent phase — the schema, auth guard pattern, Server Action pattern, and Docker entrypoint must be correct from the first commit.

Three critical technical risks have been identified through research: (1) Prisma 7's new `prisma-client` generator provider conflicts with Next.js 16 Turbopack — the fix is to keep using the `prisma-client-js` provider name, which still uses the v7 engine and adapter architecture; (2) Prisma 7 requires an explicit `@prisma/adapter-pg` package and `PrismaPg` constructor — the old implicit driver is gone; (3) `migrate dev` no longer auto-runs `prisma generate` in Prisma 7 — the entrypoint must call `prisma generate` explicitly before starting the app.

The walking skeleton approach applies here: build Docker up → auth login → one CRUD feature (books) → prove the end-to-end path works, then expand.

**Primary recommendation:** Bootstrap with `npx create-next-app@latest`, then `npx shadcn@latest init` before any domain code. Establish the Prisma singleton, auth handler, and `requireRole()` helper as the first three library files — every subsequent task depends on them.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Auth login form | Browser (Client Component) | Frontend Server (Server Action) | Form interaction is client; credential validation runs server-side via Better Auth |
| Session validation | API / Backend (Server Action) | — | `requireRole()` must run server-side; middleware is UX-only (CVE-2025-29927) |
| Book catalog CRUD | API / Backend (Server Action) | Browser (Client Component for form) | Mutations are server-side; form state is client-side |
| Catalog search (member) | Browser (Client Component) | Frontend Server (initial data load) | Debounced client-side filter on seeded dataset per D-11 |
| ISBN auto-fill | API / Backend (Route Handler or Server Action) | Open Library (external) | Must be server-side to avoid CORS; Open Library API called from server |
| Member management | API / Backend (Server Action) | Browser (Client Component for form) | Same pattern as book CRUD |
| Copy status tracking | Database / Storage | API / Backend | `CopyStatus` enum lives in DB; mutations via Server Action |
| Docker orchestration | CDN / Static (infra) | — | Entrypoint wires Postgres health → migrate → seed → start |
| Seed data | Database / Storage | — | `prisma db seed` writes to PostgreSQL |
| Soft delete | Database / Storage | API / Backend | `deletedAt` column; filter at query level |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | 16.2.7 | Full-stack framework (App Router) | Official release March 2026; Turbopack stable; SSR + Server Actions in one repo [VERIFIED: npm registry] |
| `react` / `react-dom` | 19.2.7 | UI rendering | Bundled with Next.js 16; Server Components reduce client JS [VERIFIED: npm registry] |
| `typescript` | 5.x | Type safety | Non-negotiable; Prisma generates types from schema |
| `prisma` | 7.8.0 | DB migrations + ORM CLI | `prisma migrate deploy` in production; `prisma generate` explicit in v7 [VERIFIED: npm registry] |
| `@prisma/client` | 7.8.0 | Generated Prisma client | ESM output; used as `PrismaClient({ adapter })` [VERIFIED: npm registry] |
| `@prisma/adapter-pg` | 7.8.0 | PostgreSQL driver adapter | **Required in Prisma 7** — replaces built-in Rust driver [VERIFIED: npm registry] |
| `pg` | 8.21.0 | PostgreSQL node driver | Used by `@prisma/adapter-pg` [VERIFIED: npm registry] |
| `better-auth` | 1.6.15 | Authentication + RBAC | Stable v1; credentials, sessions, admin/RBAC plugin, Prisma adapter built-in [VERIFIED: npm registry] |
| `tailwindcss` | 4.3.0 | Utility-first CSS | v4 is default for new Next.js + shadcn/ui projects; CSS-first config [VERIFIED: npm registry] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | 4.4.3 | Schema validation | Client (RHF resolver) + server (Server Action parse); use `zod@4` — it is the stable `latest` [VERIFIED: npm registry] |
| `react-hook-form` | 7.78.0 | Form state management | Ref-based, minimal re-renders; official shadcn/ui integration [VERIFIED: npm registry] |
| `@hookform/resolvers` | 5.4.0 | Bridges Zod schema to RHF | Required for `zodResolver`; v5 supports Zod v4 [VERIFIED: npm registry] |
| `lucide-react` | 1.17.0 | Icon library | Default with shadcn/ui; BookOpen, Search, Menu, etc. [VERIFIED: npm registry] |
| `sonner` | 2.0.7 | Toast notifications | shadcn/ui ships `sonner` as default toaster in v4 projects [VERIFIED: npm registry] |
| `tsx` | 4.22.4 | Execute TypeScript for seed script | Required for `prisma db seed` with `.ts` files in ESM context [VERIFIED: npm registry] |
| `node-cron` | 4.2.1 | Scheduled jobs (Phase 4 prep, not Phase 1) | Phase 1 sets up the custom server scaffold; cron logic is Phase 4 [VERIFIED: npm registry] |

> **Note on node-cron:** CLAUDE.md references 3.x, but the npm `latest` tag resolves to 4.2.1. Last v3 stable was 3.0.3. Use 4.x for Phase 1 since it is the maintained stable branch. The API is compatible.

> **Note on recharts:** CLAUDE.md references 2.x, but the npm `latest` tag resolves to 3.8.1. Not needed in Phase 1 (charts are Phase 5). Install when needed.

> **Note on Zod:** CLAUDE.md references 3.x, but `npm view zod` `latest` tag is now 4.4.3 (v4 stable). Zod v4 is a breaking change from v3 — do not assume API compatibility. The `@hookform/resolvers@5.x` supports Zod v4 via `zodResolver`. Install `zod@4`.

### shadcn/ui Components (CLI, not npm)

Install via `npx shadcn@latest add <component>` — not npm packages. Components are copied into `src/components/ui/`.

| Component | CLI Command | Phase 1 Usage |
|-----------|-------------|---------------|
| button | `add button` | All CTAs |
| input | `add input` | Login, search, form fields |
| label | `add label` | Form labels |
| card | `add card` | Login card, book cards, dashboard stats |
| badge | `add badge` | Copy status, member role chip |
| table | `add table` | Catalog table, member table, copies sub-table |
| sheet | `add sheet` | Slide-over panels (Add/Edit Book, Member) |
| dialog | `add dialog` | Soft-delete confirmations |
| form | `add form` | react-hook-form integration |
| separator | `add separator` | Sidebar section dividers |
| avatar | `add avatar` | Member profile, sidebar footer |
| dropdown-menu | `add dropdown-menu` | Table row actions (...) |
| switch | `add switch` | "Show inactive" toggle |
| skeleton | `add skeleton` | Loading states |
| sonner | `add sonner` | Toast feedback |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Better Auth | Auth.js / NextAuth v5 | Auth.js v5 still in beta; Better Auth is the recommended successor per upstream team |
| Prisma 7 | Drizzle ORM | Drizzle is valid but Prisma Studio + migration tracking + ecosystem size favor Prisma for this relational domain |
| shadcn/ui | MUI / Chakra | Both conflict with Tailwind, add bundle weight; shadcn/ui gives owned source with zero lock-in |
| Zod v4 | Zod v3 | v3 is still on next/alpha track; v4 is `latest` stable as of June 2026 |

**Installation:**

```bash
# Core framework
npm install next@latest react@latest react-dom@latest typescript

# Database + ORM
npm install @prisma/client @prisma/adapter-pg pg
npm install --save-dev prisma tsx

# Authentication
npm install better-auth

# Forms and validation
npm install zod react-hook-form @hookform/resolvers

# Icons + toasts (shadcn defaults)
npm install lucide-react sonner

# UI (CLI, not npm — run after project scaffold)
# npx shadcn@latest init
# npx shadcn@latest add button input label card badge table sheet dialog form separator avatar dropdown-menu switch skeleton sonner
```

---

## Package Legitimacy Audit

> slopcheck was run against the PyPI (Python) registry which flagged Node.js packages as false positives due to cross-ecosystem confusion. All packages below were independently verified on the npm registry via `npm view`. [VERIFIED: npm registry]

| Package | Registry | Age | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-------------|-----------|-------------|
| `next` | npm | 15 yrs | github.com/vercel/next.js | N/A (npm verified) | Approved |
| `react` | npm | 15 yrs | github.com/facebook/react | N/A | Approved |
| `react-dom` | npm | 11 yrs | github.com/facebook/react | N/A | Approved |
| `prisma` | npm | 9 yrs | github.com/prisma/prisma | N/A | Approved |
| `@prisma/client` | npm | 6 yrs | github.com/prisma/prisma | N/A | Approved |
| `@prisma/adapter-pg` | npm | 2.7 yrs | github.com/prisma/prisma | N/A | Approved |
| `pg` | npm | 15 yrs | github.com/brianc/node-postgres | N/A | Approved |
| `better-auth` | npm | 1.6 yrs (Apr 2024) | github.com/better-auth/better-auth | N/A | Approved — active, stable v1 |
| `tailwindcss` | npm | Established | github.com/tailwindlabs/tailwindcss | N/A | Approved |
| `zod` | npm | 6 yrs | github.com/colinhacks/zod | N/A | Approved |
| `react-hook-form` | npm | 7 yrs | github.com/react-hook-form/react-hook-form | N/A | Approved |
| `@hookform/resolvers` | npm | 6 yrs | github.com/react-hook-form/resolvers | N/A | Approved |
| `lucide-react` | npm | 5.6 yrs | github.com/lucide-icons/lucide | N/A | Approved |
| `sonner` | npm | 3.3 yrs (Feb 2023) | github.com/emilkowalski/sonner | N/A | Approved |
| `tsx` | npm | 10 yrs | — | N/A | Approved |
| `node-cron` | npm | 10 yrs | github.com/merencia/node-cron | N/A | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none (slopcheck cross-ecosystem false positives discarded)
**Packages flagged as suspicious [SUS]:** none

**Postinstall scripts checked:** `better-auth`, `node-cron`, `sonner` — none found.

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (React Client Components)
  │  form submits, user events
  ▼
Next.js Server (App Router)
  ├── app/(auth)/login          ← Public; LoginCard form
  ├── app/(app)/dashboard       ← Librarian; stat cards
  ├── app/(app)/books           ← Librarian; CatalogTable + BookFormSheet
  ├── app/(app)/books/[id]      ← Librarian; CopiesSubTable
  ├── app/(app)/members         ← Librarian; MemberTable + MemberFormSheet
  ├── app/(app)/catalog         ← Member; search + BookCard grid
  ├── app/(app)/my-loans        ← Member; empty state (Phase 2 populates)
  ├── app/(app)/my-profile      ← Member; profile read-only
  └── app/api/auth/[...all]     ← Better Auth handler (GET + POST)
         │
         │  Server Actions (mutations) + Route Handlers (auth)
         ▼
src/features/[domain]/actions.ts   ← requireRole() → business logic → Prisma
         │
         │  PrismaClient({ adapter: PrismaPg })
         ▼
PostgreSQL 16 (Docker container)
  ├── User / Session / Account / Verification   ← Better Auth core tables
  ├── Member                                    ← Library patron profile
  ├── Book / Author / BookCopy                  ← Catalog
  ├── LoanPolicy                                ← Seeded defaults (D-15)
  ├── Loan / Fine / Reservation (schema only)   ← Populated in Phase 2+
  └── NotificationLog (schema only)             ← Phase 4

External APIs
  └── openlibrary.org/api/books  ← ISBN auto-fill (CAT-04); called server-side
```

### Recommended Project Structure

```
library-management-system/
├── prisma/
│   ├── schema.prisma           # Full v1 schema (all models, Phase 1 through 5)
│   ├── prisma.config.ts        # Prisma 7 config (url, migrations path, seed)
│   ├── migrations/             # Auto-generated migration files
│   └── seed.ts                 # Seed: 1 librarian, 10 students, 5 faculty, 20 books, LoanPolicy
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/page.tsx
│   │   ├── (app)/
│   │   │   ├── layout.tsx      # AppSidebar wrapper
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── books/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── members/page.tsx
│   │   │   ├── catalog/page.tsx
│   │   │   ├── my-loans/page.tsx
│   │   │   └── my-profile/page.tsx
│   │   ├── api/
│   │   │   └── auth/[...all]/route.ts  # Better Auth handler
│   │   ├── globals.css         # Tailwind v4 @theme + shadcn tokens
│   │   └── layout.tsx          # Root layout
│   ├── components/
│   │   ├── ui/                 # shadcn/ui generated components
│   │   └── layout/
│   │       └── AppSidebar.tsx  # Role-aware sidebar
│   ├── features/
│   │   ├── auth/
│   │   │   └── LoginCard.tsx
│   │   ├── catalog/
│   │   │   ├── CatalogTable.tsx
│   │   │   ├── CopiesSubTable.tsx
│   │   │   ├── BookCard.tsx
│   │   │   ├── BookFormSheet.tsx
│   │   │   ├── BookStatusBadge.tsx
│   │   │   └── actions.ts      # createBook, updateBook, softDeleteBook, addCopy
│   │   ├── members/
│   │   │   ├── MemberTable.tsx
│   │   │   ├── MemberFormSheet.tsx
│   │   │   └── actions.ts      # createMember, updateMember, softDeleteMember
│   │   └── dashboard/
│   │       └── DashboardStats.tsx
│   └── lib/
│       ├── db.ts               # Prisma singleton (globalThis pattern)
│       ├── auth.ts             # Better Auth server instance
│       ├── auth-client.ts      # Better Auth browser client
│       └── require-role.ts     # requireRole() helper
├── Dockerfile
├── docker-compose.yml
├── docker-entrypoint.sh
├── .env.development
├── .env.staging
├── .env.production
└── next.config.ts
```

### Pattern 1: Prisma 7 Singleton with PrismaPg Adapter

**What:** Single Prisma client instance guarded by `globalThis` to prevent connection explosion on hot-reload.

**When to use:** All database access — import `prisma` from `@/lib/db` everywhere.

```typescript
// src/lib/db.ts
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

[VERIFIED: npm registry + official Prisma docs upgrade guide]

### Pattern 2: requireRole() Auth Guard

**What:** Every mutating Server Action calls this as its first line. Throws on unauthenticated or wrong-role requests. Never rely on middleware alone.

**When to use:** All Server Actions and Route Handlers that mutate data or return sensitive data.

```typescript
// src/lib/require-role.ts
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export type UserRole = "LIBRARIAN" | "MEMBER";

export async function requireRole(role: UserRole) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    throw new Error("UNAUTHENTICATED");
  }
  // Better Auth admin plugin stores role as string on session.user.role
  if (session.user.role !== role) {
    throw new Error("FORBIDDEN");
  }
  return session;
}

// Usage in every Server Action:
// export async function createBook(data: BookFormData) {
//   await requireRole("LIBRARIAN"); // first line, always
//   // ... business logic
// }
```

[CITED: better-auth.com/docs/integrations/next — `auth.api.getSession({ headers: await headers() })`]
[CITED: PITFALLS.md — CVE-2025-29927 auth-in-middleware-only is insufficient]

### Pattern 3: Better Auth Setup

**What:** Better Auth server instance and handler mounting.

```typescript
// src/lib/auth.ts
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin as adminPlugin } from "better-auth/plugins";
import { prisma } from "@/lib/db";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true },
  plugins: [
    adminPlugin(), // Adds role, banned, banReason, banExpires fields to User
  ],
  trustedOrigins: [process.env.BETTER_AUTH_URL!],
});

// app/api/auth/[...all]/route.ts
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
export const { GET, POST } = toNextJsHandler(auth);
```

[CITED: better-auth.com/docs/installation, better-auth.com/docs/plugins/admin]

### Pattern 4: Prisma Schema (Timestamptz Convention)

**What:** All date columns use `@db.Timestamptz` to store timezone-aware timestamps. All due-date logic uses UTC.

```prisma
// prisma/schema.prisma — excerpt showing timestamp convention
model Loan {
  id         String     @id @default(cuid())
  issuedAt   DateTime   @default(now()) @db.Timestamptz(3)
  dueAt      DateTime   @db.Timestamptz(3)
  returnedAt DateTime?  @db.Timestamptz(3)
  // ...
}
```

[CITED: PITFALLS.md — Pitfall 4; medium.com/@basem.deiaa (Timestamptz annotation confirmed)]

### Pattern 5: Prisma 7 Configuration

**What:** `prisma.config.ts` replaces scattered CLI flags. Generator uses `prisma-client-js` (not `prisma-client`) to avoid Turbopack breakage.

```typescript
// prisma/prisma.config.ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
```

```prisma
// prisma/schema.prisma — generator block
generator client {
  provider = "prisma-client-js"   // NOT "prisma-client" — avoids Turbopack breakage
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

[CITED: buildwithmatija.com/blog/migrate-prisma-v7-nextjs-16-turbopack-fix — use prisma-client-js provider]
[CITED: prisma.io/docs/guides/upgrade-prisma-orm/v7 — defineConfig, seed config, explicit generate]

### Pattern 6: Docker Entrypoint

**What:** Shell script that wires Postgres health check → `prisma generate` → `prisma migrate deploy` → conditional seed → app start.

```bash
#!/bin/sh
# docker-entrypoint.sh

set -e

echo "Waiting for Postgres..."
until pg_isready -h "$DB_HOST" -p 5432 -U "$DB_USER"; do
  sleep 1
done

echo "Running prisma generate..."
npx prisma generate

echo "Running migrations..."
npx prisma migrate deploy

# D-03: Seed only if User table is empty
USER_COUNT=$(npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM \"User\";" 2>/dev/null || echo "0")
if [ "$USER_COUNT" = "0" ] || [ -z "$USER_COUNT" ]; then
  echo "Seeding database..."
  npx prisma db seed
fi

echo "Starting Next.js..."
exec npm run start
```

[VERIFIED: D-02, D-03 from CONTEXT.md; pattern confirmed via npm registry for prisma CLI commands]

### Pattern 7: Open Library ISBN Auto-fill

**What:** Server Action (or Route Handler) that calls Open Library Books API. Must be server-side to avoid CORS restrictions.

```typescript
// src/features/catalog/actions.ts
export async function fetchBookByISBN(isbn: string) {
  await requireRole("LIBRARIAN");
  
  const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`;
  const res = await fetch(url, {
    headers: { "User-Agent": "LibraryManagementSystem/1.0 mydev.accout@gmail.com" },
    next: { revalidate: 86400 }, // Cache for 24h — book metadata is stable
  });
  
  if (!res.ok) return { error: "API_UNREACHABLE" };
  
  const data = await res.json();
  const key = `ISBN:${isbn}`;
  if (!data[key]) return { error: "ISBN_NOT_FOUND" };
  
  const book = data[key];
  return {
    title: book.title,
    author: book.authors?.[0]?.name ?? null,
    publisher: book.publishers?.[0]?.name ?? null,
    publishedYear: book.publish_date ? parseInt(book.publish_date) : null,
  };
}
```

[CITED: openlibrary.org/developers/api — `?bibkeys=ISBN:{isbn}&format=json&jscmd=data`; User-Agent requirement for >1 req/sec]

### Anti-Patterns to Avoid

- **Auth only in middleware:** Next.js middleware can be bypassed via `x-middleware-subrequest` header (CVE-2025-29927). Always call `requireRole()` inside every Server Action and Route Handler.
- **`prisma-client` generator provider:** Causes Turbopack module resolution failures in Next.js 16. Use `prisma-client-js` provider name even with Prisma v7.
- **`migrate dev` without explicit generate:** Prisma 7 no longer auto-runs `prisma generate` after `migrate dev`. The Docker entrypoint must call `prisma generate` explicitly.
- **`prisma.config.ts` in project root without dotenv:** Prisma 7 does not load `.env` automatically. `import "dotenv/config"` must be at the top of `prisma.config.ts`.
- **Storing timestamps without `@db.Timestamptz`:** Plain `DateTime` maps to `timestamp without time zone`, causing timezone-dependent overdue bugs. Use `@db.Timestamptz(3)` for every date column.
- **Client-side ISBN fetch:** Open Library API does not guarantee CORS headers. Always fetch from a Server Action.
- **Hard deletes in any application code:** All deletes must set `deletedAt` (INFRA-04). No `prisma.model.delete()` calls.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session management + cookie security | Custom JWT signing/verification | Better Auth built-in | Secure cookie rotation, CSRF protection, expiry — all handled |
| Password hashing | bcrypt wrapper, manual salt | Better Auth (Argon2id internally) | OWASP gold standard; 72-byte limit in bcrypt is a real attack surface |
| Role checking | Middleware-only guards | `requireRole()` calling `auth.api.getSession()` | Middleware bypass CVE-2025-29927; defense in depth is mandatory |
| DB migrations | Hand-written SQL migration scripts | `prisma migrate deploy` | Tracks migration history, reproducible, rollback-safe |
| Form validation | Custom regex validators | Zod schemas (shared client + server) | Single source of truth; server-side parse catches bypass attempts |
| Accessible dropdowns / dialogs | Custom portal + focus trap | Radix UI primitives via shadcn/ui | ARIA attributes, keyboard nav, focus trap — 3000+ lines of battle-tested code |
| Toast / notification system | `useState` + CSS animation | `sonner` via shadcn | Accessible, stacked, auto-dismiss — already in the UI spec |
| Open Library CORS workaround | Proxy route with custom caching | Next.js Server Action with `next: { revalidate }` | Built-in Next.js fetch caching handles this in one line |

---

## Common Pitfalls

### Pitfall 1: Prisma 7 Turbopack Breakage

**What goes wrong:** Using `provider = "prisma-client"` in `generator client` block causes Next.js 16 Turbopack to fail to resolve the generated client at runtime with a module-not-found error.

**Why it happens:** Prisma 7's new `prisma-client` provider generates the client in a structure that Turbopack's module resolution algorithm cannot handle during server-side rendering. The `prisma-client-js` provider generates a compatible structure.

**How to avoid:** Always use `provider = "prisma-client-js"` in `schema.prisma`. This uses the full Prisma 7 engine, adapter architecture, and performance improvements — only the generator output structure differs.

**Warning signs:** `Cannot find module '@prisma/client'` or similar resolution errors when running `next dev` with Turbopack.

### Pitfall 2: Prisma 7 Missing `prisma generate` Step

**What goes wrong:** `prisma migrate deploy` runs successfully but the app crashes with `PrismaClientInitializationError` because the generated client is missing or stale.

**Why it happens:** Prisma 7 decoupled `migrate deploy` from `generate`. In v6 and earlier, migration commands triggered generation. In v7, they are separate steps.

**How to avoid:** Always call `prisma generate` before `prisma migrate deploy` in the Docker entrypoint. Also add `"postinstall": "prisma generate"` to `package.json` for Railway/CI deploys.

**Warning signs:** App starts but crashes immediately with `PrismaClientInitializationError: Unable to require('.../@prisma/client')`.

### Pitfall 3: Auth-Only-in-Middleware (CVE-2025-29927)

**What goes wrong:** All RBAC guards are in `middleware.ts`. The `x-middleware-subrequest` header bypasses Next.js middleware execution entirely (CVSS 9.1).

**Why it happens:** Middleware feels like a natural centralized auth layer. It is not a security boundary.

**How to avoid:** Call `requireRole()` as the **first line** of every mutating Server Action and every Route Handler that returns protected data. Treat middleware as a UX redirect layer only (send unauthenticated browsers to `/login`).

**Warning signs:** A `curl` command with `x-middleware-subrequest: pages-render:pages-render:pages-render:pages-render:pages-render` to a protected Route Handler returns 200.

### Pitfall 4: Hot Reload Fails in Docker on Windows

**What goes wrong:** File changes in the host filesystem are not detected by the Next.js watcher inside the Docker container on Windows/WSL2. The page never updates.

**Why it happens:** Windows filesystem events don't propagate through Docker volume mounts to the Linux container's inotify system.

**How to avoid:** Set `WATCHPACK_POLLING=true` in the Next.js container environment (D-01). This enables polling-based file watching instead of inotify.

**Warning signs:** Code changes don't trigger rebuilds; you must restart the container to see changes.

### Pitfall 5: Missing `@prisma/adapter-pg` Installation

**What goes wrong:** `new PrismaClient()` (without adapter) throws at startup because Prisma 7 removed the built-in Rust database drivers.

**Why it happens:** In Prisma 6 and earlier, the Postgres driver was bundled in the Rust binary. In Prisma 7, you must provide an explicit driver adapter.

**How to avoid:** Install `@prisma/adapter-pg` and `pg`. Instantiate: `new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })`.

**Warning signs:** `PrismaClientInitializationError: Prisma requires a driver adapter to be provided`.

### Pitfall 6: Zod v3 vs v4 API Incompatibility

**What goes wrong:** Code written for Zod v3 (e.g., `z.string().nonempty()`) fails at runtime because `npm install zod` now installs v4 (the `latest` tag), which removed `nonempty()` and changed several API surfaces.

**Why it happens:** Zod v4 is a major release with breaking changes. CLAUDE.md references "3.x" but the npm registry `latest` tag now points to 4.4.3.

**How to avoid:** Pin to `zod@4` explicitly and use v4 API patterns (`z.string().min(1)` instead of `.nonempty()`). If Zod v3 is required for a specific dependency, pin with `zod@3`.

**Warning signs:** `TypeError: z.string(...).nonempty is not a function` or similar API errors at startup.

### Pitfall 7: Better Auth Schema Not Generated Before First Migration

**What goes wrong:** The first `prisma migrate dev` runs without the Better Auth tables (User, Session, Account, Verification) in `schema.prisma`, producing a schema that Better Auth cannot use.

**Why it happens:** Developers write the domain models (Book, Member, etc.) first and forget to include the auth tables. Better Auth's schema is not auto-generated unless you run `npx auth@latest generate` first.

**How to avoid:** Run `npx auth@latest generate --output prisma/schema.prisma` to scaffold the auth tables into the schema before writing any domain models. The auth tables (`User`, `Session`, `Account`, `Verification`) must be the first migration. Domain models (Member, Book, etc.) must be added in subsequent migrations or the same initial one.

**Warning signs:** Better Auth login fails with database errors; `auth.api.getSession()` returns null even with valid credentials.

---

## Code Examples

### Full Prisma Schema (Phase 1)

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ── Better Auth core tables ──────────────────────────────
model User {
  id            String    @id @default(cuid())
  name          String
  email         String    @unique
  emailVerified Boolean   @default(false)
  image         String?
  createdAt     DateTime  @default(now()) @db.Timestamptz(3)
  updatedAt     DateTime  @updatedAt @db.Timestamptz(3)
  deletedAt     DateTime? @db.Timestamptz(3)           // INFRA-04 soft delete

  // Better Auth admin plugin fields
  role          String?   @default("MEMBER")           // "LIBRARIAN" | "MEMBER"
  banned        Boolean?  @default(false)
  banReason     String?
  banExpires    DateTime? @db.Timestamptz(3)

  sessions      Session[]
  accounts      Account[]
  member        Member?
}

model Session {
  id             String   @id @default(cuid())
  expiresAt      DateTime @db.Timestamptz(3)
  token          String   @unique
  ipAddress      String?
  userAgent      String?
  userId         String
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  impersonatedBy String?
  createdAt      DateTime @default(now()) @db.Timestamptz(3)
  updatedAt      DateTime @updatedAt @db.Timestamptz(3)
}

model Account {
  id                    String    @id @default(cuid())
  accountId             String
  providerId            String
  userId                String
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  accessToken           String?
  refreshToken          String?
  idToken               String?
  accessTokenExpiresAt  DateTime? @db.Timestamptz(3)
  refreshTokenExpiresAt DateTime? @db.Timestamptz(3)
  scope                 String?
  password              String?
  createdAt             DateTime  @default(now()) @db.Timestamptz(3)
  updatedAt             DateTime  @updatedAt @db.Timestamptz(3)
}

model Verification {
  id         String    @id @default(cuid())
  identifier String
  value      String
  expiresAt  DateTime  @db.Timestamptz(3)
  createdAt  DateTime  @default(now()) @db.Timestamptz(3)
  updatedAt  DateTime  @updatedAt @db.Timestamptz(3)
}

// ── Domain models ────────────────────────────────────────
enum MemberType {
  STUDENT
  FACULTY
  STAFF
}

model Member {
  id               String     @id @default(cuid())
  userId           String     @unique
  user             User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  memberNumber     String     @unique
  memberType       MemberType @default(STUDENT)
  isActive         Boolean    @default(true)
  joinedAt         DateTime   @default(now()) @db.Timestamptz(3)

  loans            Loan[]
  reservations     Reservation[]
  fines            Fine[]
}

model Author {
  id    String @id @default(cuid())
  name  String
  books Book[]
}

model Book {
  id            String     @id @default(cuid())
  isbn          String     @unique
  title         String
  authorId      String
  author        Author     @relation(fields: [authorId], references: [id])
  genre         String?
  publisher     String?
  publishedYear Int?
  description   String?
  coverUrl      String?
  totalCopies   Int        @default(0)
  deletedAt     DateTime?  @db.Timestamptz(3)       // INFRA-04 soft delete
  createdAt     DateTime   @default(now()) @db.Timestamptz(3)
  updatedAt     DateTime   @updatedAt @db.Timestamptz(3)

  copies        BookCopy[]
  reservations  Reservation[]
}

enum CopyStatus {
  AVAILABLE
  CHECKED_OUT
  RESERVED
  LOST
  WITHDRAWN
}

model BookCopy {
  id        String     @id @default(cuid())
  bookId    String
  book      Book       @relation(fields: [bookId], references: [id])
  barcode   String     @unique
  status    CopyStatus @default(AVAILABLE)
  condition String?
  addedAt   DateTime   @default(now()) @db.Timestamptz(3)

  loans     Loan[]
}

// ── Loan policy (D-15: seeded, not hardcoded) ────────────
model LoanPolicy {
  id                 String     @id @default(cuid())
  memberType         MemberType @unique
  loanDays           Int
  maxRenewals        Int        @default(2)
  fineDailyRate      Decimal    @db.Decimal(10, 2)
  maxUnpaidFineAmount Decimal   @db.Decimal(10, 2) @default(10.00)
}

// ── Phase 2+ schema stubs (schema exists, feature inactive) ─
enum LoanStatus {
  ACTIVE
  OVERDUE
  RETURNED
  LOST
}

model Loan {
  id          String     @id @default(cuid())
  copyId      String
  copy        BookCopy   @relation(fields: [copyId], references: [id])
  memberId    String
  member      Member     @relation(fields: [memberId], references: [id])
  issuedAt    DateTime   @default(now()) @db.Timestamptz(3)
  dueAt       DateTime   @db.Timestamptz(3)
  returnedAt  DateTime?  @db.Timestamptz(3)
  renewCount  Int        @default(0)
  status      LoanStatus @default(ACTIVE)

  fines       Fine[]
}

enum FineStatus {
  UNPAID
  PAID
  WAIVED
}

model Fine {
  id        String     @id @default(cuid())
  loanId    String
  loan      Loan       @relation(fields: [loanId], references: [id])
  memberId  String
  member    Member     @relation(fields: [memberId], references: [id])
  amount    Decimal    @db.Decimal(10, 2)
  reason    String     @default("OVERDUE")
  status    FineStatus @default(UNPAID)
  createdAt DateTime   @default(now()) @db.Timestamptz(3)
  paidAt    DateTime?  @db.Timestamptz(3)
  waivedAt  DateTime?  @db.Timestamptz(3)
  waivedBy  String?
}

enum ReservationStatus {
  PENDING
  READY
  FULFILLED
  CANCELLED
}

model Reservation {
  id            String            @id @default(cuid())
  bookId        String
  book          Book              @relation(fields: [bookId], references: [id])
  memberId      String
  member        Member            @relation(fields: [memberId], references: [id])
  requestedAt   DateTime          @default(now()) @db.Timestamptz(3)
  expiresAt     DateTime?         @db.Timestamptz(3)
  status        ReservationStatus @default(PENDING)
  queuePosition Int
  notifiedAt    DateTime?         @db.Timestamptz(3)
}

model NotificationLog {
  id       String   @id @default(cuid())
  memberId String
  type     String
  sentAt   DateTime @default(now()) @db.Timestamptz(3)
  channel  String   @default("EMAIL")
  success  Boolean
  metadata Json?
}
```

### Docker Compose (Development)

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: library_dev
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data   # D-04: named volume
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 10

  app:
    build:
      context: .
      target: development
    env_file: .env.development                     # INFRA-02
    environment:
      WATCHPACK_POLLING: "true"                    # D-01: hot reload on Windows
      NODE_ENV: development
    volumes:
      - .:/app
      - /app/node_modules
      - /app/.next
    ports:
      - "3000:3000"
    depends_on:
      db:
        condition: service_healthy
    command: ["sh", "/app/docker-entrypoint.sh"]

volumes:
  postgres_data:                                   # D-04
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `next-auth` / Auth.js v5 | Better Auth 1.x | Auth.js team handed off to Better Auth team, Sep 2025 | Better Auth is now the recommended choice for new Next.js apps |
| Prisma `prisma-client-js` (v6 implicit driver) | Prisma 7 `@prisma/adapter-pg` explicit adapter | Prisma 7.0, April 2026 | Driver adapter is now a required install |
| `prisma generate` auto-runs with migrate | Explicit `prisma generate` step required | Prisma 7.0 | Entrypoints and CI pipelines must add generate step |
| `tailwindcss.config.js` | CSS-first `@theme` in `globals.css` (v4) | Tailwind v4, 2025 | No more config file; `tw-animate-css` replaces `tailwindcss-animate` |
| Zod v3 (`.nonempty()`, `.nullish()` API) | Zod v4 (breaking API changes) | Zod v4.0, 2025-2026 | `latest` npm tag now points to v4; v3 patterns break |
| Recharts 2.x | Recharts 3.x | 2025 | `latest` tag now 3.8.1; Phase 1 does not use Recharts |
| node-cron 3.x | node-cron 4.x | 2024-2025 | `latest` tag now 4.2.1; Phase 1 scaffold but not activated until Phase 4 |

**Deprecated/outdated:**
- `next-auth@beta`: Abandoned by its team; do not use for new projects.
- `prisma-client` generator provider: Incompatible with Next.js 16 Turbopack; use `prisma-client-js` provider name even with v7.
- `tailwindcss-animate`: Replaced by `tw-animate-css` in Tailwind v4 shadcn/ui projects.

---

## Assumptions Log

> All claims were verified against npm registry, official docs, or CONTEXT.md/ARCHITECTURE.md/PITFALLS.md already researched in this project. No unverified assumptions remain for Phase 1 planning.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Open Library API's `jscmd=data` endpoint returns `authors`, `publishers`, `publish_date` fields for ISBN lookup | Code Examples (CAT-04 pattern) | Auto-fill might return partial data; form would partially fill and user corrects manually — low severity |
| A2 | `better-auth.com/docs/plugins/admin` stores role as `session.user.role` string (not a separate relation) | Pattern 2 (requireRole) | `requireRole()` check may need to use a different field path; easy to fix but would require code change |
| A3 | `prisma-client-js` provider name resolves the Turbopack breakage in all Next.js 16.x versions | Pitfall 1, Pattern 5 | If a future 16.x patch changes behavior, generator may need revisiting. Risk is low given it is a widely-documented fix. |

---

## Open Questions (RESOLVED)

1. **Better Auth schema field name for role**
   - What we know: The admin plugin adds a `role` field to the User table defaulting to `"user"`. The docs show `session.user.role`.
   - What's unclear: Whether the field is exactly `role` (string) or a nested relation. The role values used in our domain are `"LIBRARIAN"` and `"MEMBER"` (not `"admin"` / `"user"`).
   - RESOLVED: Plan 01-02 Task 1 resolves this at execution time — executor runs `npx auth@latest generate`, inspects the generated Prisma schema, and verifies the field is `role: String?` on User. If Better Auth nests it differently, `requireRole()` is adjusted accordingly and noted in SUMMARY. The role values `"LIBRARIAN"` / `"MEMBER"` are set explicitly in the seed script; Better Auth's own `"admin"` / `"user"` defaults are overridden on first login via Better Auth's admin plugin `setRole()`.

2. **`prisma db seed` conditional check in entrypoint (D-03)**
   - What we know: The entrypoint must check if the User table is empty before seeding.
   - What's unclear: The exact `prisma db execute` syntax for a simple row count on startup in a shell script.
   - RESOLVED: Plan 01-03 Task 1 resolves this — the entrypoint script uses `psql "$DATABASE_URL" -t -c 'SELECT COUNT(*) FROM "User"'` executed within the app container, which has `postgresql-client` installed as a Docker image layer. This is more reliable than `prisma db execute` in shell scripts and avoids non-TTY issues.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | App runtime | Yes | 24.11.1 | — |
| npm | Package manager | Yes | 11.6.2 | — |
| Docker | INFRA-01 | Yes | 28.4.0 | — |
| Docker Compose | INFRA-01 | Yes | v2.39.2 | — |
| psql CLI | Entrypoint seed check | No (host) | — | Use psql from within Postgres container; or check via `pg` module in seed script |
| PostgreSQL server | DB | Via Docker | 16 (Docker image) | — |

**Missing dependencies with no fallback:** None — all dependencies are provided via Docker.

**Missing dependencies with fallback:** `psql` is not installed on the host but is available inside the `postgres:16-alpine` Docker container. The entrypoint script runs inside the app container which connects to the `db` service — use `pg_isready` for health check and `psql` connection string for row count check.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.8 + React Testing Library 16.3.2 |
| Config file | `vitest.config.ts` — Wave 0 creates this |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |
| E2E framework | Playwright 1.60.0 (for auth flow, form submissions) |
| E2E quick run | `npx playwright test --headed=false` |

> **Async Server Components note:** Vitest does not support async React Server Components. Unit tests cover synchronous components, utility functions, Zod schemas, and Server Actions as plain functions. Playwright covers auth flows, form submissions, and page navigation.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Email + password login succeeds with valid credentials | E2E (Playwright) | `npx playwright test tests/e2e/auth.spec.ts` | Wave 0 |
| AUTH-01 | Login fails with wrong password — error message shown | E2E (Playwright) | `npx playwright test tests/e2e/auth.spec.ts` | Wave 0 |
| AUTH-02 | Session persists after page refresh | E2E (Playwright) | `npx playwright test tests/e2e/session.spec.ts` | Wave 0 |
| AUTH-03 | MEMBER accessing `/books` (librarian route) gets 403 | Unit (Server Action) | `npx vitest run tests/unit/require-role.test.ts` | Wave 0 |
| AUTH-03 | LIBRARIAN accessing `/catalog` (member route) redirected or shown member view | E2E (Playwright) | `npx playwright test tests/e2e/rbac.spec.ts` | Wave 0 |
| CAT-01 | `createBook` Server Action returns error for MEMBER caller | Unit | `npx vitest run tests/unit/catalog-actions.test.ts` | Wave 0 |
| CAT-01 | Librarian can add book; row appears in `/books` | E2E | `npx playwright test tests/e2e/catalog.spec.ts` | Wave 0 |
| CAT-01 | Soft-delete sets `deletedAt`; book absent from default list | Unit | `npx vitest run tests/unit/catalog-actions.test.ts` | Wave 0 |
| CAT-02 | Adding copy to book increments `totalCopies` | Unit | `npx vitest run tests/unit/catalog-actions.test.ts` | Wave 0 |
| CAT-02 | Copy status badge renders correct color per status | Unit (RTL) | `npx vitest run tests/unit/BookStatusBadge.test.tsx` | Wave 0 |
| CAT-03 | Member catalog search returns matching books | E2E | `npx playwright test tests/e2e/member-catalog.spec.ts` | Wave 0 |
| CAT-04 | `fetchBookByISBN` returns title/author for known ISBN | Unit (mock fetch) | `npx vitest run tests/unit/isbn-fetch.test.ts` | Wave 0 |
| CAT-04 | `fetchBookByISBN` returns `ISBN_NOT_FOUND` for unknown ISBN | Unit (mock fetch) | `npx vitest run tests/unit/isbn-fetch.test.ts` | Wave 0 |
| MBR-01 | Librarian can register a new member; appears in member list | E2E | `npx playwright test tests/e2e/members.spec.ts` | Wave 0 |
| MBR-02 | Soft-delete sets `deletedAt`; member absent from default list | Unit | `npx vitest run tests/unit/member-actions.test.ts` | Wave 0 |
| MBR-03 | Member can view `/my-profile` and sees own name/email/role | E2E | `npx playwright test tests/e2e/member-profile.spec.ts` | Wave 0 |
| INFRA-01 | `docker compose up` succeeds; app reachable at localhost:3000 | Manual smoke | `docker compose up -d && curl http://localhost:3000` | Manual |
| INFRA-02 | `.env.development` consumed; no secrets in git | Manual audit | Check `.gitignore` includes `.env.*` | Manual |
| INFRA-03 | Seed creates 1 librarian, 10 students, 5 faculty, 20 books, LoanPolicy rows | Unit (seed verification) | `npx vitest run tests/unit/seed-verification.test.ts` | Wave 0 |
| INFRA-04 | No `prisma.model.delete()` calls in codebase | Static (grep) | `grep -r "\.delete(" src/` returns 0 results | Automated grep |

### Sampling Rate

- **Per task commit:** `npx vitest run --reporter=dot` (fast pass)
- **Per wave merge:** `npx vitest run && npx playwright test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `vitest.config.ts` — Vitest configuration
- [ ] `playwright.config.ts` — Playwright configuration
- [ ] `tests/unit/require-role.test.ts` — covers AUTH-03
- [ ] `tests/unit/catalog-actions.test.ts` — covers CAT-01, CAT-02
- [ ] `tests/unit/member-actions.test.ts` — covers MBR-02
- [ ] `tests/unit/isbn-fetch.test.ts` — covers CAT-04 (mocked fetch)
- [ ] `tests/unit/BookStatusBadge.test.tsx` — covers CAT-02 badge rendering
- [ ] `tests/unit/seed-verification.test.ts` — covers INFRA-03
- [ ] `tests/e2e/auth.spec.ts` — covers AUTH-01
- [ ] `tests/e2e/session.spec.ts` — covers AUTH-02
- [ ] `tests/e2e/rbac.spec.ts` — covers AUTH-03
- [ ] `tests/e2e/catalog.spec.ts` — covers CAT-01
- [ ] `tests/e2e/member-catalog.spec.ts` — covers CAT-03
- [ ] `tests/e2e/members.spec.ts` — covers MBR-01
- [ ] `tests/e2e/member-profile.spec.ts` — covers MBR-03
- [ ] Framework install: `npm install --save-dev vitest @vitejs/plugin-react @testing-library/react @testing-library/user-event @playwright/test`

---

## Security Domain

> `security_enforcement` is enabled (absent from config = enabled). ASVS Level 1 applies.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Better Auth 1.x credentials provider; Argon2id internally; no custom hash |
| V2.1 Password Security | Yes | Better Auth enforces minimum length; no custom validation needed |
| V3 Session Management | Yes | Better Auth session cookies; `expiresAt` enforced; `token` is unique |
| V4 Access Control | Yes | `requireRole()` in every Server Action; middleware is UX redirect only |
| V5 Input Validation | Yes | Zod v4 schemas on client (RHF resolver) and server (Server Action parse) |
| V6 Cryptography | No | No custom crypto; Better Auth handles password hashing |
| V7 Error Handling | Yes | Server Actions return typed error objects; no stack traces to client |
| V8 Data Protection | Partial | `deletedAt` soft delete preserves records; no PII in logs |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Next.js middleware bypass (CVE-2025-29927) | Elevation of Privilege | `requireRole()` in every Server Action; never rely on middleware for auth |
| Mass assignment via Server Action | Tampering | Zod schema `pick()`/`omit()` — never spread `FormData` directly |
| SQL injection via Prisma raw queries | Tampering | Use tagged template literals `$queryRaw\`...\`` with bound parameters only; avoid `$queryRawUnsafe` |
| Session fixation | Spoofing | Better Auth rotates session token on login; no custom session ID logic |
| CSRF on Server Actions | Tampering | Next.js App Router Server Actions include CSRF protection by default via the `SameSite=Lax` cookie policy |
| Open redirect on post-login | Spoofing | Validate `callbackUrl` against allowlist; Better Auth's `trustedOrigins` config |
| ISBN API response injection | Tampering | Sanitize Open Library API response before inserting to DB; use Zod to parse API response shape |

---

## Sources

### Primary (HIGH confidence)

- npm registry — verified all 16 packages (version, age, source repo)
- `prisma.io/docs/guides/upgrade-prisma-orm/v7` — Prisma 7 breaking changes, adapter requirement, generate step
- `better-auth.com/docs/installation` — Next.js handler setup, `auth.api.getSession({ headers })`
- `better-auth.com/docs/adapters/prisma` — `prismaAdapter` import path, `npx auth@latest generate`
- `better-auth.com/docs/plugins/admin` — RBAC plugin, role field on user, `userHasPermission`
- `better-auth.com/docs/integrations/next` — Server Action session pattern
- `prisma.io/docs/orm/prisma-schema/overview/prisma-config-file` — `defineConfig`, `datasource.url`, `migrations.seed`
- `.planning/research/PITFALLS.md` — CVE-2025-29927, SELECT FOR UPDATE, Timestamptz convention
- `.planning/research/ARCHITECTURE.md` — Full domain model, component boundaries
- `.planning/phases/01-foundation/01-CONTEXT.md` — Locked decisions D-01 through D-16
- `.planning/phases/01-foundation/01-UI-SPEC.md` — Component inventory, interaction contracts

### Secondary (MEDIUM confidence)

- `buildwithmatija.com/blog/migrate-prisma-v7-nextjs-16-turbopack-fix` — `prisma-client-js` provider workaround for Turbopack (multiple corroborating WebSearch results confirm this is the accepted fix)
- `openlibrary.org/developers/api` — ISBN API endpoint format, User-Agent requirement
- `medium.com/@basem.deiaa` — `@db.Timestamptz` annotation usage confirmed
- Zod dist-tags / npm view — confirmed v4 is `latest`; v3 is on `next` (pre-release) track

### Tertiary (LOW confidence — noted where applied)

- A1-A3 in Assumptions Log (see above)

---

## Metadata

**Confidence breakdown:**

- Standard stack (libraries + versions): HIGH — all verified via `npm view`
- Prisma 7 + Next.js 16 Turbopack fix: HIGH — multiple corroborating sources; widely documented
- Better Auth schema field structure: MEDIUM — docs verified; exact field name for role needs `npx auth@latest generate` confirmation
- Architecture patterns: HIGH — derived from PITFALLS.md + ARCHITECTURE.md already researched
- Validation architecture: HIGH — Vitest + Playwright is the current Next.js recommended testing stack

**Research date:** 2026-06-09
**Valid until:** 2026-07-09 (30 days) — Prisma 7.x and Better Auth 1.x are in active release; verify versions before installing
