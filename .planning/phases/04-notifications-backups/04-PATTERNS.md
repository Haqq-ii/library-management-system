# Phase 4: Notifications & Backups - Pattern Map

**Mapped:** 2026-06-22
**Files analyzed:** 9 (7 new, 1 modified, 1 infra-only)
**Analogs found:** 8 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `server.ts` | config/entry | event-driven | (none — no custom server exists yet) | no analog |
| `src/lib/email.ts` | utility | request-response | `src/lib/db.ts` (singleton pattern) | partial-match |
| `src/emails/DueDateReminderEmail.tsx` | component | transform | `src/components/catalog/BookStatusBadge.tsx` | partial-match |
| `src/emails/OverdueAlertEmail.tsx` | component | transform | `src/components/catalog/BookStatusBadge.tsx` | partial-match |
| `src/emails/HoldReadyEmail.tsx` | component | transform | `src/components/catalog/BookStatusBadge.tsx` | partial-match |
| `src/jobs/overdue-scan.ts` | service | batch | `src/features/loans/actions.ts` (prisma query + transform) | role-match |
| `src/features/notifications/actions.ts` | service | CRUD | `src/features/audit/actions.ts` | exact |
| `src/features/notifications/NotificationLogTable.tsx` | component | request-response | `src/features/audit/AuditTable.tsx` | exact |
| `src/app/(app)/notifications/page.tsx` | route/page | request-response | `src/app/(app)/audit/page.tsx` | exact |
| `src/features/loans/actions.ts` (MODIFIED) | service | request-response | self — existing `returnBook` function | self-match |
| `docker-compose.yml` (MODIFIED) | config | — | self — existing `docker-compose.yml` | self-match |

---

## Pattern Assignments

### `server.ts` (config/entry, event-driven)

**Analog:** None in codebase. Use RESEARCH.md Pattern 1 (custom server + node-cron).

**Note on `output: "standalone"` conflict:** `next.config.ts` line 5 currently has `output: "standalone"` and `Dockerfile` (line 36) runs `CMD ["node", "server.js"]` from the standalone bundle. This conflicts with a custom `server.ts`. The planner must resolve this: remove `output: "standalone"` from `next.config.ts` and update the Dockerfile `runner` stage to copy all of `node_modules` and run `node server.js` (the compiled custom server), instead of using the standalone output's `server.js`.

**Core pattern from RESEARCH.md** (use verbatim):
```typescript
// server.ts (project root — NOT inside src/)
import { createServer } from "http";
import next from "next";
import cron from "node-cron";
import { scanAndNotify } from "./src/jobs/overdue-scan";

const port = parseInt(process.env.PORT ?? "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
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

**Dockerfile runner stage replacement** (replace standalone pattern in `Dockerfile` lines 21-36):
```dockerfile
# Stage 3: builder
FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npx tsx --tsconfig tsconfig.json server.ts --outfile dist/server.js

# Stage 4: runner — full node_modules required (no standalone)
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist/server.js ./server.js
EXPOSE 3000
CMD ["node", "server.js"]
```

---

### `src/lib/email.ts` (utility, request-response)

**Analog:** `src/lib/db.ts` — singleton export pattern.

**Singleton pattern from `src/lib/db.ts`** (lines 1-19):
```typescript
// src/lib/db.ts — singleton export via globalThis
import { PrismaClient } from "@/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({ adapter, log: [...] });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

**Apply same singleton guard for Resend client.** Core pattern from RESEARCH.md Pattern 2:
```typescript
// src/lib/email.ts
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
      { from: process.env.RESEND_FROM_EMAIL ?? "Library <noreply@yourdomain.com>", to: [opts.to], subject: opts.subject, react: opts.react },
      { idempotencyKey: opts.idempotencyKey }
    );
    success = !error && !!data?.id;
  } catch {
    success = false;
  }
  // Always write NotificationLog — success OR failure (NOTF-04)
  await prisma.notificationLog.create({
    data: { memberId: opts.memberId, type: opts.type, channel: "EMAIL", success, metadata: opts.metadata ?? null },
  });
  return { success };
}
```

**Key rule:** `RESEND_API_KEY` must never have `NEXT_PUBLIC_` prefix. Access only server-side.

---

### `src/emails/DueDateReminderEmail.tsx`, `src/emails/OverdueAlertEmail.tsx`, `src/emails/HoldReadyEmail.tsx` (component, transform)

**Analog:** No React Email templates exist yet. Closest component analog is `src/components/catalog/BookStatusBadge.tsx` (typed props → JSX). Use RESEARCH.md Pattern 3.

**Template structure pattern** (apply to all three email components):
```typescript
// src/emails/DueDateReminderEmail.tsx
import { Html, Head, Body, Container, Text, Preview } from "@react-email/components";
import * as React from "react";

interface DueDateReminderEmailProps {
  memberName: string;
  bookTitle: string;
  dueDate: string;   // pre-formatted UTC date string — no toLocaleDateString()
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
          <Text>Your copy of <strong>{bookTitle}</strong> is due {daysUntilDue === 0 ? "today" : `in ${daysUntilDue} days`} ({dueDate}).</Text>
          <Text>Please return it to the library on time to avoid fines.</Text>
        </Container>
      </Body>
    </Html>
  );
}
```

**Prop naming rule:** Pre-format dates as strings before passing to templates (UTC epoch math, consistent with existing `actions.ts` date patterns). Never pass `Date` objects to template props.

---

### `src/jobs/overdue-scan.ts` (service, batch)

**Analog:** `src/features/loans/actions.ts` — Prisma query patterns with UTC epoch math.

**UTC epoch math pattern from `src/features/loans/actions.ts`** (lines 99, 185-186):
```typescript
// Existing pattern — UTC epoch math (NOT toLocaleDateString):
const dueAt = new Date(Date.now() + loanDays * 24 * 60 * 60 * 1000);
const overdueMs = now.getTime() - new Date(loan.dueAt).getTime();
const overdueDays = Math.max(0, Math.ceil(overdueMs / (24 * 60 * 60 * 1000)));
```

**Prisma include pattern for loans** (from `src/features/loans/actions.ts` lines 163-170):
```typescript
const loan = await tx.loan.findUnique({
  where: { id: loanId },
  include: {
    copy: { include: { book: true } },
    member: { include: { user: true } },
  },
});
```

**Full cron handler pattern from RESEARCH.md Pattern 4** (use verbatim):
```typescript
// src/jobs/overdue-scan.ts
import { prisma } from "@/lib/db";
import { sendAndLog } from "@/lib/email";
import { DueDateReminderEmail } from "@/emails/DueDateReminderEmail";
import { OverdueAlertEmail } from "@/emails/OverdueAlertEmail";
import * as React from "react";

export async function scanAndNotify(): Promise<void> {
  const now = new Date();
  const todayUTC = now.toISOString().slice(0, 10); // "2026-06-22"
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const upcomingLoans = await prisma.loan.findMany({
    where: { status: "ACTIVE", dueAt: { lte: in3Days, gte: now }, returnedAt: null },
    include: { member: { include: { user: true } }, copy: { include: { book: true } } },
  });

  for (const loan of upcomingLoans) {
    const daysUntilDue = Math.round(
      (new Date(loan.dueAt).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
    );
    const type = daysUntilDue === 0 ? "DUE_DATE_SAME" : "DUE_DATE_3DAY";
    const idempotencyKey = `${type}/${loan.id}/${todayUTC}`;
    await sendAndLog({
      to: loan.member.user.email,
      subject: daysUntilDue === 0 ? "Your book is due today" : "Your book is due in 3 days",
      react: React.createElement(DueDateReminderEmail, {
        memberName: loan.member.user.name,
        bookTitle: loan.copy.book.title,
        dueDate: new Date(loan.dueAt).toISOString().slice(0, 10),
        daysUntilDue,
      }),
      memberId: loan.memberId,
      type,
      idempotencyKey,
    });
  }

  // Filter by dueAt < now AND returnedAt IS NULL — NOT loan.status === "OVERDUE" only
  const overdueLoans = await prisma.loan.findMany({
    where: { returnedAt: null, dueAt: { lt: now } },
    include: { member: { include: { user: true } }, copy: { include: { book: true } } },
  });

  for (const loan of overdueLoans) {
    const idempotencyKey = `OVERDUE_ALERT/${loan.id}/${todayUTC}`;
    await sendAndLog({
      to: loan.member.user.email,
      subject: "Overdue book reminder",
      react: React.createElement(OverdueAlertEmail, { memberName: loan.member.user.name, bookTitle: loan.copy.book.title }),
      memberId: loan.memberId,
      type: "OVERDUE_ALERT",
      idempotencyKey,
    });
  }
}
```

---

### `src/features/notifications/actions.ts` (service, CRUD)

**Analog:** `src/features/audit/actions.ts` — exact structural match.

**Imports pattern from `src/features/audit/actions.ts`** (lines 1-4):
```typescript
"use server";

import { requireRole } from "@/lib/require-role";
import { prisma } from "@/lib/db";
```

**ActionResult type pattern** (lines 6-8) — reuse directly:
```typescript
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };
```

**Auth guard pattern** (lines 58-62):
```typescript
try {
  await requireRole("LIBRARIAN");
} catch (err) {
  return { success: false, error: err instanceof Error ? err.message : "FORBIDDEN" };
}
```

**Paginated query pattern** (lines 96-108):
```typescript
const [entries, total] = await Promise.all([
  prisma.auditLog.findMany({
    where,
    include: { actor: true },
    orderBy: { createdAt: "desc" },
    skip,
    take: PAGE_SIZE,
  }),
  prisma.auditLog.count({ where }),
]);
return { success: true, data: { entries: entries as unknown as AuditLogEntry[], total } };
```

**Adapt:** replace `auditLog` with `notificationLog`, remove `actor` include (NotificationLog has `memberId` not `actorId`), add optional `type` filter (like `action` filter in audit). Add `member: { include: { user: true } }` include for member name/email display.

---

### `src/features/notifications/NotificationLogTable.tsx` (component, request-response)

**Analog:** `src/features/audit/AuditTable.tsx` — exact structural match.

**Directive and imports pattern** (lines 1-16):
```typescript
"use client";

import { useState, useTransition } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { getNotificationLog, type NotificationLogEntry } from "./actions";
```

**State + pagination pattern** (lines 62-70):
```typescript
const [entries, setEntries] = useState<NotificationLogEntry[]>(initialEntries);
const [total, setTotal] = useState(initialTotal);
const [page, setPage] = useState(initialPage);
const [isPending, startTransition] = useTransition();
const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
```

**Server Action call via startTransition pattern** (lines 80-94):
```typescript
startTransition(async () => {
  const result = await getNotificationLog({ page: newPage, type: newType });
  if (result.success) {
    setEntries(result.data.entries);
    setTotal(result.data.total);
    setPage(newPage);
  }
});
```

**Date formatting pattern** (lines 213-222) — copy exact locale format used in AuditTable:
```typescript
{new Date(entry.createdAt).toLocaleString("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})}
```

**Adapt:** columns are `createdAt`, `member.user.name`, `type`, `channel`, `success` (boolean badge: green/red). Replace action type multi-select with notification type select (`DUE_DATE_3DAY`, `DUE_DATE_SAME`, `OVERDUE_ALERT`, `HOLD_READY`). Remove date range filters (notifications log is append-only; type filter is sufficient for v1).

---

### `src/app/(app)/notifications/page.tsx` (route/page, request-response)

**Analog:** `src/app/(app)/audit/page.tsx` — exact structural match.

**Full page pattern from `src/app/(app)/audit/page.tsx`** (lines 1-35):
```typescript
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { NotificationLogTable } from "@/features/notifications/NotificationLogTable";
import { getNotificationLog } from "@/features/notifications/actions";

interface NotificationsPageProps {
  searchParams: Promise<{ type?: string; page?: string }>;
}

export default async function NotificationsPage({ searchParams }: NotificationsPageProps) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (session.user.role !== "LIBRARIAN") redirect("/dashboard");

  const params = await searchParams;
  const type = params.type ?? undefined;
  const page = parseInt(params.page ?? "1") || 1;

  const result = await getNotificationLog({ page, type });
  const entries = result.success ? result.data.entries : [];
  const total = result.success ? result.data.total : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Notification Log</h1>
      <NotificationLogTable entries={entries} total={total} page={page} />
    </div>
  );
}
```

---

### `src/features/loans/actions.ts` — `returnBook` function (MODIFIED)

**Analog:** Self — existing `returnBook` in `src/features/loans/actions.ts`.

**Current return shape** (lines 147, 270-278):
```typescript
// Current shape — only returns holdMemberName
export async function returnBook(
  loanId: string
): Promise<ActionResult<{ holdTriggered: boolean; holdMemberName?: string }>>

// Current holdTriggered branch return (inside transaction, line 270):
return {
  holdTriggered: true,
  holdMemberName: pendingReservation.member.user.name,
};
```

**Required additions to return shape:**
1. Extend the transaction return type to include `holdMemberId`, `holdMemberEmail`, `bookTitle`, `reservationId`.
2. After `await prisma.$transaction(...)` resolves and `data.holdTriggered === true`, call `sendHoldReady()` BEFORE `revalidatePath` calls. Do NOT call inside the transaction.

**Pattern for post-transaction email call** (analogous to RESEARCH.md Pattern 5):
```typescript
// After: const data = await prisma.$transaction(async (tx) => { ... });
// Before: revalidatePath("/loans");

if (data.holdTriggered && data.holdMemberId && data.holdMemberEmail) {
  await sendHoldReady({
    memberId: data.holdMemberId,
    memberEmail: data.holdMemberEmail,
    memberName: data.holdMemberName ?? "",
    bookTitle: data.bookTitle ?? "",
    idempotencyKey: `HOLD_READY/${data.reservationId}`,
  });
}

revalidatePath("/loans");
revalidatePath("/my-loans");
```

**Anti-pattern to avoid:** Do NOT call `sendHoldReady` inside `prisma.$transaction()`. The Resend HTTP call must happen after the transaction commits (see RESEARCH.md Pitfall 2 and existing `checkoutBook` pattern where AuditLog is written inside but external calls are post-transaction).

---

### `docker-compose.yml` (MODIFIED — pg_dump backup sidecar)

**Analog:** Existing `docker-compose.yml` — extend with a new service following the same pattern as the `db` service.

**Existing service structure** (`docker-compose.yml` lines 1-16) — model the sidecar on the `db` service:
```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: library_dev
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d library_dev"]
      interval: 5s
      timeout: 5s
      retries: 10
      start_period: 10s
```

**pg_dump sidecar addition from RESEARCH.md Pattern 7:**
```yaml
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
    command: >
      sh -c "echo '0 2 * * * pg_dump -Fc $$PGDATABASE > /backups/db-$$(date +%F).dump' > /etc/crontabs/root && crond -f -l 2"
```

**Add to `volumes:` section:** `backups_data:` (or use host bind mount `./backups` as shown; host bind mount is preferred for easy access to backup files).

---

## Shared Patterns

### Auth Guard (requireRole)
**Source:** `src/lib/require-role.ts` (lines 1-21)
**Apply to:** `src/features/notifications/actions.ts` (getNotificationLog)
```typescript
try {
  await requireRole("LIBRARIAN");
} catch (err) {
  return { success: false, error: err instanceof Error ? err.message : "FORBIDDEN" };
}
```

### Page Auth Guard (Server Component redirect)
**Source:** `src/app/(app)/audit/page.tsx` (lines 12-15)
**Apply to:** `src/app/(app)/notifications/page.tsx`
```typescript
const session = await auth.api.getSession({ headers: await headers() });
if (!session) redirect("/login");
if (session.user.role !== "LIBRARIAN") redirect("/dashboard");
```

### UTC Epoch Math for Dates
**Source:** `src/features/loans/actions.ts` (lines 99, 185-186)
**Apply to:** `src/jobs/overdue-scan.ts` (all date window calculations)
```typescript
// Always use getTime() arithmetic — never toLocaleDateString()
const dueAt = new Date(Date.now() + loanDays * 24 * 60 * 60 * 1000);
const overdueMs = now.getTime() - new Date(loan.dueAt).getTime();
```

### ActionResult Type
**Source:** `src/features/audit/actions.ts` (lines 6-8) and `src/features/loans/actions.ts` (lines 9-11)
**Apply to:** `src/features/notifications/actions.ts`
```typescript
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };
```

### Error Handling in Server Actions
**Source:** `src/features/audit/actions.ts` (lines 109-112) and `src/features/loans/actions.ts` (lines 136-143)
**Apply to:** `src/features/notifications/actions.ts`, `src/jobs/overdue-scan.ts`
```typescript
} catch (err) {
  console.error("[functionName]", err);
  return { success: false, error: "DB_ERROR" };
}
```

### Prisma Singleton Import
**Source:** `src/lib/db.ts`
**Apply to:** `src/lib/email.ts`, `src/jobs/overdue-scan.ts`, `src/features/notifications/actions.ts`
```typescript
import { prisma } from "@/lib/db";
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `server.ts` | config/entry | event-driven | No custom server exists; project uses standalone Next.js output. Use RESEARCH.md Pattern 1. |

---

## Metadata

**Analog search scope:** `src/features/`, `src/lib/`, `src/app/(app)/`, `src/components/`, `tests/unit/`, `Dockerfile`, `docker-compose.yml`, `next.config.ts`
**Files scanned:** 14 source files read
**Pattern extraction date:** 2026-06-22
