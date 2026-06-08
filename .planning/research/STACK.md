# Stack Research: Library Management System

**Project:** School/University Library Management System
**Researched:** 2026-06-09
**Overall confidence:** HIGH

---

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js | 16.x (latest stable) | Full-stack framework | App Router gives co-located API (Route Handlers + Server Actions), SSR for catalog pages, strong TypeScript support. Single repo means no separate Express/Fastify backend to maintain. Turbopack is now stable (Next 16), making dev startup ~400% faster. |
| React | 19.x | UI rendering | Bundled with Next.js 16. Server Components reduce client JS — important for catalog/report pages that are read-heavy. |
| TypeScript | 5.x | Type safety | Non-negotiable at this project's scope. Prisma generates types from schema; end-to-end type safety from DB row to UI component is the main productivity multiplier. |

### Database

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| PostgreSQL | 16.x | Primary data store | Relational model is the correct fit: loans FK to books and members, fines FK to loans, reservations with status machines. JSON/NoSQL would require re-inventing joins. Widely available on every host (Railway, Supabase, Neon, self-hosted). |
| Prisma ORM | 7.x (latest stable as of April 2026) | Database access layer | Type-safe query builder generated from schema.prisma. `prisma migrate` gives tracked, reproducible migrations. Prisma Studio for local data inspection. v7 ships as ESM, Rust-free client, faster cold starts. Use `@prisma/client` + `prisma` as devDep. |

### Authentication

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Better Auth | 1.x (stable) | Authentication + RBAC | Auth.js (NextAuth) v5 remains beta after years; the Auth.js team now steers new projects to Better Auth. Better Auth shipped v1 stable in early 2025. Built-in: credentials (email/password), session management, RBAC/roles plugin, rate limiting, email verification — all needed by this project with zero extra packages. Supports Prisma adapter natively. |

### Email

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Resend | latest (`resend`) | Transactional email delivery | Developer-first SMTP API. Free tier (3,000/month) covers a school's notification volume. Simple `resend.emails.send()` call from Server Actions or Route Handlers. No SMTP config headaches. |
| React Email | 6.x (`react-email`, `@react-email/components`) | Email template authoring | Write due-date reminders and overdue alerts as React components. Renders to HTML for Resend. 2M weekly npm downloads. Maintained by the Resend team — seamless pairing. |

### UI / Styling

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tailwind CSS | 4.x | Utility-first CSS | v4 is now the default in new Next.js projects with shadcn/ui. OKLCH color tokens, new `@theme` directive. No separate config file (CSS-first config). |
| shadcn/ui | latest CLI (`shadcn`) | Accessible component primitives | Not an npm package — CLI copies component source into your repo. Components own Radix UI primitives (dialog, dropdown, table, form). Full Tailwind v4 + React 19 compatibility confirmed. You style and extend directly rather than fighting a third-party API. Tables, modals, badges, and form inputs are all required by this project. |
| Radix UI | (transitive via shadcn) | Headless accessible primitives | Keyboard navigation and ARIA for free on dropdowns, dialogs, tooltips. |

### Form Handling & Validation

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| React Hook Form | 7.x (`react-hook-form`) | Form state management | Ref-based, minimal re-renders. Official shadcn/ui form integration documented. Used for book catalog forms, member registration, checkout/return forms. |
| Zod | 3.x (`zod`) | Schema validation | Single schema validates both client-side (via RHF resolver) and server-side (inside Server Actions). `@hookform/resolvers` bridges the two. Type inference means no separate TypeScript interface for form data. |

### Reporting / Analytics

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Recharts | 2.x (`recharts`) | Dashboard charts | SVG-based, React-native library. Best choice for Next.js App Router because SVG renders on server without Canvas workarounds. Component API matches React mental model. Sufficient for borrowing stats, popular books bar charts, and overdue summaries. No Canvas issues with SSR. |

### Scheduled Jobs (Overdue Detection / Reminders)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| node-cron | 3.x (`node-cron`) | Daily overdue scan + email dispatch | For this project's scale (single institution), node-cron running inside a long-lived Next.js custom server (`server.js`) or a separate lightweight worker process is sufficient. Triggers: check for loans past due date, update fine records, dispatch Resend emails. No Redis dependency. BullMQ is over-engineered here — it adds Redis infra for a task that runs once per day and has no retry criticality. |

### Deployment

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Railway | — | Hosting (recommended) | Supports long-lived Node.js processes (needed for node-cron). Managed PostgreSQL add-on. Git-push deployment. Vercel is fine for stateless Next.js but its serverless model kills persistent cron processes — Railway or self-hosted VPS avoids this. |

---

## Key Library Choices

### Authentication: Better Auth over Auth.js / NextAuth

- Auth.js v5 has been in beta for 2+ years; as of September 2025 the Auth.js team handed maintenance to the Better Auth team and pointed new projects there.
- Better Auth v1 (stable, early 2025) provides: credentials login, session management, email verification, role-based access control plugin, rate limiting — all needed for librarian vs student/faculty roles.
- Prisma adapter available out of the box.
- Install: `npm install better-auth`
- Avoid: `next-auth@beta` for new projects per upstream guidance.

### Password Hashing: Argon2id (bundled inside Better Auth)

- Better Auth uses Argon2id internally — no manual bcrypt configuration needed.
- If rolling custom auth (not recommended): use `argon2` package. OWASP/NIST recommend Argon2id as the gold standard for new systems. `bcryptjs` is fine but inferior; its 72-byte password limit and GPU vulnerability make Argon2id the correct choice for new code.

### ORM: Prisma 7 (not Drizzle, not raw pg)

- Prisma's declarative schema is particularly valuable for a relational domain with many FK relationships (loans, fines, reservations, members, books).
- `prisma migrate dev` in development, `prisma migrate deploy` in CI/production.
- The singleton pattern for the Prisma client must be used in Next.js development to prevent connection pool exhaustion from hot-reload: export a single `prisma` instance from `lib/prisma.ts` using `globalThis`.
- v7 note: configuration moves to `prisma.config.ts`. MongoDB is not yet supported in v7 (irrelevant here — using PostgreSQL).

### Email: Resend + React Email (not Nodemailer)

- Nodemailer requires an SMTP server or app-password configuration and is harder to debug deliverability issues.
- Resend handles deliverability, domain authentication (SPF/DKIM), and provides a dashboard for monitoring sends.
- React Email components (due-date reminder, overdue alert) are version-controlled like normal code, previewed in a local dev server (`email dev`), and rendered to HTML by Resend.
- Install: `npm install resend react-email @react-email/components`

### UI Components: shadcn/ui + Tailwind v4 (not MUI, not Chakra, not Mantine)

- shadcn/ui copies source into `components/ui/` — you own the code, no version-lock on a third-party API surface.
- Tailwind v4 CSS-first config reduces boilerplate; `tw-animate-css` replaces `tailwindcss-animate` in new projects.
- MUI and Chakra ship pre-styled components that conflict with Tailwind and are harder to customize for a domain-specific admin UI.
- Install: `npx shadcn@latest init` (CLI-driven, not an npm package).

### Charts: Recharts (not Chart.js, not Victory)

- Recharts is SVG-native, works cleanly in Next.js App Router Server Components, and pairs directly with shadcn/ui's card primitives.
- react-chartjs-2 (Chart.js wrapper) uses Canvas — client-only, requires `'use client'` on chart components, complicates SSR.
- The library's reporting requirements (borrowing stats, popular books, overdue summary) are modest — Recharts handles them without the Canvas overhead.

### Validation: Zod + React Hook Form (not Yup, not Formik)

- Zod schemas serve double duty: RHF resolver on the client, `schema.parse()` in Server Actions on the server.
- Yup is comparable but Zod has better TypeScript inference.
- Formik is slower (re-renders on every keystroke) and not recommended for new projects.
- Install: `npm install zod react-hook-form @hookform/resolvers`

### Scheduled Tasks: node-cron (not BullMQ, not Vercel Cron)

- BullMQ requires Redis — adding a Redis instance for a single daily overdue scan is unjustified.
- Vercel Cron requires a Pro plan and does not support App Router Route Handlers reliably.
- node-cron in a custom server (`server.ts` with `createServer` from `http`) runs in the same Node process, has no external dependencies, and is sufficient for: daily fine accumulation, 3-days-before due reminder, day-of reminder.
- If deployed to Railway: the server runs persistently, so node-cron fires correctly.

---

## Installation

```bash
# Core framework
npm install next@latest react@latest react-dom@latest

# Database
npm install @prisma/client
npm install -D prisma

# Authentication
npm install better-auth

# Email
npm install resend react-email @react-email/components

# Forms and validation
npm install zod react-hook-form @hookform/resolvers

# Charts
npm install recharts

# Scheduled jobs
npm install node-cron
npm install -D @types/node-cron

# UI (CLI-based, not an npm install)
# npx shadcn@latest init
# Tailwind CSS v4 is initialized by shadcn CLI
```

---

## What NOT to Use

| Package | Why Not |
|---------|---------|
| `next-auth` / `next-auth@beta` (Auth.js v5) | Still in beta after 2+ years; upstream team now steers new projects to Better Auth. Fragmented v4→v5 migration, limited built-in RBAC. |
| Clerk / Auth0 | SaaS auth adds a vendor dependency and monthly cost for a school system where user management should be internal. Overkill for librarian-managed accounts. |
| Nodemailer | SMTP config complexity, deliverability is your problem. Resend solves this entirely. |
| SendGrid / Mailgun | More complex SDKs and higher cost for small transactional volume. Resend free tier (3K/month) covers this use case. |
| MySQL / MariaDB | PostgreSQL has superior support for complex queries (window functions for reporting, advisory locks for reservation race conditions). All recommended hosting providers support PostgreSQL. |
| MongoDB / Mongoose | Document model is wrong for this domain. Loan relationships (book FK, member FK, fine FK) are inherently relational. |
| Drizzle ORM | Technically valid but Prisma has a larger ecosystem, better documentation, and Prisma Studio for admin visibility. Drizzle's raw-SQL-close API is an advantage only if you need maximum query control — not needed here. |
| MUI (Material UI) | Heavy bundle, opinionated design system conflicts with Tailwind, requires theme overrides for customization. |
| Chakra UI | Similar issues to MUI — not Tailwind-native, extra abstraction layer. |
| Chart.js / react-chartjs-2 | Canvas-based, client-only, requires `'use client'` everywhere. SVG-based Recharts is simpler and more SSR-friendly. |
| BullMQ | Requires Redis infrastructure. Unjustified for a daily cron scan in a single-institution deployment. |
| Vercel (deployment for cron) | Serverless model kills persistent processes. node-cron does not work on Vercel without a separate cron trigger endpoint. Railway or self-hosted is the correct choice. |
| SWR / TanStack Query | Not needed in Next.js App Router. Server Components + Server Actions handle data fetching and mutations. Client-side caching from a query library adds complexity without benefit for this primarily server-rendered app. Add only if specific client-side live-update features emerge later. |
| tRPC | Adds a separate RPC layer. Next.js Server Actions already provide type-safe server-client calls without tRPC's infrastructure overhead. |

---

## Confidence Levels

| Area | Confidence | Notes |
|------|------------|-------|
| Next.js 16 + App Router | HIGH | Official docs, active release train verified (16.2 stable March 2026) |
| Prisma 7 + PostgreSQL | HIGH | Official changelog confirms 7.7.0 April 2026; Prisma docs verified |
| Better Auth over Auth.js | HIGH | Multiple current sources (LogRocket 2026, Better Stack 2026) confirm Auth.js team handed off to Better Auth; Better Auth v1 stable |
| Resend + React Email | HIGH | Official docs, React Email 6.x (6.5.0 June 2026), 2M weekly downloads |
| Tailwind v4 + shadcn/ui | HIGH | shadcn/ui docs confirm full Tailwind v4 + React 19 compatibility |
| React Hook Form + Zod | HIGH | Official shadcn/ui form integration documented; universal community consensus |
| Recharts for charts | MEDIUM-HIGH | SVG/SSR advantage verified; recommendation from multiple 2025-2026 comparison sources |
| node-cron for scheduled jobs | MEDIUM | Correct for non-Vercel persistent hosting; Vercel deployment would require a different approach (external cron service or Railway) |
| Railway for deployment | MEDIUM | Recommended for persistent Node.js with cron; Vercel is simpler but incompatible with node-cron |

---

## Sources

- [Next.js Blog — 16.2 Release](https://nextjs.org/blog)
- [Next.js Upgrading to v15](https://nextjs.org/docs/app/guides/upgrading/version-15)
- [Prisma Changelog](https://www.prisma.io/changelog)
- [Prisma + Next.js Guide](https://www.prisma.io/docs/guides/nextjs)
- [Auth.js v5 Migration](https://authjs.dev/getting-started/migrating-to-v5)
- [Auth.js RBAC Guide](https://authjs.dev/guides/role-based-access-control)
- [Auth.js is now part of Better Auth — Hacker News](https://news.ycombinator.com/item?id=45389293)
- [Better Auth Documentation](https://better-auth.com/)
- [Best Auth Library Next.js 2026 — LogRocket](https://blog.logrocket.com/best-auth-library-nextjs-2026/)
- [Resend + Next.js](https://resend.com/docs/send-with-nextjs)
- [React Email](https://react.email/)
- [shadcn/ui Tailwind v4](https://ui.shadcn.com/docs/tailwind-v4)
- [shadcn/ui React Hook Form](https://ui.shadcn.com/docs/forms/react-hook-form)
- [Recharts vs Chart.js — LogRocket 2026](https://blog.logrocket.com/best-react-chart-libraries-2026/)
- [Password Hashing 2026 — Argon2 vs bcrypt](https://www.pkgpulse.com/compare/argon2-vs-bcrypt)
- [BullMQ vs node-cron — Better Stack](https://betterstack.com/community/guides/scaling-nodejs/bullmq-scheduled-tasks/)
- [Prisma Production Guide — digitalapplied.com](https://www.digitalapplied.com/blog/prisma-orm-production-guide-nextjs)
