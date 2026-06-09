---
phase: 01-foundation
plan: "02"
subsystem: auth
tags: [better-auth, prisma, auth-guard, seed, rbac, argon2id]
dependency_graph:
  requires:
    - "01-01: Prisma schema, generated client, installed packages"
  provides:
    - "Prisma 7 singleton (src/lib/db.ts) — PrismaPg adapter + globalThis hot-reload guard"
    - "Better Auth server instance (src/lib/auth.ts) — credentials + admin RBAC plugin + trustedOrigins"
    - "Better Auth browser client (src/lib/auth-client.ts)"
    - "requireRole() server-side auth guard (src/lib/require-role.ts) — CVE-2025-29927 defense"
    - "Better Auth GET+POST catch-all route (src/app/api/auth/[...all]/route.ts)"
    - "Dev seed script (prisma/seed.ts) — 1 librarian, 10 students, 5 faculty, 20 books, LoanPolicy rows, Argon2id passwords"
  affects:
    - "All subsequent plans: every Server Action imports requireRole() from src/lib/require-role"
    - "Every DB access imports prisma from src/lib/db"
    - "Login flow uses auth instance from src/lib/auth"
    - "Auth route mounted at /api/auth/[...all]"
tech_stack:
  added: []
  patterns:
    - "Prisma 7 singleton with globalThis guard — prevents connection pool exhaustion on hot-reload"
    - "Better Auth prismaAdapter with admin plugin — role stored as string on session.user.role"
    - "requireRole() as first-line guard in every Server Action (CVE-2025-29927 mitigation)"
    - "Seed uses better-auth/crypto hashPassword (Argon2id) — no raw password strings in DB"
    - "Better Auth credential Account: providerId=credential, accountId=userId, password=hashedPw"
key_files:
  created:
    - "src/lib/db.ts — Prisma 7 singleton with PrismaPg adapter"
    - "src/lib/auth.ts — Better Auth server instance with admin plugin + trustedOrigins"
    - "src/lib/auth-client.ts — Better Auth browser client via createAuthClient"
    - "src/lib/require-role.ts — Server-side role guard (UNAUTHENTICATED/FORBIDDEN throws)"
    - "src/app/api/auth/[...all]/route.ts — Better Auth GET+POST handler via toNextJsHandler"
    - "prisma/seed.ts — Dev seed with LoanPolicy D-15/D-16 values, 16 users, 20 books"
  modified: []
decisions:
  - "Import path for PrismaClient is @/generated/prisma (output = ../src/generated/prisma in schema)"
  - "hashPassword imported from better-auth/crypto (the public export path, not the dist/ internal)"
  - "Seed creates users directly via Prisma + Account records — avoids HTTP context issues with auth.api.signUpEmail in non-server context"
  - "session.user.role confirmed as the correct field path for Better Auth admin plugin (RESEARCH.md Open Q1 resolved)"
metrics:
  completed_date: "2026-06-09"
  tasks_completed: 2
  tasks_total: 2
  files_created: 6
  files_modified: 0
---

# Phase 01 Plan 02: Core Auth + Seed Script Summary

Prisma 7 singleton, Better Auth instance with credentials + RBAC admin plugin, server-side `requireRole()` guard (CVE-2025-29927 defense), the Better Auth catch-all route handler, and a dev seed script seeding LoanPolicy defaults (D-15/D-16), 1 librarian, 10 students, 5 faculty, and 20 books via Argon2id-hashed passwords.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Core lib files + auth route | e092514 | src/lib/db.ts, src/lib/auth.ts, src/lib/auth-client.ts, src/lib/require-role.ts, src/app/api/auth/[...all]/route.ts |
| 2 | Seed script with LoanPolicy and realistic data | 5a37f8e | prisma/seed.ts |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] better-auth/dist/crypto is not a TypeScript module export path**
- **Found during:** Task 2 tsc verification
- **Issue:** The plan's PATTERNS.md example used `better-auth/dist/crypto` as the import path. TypeScript reports `Cannot find module 'better-auth/dist/crypto' or its corresponding type declarations` because dist/ internal paths are not in the package's `exports` map.
- **Fix:** Changed import to `better-auth/crypto` — this is the public export in the `exports` field of `better-auth/package.json` with proper `.d.mts` type declarations.
- **Files modified:** prisma/seed.ts
- **Commit:** 5a37f8e (fixed inline before commit)

**2. [Rule 2 - Missing critical functionality] Seed uses direct Prisma writes instead of auth.api.signUpEmail**
- **Found during:** Task 2 implementation
- **Issue:** `auth.api.signUpEmail` is designed for HTTP request contexts and requires `headers` with a valid host matching `trustedOrigins`. The seed script runs outside Next.js with no HTTP context and `BETTER_AUTH_URL` may not be set during CI/seed runs.
- **Fix:** Used `hashPassword` from `better-auth/crypto` to hash passwords with Argon2id, then created `User` + `Account` records directly in Prisma — exactly mirroring what `signUpEmail` does internally (confirmed by reading `better-auth/dist/api/routes/sign-up.mjs` source). No raw password strings in the DB. Credential account stored with `providerId: "credential"`.
- **Files modified:** prisma/seed.ts
- **Commit:** 5a37f8e

**3. [Rule 2 - Missing critical functionality] Prisma generate needed in worktree**
- **Found during:** Task 1 implementation start
- **Issue:** The `src/generated/prisma` directory is gitignored and was not present in the worktree (only in the main repo). All lib files that import from `@/generated/prisma` would fail to type-check.
- **Fix:** Ran `npx prisma generate` in the worktree to populate the generated client before writing any lib files.
- **Files modified:** N/A (generated directory, gitignored)

## Known Stubs

None. This plan creates infrastructure files (no UI components or data stubs).

## Threat Surface Scan

All files comply with the plan's threat model. No new security-relevant surface introduced beyond what the plan specifies:

| Control | File | Status |
|---------|------|--------|
| T-02-01: requireRole() CVE-2025-29927 guard | src/lib/require-role.ts | IMPLEMENTED — throws UNAUTHENTICATED and FORBIDDEN; unit test covers both paths |
| T-02-02: Session fixation | src/lib/auth.ts | MITIGATED — Better Auth handles session rotation; no custom session logic |
| T-02-03: Open redirect | src/lib/auth.ts | MITIGATED — trustedOrigins: [process.env.BETTER_AUTH_URL!] constrains callback origins |
| T-02-04: Seeded passwords | prisma/seed.ts | ACCEPTED — Password123! dev-only, documented in seed, never in production DB |
| T-02-05: Password hashing | prisma/seed.ts | MITIGATED — hashPassword from better-auth/crypto (Argon2id) used; no raw passwords |

## Self-Check: PASSED

- `src/lib/db.ts` contains `new PrismaPg(` and `globalForPrisma` — verified
- `src/lib/auth.ts` contains `betterAuth(`, `prismaAdapter(prisma`, `admin(`, `trustedOrigins` — verified
- `src/lib/require-role.ts` contains `throw new Error("UNAUTHENTICATED")`, `throw new Error("FORBIDDEN")`, `auth.api.getSession` — verified
- `src/lib/require-role.ts` exports `requireRole` and type `UserRole` — verified
- `src/app/api/auth/[...all]/route.ts` contains `toNextJsHandler(auth)` and exports `GET` and `POST` — verified
- `prisma/seed.ts` contains `loanPolicy.upsert` for both STUDENT and FACULTY — verified
- `prisma/seed.ts` has `loanDays: 14` (STUDENT), `loanDays: 30` (FACULTY), `fineDailyRate: 0.25` — verified
- `prisma/seed.ts` creates user with email `librarian@library.test` and role `"LIBRARIAN"` — verified
- `prisma/seed.ts` does NOT import bcrypt/argon directly; uses `better-auth/crypto` hashPassword — verified
- `prisma/seed.ts` has 20 book entries in BOOKS array — verified
- `prisma/seed.ts` contains `prisma.$disconnect()` — verified
- `npx vitest run tests/unit/require-role.test.ts` — 5/5 tests PASSED — verified
- `npx tsc --noEmit` exits 0 — verified
- Commits e092514, 5a37f8e present in git log — verified
