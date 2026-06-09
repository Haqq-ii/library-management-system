# Phase 1: Foundation - Pattern Map

**Mapped:** 2026-06-09
**Files analyzed:** 38 new files (greenfield — no existing codebase)
**Analogs found:** 0 / 38 (greenfield; all patterns sourced from RESEARCH.md)

> This is a greenfield project. No existing source files to map against. Every section
> below describes the pattern that MUST be established — it becomes the analog for all
> future phases.

---

## File Classification

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `prisma/schema.prisma` | config/schema | batch | none | no analog |
| `prisma/prisma.config.ts` | config | batch | none | no analog |
| `prisma/seed.ts` | utility | batch | none | no analog |
| `src/lib/db.ts` | utility | request-response | none | no analog |
| `src/lib/auth.ts` | utility | request-response | none | no analog |
| `src/lib/auth-client.ts` | utility | request-response | none | no analog |
| `src/lib/require-role.ts` | middleware | request-response | none | no analog |
| `src/app/api/auth/[...all]/route.ts` | route | request-response | none | no analog |
| `src/app/(auth)/login/page.tsx` | component | request-response | none | no analog |
| `src/app/(app)/layout.tsx` | component | request-response | none | no analog |
| `src/app/(app)/dashboard/page.tsx` | component | request-response | none | no analog |
| `src/app/(app)/books/page.tsx` | component | CRUD | none | no analog |
| `src/app/(app)/books/[id]/page.tsx` | component | CRUD | none | no analog |
| `src/app/(app)/members/page.tsx` | component | CRUD | none | no analog |
| `src/app/(app)/catalog/page.tsx` | component | request-response | none | no analog |
| `src/app/(app)/my-loans/page.tsx` | component | request-response | none | no analog |
| `src/app/(app)/my-profile/page.tsx` | component | request-response | none | no analog |
| `src/features/auth/LoginCard.tsx` | component | request-response | none | no analog |
| `src/features/catalog/CatalogTable.tsx` | component | CRUD | none | no analog |
| `src/features/catalog/CopiesSubTable.tsx` | component | CRUD | none | no analog |
| `src/features/catalog/BookCard.tsx` | component | request-response | none | no analog |
| `src/features/catalog/BookFormSheet.tsx` | component | CRUD | none | no analog |
| `src/features/catalog/BookStatusBadge.tsx` | component | request-response | none | no analog |
| `src/features/catalog/actions.ts` | service | CRUD | none | no analog |
| `src/features/members/MemberTable.tsx` | component | CRUD | none | no analog |
| `src/features/members/MemberFormSheet.tsx` | component | CRUD | none | no analog |
| `src/features/members/actions.ts` | service | CRUD | none | no analog |
| `src/features/dashboard/DashboardStats.tsx` | component | request-response | none | no analog |
| `src/components/layout/AppSidebar.tsx` | component | request-response | none | no analog |
| `src/app/globals.css` | config | — | none | no analog |
| `src/app/layout.tsx` | component | request-response | none | no analog |
| `next.config.ts` | config | — | none | no analog |
| `Dockerfile` | config | — | none | no analog |
| `docker-compose.yml` | config | — | none | no analog |
| `docker-entrypoint.sh` | utility | batch | none | no analog |
| `.env.development` | config | — | none | no analog |
| `.env.staging` | config | — | none | no analog |
| `.env.production` | config | — | none | no analog |

---

## Pattern Assignments

### `src/lib/db.ts` (utility, request-response)

**Pattern name:** Prisma 7 Singleton with PrismaPg Adapter
**Source:** RESEARCH.md — Pattern 1

**Critical constraint:** `globalThis` guard is mandatory. Without it, Next.js hot-reload creates a new
`PrismaClient` on every module refresh, exhausting the Postgres connection pool within minutes.

**Full implementation to copy:**

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

**Required packages:** `@prisma/client@7.8.0`, `@prisma/adapter-pg@7.8.0`, `pg@8.21.0`

**Anti-pattern:** `new PrismaClient()` without adapter throws `PrismaClientInitializationError:
Prisma requires a driver adapter to be provided` in Prisma 7.

---

### `src/lib/auth.ts` (utility, request-response)

**Pattern name:** Better Auth Server Instance
**Source:** RESEARCH.md — Pattern 3

**Full implementation to copy:**

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
    adminPlugin(), // Adds role, banned, banReason, banExpires to User
  ],
  trustedOrigins: [process.env.BETTER_AUTH_URL!],
});
```

**Open question (RESEARCH.md §Open Questions #1):** Better Auth admin plugin defaults role to
`"user"`, not `"MEMBER"`. After running `npx auth@latest generate`, inspect the generated schema
to confirm exact role field name and default value. Role strings in this project are `"LIBRARIAN"`
and `"MEMBER"` — seed script must set these explicitly.

---

### `src/lib/auth-client.ts` (utility, request-response)

**Pattern name:** Better Auth Browser Client

```typescript
// src/lib/auth-client.ts
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL!,
});
```

This is the client-side counterpart to `auth.ts`. Import `authClient` in Client Components
(e.g., `LoginCard.tsx`) for `signIn.email()`, `signOut()`, `useSession()`.

---

### `src/lib/require-role.ts` (middleware, request-response)

**Pattern name:** Server-side Auth Guard — Defense in Depth
**Source:** RESEARCH.md — Pattern 2, Pitfall 3 (CVE-2025-29927)

**Full implementation to copy:**

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
```

**Usage rule:** `await requireRole("LIBRARIAN")` or `await requireRole("MEMBER")` MUST be the
FIRST line of every Server Action and every Route Handler that touches protected data. Middleware
alone is insufficient (CVE-2025-29927 bypass via `x-middleware-subrequest` header).

---

### `src/app/api/auth/[...all]/route.ts` (route, request-response)

**Pattern name:** Better Auth Catch-All Handler
**Source:** RESEARCH.md — Pattern 3

```typescript
// src/app/api/auth/[...all]/route.ts
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
```

This is the only file that does NOT call `requireRole()` — Better Auth manages its own session
internally here.

---

### `src/features/catalog/actions.ts` (service, CRUD)

**Pattern name:** Server Action with requireRole + Zod + Prisma soft-delete
**Source:** RESEARCH.md — Pattern 2 (requireRole usage), Pattern 7 (ISBN fetch), Anti-Patterns

**Template pattern — every Server Action follows this shape:**

```typescript
"use server";

import { requireRole } from "@/lib/require-role";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { revalidatePath } from "next/cache";

// ── Zod schema (shared client + server) ──────────────────
const BookSchema = z.object({
  isbn: z.string().min(10).max(13),
  title: z.string().min(1),
  authorName: z.string().min(1),
  genre: z.string().optional(),
  publisher: z.string().optional(),
  publishedYear: z.number().int().optional(),
});

// ── Typed return shape (no raw Error objects to client) ──
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ── Mutation — LIBRARIAN only ─────────────────────────────
export async function createBook(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  await requireRole("LIBRARIAN"); // first line, always

  const parsed = BookSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: "INVALID_INPUT" };
  }

  try {
    // Upsert Author, then create Book
    const author = await prisma.author.upsert({
      where: { name: parsed.data.authorName },
      update: {},
      create: { name: parsed.data.authorName },
    });

    const book = await prisma.book.create({
      data: {
        isbn: parsed.data.isbn,
        title: parsed.data.title,
        authorId: author.id,
        genre: parsed.data.genre,
        publisher: parsed.data.publisher,
        publishedYear: parsed.data.publishedYear,
      },
    });

    revalidatePath("/books");
    return { success: true, data: { id: book.id } };
  } catch (err) {
    // No stack traces to client
    console.error("[createBook]", err);
    return { success: false, error: "DB_ERROR" };
  }
}

// ── Soft delete — NEVER prisma.book.delete() ─────────────
export async function softDeleteBook(
  id: string
): Promise<ActionResult<void>> {
  await requireRole("LIBRARIAN");

  await prisma.book.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/books");
  return { success: true, data: undefined };
}

// ── ISBN auto-fill (server-side to avoid CORS) ───────────
export async function fetchBookByISBN(
  isbn: string
): Promise<ActionResult<{ title: string | null; author: string | null; publisher: string | null; publishedYear: number | null }>> {
  await requireRole("LIBRARIAN");

  const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`;
  const res = await fetch(url, {
    headers: { "User-Agent": "LibraryManagementSystem/1.0 mydev.accout@gmail.com" },
    next: { revalidate: 86400 }, // 24h cache — book metadata is stable
  });

  if (!res.ok) return { success: false, error: "API_UNREACHABLE" };

  const data = await res.json();
  const key = `ISBN:${isbn}`;
  if (!data[key]) return { success: false, error: "ISBN_NOT_FOUND" };

  const book = data[key];
  return {
    success: true,
    data: {
      title: book.title ?? null,
      author: book.authors?.[0]?.name ?? null,
      publisher: book.publishers?.[0]?.name ?? null,
      publishedYear: book.publish_date ? parseInt(book.publish_date) : null,
    },
  };
}
```

**Rules derived from this pattern:**
- `"use server"` directive at file top
- `requireRole()` first line of every exported function
- Zod `safeParse` — never trust raw input
- Return typed `ActionResult<T>` — never throw to the client
- Soft delete = `prisma.model.update({ data: { deletedAt: new Date() } })` — NEVER `prisma.model.delete()`
- `revalidatePath()` after mutations
- Default queries filter `{ where: { deletedAt: null } }` everywhere

---

### `src/features/members/actions.ts` (service, CRUD)

**Pattern name:** Same Server Action shape as `catalog/actions.ts`

Copy the Server Action pattern above. Member-specific notes:
- `createMember` creates both `User` (Better Auth) and `Member` (library patron) records in a
  Prisma transaction: `prisma.$transaction([...])`
- `softDeleteMember` sets `deletedAt` on `User` (not `Member`) — `User.deletedAt` is the soft-delete
  field per the schema
- Role is set on `User.role` as the string `"MEMBER"` when registering a member

---

### `prisma/schema.prisma` (config/schema, batch)

**Pattern name:** Prisma 7 Schema with Timestamptz Convention
**Source:** RESEARCH.md — Pattern 4, Pattern 5, Code Examples (Full Prisma Schema)

**Generator block — use exactly this (not `prisma-client`):**

```prisma
generator client {
  provider = "prisma-client-js"   // NOT "prisma-client" — avoids Turbopack breakage
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

**Timestamp convention — every DateTime column:**

```prisma
createdAt  DateTime  @default(now()) @db.Timestamptz(3)
updatedAt  DateTime  @updatedAt      @db.Timestamptz(3)
deletedAt  DateTime?                 @db.Timestamptz(3)  // soft delete columns
dueAt      DateTime                  @db.Timestamptz(3)  // domain date columns
```

Plain `DateTime` without `@db.Timestamptz` maps to `timestamp without time zone` in Postgres,
causing timezone-dependent bugs in overdue detection. All date columns use `@db.Timestamptz(3)`.

**Full schema:** Use the complete schema from RESEARCH.md Code Examples section verbatim. It includes
all models for Phase 1 through 5 (Loan, Fine, Reservation stubs are created now, populated later).

**Pre-flight:** Before writing domain models, run `npx auth@latest generate --output prisma/schema.prisma`
to scaffold Better Auth tables (User, Session, Account, Verification) first (RESEARCH.md Pitfall 7).

---

### `prisma/prisma.config.ts` (config, batch)

**Pattern name:** Prisma 7 defineConfig
**Source:** RESEARCH.md — Pattern 5

```typescript
// prisma/prisma.config.ts
import "dotenv/config";  // REQUIRED — Prisma 7 does not auto-load .env
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

**`import "dotenv/config"` is mandatory** — Prisma 7 does not auto-load `.env`. Missing this line
causes `DATABASE_URL` to be undefined at CLI time.

---

### `prisma/seed.ts` (utility, batch)

**Pattern name:** Prisma seed with empty-DB guard and realistic volume

```typescript
// prisma/seed.ts
import { PrismaClient, MemberType } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // LoanPolicy (D-15, D-16)
  await prisma.loanPolicy.upsert({
    where: { memberType: MemberType.STUDENT },
    update: {},
    create: { memberType: MemberType.STUDENT, loanDays: 14, maxRenewals: 2, fineDailyRate: 0.25, maxUnpaidFineAmount: 10.00 },
  });
  await prisma.loanPolicy.upsert({
    where: { memberType: MemberType.FACULTY },
    update: {},
    create: { memberType: MemberType.FACULTY, loanDays: 30, maxRenewals: 4, fineDailyRate: 0.25, maxUnpaidFineAmount: 20.00 },
  });

  // 1 librarian account (via Better Auth hash — use Better Auth's createUser or hash manually)
  // 10 student accounts + Member rows
  // 5 faculty accounts + Member rows
  // 20 books with 1-3 copies each
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
```

**Note:** Better Auth manages password hashing (Argon2id). For seed data, call
`auth.api.createUser({ body: { email, password, name, role } })` or use Better Auth's
internal `hashPassword` export if available, rather than inserting raw passwords.
The exact seeding approach for Better Auth users should be confirmed when `npx auth@latest generate`
is run and the auth API surface is inspected.

**Volume requirement (INFRA-03):** 1 librarian, 10 students, 5 faculty, 20 books (1–3 copies each), 2 LoanPolicy rows.

---

### `docker-entrypoint.sh` (utility, batch)

**Pattern name:** Health check → generate → migrate → conditional seed → start
**Source:** RESEARCH.md — Pattern 6, Open Question #2

```sh
#!/bin/sh
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
# Use psql from within the app container (connect to db service)
USER_COUNT=$(psql "$DATABASE_URL" -t -c 'SELECT COUNT(*) FROM "User";' 2>/dev/null | tr -d ' ' || echo "0")
if [ "$USER_COUNT" = "0" ] || [ -z "$USER_COUNT" ]; then
  echo "Seeding database..."
  npx prisma db seed
fi

echo "Starting Next.js..."
exec npm run start
```

**Order matters:** `prisma generate` BEFORE `prisma migrate deploy`. Prisma 7 does not auto-generate
after migrate (Pitfall 2). Missing this step causes `PrismaClientInitializationError` on startup.

**psql for seed check:** More reliable than `prisma db execute` in shell context (Open Question #2).
The `psql` binary is available in the `postgres:16-alpine` image; the app container must have it
installed or use a pg-capable base image.

---

### `docker-compose.yml` (config, batch)

**Pattern name:** Named volume + health check + WATCHPACK_POLLING
**Source:** RESEARCH.md — Code Examples (Docker Compose)

Key constraints from decisions:
- `WATCHPACK_POLLING: "true"` — D-01, required for Windows/WSL2 hot reload
- `postgres_data:/var/lib/postgresql/data` named volume — D-04
- `depends_on: db: condition: service_healthy` — app waits for Postgres health check
- `env_file: .env.development` — D-02, INFRA-02

Full docker-compose template is in RESEARCH.md Code Examples. Copy it verbatim.

---

### `Dockerfile` (config, batch)

**Pattern name:** Multi-stage build with `development` target

```dockerfile
# Stage 1: deps
FROM node:24-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Stage 2: development (target used by docker-compose)
FROM node:24-alpine AS development
WORKDIR /app
# Install pg_isready and psql for entrypoint
RUN apk add --no-cache postgresql-client
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000

# Stage 3: builder (for production)
FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 4: production runner
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
EXPOSE 3000
CMD ["npm", "run", "start"]
```

**`postgresql-client` apk install** is required in the development stage so `pg_isready` and
`psql` are available for the entrypoint seed check.

---

### `src/app/(app)/layout.tsx` (component, request-response)

**Pattern name:** Protected App Shell with role-aware sidebar

```typescript
// src/app/(app)/layout.tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { AppSidebar } from "@/components/layout/AppSidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  return (
    <div className="flex h-screen">
      <AppSidebar role={session.user.role as "LIBRARIAN" | "MEMBER"} />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
```

**Note:** Layout redirect is UX convenience only. Server Actions still call `requireRole()` as
the security boundary (CVE-2025-29927 defense in depth).

---

### `src/components/layout/AppSidebar.tsx` (component, request-response)

**Pattern name:** Role-aware collapsible sidebar with shadcn/ui primitives

Key behaviors (D-05, D-06, D-07):
- Accepts `role: "LIBRARIAN" | "MEMBER"` prop
- Librarian nav: Dashboard, Books, Members, Loans (Loans shown but disabled/grayed in Phase 1)
- Member nav: Search Catalog, My Loans, My Reservations (disabled), My Profile
- Collapses to hamburger on mobile (shadcn/ui `Sheet` for mobile drawer)
- Uses `lucide-react` icons: `LayoutDashboard`, `BookOpen`, `Users`, `BookMarked`, `Search`, `User`

---

### `src/features/auth/LoginCard.tsx` (component, request-response)

**Pattern name:** Centered auth card with RHF + Zod + Better Auth client

Key behaviors (D-08):
- Centered card on plain background — no split layout
- `useForm` from `react-hook-form` with `zodResolver`
- `authClient.signIn.email({ email, password })` on submit
- `sonner` toast for error states
- Redirect to `/dashboard` (librarian) or `/catalog` (member) on success

```typescript
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

type LoginData = z.infer<typeof LoginSchema>;
```

---

### `src/features/catalog/BookFormSheet.tsx` (component, CRUD)

**Pattern name:** Slide-over sheet with RHF + Zod + Server Action + ISBN auto-fill

Key behaviors (D-12):
- shadcn/ui `Sheet` component (right-side drawer)
- Catalog table stays visible in background
- "Auto-fill" button calls `fetchBookByISBN` Server Action; populates fields via `setValue`
- Form fields: ISBN, title, author, genre, publisher, publishedYear
- On submit: calls `createBook` or `updateBook` Server Action
- `sonner` toast on success/error
- `revalidatePath` handled server-side in the action

```typescript
"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { fetchBookByISBN, createBook, updateBook } from "./actions";
import { toast } from "sonner";
```

---

### `src/features/catalog/BookStatusBadge.tsx` (component, request-response)

**Pattern name:** shadcn/ui Badge with CopyStatus color variants

```typescript
// src/features/catalog/BookStatusBadge.tsx
import { Badge } from "@/components/ui/badge";

type CopyStatus = "AVAILABLE" | "CHECKED_OUT" | "RESERVED" | "LOST" | "WITHDRAWN";

const variantMap: Record<CopyStatus, string> = {
  AVAILABLE:    "bg-green-100 text-green-800",
  CHECKED_OUT:  "bg-yellow-100 text-yellow-800",
  RESERVED:     "bg-blue-100 text-blue-800",
  LOST:         "bg-red-100 text-red-800",
  WITHDRAWN:    "bg-red-100 text-red-800",
};

export function BookStatusBadge({ status }: { status: CopyStatus }) {
  return (
    <Badge className={variantMap[status]}>
      {status.replace("_", " ")}
    </Badge>
  );
}
```

---

### `src/features/catalog/CatalogTable.tsx` (component, CRUD)

**Pattern name:** shadcn/ui Table with sortable columns and inline row actions (D-09)

Key behaviors:
- shadcn/ui `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell`
- Columns: title, author, ISBN, copy count, availability (available/total), actions
- Row actions via `DropdownMenu` (`...` button): Edit (opens `BookFormSheet`), Delete (opens confirm `Dialog`)
- "Show inactive" `Switch` toggles `deletedAt IS NULL` filter — calls Server Action to refetch
- Offset pagination: `page` and `pageSize` state, server-fetched data

---

### `src/features/catalog/CopiesSubTable.tsx` (component, CRUD)

**Pattern name:** Sub-table on `/books/[id]` detail page (D-10)

Key behaviors:
- Shows each `BookCopy` row: barcode, status badge, condition, addedAt
- Actions: change status, mark lost, mark withdrawn
- "Add Copy" button creates a new `BookCopy` via `addCopy` Server Action
- `BookStatusBadge` used for status column

---

### `src/features/catalog/BookCard.tsx` (component, request-response)

**Pattern name:** shadcn/ui Card for member catalog results (D-11)

Key behaviors:
- shadcn/ui `Card`, `CardHeader`, `CardContent`
- Displays: title, author, availability badge (X of Y available)
- "Reserve" button — disabled with tooltip "Coming in Phase 3" for now

---

### `src/features/members/MemberFormSheet.tsx` (component, CRUD)

**Pattern name:** Same slide-over pattern as `BookFormSheet.tsx` (D-13)

Fields: name, email, password (create only), role (STUDENT/FACULTY), status toggle.
Calls `createMember` or `updateMember` Server Action.

---

### `src/app/(app)/catalog/page.tsx` (component, request-response)

**Pattern name:** Member catalog with debounced search (D-11, CAT-03)

Key behaviors:
- Server Component for initial data load (first 20 books)
- Client Component for search input with debounce (300ms `setTimeout`)
- `BookCard` grid layout
- Search queries `Book` with `title` or `author.name` ILIKE via Server Action or Route Handler

---

### `src/app/globals.css` (config)

**Pattern name:** Tailwind v4 CSS-first config

```css
/* src/app/globals.css */
@import "tailwindcss";
@import "tw-animate-css";    /* replaces tailwindcss-animate in Tailwind v4 shadcn projects */

@custom-variant dark (&:is(.dark *));

@theme inline {
  /* shadcn/ui token overrides go here after `npx shadcn@latest init` */
}
```

**No `tailwind.config.js`** — Tailwind v4 is CSS-first. Configuration lives in `globals.css`
via `@theme` directive. `tw-animate-css` replaces `tailwindcss-animate`.

---

### Test files (`tests/unit/*.test.ts`, `tests/e2e/*.spec.ts`) (test, request-response)

**Pattern name:** Vitest (unit) + Playwright (E2E)
**Source:** RESEARCH.md — Validation Architecture

**Unit test template:**

```typescript
// tests/unit/require-role.test.ts
import { describe, it, expect, vi } from "vitest";

// Mock Better Auth and Next headers
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));
vi.mock("next/headers", () => ({
  headers: vi.fn(() => new Headers()),
}));

import { requireRole } from "@/lib/require-role";
import { auth } from "@/lib/auth";

describe("requireRole", () => {
  it("throws UNAUTHENTICATED when no session", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);
    await expect(requireRole("LIBRARIAN")).rejects.toThrow("UNAUTHENTICATED");
  });

  it("throws FORBIDDEN when wrong role", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { role: "MEMBER" },
    } as any);
    await expect(requireRole("LIBRARIAN")).rejects.toThrow("FORBIDDEN");
  });
});
```

**E2E test template:**

```typescript
// tests/e2e/auth.spec.ts
import { test, expect } from "@playwright/test";

test("librarian can log in", async ({ page }) => {
  await page.goto("/login");
  await page.fill('[name="email"]', "librarian@library.test");
  await page.fill('[name="password"]', "Password123!");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL("/dashboard");
});
```

**Test file to requirement mapping:** See RESEARCH.md Validation Architecture — Phase Requirements → Test Map table.

---

## Shared Patterns

### Shared Pattern 1: Auth Guard (all mutating Server Actions)

**Apply to:** All exported functions in `catalog/actions.ts`, `members/actions.ts`, and any future `*/actions.ts`

```typescript
// First line of every Server Action function body:
await requireRole("LIBRARIAN"); // or "MEMBER" for member-only actions
```

### Shared Pattern 2: Soft Delete (all domain mutations)

**Apply to:** All delete operations in all `actions.ts` files

```typescript
// CORRECT — soft delete
await prisma.book.update({ where: { id }, data: { deletedAt: new Date() } });

// FORBIDDEN — never use in this codebase
// await prisma.book.delete({ where: { id } });
```

### Shared Pattern 3: Default Query Filter (all list queries)

**Apply to:** All Prisma queries that list records

```typescript
// Books
await prisma.book.findMany({ where: { deletedAt: null } });

// Users/Members
await prisma.user.findMany({ where: { deletedAt: null } });
```

### Shared Pattern 4: ActionResult Return Type (all Server Actions)

**Apply to:** All Server Action return types

```typescript
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };
```

No raw `Error` objects, no stack traces, no internal error messages sent to client.

### Shared Pattern 5: Zod v4 Validation (all forms and actions)

**Apply to:** All form schemas and Server Action input validation

```typescript
import { z } from "zod";

// v4 API — min(1) instead of nonempty() (nonempty removed in v4)
const Schema = z.object({
  title: z.string().min(1),
  publishedYear: z.number().int().min(1000).max(9999).optional(),
});
```

**Use `zod@4` API.** `z.string().nonempty()` does not exist in Zod v4.

### Shared Pattern 6: Timestamp Convention (all Prisma models)

**Apply to:** Every `DateTime` field in `schema.prisma`

```prisma
fieldName  DateTime   @default(now()) @db.Timestamptz(3)
```

No plain `DateTime` without `@db.Timestamptz`. Plain DateTime = timezone-naive = overdue bugs.

### Shared Pattern 7: Toast Feedback (all Client Components with mutations)

**Apply to:** All form submission handlers

```typescript
import { toast } from "sonner";

const result = await serverAction(data);
if (result.success) {
  toast.success("Book added successfully");
  onClose();
} else {
  toast.error("Failed to add book. Please try again.");
}
```

---

## No Analog Found

All files are greenfield. The patterns above ARE the analogs for all future phases.

| File Category | Why No Analog | Pattern Source |
|---------------|---------------|----------------|
| All 38 files | Greenfield project — no prior codebase | RESEARCH.md patterns 1-7 + decisions D-01 to D-16 |

---

## Critical Implementation Order

The planner MUST sequence work in this dependency order:

1. **Wave 0 — Scaffold:** `npx create-next-app@latest`, `npx shadcn@latest init`, install all npm packages
2. **Wave 0 — Auth schema first:** `npx auth@latest generate --output prisma/schema.prisma` before any domain models
3. **Wave 0 — Prisma files:** `schema.prisma` (full schema), `prisma.config.ts`, `prisma/seed.ts`
4. **Wave 0 — Core lib files:** `db.ts` → `auth.ts` → `auth-client.ts` → `require-role.ts` (in this order — each depends on the prior)
5. **Wave 0 — Docker:** `Dockerfile`, `docker-compose.yml`, `docker-entrypoint.sh`, `.env.*` files
6. **Wave 1 — Auth flow:** `app/api/auth/[...all]/route.ts`, `LoginCard.tsx`, `(app)/layout.tsx`, `AppSidebar.tsx`
7. **Wave 2 — Catalog CRUD:** `catalog/actions.ts`, `CatalogTable.tsx`, `BookFormSheet.tsx`, `BookStatusBadge.tsx`, `CopiesSubTable.tsx`, `BookCard.tsx`
8. **Wave 3 — Members:** `members/actions.ts`, `MemberTable.tsx`, `MemberFormSheet.tsx`
9. **Wave 4 — Member-facing pages:** `catalog/page.tsx`, `my-profile/page.tsx`, `my-loans/page.tsx` (empty state)
10. **Wave 5 — Tests and verification**

---

## Metadata

**Analog search scope:** N/A — greenfield project
**Files scanned:** 0 existing source files
**Pattern extraction date:** 2026-06-09
**Primary source:** `.planning/phases/01-foundation/01-RESEARCH.md`
**Secondary sources:** `.planning/phases/01-foundation/01-CONTEXT.md`, `CLAUDE.md`
