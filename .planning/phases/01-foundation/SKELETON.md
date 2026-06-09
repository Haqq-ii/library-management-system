# Phase 1 — Walking Skeleton

> The thinnest possible end-to-end vertical slice that proves the entire stack works:
> `docker compose up` → seeded Postgres → Better Auth login → authenticated app shell.
> Architectural decisions recorded here are LOCKED for all subsequent phases — they are
> not renegotiated downstream.

**Created:** 2026-06-09
**Phase:** 1 — Foundation
**Status:** Architectural contract for Walking Skeleton (Wave 1–3)

---

## What the Skeleton Proves

A developer with Docker installed runs `docker compose up` and, with zero manual database
setup, reaches a working login page at `http://localhost:3000`. They log in as the seeded
librarian (`librarian@library.test`) and land on an authenticated dashboard rendered behind
a role-aware sidebar. This exercises every layer once:

| Layer | Skeleton exercise |
|-------|-------------------|
| Container orchestration | `docker compose up` brings up Postgres + Next.js app |
| DB migration | Entrypoint runs `prisma generate` → `prisma migrate deploy` |
| DB seed (real write) | Entrypoint seeds 1 librarian + LoanPolicy on empty DB (D-03) |
| Auth (real read/write) | Better Auth validates credentials against seeded `User` row |
| Server-side guard | `(app)/layout.tsx` calls `auth.api.getSession()`; redirects when absent |
| UI interaction | Login form (`LoginCard`) submits via `authClient.signIn.email()` |
| Routing | Authenticated user lands on `/dashboard` behind `AppSidebar` |

---

## Locked Architectural Decisions

These decisions are established by the skeleton and inherited by Phases 2–5 without change.

### Framework & Runtime

| Decision | Value | Source |
|----------|-------|--------|
| Framework | Next.js 16.2.7 (App Router, Turbopack) | RESEARCH.md Standard Stack |
| Runtime | Node.js 24 (alpine in Docker) | RESEARCH.md Environment Availability |
| Language | TypeScript 5.x, strict mode | CLAUDE.md |
| React | 19.2.7 (Server Components default) | RESEARCH.md |

### Database & ORM

| Decision | Value | Rationale |
|----------|-------|-----------|
| Database | PostgreSQL 16 (`postgres:16-alpine`) | CLAUDE.md; relational domain |
| ORM | Prisma 7.8.0 | CLAUDE.md |
| Generator provider | `prisma-client-js` (NOT `prisma-client`) | RESEARCH.md Pitfall 1 — Turbopack breakage |
| Client output path | `../src/generated/prisma` | RESEARCH.md Pattern 5 |
| Driver adapter | `@prisma/adapter-pg` + `pg` (`PrismaPg`) | RESEARCH.md Pitfall 5 — required in v7 |
| Client access | Singleton via `globalThis` in `src/lib/db.ts` | RESEARCH.md Pattern 1 |
| Timestamp convention | Every `DateTime` column uses `@db.Timestamptz(3)`; logic in UTC | STATE.md decision; RESEARCH.md Pattern 4 |
| Config file | `prisma/prisma.config.ts` with `import "dotenv/config"` first line | RESEARCH.md Pattern 5 |
| Migration strategy | `prisma migrate deploy` at container startup (D-02) | CONTEXT.md D-02 |
| Generate ordering | `prisma generate` BEFORE `migrate deploy` (v7 decoupled) | RESEARCH.md Pitfall 2 |

### Schema Shape (LOCKED — Book/BookCopy split cannot be retrofitted)

The full v1 schema (all Phase 1–5 models) is created in the first migration. Phase 1
populates Better Auth tables, `Member`, `Author`, `Book`, `BookCopy`, `LoanPolicy`. The
`Loan`, `Fine`, `Reservation`, `NotificationLog` models exist as schema stubs (tables created,
features inactive until later phases).

- `Book` (title-level metadata) is split from `BookCopy` (physical copies with `CopyStatus`).
  This split is locked in the first migration and is a foreign-key root for Phases 2–5.
- `User.deletedAt` and `Book.deletedAt` are the soft-delete columns (INFRA-04). No hard deletes.
- `LoanPolicy` is a seeded DB table (D-15), one row per `MemberType`, NOT env vars or constants.

### Authentication

| Decision | Value | Rationale |
|----------|-------|-----------|
| Auth library | Better Auth 1.6.15 | CLAUDE.md; Auth.js v5 still beta |
| Plugin | `admin` plugin (adds `role`, `banned`, `banReason`, `banExpires` to User) | RESEARCH.md Pattern 3 |
| Role field | `User.role` string: `"LIBRARIAN"` \| `"MEMBER"` (default `"MEMBER"`) | RESEARCH.md Open Q1 |
| Password hashing | Argon2id (Better Auth internal — no custom hash) | RESEARCH.md Don't Hand-Roll |
| Handler mount | `src/app/api/auth/[...all]/route.ts` via `toNextJsHandler(auth)` | RESEARCH.md Pattern 3 |
| Session retrieval | `auth.api.getSession({ headers: await headers() })` | RESEARCH.md Pattern 2 |
| **Security boundary** | `requireRole()` first line of EVERY Server Action; middleware is UX-only (CVE-2025-29927) | STATE.md decision; RESEARCH.md Pitfall 3 |
| Trusted origins | `trustedOrigins: [process.env.BETTER_AUTH_URL]` (open-redirect guard) | RESEARCH.md Security Domain |

### Directory Layout (LOCKED)

```
library-management-system/
├── prisma/
│   ├── schema.prisma            # Full v1 schema (Phase 1–5 models)
│   ├── prisma.config.ts         # Prisma 7 defineConfig + seed entry
│   ├── migrations/              # Generated migration files
│   └── seed.ts                  # Seed (tsx); empty-DB guarded by entrypoint
├── src/
│   ├── app/
│   │   ├── (auth)/login/page.tsx
│   │   ├── (app)/layout.tsx     # Session-gated shell + AppSidebar
│   │   ├── (app)/dashboard/page.tsx
│   │   ├── (app)/books/page.tsx
│   │   ├── (app)/books/[id]/page.tsx
│   │   ├── (app)/members/page.tsx
│   │   ├── (app)/catalog/page.tsx
│   │   ├── (app)/my-loans/page.tsx
│   │   ├── (app)/my-profile/page.tsx
│   │   ├── api/auth/[...all]/route.ts
│   │   ├── globals.css          # Tailwind v4 @theme (CSS-first; no tailwind.config.js)
│   │   └── layout.tsx           # Root layout (+ Sonner Toaster, skip-link)
│   ├── components/
│   │   ├── ui/                  # shadcn/ui generated source (owned)
│   │   └── layout/AppSidebar.tsx
│   ├── features/
│   │   ├── auth/LoginCard.tsx
│   │   ├── catalog/{CatalogTable,CopiesSubTable,BookCard,BookFormSheet,BookStatusBadge}.tsx + actions.ts
│   │   ├── members/{MemberTable,MemberFormSheet}.tsx + actions.ts
│   │   └── dashboard/DashboardStats.tsx
│   └── lib/{db,auth,auth-client,require-role}.ts
├── tests/{unit,e2e}/
├── Dockerfile                   # Multi-stage; development target
├── docker-compose.yml           # app + db; named volume; WATCHPACK_POLLING
├── docker-entrypoint.sh         # health → generate → migrate → conditional seed → start
├── .env.development / .env.staging / .env.production
├── next.config.ts
├── vitest.config.ts
└── playwright.config.ts
```

### Local Dev & Deployment

| Decision | Value | Source |
|----------|-------|--------|
| Local dev | Docker-first from first commit (`docker compose up`) | CLAUDE.md; INFRA-01 |
| Hot reload | Volume mount + `WATCHPACK_POLLING=true` (Windows/WSL2 inotify fix) | D-01 |
| Postgres persistence | Named Docker volume `postgres_data` (not bind mount) | D-04 |
| Seed guard | Entrypoint seeds only when `User` table empty (psql row count) | D-03 |
| Env config split | `.env.development` / `.env.staging` / `.env.production`; `.env.*` gitignored | INFRA-02 |
| Production target | Containerized; Railway (persistent node-cron for Phase 4) | CLAUDE.md |
| Build seed runner | `tsx prisma/seed.ts` | RESEARCH.md |

### UI System

| Decision | Value | Source |
|----------|-------|--------|
| Component system | shadcn/ui (CLI-copied source in `src/components/ui/`) | UI-SPEC.md |
| Styling | Tailwind v4 CSS-first (`@theme` in `globals.css`); `tw-animate-css` | PATTERNS.md |
| Palette | shadcn default slate/neutral | UI-SPEC.md (D discretion) |
| Icons | lucide-react | UI-SPEC.md |
| Toasts | sonner | UI-SPEC.md |
| Forms | react-hook-form + Zod v4 (`@hookform/resolvers` v5) | RESEARCH.md |
| Typography | 4 sizes (14/14/20/24px), 2 weights (400/600) | UI-SPEC.md |

---

## Skeleton Build Order (Wave 1 → Wave 3)

1. **Wave 1 (Plan 01):** `create-next-app` scaffold → `shadcn init` → install packages →
   `npx auth@latest generate` (auth tables FIRST per Pitfall 7) → full `schema.prisma` →
   `prisma.config.ts` → test harness configs → **[BLOCKING] `prisma migrate dev --name init`**.
2. **Wave 2 (Plan 02):** `db.ts` → `auth.ts` → `auth-client.ts` → `require-role.ts` →
   Better Auth route handler → `seed.ts` (librarian + LoanPolicy + members + books).
3. **Wave 3 (Plan 03):** Dockerfile + docker-compose + entrypoint + `.env.*`;
   **[BLOCKING] `docker compose up` smoke** proving login page reachable.
4. **Wave 3 (Plan 04):** Root layout + `globals.css` + `LoginCard` + `(app)/layout.tsx` +
   `AppSidebar` + dashboard — completes the clickable skeleton.

After Wave 3, the Walking Skeleton is provable: container up, login succeeds, dashboard renders.
Waves 4–5 (catalog, members, member-facing pages) build features on top of the proven skeleton.

---

## Skeleton Stop Line

The skeleton is complete and feature development may begin once ALL of these are TRUE:

- [ ] `docker compose up` starts Postgres + app with no manual steps
- [ ] Migrations applied automatically; `User`/`LoanPolicy` tables exist
- [ ] Seed ran on empty DB: 1 librarian + LoanPolicy rows present
- [ ] `http://localhost:3000` serves the login page (contains "Sign In")
- [ ] Seeded librarian logs in and reaches `/dashboard`
- [ ] `/dashboard` renders behind `AppSidebar`; unauthenticated request to `/dashboard` redirects to `/login`
- [ ] `requireRole()` exists and is the established guard pattern for all future Server Actions

---

*Skeleton contract created: 2026-06-09 — locked for Phases 2–5.*
