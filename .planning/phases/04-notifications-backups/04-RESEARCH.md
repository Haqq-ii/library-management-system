# Phase 4: Notifications & Backups - Research

**Researched:** 2026-06-22
**Domain:** Transactional email (Resend + React Email), scheduled jobs (node-cron + Next.js instrumentation), PostgreSQL backup (pg_dump / Railway native backups)
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NOTF-01 | System sends a due-date reminder email 3 days before and on the due date | node-cron daily scan queries loans; Resend sends; NotificationLog deduplicates |
| NOTF-02 | System sends an overdue alert email daily while a loan is overdue | Same cron scan; loan.status OVERDUE query; daily idempotency key prevents re-send within same day |
| NOTF-03 | System sends a hold-ready email when a reserved copy is assigned to a member | Triggered inline in `returnBook` when `holdTriggered: true`; not a cron job — event-driven |
| NOTF-04 | System logs notification delivery status (sent/failed) per member per event | NotificationLog model already in schema; write success/failure after each Resend call |
| INFRA-05 | Automated database backups on configured schedule | Railway native backup UI (daily/weekly/monthly) or Docker sidecar with pg_dump |
</phase_requirements>

---

## Summary

Phase 4 introduces two orthogonal systems: (1) transactional email notifications driven by a scheduled cron job and one inline event trigger, and (2) database backup configuration. The email layer uses Resend + React Email — both are already specified as locked decisions in CLAUDE.md and are well-established packages with official documentation. The cron job uses node-cron, also locked. The primary architectural question resolved by this research is **where to mount node-cron in this project's Next.js 16 + standalone Docker setup** — specifically, whether to use `instrumentation.ts` (the App Router idiomatic path) or a custom `server.ts` entry point.

The critical finding is that **`instrumentation.ts` + `output: "standalone"` is a broken combination** in current Next.js. The instrumentation hook is not included in the standalone bundle and does not run when the app starts as `node .next/standalone/server.js`. This project already uses `output: "standalone"` in `next.config.ts` and depends on the standalone Dockerfile runner. Therefore, the planner must use the **custom server pattern** rather than instrumentation.ts for cron initialization. This requires dropping `output: "standalone"` OR restructuring the build/Dockerfile to bundle the custom server separately alongside the standalone output.

The `NotificationLog` model is already present in the schema — Phase 4 only needs to write to it, not create it. The `Reservation.notifiedAt` field is also already present and is written by `returnBook` when a hold is triggered, so the hold-ready email trigger has a clear attachment point. The backup requirement (INFRA-05) for Railway deployments is satisfied by Railway's native Backup UI (no code required); for self-hosted Docker, a pg_dump sidecar container is the standard approach.

**Primary recommendation:** Initialize node-cron in a custom `server.ts` that wraps Next.js; modify the Dockerfile to bundle and run the custom server instead of `node .next/standalone/server.js` directly.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Send due-date reminder emails | API / Backend (cron) | Database | Cron reads loans from DB, calls Resend API server-side |
| Send overdue alert emails | API / Backend (cron) | Database | Same cron job — daily scan of ACTIVE loans past dueAt |
| Send hold-ready email | API / Backend (returnBook Server Action) | — | Event-driven; fires inline when reservation advances to READY; no separate cron |
| Log notification delivery | Database | API / Backend | Write NotificationLog row after each Resend call |
| Cron job lifecycle | API / Backend (custom server.ts) | — | Must run in persistent Node.js process; instrumentation.ts incompatible with standalone output |
| Database backup (Railway) | Infrastructure (Railway UI) | — | No application code needed; purely configuration |
| Database backup (self-hosted) | Infrastructure (Docker sidecar) | — | pg_dump in a separate container on a cron schedule |
| Email templates | API / Backend (React Email components) | — | Rendered server-side to HTML; never client-side |
| Notification delivery log UI | Frontend Server (SSR page) | Database | Librarian-facing read-only table; same Server Component + Table pattern as /audit |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `resend` | 6.14.0 | Resend API client — send transactional emails | Locked in CLAUDE.md; official SDK; verified on registry |
| `react-email` | 6.6.3 | Email preview server + template authoring entry | Locked in CLAUDE.md; same monorepo as `@react-email/components` |
| `@react-email/components` | 1.0.12 | Pre-built email building blocks (Html, Body, Text, Button, etc.) | Locked in CLAUDE.md; standard companion to `react-email` |
| `@react-email/render` | 2.0.9 | Render React Email JSX to HTML string | Required to produce the `html` string passed to Resend |
| `node-cron` | 4.5.0 | Schedule daily cron jobs inside Node.js process | Locked in CLAUDE.md; zero external dependencies; TypeScript native |
| `@types/node-cron` | 3.0.11 | TypeScript types for node-cron | devDependency; published by DefinitelyTyped |

[VERIFIED: npm registry] — all versions confirmed via `npm view <package> version` on 2026-06-22. All repos point to `github.com/resend/resend-node`, `github.com/resend/react-email`, `github.com/node-cron/node-cron`.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `esbuild` (or `tsx`) | already in devDeps as `tsx` | Bundle custom server.ts to JS for production Dockerfile | Only if custom server approach adopted (required here) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `instrumentation.ts` for cron init | `server.ts` custom server | instrumentation.ts broken with standalone output; custom server works but removes static optimization |
| Railway native backups | pg_dump sidecar container | Railway UI is zero-code and simpler; sidecar is more portable for self-hosted |
| `@react-email/render` inline | `react` prop on Resend | Passing `react: <Template />` also works but `@react-email/render` gives more control (plainText, idempotency pre-render) |

**Installation:**
```bash
npm install resend react-email @react-email/components @react-email/render node-cron
npm install --save-dev @types/node-cron
```

---

## Package Legitimacy Audit

| Package | Registry | Age | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-------------|-----------|-------------|
| `resend` | npm | 9 yrs (2017-02) | github.com/resend/resend-node | N/A — verified via official docs | Approved |
| `react-email` | npm | ~10 yrs (2016-05, reused) | github.com/resend/react-email | N/A — official Resend repo | Approved |
| `@react-email/components` | npm | ~3 yrs (2023-02) | github.com/resend/react-email (monorepo) | N/A — official Resend monorepo | Approved |
| `@react-email/render` | npm | ~4 yrs (2022-09) | github.com/resend/react-email (monorepo) | N/A — official Resend monorepo | Approved |
| `node-cron` | npm | ~10 yrs (2016-02) | github.com/node-cron/node-cron | N/A — well-established | Approved |
| `@types/node-cron` | npm | Known DefinitelyTyped package | DefinitelyTyped | N/A | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** none

No `postinstall` scripts found for any of the above packages (`npm view <pkg> scripts.postinstall` returned empty for all).

*slopcheck CLI was not runnable via command invocation but pip install confirmed slopcheck 0.6.1 is installed. All packages were manually verified via npm view against their published GitHub repositories and official documentation sources.*

---

## Architecture Patterns

### System Architecture Diagram

```
[node-cron daily job] (server.ts / instrumentation-node.ts)
    |
    v
[scanAndNotify()] -- queries --> [Prisma: Loan + Member + User]
    |
    |-- loans due in 3 days ------> [sendDueDateReminder()] --> [Resend API]
    |-- loans due today ----------> [sendDueDateReminder()]    --> success/failure
    |-- loans past dueAt ---------> [sendOverdueAlert()]    --> [NotificationLog write]
    |
    [idempotency gate] <-- NotificationLog: was this (memberId, type, date) sent today?


[returnBook Server Action]
    |
    |-- holdTriggered: true ------> [sendHoldReady()] --> [Resend API]
                                                      --> [NotificationLog write]


[pg_dump / Railway Backup]
    |
    |-- Railway: configured in UI (daily/weekly/monthly, no code)
    |-- Docker self-hosted: backup sidecar container (docker-compose.yml addition)
```

### Recommended Project Structure

```
src/
├── emails/                       # React Email template components
│   ├── DueDateReminderEmail.tsx  # due-date reminder (3-day and same-day)
│   ├── OverdueAlertEmail.tsx     # overdue daily alert
│   └── HoldReadyEmail.tsx        # reservation hold-ready notification
├── lib/
│   ├── email.ts                  # Resend client singleton + sendEmail() helper
│   └── notifications.ts          # sendDueDateReminder(), sendOverdueAlert(), sendHoldReady()
├── jobs/
│   └── overdue-scan.ts           # scanAndNotify() — cron job handler
├── features/
│   └── notifications/
│       └── actions.ts            # getNotificationLog() — LIBRARIAN query action
server.ts                         # custom server entry point (root of project)
scripts/
└── build-server.ts               # esbuild bundler for server.ts (if standalone retained)
```

### Pattern 1: Custom Server + node-cron (App Router, standalone output)

**What:** A `server.ts` at the project root wraps the Next.js App Router and registers node-cron jobs once at startup. Because `output: "standalone"` conflicts with custom server file tracing, the Dockerfile is adjusted to either (a) drop standalone and use a regular build, or (b) bundle server.ts separately alongside standalone output.

**When to use:** Any Next.js project using `output: "standalone"` that needs a persistent background process (node-cron, websockets, etc.).

**Example:**
```typescript
// server.ts (project root — not inside src/)
// Source: https://nextjs.org/docs/pages/guides/custom-server [CITED]
import { createServer } from "http";
import next from "next";
import cron from "node-cron";
import { scanAndNotify } from "./src/jobs/overdue-scan";

const port = parseInt(process.env.PORT ?? "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // Schedule daily overdue scan at 06:00 UTC
  cron.schedule("0 6 * * *", async () => {
    console.log("[cron] Running daily overdue scan...");
    await scanAndNotify();
  }, { timezone: "UTC" });

  createServer((req, res) => {
    handle(req, res);
  }).listen(port, () => {
    console.log(`> Server listening on port ${port}`);
  });
});
```

### Pattern 2: Resend + React Email — Send Helper

**What:** A singleton Resend client and a typed send helper that writes to NotificationLog on success/failure.

**Example:**
```typescript
// src/lib/email.ts
// Source: https://resend.com/docs/send-with-nextjs [CITED]
import { Resend } from "resend";
import { prisma } from "@/lib/db";

const resend = new Resend(process.env.RESEND_API_KEY);

export type NotificationType = "DUE_DATE_3DAY" | "DUE_DATE_SAME" | "OVERDUE_ALERT" | "HOLD_READY";

export async function sendAndLog(opts: {
  to: string;
  subject: string;
  react: React.ReactElement;
  memberId: string;
  type: NotificationType;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}): Promise<{ success: boolean }> {
  let success = false;
  try {
    const { data, error } = await resend.emails.send(
      {
        from: process.env.RESEND_FROM_EMAIL ?? "Library <noreply@yourdomain.com>",
        to: [opts.to],
        subject: opts.subject,
        react: opts.react,
      },
      { idempotencyKey: opts.idempotencyKey }
    );
    success = !error && !!data?.id;
  } catch {
    success = false;
  }

  // Always write to NotificationLog — success or failure (NOTF-04)
  await prisma.notificationLog.create({
    data: {
      memberId: opts.memberId,
      type: opts.type,
      channel: "EMAIL",
      success,
      metadata: opts.metadata ?? null,
    },
  });

  return { success };
}
```

### Pattern 3: React Email Template

**What:** Typed React components using `@react-email/components` primitives, rendered to HTML at send time via `@react-email/render`.

**Example:**
```typescript
// src/emails/DueDateReminderEmail.tsx
// Source: https://react.email/docs/utilities/render [CITED]
import { Html, Head, Body, Container, Text, Button, Preview } from "@react-email/components";
import * as React from "react";

interface DueDateReminderEmailProps {
  memberName: string;
  bookTitle: string;
  dueDate: string;   // pre-formatted UTC date string
  daysUntilDue: number;
}

export function DueDateReminderEmail({ memberName, bookTitle, dueDate, daysUntilDue }: DueDateReminderEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your loan is due {daysUntilDue === 0 ? "today" : `in ${daysUntilDue} days`}</Preview>
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#f9f9f9" }}>
        <Container>
          <Text>Hi {memberName},</Text>
          <Text>
            Your copy of <strong>{bookTitle}</strong> is due{" "}
            {daysUntilDue === 0 ? "today" : `in ${daysUntilDue} days`} ({dueDate}).
          </Text>
          <Text>Please return it to the library on time to avoid fines.</Text>
        </Container>
      </Body>
    </Html>
  );
}

// Render at send time (async):
// import { render } from "@react-email/render";
// const html = await render(<DueDateReminderEmail {...props} />);
// Then pass html: html to resend.emails.send() or use react: <DueDateReminderEmail {...props} />
```

### Pattern 4: Cron Job Handler (Overdue Scan)

**What:** The daily cron callback that queries the database for loans requiring notifications and calls send helpers. Uses idempotency keys to prevent duplicate emails within a 24-hour window.

**Example:**
```typescript
// src/jobs/overdue-scan.ts
import { prisma } from "@/lib/db";
import { sendDueDateReminder } from "@/lib/notifications";
import { sendOverdueAlert } from "@/lib/notifications";

export async function scanAndNotify(): Promise<void> {
  const now = new Date();
  const todayUTC = now.toISOString().slice(0, 10); // "2026-06-22" — date key for idempotency

  // Window: loans due in 0-3 days (inclusive)
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const upcomingLoans = await prisma.loan.findMany({
    where: {
      status: "ACTIVE",
      dueAt: { lte: in3Days, gte: now },
      returnedAt: null,
    },
    include: { member: { include: { user: true } }, copy: { include: { book: true } } },
  });

  for (const loan of upcomingLoans) {
    const daysUntilDue = Math.round(
      (new Date(loan.dueAt).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
    );
    const type = daysUntilDue === 0 ? "DUE_DATE_SAME" : "DUE_DATE_3DAY";
    // Idempotency key: prevents duplicate within 24h (Resend keeps keys 24h)
    const idempotencyKey = `${type}/${loan.id}/${todayUTC}`;
    await sendDueDateReminder({ loan, daysUntilDue, idempotencyKey, type });
  }

  // Overdue loans (status OVERDUE or ACTIVE with dueAt in the past)
  const overdueLoans = await prisma.loan.findMany({
    where: {
      returnedAt: null,
      dueAt: { lt: now },
    },
    include: { member: { include: { user: true } }, copy: { include: { book: true } } },
  });

  for (const loan of overdueLoans) {
    const idempotencyKey = `OVERDUE_ALERT/${loan.id}/${todayUTC}`;
    await sendOverdueAlert({ loan, idempotencyKey });
  }
}
```

### Pattern 5: Hold-Ready Email (Inline — not cron)

**What:** Called from within `returnBook` when `holdTriggered: true`. The email is sent after the transaction commits, not inside the transaction, to avoid holding a DB connection open during a Resend HTTP call.

**Where to call it:** In `src/features/loans/actions.ts`, after the `prisma.$transaction` resolves and `data.holdTriggered === true`, call `sendHoldReady()` before the `revalidatePath` calls.

```typescript
// src/features/loans/actions.ts (addition to returnBook, after transaction)
if (data.holdTriggered && data.holdMemberId && data.holdMemberEmail) {
  await sendHoldReady({
    memberId: data.holdMemberId,
    memberEmail: data.holdMemberEmail,
    memberName: data.holdMemberName ?? "",
    bookTitle: data.bookTitle ?? "",
    pickupWindowHours: PICKUP_WINDOW_HOURS,
    idempotencyKey: `HOLD_READY/${reservationId}`,
  });
}
```

Note: `returnBook` will need to return additional fields (`holdMemberId`, `holdMemberEmail`, `bookTitle`) from the transaction for the email call. This is a small addition to the existing return shape.

### Pattern 6: Notification Delivery Log UI

**What:** A read-only LIBRARIAN page (`/notifications`) using the same Server Component + table pattern as `/audit`. Queries `NotificationLog` with pagination and optional type filter.

**Analog in codebase:** `src/app/(app)/audit/page.tsx` + `src/features/audit/actions.ts` — exact structural match (getAuditLog → getNotificationLog, AuditTable → NotificationTable).

### Pattern 7: Idempotency Key Strategy

**What:** Resend's idempotency keys (passed as second argument to `resend.emails.send()`) prevent duplicate sends within a 24-hour window even if the cron job runs twice (e.g., container restart).

**Format:** `<NOTIFICATION_TYPE>/<loanId>/<YYYY-MM-DD>` (max 256 chars, stays within limit).

**Expiration:** Resend retains idempotency keys for 24 hours. The NotificationLog serves as the longer-term record. [CITED: https://resend.com/docs/dashboard/emails/idempotency-keys]

### Anti-Patterns to Avoid

- **Sending email inside a Prisma transaction:** Resend HTTP call holds the DB transaction open; always send after `.then()` or after `await prisma.$transaction(...)`.
- **Using `instrumentation.ts` with `output: "standalone"`:** The instrumentation hook does not run in the standalone build. [CITED: github.com/vercel/next.js/issues/89377]
- **Date comparisons with `toLocaleDateString()`:** The codebase already enforces UTC epoch math; the cron scan must use `new Date().getTime()` arithmetic for due date windows, consistent with `actions.ts` patterns.
- **Querying `loan.status === "OVERDUE"` only:** The `status` field is set to `OVERDUE` only by the cron job itself; on first run, overdue loans may still have `status === "ACTIVE"`. Filter on `dueAt < now AND returnedAt IS NULL` to catch all overdue, regardless of status field.
- **Re-sending hold-ready on every cron run:** `sendHoldReady` is event-driven (triggered inline from `returnBook`), not cron-driven. Do not include hold notifications in the daily scan.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email delivery with retry | Custom SMTP client | `resend` SDK | Deliverability, SPF/DKIM, rate limiting, monitoring dashboard all handled |
| HTML email layout | Custom HTML string concatenation | `@react-email/components` | Email client compatibility matrix (Outlook, Gmail quirks) is enormous; components encode correct inline styles |
| Duplicate send prevention | Custom DB "sent" flag checked before every send | Resend idempotency key + NotificationLog | Resend handles the concurrent request race; NotificationLog is the durable record |
| Cron scheduling | `setInterval` loop | `node-cron` | setInterval drifts over time; node-cron handles DST edge cases, timezone spec, missed-run behavior |
| Backup orchestration | Custom pg_dump shell inside the app server | Docker sidecar or Railway UI | Keeps backup concerns separated from app; sidecar can be restarted independently |

**Key insight:** Email HTML is the most cross-client compatibility minefield in web development. React Email's components produce inline-styled, table-based HTML that renders correctly in Outlook 2016, Gmail web, Apple Mail, and mobile clients. Hand-rolled HTML will render broken in at least one major client.

---

## Common Pitfalls

### Pitfall 1: instrumentation.ts silently does nothing in standalone mode

**What goes wrong:** Cron jobs are registered in `instrumentation.ts` → they run in dev (`next dev`) → they do NOT run in production (`node .next/standalone/server.js`) → no emails are sent without any error.
**Why it happens:** The standalone build does not include instrumentation files in its output bundle. This is an open Next.js issue [#89377].
**How to avoid:** Use a custom `server.ts` instead. Either (a) remove `output: "standalone"` from `next.config.ts` and update the Dockerfile to copy all of `node_modules`, or (b) bundle `server.ts` separately with esbuild and copy alongside the standalone output.
**Warning signs:** Emails work in `npm run dev` but never arrive in production Docker deployment.

### Pitfall 2: Email sent inside Prisma transaction

**What goes wrong:** `resend.emails.send()` is called inside `prisma.$transaction()`. If the Resend API takes >5s, the DB transaction times out and rolls back, but the email may already have been sent.
**Why it happens:** Wanting atomicity between the DB write (NotificationLog) and the email send.
**How to avoid:** Send the email *after* the transaction commits. Write to NotificationLog in a separate Prisma call outside the transaction, using the result of the Resend call.
**Warning signs:** Intermittent "Transaction already closed" Prisma errors in production.

### Pitfall 3: Duplicate overdue emails due to cron drift

**What goes wrong:** Two cron runs fire close together (container restart, time correction), and a member receives two overdue emails on the same day.
**Why it happens:** No deduplication at the send layer.
**How to avoid:** Use Resend idempotency key `OVERDUE_ALERT/<loanId>/<YYYY-MM-DD>`. The key includes the calendar date so it resets at midnight UTC; Resend deduplicates within 24 hours.
**Warning signs:** Member complaints of duplicate emails; NotificationLog shows two `OVERDUE_ALERT` rows for same memberId + same date.

### Pitfall 4: Querying only `loan.status = 'OVERDUE'` for the daily scan

**What goes wrong:** On the first cron run after deployment, many loans are past due but still have `status = 'ACTIVE'` (the status field is application-managed, not auto-updated by Postgres). The scan misses them.
**Why it happens:** The `loan.status` field is only set to `OVERDUE` when the cron job explicitly updates it, or when the librarian views the loan. It does not update itself automatically.
**How to avoid:** Filter by `dueAt < now AND returnedAt IS NULL` — this catches overdue loans regardless of their `status` field. Optionally, also update `status` to `OVERDUE` in the same scan (a side effect of the cron pass).
**Warning signs:** No overdue emails sent on first production deployment; emails start arriving only after the librarian views the loans page.

### Pitfall 5: RESEND_API_KEY missing in Docker environment

**What goes wrong:** Emails silently fail in Docker dev because `RESEND_API_KEY` is not in `.env.development`.
**Why it happens:** The key was not added to `.env.development` or `.env.example`.
**How to avoid:** Add `RESEND_API_KEY=` and `RESEND_FROM_EMAIL=` to `.env.example` in Wave 0. In dev, use Resend's `delivered@resend.dev` test address so no domain verification is needed.
**Warning signs:** Resend SDK returns `{ error: { name: "missing_api_key" } }` immediately.

### Pitfall 6: Hold-ready email triggered by cron instead of event

**What goes wrong:** A cron job queries `Reservation.status = 'READY'` and re-sends hold-ready emails on every daily run, flooding the member with duplicate hold notifications.
**Why it happens:** Misunderstanding that hold-ready is event-driven (triggered once on return), not daily.
**How to avoid:** `sendHoldReady()` is called exactly once from `returnBook()` when `holdTriggered: true`. The idempotency key `HOLD_READY/<reservationId>` (no date suffix) ensures it is sent exactly once ever, not once per day.
**Warning signs:** Member receives hold-ready email every day their reservation is READY.

---

## Code Examples

### Send with React Email and log result

```typescript
// Source: https://resend.com/docs/send-with-nextjs [CITED]
import { Resend } from "resend";
import { render } from "@react-email/render";
import * as React from "react";

const resend = new Resend(process.env.RESEND_API_KEY);

// Pass JSX element directly using react: property (Resend renders internally)
const { data, error } = await resend.emails.send(
  {
    from: "Library <noreply@library.school.edu>",
    to: [memberEmail],
    subject: "Your book is due in 3 days",
    react: <DueDateReminderEmail memberName={name} bookTitle={title} dueDate={dueStr} daysUntilDue={3} />,
  },
  {
    idempotencyKey: `DUE_DATE_3DAY/${loanId}/2026-06-22`,
  }
);

if (error) {
  // Log failure
  await prisma.notificationLog.create({ data: { memberId, type: "DUE_DATE_3DAY", success: false, channel: "EMAIL" } });
}
```

### node-cron schedule (TypeScript, timezone)

```typescript
// Source: https://github.com/node-cron/node-cron [CITED]
import cron from "node-cron";

// Run at 06:00 UTC every day
cron.schedule("0 6 * * *", async () => {
  await scanAndNotify();
}, { timezone: "UTC" });
```

### React Email render to HTML string (alternative to react: property)

```typescript
// Source: https://react.email/docs/utilities/render [CITED]
import { render } from "@react-email/render";

const html = await render(<OverdueAlertEmail memberName={name} bookTitle={title} daysOverdue={7} />);
const plainText = await render(<OverdueAlertEmail ... />, { plainText: true });

await resend.emails.send({
  from: "Library <noreply@library.school.edu>",
  to: [email],
  subject: "Overdue book reminder",
  html,
  text: plainText,
});
```

### Railway Backup Configuration (no code)

```
Railway Dashboard → your PostgreSQL service → Settings → Backups tab
→ Enable "Daily" (backed up every 24 hours, kept 6 days)
→ Optionally enable "Weekly" (kept 1 month)
```
[CITED: https://docs.railway.com/reference/backups]

### pg_dump sidecar for Docker self-hosted

```yaml
# Addition to docker-compose.yml (self-hosted only)
# Source: https://serversinc.io/blog/automated-postgresql-backups-in-docker-complete-guide-with-pg-dump/ [CITED]
  db-backup:
    image: postgres:16-alpine
    environment:
      PGHOST: db
      PGUSER: postgres
      PGPASSWORD: postgres
      PGDATABASE: library_dev
    volumes:
      - ./backups:/backups
    depends_on:
      db:
        condition: service_healthy
    # Run pg_dump daily at 02:00 via crond (Alpine built-in)
    command: >
      sh -c "echo '0 2 * * * pg_dump -Fc $$PGDATABASE > /backups/db-$$(date +%F).dump' > /etc/crontabs/root && crond -f -l 2"
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `instrumentation.ts` for cron jobs | Custom `server.ts` (standalone incompatibility) | Next.js issue open as of 2026 | Must use custom server for cron in standalone deployments |
| Passing raw HTML strings to Resend | `react: <Template />` or `render()` | Resend SDK v2+ | Templates are type-safe React components, not string templates |
| `next-auth` / Auth.js for roles | Better Auth (already locked) | 2025 | Already implemented in this project |
| `node-cron` v3 (CommonJS) | `node-cron` v4 (TypeScript-native) | 2024-2025 | v4 ships as TypeScript; `@types/node-cron` still needed but improves IDE completions |

**Deprecated/outdated:**
- Nodemailer: SMTP config burden, deliverability your problem — Resend solves this (already excluded in CLAUDE.md)
- Vercel Cron: Pro plan only, does not support persistent processes — already excluded in CLAUDE.md

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `instrumentation.ts` is broken with `output: "standalone"` in Next.js 16 | Common Pitfalls, Architecture | If fixed in Next.js 16.2.7+, a simpler instrumentation.ts approach could be used instead of custom server |
| A2 | `returnBook` currently returns enough data to trigger `sendHoldReady` after the transaction | Architecture Patterns (Pattern 5) | If holdMemberId/holdMemberEmail are not in the return shape, returnBook needs a small extension |
| A3 | The daily cron at 06:00 UTC is an appropriate schedule for this use case | Architecture | User may prefer a different time; no business requirement specifies the exact hour |

---

## Open Questions (RESOLVED)

1. **Custom server vs dropping standalone output**
   - What we know: `output: "standalone"` conflicts with `instrumentation.ts` cron registration; the Dockerfile currently uses `CMD ["node", "server.js"]` (standalone output's `server.js`)
   - What's unclear: Whether the planner should (a) drop `output: "standalone"` and copy full `node_modules` in the Dockerfile, or (b) bundle a custom `server.ts` separately using esbuild and put it alongside the standalone output
   - Recommendation: Option (a) — remove `output: "standalone"`, adjust Dockerfile to a standard Node.js build. This is simpler and the image size tradeoff is acceptable for a single-institution deployment. The Dockerfile already has a multi-stage build that can be adapted.
   - **RESOLVED: Plan 04-02 removes `output: "standalone"` from `next.config.ts` and introduces a custom `server.ts` with node-cron. Dockerfile is updated to standard Node.js build (no standalone).**

2. **RESEND_FROM_EMAIL domain verification**
   - What we know: Resend requires a verified domain for production `from:` addresses; `onboarding@resend.dev` only works for Resend's own test domain
   - What's unclear: Whether the user has a custom domain to verify, or will use Resend's shared sending domain
   - Recommendation: Use `delivered@resend.dev` as `to:` in dev (Resend test address), add `RESEND_FROM_EMAIL` env var and document that a custom domain must be verified before production use
   - **RESOLVED: Plan 04-01 adds `RESEND_FROM_EMAIL` to `.env.example` with a `onboarding@resend.dev` dev fallback and documents that a custom domain must be verified before production use.**

3. **Notification log UI page name and nav placement**
   - What we know: NOTF-04 requires a librarian-inspectable delivery log; the pattern is identical to `/audit`
   - What's unclear: Whether this should be a dedicated `/notifications` page or a tab within `/audit`
   - Recommendation: Separate `/notifications` page, mirroring the `/audit` pattern. Add to LIBRARIAN_NAV in AppSidebar.
   - **RESOLVED: Plan 04-04 creates a dedicated `/notifications` page with its own `NotificationLogTable` client component and adds a "Notifications" entry to LIBRARIAN_NAV in `AppSidebar.tsx`.**

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Custom server, cron | Yes | v24.11.1 | — |
| Docker | Dev environment, backup sidecar | Yes | 28.4.0 | — |
| `resend` npm package | Email sending | Not yet installed | 6.14.0 (registry) | — |
| `node-cron` npm package | Cron scheduling | Not yet installed | 4.5.0 (registry) | — |
| `@react-email/*` packages | Email templates | Not yet installed | See Standard Stack | — |
| `RESEND_API_KEY` | Resend API calls | Not set (not in `.env.example`) | — | Add to `.env.example` in Wave 0 |
| `pg_dump` | Self-hosted backup sidecar | Not on host (not needed — lives in postgres Docker image) | — | Use `postgres:16-alpine` image for sidecar |
| Railway Backups | INFRA-05 on Railway | Configured in Railway UI | — | pg_dump sidecar for self-hosted |

**Missing dependencies with no fallback:** none — all have paths to resolution.

**Missing dependencies with fallback:** `RESEND_API_KEY` env var not yet present — Wave 0 must add to `.env.example` and document dev testing approach.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.8 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npm test` (vitest run) |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| NOTF-01 | scanAndNotify() calls sendDueDateReminder for loans due in ≤3 days | unit | `npm test -- tests/unit/overdue-scan.test.ts` | Wave 0 |
| NOTF-01 | sendDueDateReminder does NOT send if loan due >3 days away | unit | `npm test -- tests/unit/overdue-scan.test.ts` | Wave 0 |
| NOTF-02 | scanAndNotify() calls sendOverdueAlert for loans where dueAt < now | unit | `npm test -- tests/unit/overdue-scan.test.ts` | Wave 0 |
| NOTF-02 | sendOverdueAlert is NOT called for loans where returnedAt is set | unit | `npm test -- tests/unit/overdue-scan.test.ts` | Wave 0 |
| NOTF-03 | returnBook calls sendHoldReady when holdTriggered is true | unit | `npm test -- tests/unit/loan-return.test.ts` | Exists (extend) |
| NOTF-04 | NotificationLog row created with success:true on successful send | unit | `npm test -- tests/unit/email.test.ts` | Wave 0 |
| NOTF-04 | NotificationLog row created with success:false on Resend error | unit | `npm test -- tests/unit/email.test.ts` | Wave 0 |
| INFRA-05 | manual-only | manual-only | — | N/A |

**Manual-only justification for INFRA-05:** Backup configuration is infrastructure (Railway UI or Docker Compose); there is no application code to unit test. Verification is: "a backup exists in Railway dashboard / backup volume after the scheduled window."

### Sampling Rate

- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/unit/overdue-scan.test.ts` — covers NOTF-01, NOTF-02 (mock prisma, mock sendAndLog)
- [ ] `tests/unit/email.test.ts` — covers NOTF-04 (mock Resend SDK, verify NotificationLog create called)
- [ ] Extend `tests/unit/loan-return.test.ts` for NOTF-03 — add test case for holdTriggered path calling sendHoldReady

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Not a new auth surface |
| V3 Session Management | no | No new session logic |
| V4 Access Control | yes | getNotificationLog action requires `requireRole("LIBRARIAN")`; cron job runs server-side only |
| V5 Input Validation | yes (minimal) | No user input in cron; notification log query params validated with Zod (page number, type filter) |
| V6 Cryptography | no | Resend handles TLS; no keys to manage |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| RESEND_API_KEY leaked to client bundle | Information Disclosure | Never use `NEXT_PUBLIC_` prefix; key accessed only in Server Actions and server.ts |
| Notification log exposes member PII to unauthorized users | Elevation of Privilege | `requireRole("LIBRARIAN")` on `getNotificationLog` action |
| Email flooding via cron restart loop | Denial of Service | Resend idempotency key (24h deduplication); NotificationLog secondary audit |
| pg_dump backup contains plaintext passwords | Information Disclosure | Backup files stored in Docker volume (not committed to git); Railway backups are isolated per-service |

---

## Sources

### Primary (HIGH confidence)
- `resend` npm — confirmed v6.14.0, github.com/resend/resend-node, 2026-06-17 published
- `node-cron` npm — confirmed v4.5.0, github.com/node-cron/node-cron, 2026-06-21 published
- `@react-email/components` npm — confirmed v1.0.12, github.com/resend/react-email
- `@react-email/render` npm — confirmed v2.0.9, github.com/resend/react-email
- https://resend.com/docs/send-with-nextjs — Resend official Next.js guide
- https://resend.com/docs/dashboard/emails/idempotency-keys — Idempotency key format and 24h expiry
- https://react.email/docs/utilities/render — render() async API, plainText option
- https://nextjs.org/docs/app/guides/instrumentation — instrumentation.ts register() pattern, NEXT_RUNTIME guard
- https://nextjs.org/docs/pages/guides/custom-server — custom server.ts pattern for Node.js
- https://docs.railway.com/reference/backups — Railway Backup: daily/weekly/monthly schedules, retention

### Secondary (MEDIUM confidence)
- github.com/vercel/next.js/issues/89377 — instrumentation.ts broken with standalone output (open issue, confirmed in multiple separate reports)
- github.com/vercel/next.js/issues/49897 — same instrumentation + standalone issue, originally reported in Next 13, still open
- https://serversinc.io/blog/automated-postgresql-backups-in-docker-complete-guide-with-pg-dump/ — pg_dump sidecar pattern
- https://hmos.dev/en/nextjs-docker-standalone-and-custom-server — custom server + standalone esbuild approach

### Tertiary (LOW confidence)
- None — all key findings were verified via official documentation or npm registry

---

## Project Constraints (from CLAUDE.md)

The following CLAUDE.md directives apply directly to this phase:

| Constraint | Implication for Phase 4 |
|-----------|------------------------|
| Resend for transactional email (not Nodemailer, not SendGrid) | Use `resend` SDK exclusively |
| React Email for templates | Use `@react-email/components` + `@react-email/render` |
| node-cron in custom server (`server.ts`) | Must implement custom server entry point; NOT Route Handlers for cron trigger |
| Railway or self-hosted Docker (NOT Vercel) | Persistent process works; node-cron fires correctly |
| `output: "standalone"` currently in `next.config.ts` | CONFLICT with instrumentation.ts; planner must resolve (see Open Questions) |
| Every Server Action calls `requireRole()` independently | `getNotificationLog` action must call `requireRole("LIBRARIAN")` |
| All DateTime columns use `@db.Timestamptz` | Any new columns must use `@db.Timestamptz(3)` |
| All domain records use soft delete (`deletedAt`) | NotificationLog records are append-only; no delete needed |
| Docker-first dev — all local dev via Docker | `RESEND_API_KEY` must be injected via `env_file` in docker-compose.yml |

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified on npm registry and official documentation
- Architecture: HIGH — cron pattern confirmed via official Next.js docs; standalone conflict confirmed via open GitHub issues
- Pitfalls: HIGH — instrumentation/standalone conflict verified; others derived from code inspection of existing patterns
- Backup approach: HIGH (Railway) / MEDIUM (self-hosted) — Railway docs confirmed; sidecar pattern widely documented

**Research date:** 2026-06-22
**Valid until:** 2026-07-22 (Next.js releases rapidly; re-check instrumentation/standalone issue if upgrading Next.js)
