# Phase 3: Fines, Reservations, Renewals & Audit - Pattern Map

**Mapped:** 2026-06-21
**Files analyzed:** 14 new/modified files
**Analogs found:** 14 / 14

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `prisma/schema.prisma` | schema | — | self (add AuditLog model + AuditAction enum + waivedReason on Fine) | exact (update) |
| `src/lib/constants.ts` | utility/config | — | no existing file — create new | no analog |
| `src/features/fines/actions.ts` | server action | CRUD | `src/features/members/actions.ts` | exact |
| `src/features/reservations/actions.ts` | server action | CRUD + transaction | `src/features/loans/actions.ts` | exact |
| `src/features/audit/actions.ts` | server action (query) | request-response | `src/features/catalog/catalog-search.ts` | role-match |
| `src/features/loans/actions.ts` | server action | CRUD + transaction | self (modify checkoutBook + returnBook, add renewLoan) | exact (update) |
| `src/features/catalog/actions.ts` | server action | CRUD | self (add audit writes to createBook/updateBook/softDeleteBook) | exact (update) |
| `src/features/members/actions.ts` | server action | CRUD | self (add audit writes to createMember/updateMember/softDeleteMember) | exact (update) |
| `src/app/(app)/fines/page.tsx` | page (server component) | request-response | `src/app/(app)/loans/page.tsx` | exact |
| `src/app/(app)/my-reservations/page.tsx` | page (server component) | request-response | `src/app/(app)/my-loans/page.tsx` | exact |
| `src/app/(app)/audit/page.tsx` | page (server component) | request-response | `src/app/(app)/loans/page.tsx` | exact |
| `src/app/(app)/my-loans/page.tsx` | page (server component) | request-response | self (add Renew button + Actions column) | exact (update) |
| `src/components/catalog/BookCard.tsx` | component | request-response | self (already has Reserve button — verify reserveBook action exists) | exact (update) |
| `src/components/layout/AppSidebar.tsx` | component (layout) | — | self (add Fines + Audit Log to LIBRARIAN_NAV, remove disabled from My Reservations) | exact (update) |

---

## Pattern Assignments

### `prisma/schema.prisma` (schema)

**Analog:** self — extend existing schema

**Add waivedReason to Fine model** (after line 190 `waivedBy String?`):
```prisma
  waivedReason String?
```

**Add AuditAction enum** (new, after ReservationStatus enum):
```prisma
enum AuditAction {
  CHECKOUT
  RETURN
  FINE_WAIVED
  BOOK_ADDED
  BOOK_EDITED
  BOOK_DELETED
  MEMBER_ADDED
  MEMBER_EDITED
  MEMBER_DEACTIVATED
}
```

**Add AuditLog model** (new, after NotificationLog model):
```prisma
model AuditLog {
  id         String      @id @default(cuid())
  actorId    String
  action     AuditAction
  entityType String
  entityId   String
  details    Json?
  createdAt  DateTime    @default(now()) @db.Timestamptz(3)

  actor      User        @relation(fields: [actorId], references: [id])
}
```

**Add auditLogs relation to User model** (after `member Member?` line 31):
```prisma
  auditLogs  AuditLog[]
```

**Timestamptz convention** (carry forward from all existing fields): all DateTime fields use `@db.Timestamptz(3)`.

---

### `src/lib/constants.ts` (utility/config)

**No analog** — create new file. Simple export file, no pattern to copy.

```typescript
// Pickup window: hours from Reservation.notifiedAt before a READY reservation expires.
// Changing this requires a code deploy (acceptable for v1 — D-11).
export const PICKUP_WINDOW_HOURS = 48;
```

---

### `src/features/fines/actions.ts` (server action, CRUD)

**Analog:** `src/features/members/actions.ts`

**Imports pattern** (copy from members/actions.ts lines 1-7, adapt):
```typescript
"use server";

import { requireRole } from "@/lib/require-role";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { revalidatePath } from "next/cache";
```

**ActionResult type** (identical across all action files — lines 9-11 of members/actions.ts):
```typescript
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };
```

**Auth guard pattern** (lines 27-30 of members/actions.ts):
```typescript
try {
  await requireRole("LIBRARIAN");
} catch (err) {
  return { success: false, error: err instanceof Error ? err.message : "FORBIDDEN" };
}
```

**waiveFine core pattern** — mirrors updateMember structure (single-record mutation, no transaction needed):
```typescript
const WaiveFineSchema = z.object({
  fineId: z.string().min(1),
  reason: z.string().min(1),
});

export async function waiveFine(raw: unknown): Promise<ActionResult<void>> {
  // Step 1: Auth
  try {
    await requireRole("LIBRARIAN");
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "FORBIDDEN" };
  }

  // Step 2: Validate
  const parsed = WaiveFineSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: "INVALID_INPUT" };

  // Step 3: Mutate + audit write in one transaction
  try {
    await prisma.$transaction(async (tx) => {
      const session = await requireRole("LIBRARIAN"); // get session for actorId
      const fine = await tx.fine.update({
        where: { id: parsed.data.fineId },
        data: {
          status: "WAIVED",
          waivedAt: new Date(),
          waivedBy: session.user.id,
          waivedReason: parsed.data.reason,
        },
        include: {
          member: { include: { user: true } },
          loan: { include: { copy: { include: { book: true } } } },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          action: "FINE_WAIVED",
          entityType: "Fine",
          entityId: fine.id,
          details: {
            description: `Waived $${Number(fine.amount).toFixed(2)} fine on '${fine.loan.copy.book.title}' for ${fine.member.user.name}. Reason: ${parsed.data.reason}`,
            fineId: fine.id,
            memberId: fine.memberId,
            memberName: fine.member.user.name,
            bookTitle: fine.loan.copy.book.title,
            amount: Number(fine.amount),
            reason: parsed.data.reason,
          },
        },
      });
    });

    revalidatePath("/fines");
    return { success: true, data: undefined };
  } catch (err) {
    console.error("[waiveFine]", err);
    return { success: false, error: "DB_ERROR" };
  }
}
```

**Error handling pattern** (lines 75-79 of members/actions.ts):
```typescript
  } catch (err: any) {
    if (err?.code === "P2002") return { success: false, error: "EMAIL_EXISTS" };
    console.error("[createMember]", err);
    return { success: false, error: "DB_ERROR" };
  }
```
For fines: check for `P2025` (record not found) in addition to generic `DB_ERROR`.

---

### `src/features/reservations/actions.ts` (server action, CRUD + transaction)

**Analog:** `src/features/loans/actions.ts` (full transaction pattern) + `src/features/catalog/actions.ts` lines 209-248 (existing `reserveBook` partial pattern)

**Note:** `reserveBook` already exists in `src/features/catalog/actions.ts` lines 209-248. Phase 3 adds `cancelReservation` only. The lazy expiry logic lives inside `returnBook` in loans/actions.ts, not in a separate reservations file. A `src/features/reservations/actions.ts` file should export `cancelReservation`.

**Imports pattern** (same as all action files):
```typescript
"use server";

import { requireRole } from "@/lib/require-role";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
```

**Auth pattern for MEMBER action** (from catalog/actions.ts lines 210-214 — `reserveBook` captures session):
```typescript
let session;
try {
  session = await requireRole("MEMBER");
} catch (err) {
  return { success: false, error: err instanceof Error ? err.message : "FORBIDDEN" };
}
```

**cancelReservation core pattern** — mirrors returnBook's transaction structure (loans/actions.ts lines 122-243):
```typescript
export async function cancelReservation(reservationId: string): Promise<ActionResult<void>> {
  let session;
  try {
    session = await requireRole("MEMBER");
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "FORBIDDEN" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id: reservationId },
        include: { member: { include: { user: true } }, book: true },
      });

      if (!reservation) throw new Error("NOT_FOUND");
      // Guard: member can only cancel their own reservation
      if (reservation.member.userId !== session.user.id) throw new Error("FORBIDDEN");
      if (reservation.status !== "PENDING") throw new Error("NOT_CANCELLABLE");

      await tx.reservation.update({
        where: { id: reservationId },
        data: { status: "CANCELLED" },
      });

      // Re-number queue positions for remaining PENDING reservations
      // (shift down all positions > cancelled position)
    });

    revalidatePath("/my-reservations");
    return { success: true, data: undefined };
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") return { success: false, error: "NOT_FOUND" };
    if (err instanceof Error && err.message === "NOT_CANCELLABLE") return { success: false, error: "NOT_CANCELLABLE" };
    console.error("[cancelReservation]", err);
    return { success: false, error: "DB_ERROR" };
  }
}
```

---

### `src/features/audit/actions.ts` (server action, query)

**Analog:** `src/features/loans/actions.ts` auth guard pattern + `src/features/catalog/catalog-search.ts` query-only pattern

**Core pattern** — query only, no mutation, LIBRARIAN-only:
```typescript
"use server";

import { requireRole } from "@/lib/require-role";
import { prisma } from "@/lib/db";

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function getAuditLog(params: {
  page: number;
  fromDate?: string;
  toDate?: string;
  actions?: string[];
}): Promise<ActionResult<{ entries: AuditEntry[]; total: number }>> {
  try {
    await requireRole("LIBRARIAN");
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "FORBIDDEN" };
  }

  const PAGE_SIZE = 20;
  const skip = (params.page - 1) * PAGE_SIZE;

  try {
    const where = {
      ...(params.fromDate ? { createdAt: { gte: new Date(params.fromDate) } } : {}),
      ...(params.toDate ? { createdAt: { lte: new Date(params.toDate) } } : {}),
      ...(params.actions?.length ? { action: { in: params.actions } } : {}),
    };

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

    return { success: true, data: { entries, total } };
  } catch (err) {
    console.error("[getAuditLog]", err);
    return { success: false, error: "DB_ERROR" };
  }
}
```

---

### `src/features/loans/actions.ts` (server action, modify) — ADD renewLoan + retrofit audit + lazy expiry

**Analog:** self — extend existing file

**renewLoan new function** — blocking logic in sequence (D-15):
```typescript
export async function renewLoan(loanId: string): Promise<ActionResult<{ newDueAt: Date }>> {
  // Step 1: Auth — member only
  let session;
  try {
    session = await requireRole("MEMBER");
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "FORBIDDEN" };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const loan = await tx.loan.findUnique({
        where: { id: loanId },
        include: {
          member: { include: { user: true } },
          copy: { include: { book: true } },
        },
      });

      if (!loan) throw new Error("NOT_FOUND");
      // Guard: member can only renew their own loan
      if (loan.member.userId !== session.user.id) throw new Error("FORBIDDEN");

      const policy = await tx.loanPolicy.findUnique({
        where: { memberType: loan.member.memberType },
      });
      if (!policy) throw new Error("NO_POLICY");

      // Block 1: FINE_BLOCK (D-15 — checked first)
      const unpaidFines = await tx.fine.aggregate({
        where: { memberId: loan.memberId, status: "UNPAID" },
        _sum: { amount: true },
      });
      const unpaidTotal = Number(unpaidFines._sum.amount ?? 0);
      if (unpaidTotal >= Number(policy.maxUnpaidFineAmount)) {
        throw new Error(`FINE_BLOCK:${unpaidTotal.toFixed(2)}`);
      }

      // Block 2: MAX_RENEWALS (D-15)
      if (loan.renewCount >= policy.maxRenewals) {
        throw new Error(`MAX_RENEWALS:${policy.maxRenewals}`);
      }

      // Block 3: RESERVATION_BLOCK (D-15)
      const activeReservation = await tx.reservation.findFirst({
        where: {
          bookId: loan.copy.bookId,
          status: { in: ["PENDING", "READY"] },
        },
      });
      if (activeReservation) {
        throw new Error("RESERVATION_BLOCK");
      }

      // Compute new due date: current dueAt + loanDays (D-14)
      const currentDue = new Date(loan.dueAt);
      const newDueAt = new Date(currentDue.getTime() + policy.loanDays * 24 * 60 * 60 * 1000);

      await tx.loan.update({
        where: { id: loanId },
        data: { dueAt: newDueAt, renewCount: { increment: 1 } },
      });

      return { newDueAt };
    });

    revalidatePath("/my-loans");
    return { success: true, data: result };
  } catch (err) {
    if (err instanceof Error) {
      if (err.message.startsWith("FINE_BLOCK:")) return { success: false, error: err.message };
      if (err.message.startsWith("MAX_RENEWALS:")) return { success: false, error: err.message };
      if (err.message === "RESERVATION_BLOCK") return { success: false, error: "RESERVATION_BLOCK" };
      if (err.message === "NOT_FOUND") return { success: false, error: "NOT_FOUND" };
    }
    console.error("[renewLoan]", err);
    return { success: false, error: "DB_ERROR" };
  }
}
```

**Audit write pattern** to retrofit into checkoutBook and returnBook — add inside transaction after the existing mutation, before the return statement:
```typescript
// Inside the transaction, after loan is created/closed:
await tx.auditLog.create({
  data: {
    actorId: session.user.id,      // session captured at top of action
    action: "CHECKOUT",            // or "RETURN"
    entityType: "Loan",
    entityId: newLoan.id,
    details: {
      description: `Checked out '${book.title}' (copy ${copyBarcode}) to ${memberName}, due ${dueAt.toISOString()}`,
      memberId,
      memberName,
      bookTitle: book.title,
      copyBarcode,
      dueAt: dueAt.toISOString(),
    },
  },
});
```

**FINE_BLOCK check** to add at start of checkoutBook (after member lookup, before copy lock):
```typescript
// After member + policy lookup (lines 38-52 of existing actions.ts):
const unpaidFines = await prisma.fine.aggregate({
  where: { memberId, status: "UNPAID" },
  _sum: { amount: true },
});
const unpaidTotal = Number(unpaidFines._sum.amount ?? 0);
if (unpaidTotal >= Number(policy.maxUnpaidFineAmount)) {
  return { success: false, error: `FINE_BLOCK:${unpaidTotal.toFixed(2)}` };
}
```

**Lazy expiry pattern** to add inside returnBook transaction, before the hold-advance `findFirst` (after line 211 of existing actions.ts):
```typescript
// Expire READY reservations past pickup window before advancing the queue
const PICKUP_WINDOW_MS = 48 * 60 * 60 * 1000; // PICKUP_WINDOW_HOURS from constants.ts
const now = new Date();
const expiredReady = await tx.reservation.findMany({
  where: {
    bookId,
    status: "READY",
    notifiedAt: { lt: new Date(now.getTime() - PICKUP_WINDOW_MS) },
  },
});
for (const expired of expiredReady) {
  await tx.reservation.update({
    where: { id: expired.id },
    data: { status: "CANCELLED" },
  });
}
// Then continue with existing findFirst for pendingReservation
```

---

### `src/features/catalog/actions.ts` (server action, modify) — ADD audit writes

**Analog:** self — extend existing file

**Audit write after createBook** (add inside try block after `revalidatePath("/books")`, line 61):
```typescript
await prisma.auditLog.create({
  data: {
    actorId: session.user.id,
    action: "BOOK_ADDED",
    entityType: "Book",
    entityId: book.id,
    details: {
      description: `Added book '${parsed.data.title}' by ${parsed.data.authorName} (ISBN: ${parsed.data.isbn})`,
      bookId: book.id,
      title: parsed.data.title,
      author: parsed.data.authorName,
      isbn: parsed.data.isbn,
    },
  },
});
```

**Session capture pattern** — requireRole already called; capture its return value for actorId:
```typescript
// Change top of each affected action from:
try { await requireRole("LIBRARIAN"); }
// To:
let session;
try { session = await requireRole("LIBRARIAN"); }
// Then use session.user.id as actorId in auditLog.create
```

---

### `src/features/members/actions.ts` (server action, modify) — ADD audit writes

**Analog:** self — same session-capture pattern as catalog/actions.ts above

**Audit write for createMember** (add after `revalidatePath("/members")`, line 73):
```typescript
await prisma.auditLog.create({
  data: {
    actorId: session.user.id,
    action: "MEMBER_ADDED",
    entityType: "Member",
    entityId: userId,
    details: {
      description: `Registered member ${parsed.data.name} (${parsed.data.email}) as ${parsed.data.memberType}`,
      memberId: userId,
      name: parsed.data.name,
      email: parsed.data.email,
      memberType: parsed.data.memberType,
    },
  },
});
```

---

### `src/app/(app)/fines/page.tsx` (page, request-response)

**Analog:** `src/app/(app)/loans/page.tsx` (lines 1-51) — exact structural match

**Imports pattern** (adapt from loans/page.tsx lines 1-6):
```typescript
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FinesTable } from "@/features/fines/FinesTable";
```

**Auth + role guard pattern** (loans/page.tsx lines 12-14 — identical):
```typescript
const session = await auth.api.getSession({ headers: await headers() });
if (!session) redirect("/login");
if (session.user.role !== "LIBRARIAN") redirect("/dashboard");
```

**Data fetch + page structure** (adapt from loans/page.tsx lines 19-51):
```typescript
export default async function FinesPage({ searchParams }: FinesPageProps) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (session.user.role !== "LIBRARIAN") redirect("/dashboard");

  const params = await searchParams;
  const activeTab = (params.tab === "all" ? "all" : "unpaid") as "unpaid" | "all";

  const fines = await prisma.fine.findMany({
    include: {
      member: { include: { user: true } },
      loan: { include: { copy: { include: { book: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const unpaidCount = fines.filter((f) => f.status === "UNPAID").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Fines</h1>
        <span className="text-sm text-muted-foreground">
          {unpaidCount} unpaid
        </span>
      </div>
      <FinesTable fines={fines} activeTab={activeTab} />
    </div>
  );
}
```

---

### `src/app/(app)/my-reservations/page.tsx` (page, request-response)

**Analog:** `src/app/(app)/my-loans/page.tsx` (lines 1-177) — member page, inline Table, no client table component

**Auth + member lookup pattern** (my-loans/page.tsx lines 16-39):
```typescript
const session = await auth.api.getSession({ headers: await headers() });
if (!session) redirect("/login");

const member = await prisma.member.findUnique({
  where: { userId: session.user.id },
  include: {
    reservations: {
      include: { book: true },
      orderBy: { requestedAt: "desc" },
    },
  },
});

if (!member) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">My Reservations</h1>
      <p className="text-muted-foreground">No member record found for your account.</p>
    </div>
  );
}
```

**Inline Table structure** (copy from my-loans/page.tsx lines 65-122 — exact TableHeader/TableBody/TableRow/TableCell pattern):
```typescript
// Page heading pattern (my-loans/page.tsx line 54-55):
<h1 className="text-2xl font-semibold">My Reservations</h1>
<span className="text-sm text-muted-foreground">({reservations.length} reservations)</span>

// Table row for READY status — expires column:
const pickupDeadline = reservation.notifiedAt
  ? new Date(new Date(reservation.notifiedAt).getTime() + 48 * 60 * 60 * 1000)
  : null;
const isExpired = pickupDeadline ? pickupDeadline < new Date() : false;
// Render:
<TableCell className={isExpired ? "text-red-600 font-semibold" : "text-green-800"}>
  Pick up by {pickupDeadline?.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
</TableCell>
```

**Empty state pattern** (my-loans/page.tsx lines 76-81 — centered muted text):
```typescript
<TableRow>
  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
    No reservations
  </TableCell>
</TableRow>
```

This page will need `"use client"` for the cancel dialog state — or extract a `MyReservationsClient` component like how LoansTable wraps all interaction. Follow the my-loans pattern of keeping the page as a Server Component that passes data to a client component.

---

### `src/app/(app)/audit/page.tsx` (page, request-response)

**Analog:** `src/app/(app)/loans/page.tsx` — LIBRARIAN-only, same auth guard, same page skeleton

**searchParams pattern** (loans/page.tsx lines 16-17):
```typescript
const params = await searchParams;
// Audit-specific params:
const fromDate = params.from ?? undefined;
const toDate = params.to ?? undefined;
const actions = params.actions ? params.actions.split(",") : undefined;
const page = parseInt(params.page ?? "1");
```

**Page structure** (adapt loans/page.tsx lines 40-51):
```typescript
return (
  <div className="space-y-6">
    <h1 className="text-2xl font-semibold">Audit Log</h1>
    <AuditTable entries={entries} total={total} page={page} />
  </div>
);
```

The filter bar (date inputs + action select + Clear button) lives inside the client `AuditTable` component, same as `LoansTable` owns its tabs and pagination.

---

### `src/app/(app)/my-loans/page.tsx` (page, modify) — ADD Renew button

**Analog:** self — existing file at lines 65-122

**Add Actions column header** (after Status `<TableHead>` in the active loans table):
```typescript
<TableHead className="w-24">Actions</TableHead>
```

**Renew button in each active loan row** (after Status `<TableCell>`):
```typescript
<TableCell>
  <Button
    size="sm"
    variant="outline"
    disabled={isPending}
    onClick={() => handleRenew(loan.id)}
  >
    Renew
  </Button>
</TableCell>
```

**Note:** Adding the Renew button requires converting the active loans section to `"use client"` or extracting a client wrapper component. Follow the same pattern used in `LoansTable.tsx` — extract an `ActiveLoansClient` component that uses `useTransition` and `toast`.

**useTransition + toast pattern** (LoansTable.tsx lines 3, 16-17, 89, 129-143):
```typescript
"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { renewLoan } from "@/features/loans/actions";

const [isPending, startTransition] = useTransition();

function handleRenew(loanId: string) {
  startTransition(async () => {
    const result = await renewLoan(loanId);
    if (result.success) {
      const dateStr = new Date(result.data.newDueAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      toast.success(`Loan renewed. New due date: ${dateStr}.`);
    } else if (result.error.startsWith("FINE_BLOCK:")) {
      const amount = result.error.split(":")[1];
      toast.error(`Renewal blocked: $${amount} in unpaid fines.`);
    } else if (result.error.startsWith("MAX_RENEWALS:")) {
      const max = result.error.split(":")[1];
      toast.error(`Renewal blocked: maximum renewals (${max}) reached.`);
    } else if (result.error === "RESERVATION_BLOCK") {
      toast.error("Renewal blocked: another member has a hold on this title.");
    } else {
      toast.error("Couldn't renew loan. Please try again.");
    }
  });
}
```

---

### `src/components/catalog/BookCard.tsx` (component, modify)

**Analog:** self — existing file (lines 1-67)

**Current state:** Reserve button already exists (lines 57-61). `reserveBook` action already imported from `@/features/catalog/actions` (line 15). `handleReserve` already implemented with correct toast messages (lines 21-32).

**Verification needed:** Confirm `reserveBook` in `src/features/catalog/actions.ts` is the Phase 3 version — it exists at lines 209-248. The action places a PENDING reservation. No code change needed to BookCard.tsx unless the lazy expiry logic requires calling a different action on Reserve. Per D-12, lazy expiry runs inside `placeReservation` — but the existing action is `reserveBook`. Planner should decide whether to enhance `reserveBook` with lazy expiry in-place or leave as-is.

**Existing button pattern** (lines 57-61 — no change needed):
```typescript
<Button
  className="w-full"
  disabled={book.availableCount > 0 || isPending}
  onClick={handleReserve}
>
  Reserve
</Button>
```

---

### `src/components/layout/AppSidebar.tsx` (component, modify)

**Analog:** self — existing file (lines 52-70)

**LIBRARIAN_NAV additions** (after line 56 `{ href: "/loans", ... }`):
```typescript
import { Receipt, ClipboardList } from "lucide-react"; // add to existing import block (line 7-15)

const LIBRARIAN_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/books", label: "Books", icon: BookOpen },
  { href: "/members", label: "Members", icon: Users },
  { href: "/loans", label: "Loans", icon: BookMarked },
  { href: "/fines", label: "Fines", icon: Receipt },           // NEW
  { href: "/audit", label: "Audit Log", icon: ClipboardList }, // NEW
];
```

**MEMBER_NAV change** — remove `disabled: true` from My Reservations entry (lines 63-68):
```typescript
// Change from:
{
  href: "/my-reservations",
  label: "My Reservations",
  icon: BookOpen,
  disabled: true,  // REMOVE THIS LINE
},
// To:
{ href: "/my-reservations", label: "My Reservations", icon: BookOpen },
```

---

## Shared Patterns

### Authentication Guard (LIBRARIAN)
**Source:** `src/features/loans/actions.ts` lines 21-28, `src/features/members/actions.ts` lines 27-30
**Apply to:** `waiveFine`, `getAuditLog`, all catalog/member retrofit actions
```typescript
try {
  await requireRole("LIBRARIAN");
} catch (err) {
  return { success: false, error: err instanceof Error ? err.message : "FORBIDDEN" };
}
```

### Authentication Guard with Session Capture (LIBRARIAN)
**Source:** adapted from `src/features/catalog/actions.ts` lines 210-214 (MEMBER version)
**Apply to:** any LIBRARIAN action that also writes AuditLog (needs `session.user.id` as `actorId`)
```typescript
let session;
try {
  session = await requireRole("LIBRARIAN");
} catch (err) {
  return { success: false, error: err instanceof Error ? err.message : "FORBIDDEN" };
}
```

### Authentication Guard with Session Capture (MEMBER)
**Source:** `src/features/catalog/actions.ts` lines 210-214
**Apply to:** `cancelReservation`, `renewLoan`
```typescript
let session;
try {
  session = await requireRole("MEMBER");
} catch (err) {
  return { success: false, error: err instanceof Error ? err.message : "FORBIDDEN" };
}
```

### Transaction Pattern
**Source:** `src/features/loans/actions.ts` lines 55-92 (checkoutBook) and 122-243 (returnBook)
**Apply to:** `waiveFine` (audit write inside same tx), `cancelReservation`, `renewLoan`
```typescript
const result = await prisma.$transaction(async (tx) => {
  // ... mutations ...
  // ... audit write at end ...
  return { ... };
});
```

### ActionResult Type
**Source:** `src/features/loans/actions.ts` lines 8-10 (defined; also in members/actions.ts lines 9-11 and catalog/actions.ts lines 8-10)
**Apply to:** all new action files — define once at the top of each file:
```typescript
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };
```

### Error Handling (Action level)
**Source:** `src/features/loans/actions.ts` lines 98-104 and 249-258
**Apply to:** all new Server Actions
```typescript
} catch (err) {
  if (err instanceof Error && err.message === "NOT_FOUND") {
    return { success: false, error: "NOT_FOUND" };
  }
  console.error("[actionName]", err);
  return { success: false, error: "DB_ERROR" };
}
```

### Page Auth Guard (Librarian page)
**Source:** `src/app/(app)/loans/page.tsx` lines 12-14
**Apply to:** `/fines/page.tsx`, `/audit/page.tsx`
```typescript
const session = await auth.api.getSession({ headers: await headers() });
if (!session) redirect("/login");
if (session.user.role !== "LIBRARIAN") redirect("/dashboard");
```

### Page Auth Guard (Member page)
**Source:** `src/app/(app)/my-loans/page.tsx` lines 16-18
**Apply to:** `/my-reservations/page.tsx`
```typescript
const session = await auth.api.getSession({ headers: await headers() });
if (!session) redirect("/login");
// No role check — any authenticated user with a member record can view
```

### Tabbed Table Component Pattern
**Source:** `src/features/loans/LoansTable.tsx` lines 353-370 (Tabs + TabsList + TabsTrigger + TabsContent)
**Apply to:** `src/features/fines/FinesTable.tsx` (Unpaid | All tabs)
```typescript
export function FinesTable({ fines, activeTab }: FinesTableProps) {
  return (
    <Tabs defaultValue={activeTab}>
      <TabsList>
        <TabsTrigger value="unpaid">Unpaid</TabsTrigger>
        <TabsTrigger value="all">All</TabsTrigger>
      </TabsList>
      <TabsContent value="unpaid"><UnpaidFinesTab fines={fines} /></TabsContent>
      <TabsContent value="all"><AllFinesTab fines={fines} /></TabsContent>
    </Tabs>
  );
}
```

### Pagination Pattern
**Source:** `src/features/loans/LoansTable.tsx` lines 60, 102-103, 220-243
**Apply to:** `FinesTable`, `AuditTable`
```typescript
const PAGE_SIZE = 20;
const [page, setPage] = useState(1);
const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
const paginated = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

// Render:
{totalPages > 1 && (
  <div className="flex items-center justify-between text-sm text-muted-foreground">
    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Prev</Button>
    <span>Page {page} of {totalPages}</span>
    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
  </div>
)}
```

### Dialog (Confirmation / Destructive Action)
**Source:** `src/features/loans/ReturnModal.tsx` lines 1-90
**Apply to:** Fine waiver dialog, reservation cancellation dialog
```typescript
"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function WaiveFineDialog({ open, onOpenChange, fine }: WaiveFineDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [reason, setReason] = useState("");

  function handleConfirm() {
    startTransition(async () => {
      const result = await waiveFine({ fineId: fine.id, reason });
      if (result.success) {
        toast.success("Fine waived successfully.");
        onOpenChange(false);
      } else {
        toast.error("Couldn't waive fine. Please try again.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isPending) onOpenChange(isOpen); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Waive Fine</DialogTitle>
          <DialogDescription>
            Waive fine of ${fine.amount} for {fine.memberName}? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {/* <Label> + <Textarea> for reason */}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Cancel</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isPending || reason.trim().length === 0}>Confirm Waive</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### Semantic Badge Pattern
**Source:** `src/features/loans/LoansTable.tsx` lines 63-76 (LoanStatusBadge component)
**Apply to:** fine status badges, reservation status badges, audit action badges
```typescript
// Inline badge with semantic colors (no variant prop — use className directly):
<Badge className="bg-red-100 text-red-800 hover:bg-red-100">UNPAID</Badge>
<Badge className="bg-green-100 text-green-800 hover:bg-green-100">PAID</Badge>
<Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100">WAIVED</Badge>
```

### useTransition + Toast (Client mutation)
**Source:** `src/features/loans/LoansTable.tsx` lines 89, 129-143; `src/components/catalog/BookCard.tsx` lines 19, 21-32
**Apply to:** Renew button handler, Cancel reservation button, Waive button (before dialog opens)
```typescript
const [isPending, startTransition] = useTransition();

startTransition(async () => {
  const result = await serverAction(args);
  if (result.success) {
    toast.success("...");
  } else {
    toast.error("...");
  }
});
```

### UTC Epoch Math (no locale date ops)
**Source:** `src/features/loans/actions.ts` lines 79, 180 — comment explicitly states "UTC epoch math (PITFALLS section 4)"
**Apply to:** pickup window expiry check, new due date computation in renewLoan, fine amount calculation
```typescript
// CORRECT — UTC epoch arithmetic:
const newDueAt = new Date(currentDue.getTime() + policy.loanDays * 24 * 60 * 60 * 1000);
const pickupDeadline = new Date(notifiedAt.getTime() + PICKUP_WINDOW_HOURS * 60 * 60 * 1000);

// WRONG — do NOT use:
// new Date(date.toLocaleDateString())
// date.setDate(date.getDate() + n)
```

### AuditLog Write (inside transaction)
**Source:** defined by D-18/D-19 in CONTEXT.md — no existing analog yet
**Apply to:** every librarian Server Action in Phase 3 + retrofit of checkoutBook/returnBook
```typescript
await tx.auditLog.create({
  data: {
    actorId: session.user.id,
    action: "CHECKOUT", // AuditAction enum value
    entityType: "Loan", // "Loan" | "Fine" | "Book" | "Member"
    entityId: entityId,
    details: {
      description: "Human-readable string rendered in /audit Description column",
      // ... structured fields per action type (see UI-SPEC.md AuditLog details JSON Schema)
    },
  },
});
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/lib/constants.ts` | utility/config | — | No existing constants file; simple new file with one export |

---

## Metadata

**Analog search scope:** `src/features/`, `src/app/(app)/`, `src/components/`, `prisma/`
**Files read:** 10 source files
**Pattern extraction date:** 2026-06-21
