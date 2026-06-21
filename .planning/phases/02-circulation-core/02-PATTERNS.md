# Phase 2: Circulation Core - Pattern Map

**Mapped:** 2026-06-15
**Files analyzed:** 8 new/modified files
**Analogs found:** 8 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/app/(app)/loans/page.tsx` | page (server component) | request-response | `src/app/(app)/books/page.tsx` | exact |
| `src/app/(app)/my-loans/page.tsx` | page (server component) | request-response | `src/app/(app)/my-loans/page.tsx` (existing stub) | exact (update) |
| `src/features/loans/actions.ts` | server actions | CRUD + transaction | `src/features/members/actions.ts` | exact |
| `src/features/loans/CheckoutSheet.tsx` | component (slide-over) | request-response | `src/features/catalog/BookFormSheet.tsx` | exact |
| `src/features/loans/ReturnModal.tsx` | component (dialog) | request-response | `src/features/catalog/CatalogTable.tsx` (inline Dialog) | role-match |
| `src/features/loans/LoansTable.tsx` | component (table) | request-response | `src/features/catalog/CatalogTable.tsx` | exact |
| `src/features/loans/loan-search.ts` | server action (search) | request-response | `src/features/catalog/catalog-search.ts` | exact |
| `src/components/layout/AppSidebar.tsx` | component (layout) | — | self (update `disabled: true` → remove flag) | exact (update) |

---

## Pattern Assignments

### `src/app/(app)/loans/page.tsx` (page, request-response)

**Analog:** `src/app/(app)/books/page.tsx`

**Imports pattern** (lines 1-3):
```typescript
import { prisma } from "@/lib/db";
import { CatalogTable } from "@/features/catalog/CatalogTable";
// → replace with LoansTable from "@/features/loans/LoansTable"
```

**Core page pattern** (lines 8-29):
```typescript
// Server Component: fetch data, pass to client table component
export default async function BooksPage({ searchParams }: BooksPageProps) {
  const params = await searchParams;
  // resolve URL params (tab selection: active | all)

  const loans = await prisma.loan.findMany({
    where: { /* filter by tab */ },
    include: { copy: { include: { book: { include: { author: true } } } }, member: { include: { user: true } } },
    orderBy: { dueAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Loans</h1>
        <span className="text-sm text-muted-foreground">{loans.length} loan{loans.length !== 1 ? "s" : ""}</span>
      </div>
      <LoansTable loans={loans} activeTab={params.tab ?? "active"} />
    </div>
  );
}
```

**Auth pattern:** This is a librarian-only page. Redirect non-librarians using the same session check pattern as `my-loans/page.tsx` lines 16-17 (`auth.api.getSession` + `redirect`), then additionally check `session.user.role === "LIBRARIAN"`.

---

### `src/app/(app)/my-loans/page.tsx` (page, request-response) — UPDATE

**Analog:** existing `src/app/(app)/my-loans/page.tsx` (full file — already read)

**Current structure to preserve** (lines 1-38): session check, member lookup with loans include, not-found guard.

**Change:** Split the flat `loans` array into two sections:
- `activeLoans = loans.filter(l => l.status === "ACTIVE" || l.status === "OVERDUE")`
- `historyLoans = loans.filter(l => l.returnedAt !== null)`

**Overdue highlight pattern** (lines 71-75 of existing file — already established):
```typescript
const isOverdue =
  loan.status === "OVERDUE" ||
  (loan.status === "ACTIVE" && new Date(loan.dueAt) < new Date());
```

**Badge variants pattern** (lines 89-97 of existing file — established):
```typescript
loan.returnedAt ? (
  <Badge variant="outline">Returned</Badge>
) : isOverdue ? (
  <Badge variant="destructive">Overdue</Badge>
) : (
  <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>
)
```

**Row highlight:** Add `className={isOverdue ? "bg-red-50" : undefined}` to `<TableRow>` for active loans section (extends existing `text-red-600` date colouring from line 83-84).

---

### `src/features/loans/actions.ts` (server actions, CRUD + transaction)

**Analog:** `src/features/catalog/actions.ts` and `src/features/members/actions.ts`

**File header + ActionResult type** (catalog/actions.ts lines 1-11):
```typescript
"use server";

import { requireRole } from "@/lib/require-role";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { revalidatePath } from "next/cache";

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };
```

**requireRole guard pattern** (catalog/actions.ts lines 32-36 — used by every action):
```typescript
try {
  await requireRole("LIBRARIAN");
} catch (err) {
  return { success: false, error: err instanceof Error ? err.message : "FORBIDDEN" };
}
```

**Zod validation pattern** (catalog/actions.ts lines 38-41):
```typescript
const parsed = BookSchema.safeParse(raw);
if (!parsed.success) {
  return { success: false, error: "INVALID_INPUT" };
}
```

**Transaction pattern** (members/actions.ts lines 43-71 — `prisma.$transaction`):
```typescript
const result = await prisma.$transaction(async (tx) => {
  // multiple tx.model.operation() calls
  // for checkout: SELECT FOR UPDATE copy, create Loan, update BookCopy.status
});
```

**`SELECT FOR UPDATE` pattern for checkout** — no existing analog in codebase; use raw query inside transaction:
```typescript
const [copy] = await tx.$queryRaw<{ id: string }[]>`
  SELECT id FROM "BookCopy"
  WHERE "bookId" = ${bookId} AND status = 'AVAILABLE'
  ORDER BY "createdAt" ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED
`;
```
(See `.planning/research/PITFALLS.md` for full pattern — no codebase analog exists.)

**Error handling + revalidatePath** (catalog/actions.ts lines 63-66):
```typescript
revalidatePath("/loans");
return { success: true, data: { id: loan.id } };
// ...
console.error("[checkoutBook]", err);
return { success: false, error: "DB_ERROR" };
```

**Prisma unique constraint error** (members/actions.ts line 76):
```typescript
if (err?.code === "P2002") return { success: false, error: "EMAIL_EXISTS" };
```

---

### `src/features/loans/CheckoutSheet.tsx` (component, slide-over)

**Analog:** `src/features/catalog/BookFormSheet.tsx` (full file — already read)

**File header + imports** (BookFormSheet.tsx lines 1-17):
```typescript
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
```

**Sheet wrapper pattern** (BookFormSheet.tsx lines 129-131):
```typescript
<Sheet open={open} onOpenChange={handleOpenChange}>
  <SheetContent className="w-full sm:max-w-[480px] overflow-y-auto">
    <SheetHeader><SheetTitle>Check Out Book</SheetTitle></SheetHeader>
```

**Form submit pattern** (BookFormSheet.tsx lines 106-126):
```typescript
async function onSubmit(values: BookFormValues) {
  const result = await checkoutBook(values);
  if (result.success) {
    toast.success("Book checked out successfully.");
    onOpenChange(false);
  } else {
    toast.error("Couldn't complete checkout. Please check your input and try again.");
  }
}
```

**SheetFooter with Cancel + Submit** (BookFormSheet.tsx lines 245-260):
```typescript
<SheetFooter className="pt-4">
  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
    Cancel
  </Button>
  <Button type="submit" disabled={form.formState.isSubmitting}>
    {form.formState.isSubmitting ? (
      <Loader2 className="h-4 w-4 animate-spin mr-2" />
    ) : null}
    Confirm Checkout
  </Button>
</SheetFooter>
```

**Type-ahead search fields** — no codebase analog. Use `useState` + `useTransition` + debounced Server Action call pattern. The `catalog-search.ts` pattern (below) provides the server side; the client side should:
```typescript
const [memberQuery, setMemberQuery] = useState("");
const [memberResults, setMemberResults] = useState<MemberSearchResult[]>([]);
const [isPending, startTransition] = useTransition();

function handleMemberQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
  setMemberQuery(e.target.value);
  startTransition(async () => {
    const result = await searchMembers(e.target.value);
    if (result.success) setMemberResults(result.data);
  });
}
// Render results as a positioned dropdown list below the input
```

---

### `src/features/loans/ReturnModal.tsx` (component, dialog)

**Analog:** `src/features/catalog/CatalogTable.tsx` inline Dialog (lines 282-302)

**Dialog pattern** (CatalogTable.tsx lines 282-302):
```typescript
<Dialog
  open={!!deactivateTarget}
  onOpenChange={(open) => { if (!open) setDeactivateTarget(null); }}
>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Deactivate book?</DialogTitle>
      <DialogDescription>
        This book will be hidden from the catalog. Existing loan records are preserved.
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline" onClick={() => setDeactivateTarget(null)}>
        Cancel
      </Button>
      <Button variant="destructive" onClick={handleDeactivate} disabled={isPending}>
        Deactivate
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Adapt for overdue return confirmation:**
- `DialogTitle`: "Return Overdue Book?"
- `DialogDescription`: "This book is {daysOverdue} days overdue. A fine of ${fineAmount} will be recorded on {memberName}'s account."
- Destructive confirm button: "Confirm Return"
- After confirm: call `returnBook(loanId)` Server Action, show `toast.success(...)` with hold notice if reservation triggered

**useTransition for action** (CatalogTable.tsx lines 63, 107-119):
```typescript
const [isPending, startTransition] = useTransition();
// ...
startTransition(async () => {
  const result = await returnBook(loanId);
  if (result.success) {
    toast.success(result.data?.holdTriggered
      ? `Returned. Hold triggered for ${result.data.holdMemberName} — copy reserved.`
      : "Book returned successfully."
    );
  } else {
    toast.error("Couldn't process return. Please try again.");
  }
});
```

---

### `src/features/loans/LoansTable.tsx` (component, table)

**Analog:** `src/features/catalog/CatalogTable.tsx` (full file — already read)

**File header + imports** (CatalogTable.tsx lines 1-24):
```typescript
"use client";

import { useState, useMemo, useTransition } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
```

**Tabs pattern** — no codebase analog for shadcn Tabs; import from ui:
```typescript
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
// Use defaultValue={activeTab} where activeTab comes from page searchParams
```

**Pagination pattern** (CatalogTable.tsx lines 94-95, 247-270):
```typescript
const PAGE_SIZE = 20;
const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
// ... Prev / Next buttons with disabled states
```

**Overdue row highlight pattern** (extends my-loans/page.tsx line 83-84):
```typescript
<TableRow
  key={loan.id}
  className={cn(isOverdue ? "bg-red-50" : undefined)}
>
```

**Sort icon pattern** (CatalogTable.tsx lines 43-47):
```typescript
function SortIcon({ col, sortKey, sortDir }) {
  if (sortKey !== col) return <ChevronsUpDown className="ml-1 h-3 w-3 text-muted-foreground" />;
  if (sortDir === "asc") return <ChevronUp className="ml-1 h-3 w-3" />;
  return <ChevronDown className="ml-1 h-3 w-3" />;
}
```

**Row action — inline button** (not dropdown, per D-11): Active tab has a direct "Return" button in the Actions column (not a `DropdownMenu`) since return is the single action:
```typescript
<TableCell>
  <Button
    size="sm"
    variant="outline"
    onClick={() => setReturnTarget(loan)}
    disabled={isPending}
  >
    Return
  </Button>
</TableCell>
```

**DropdownMenu pattern for All Loans tab** (CatalogTable.tsx lines 216-238): All Loans tab rows have no actions (read-only history), so omit the actions column or show a "—" cell.

---

### `src/features/loans/loan-search.ts` (server action, search)

**Analog:** `src/features/catalog/catalog-search.ts` (full file — already read)

**Full pattern** (catalog-search.ts lines 1-56):
```typescript
"use server";

import { requireRole } from "@/lib/require-role";
import { prisma } from "@/lib/db";

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

export async function searchMembers(query: string): Promise<ActionResult<MemberSearchResult[]>> {
  await requireRole("LIBRARIAN"); // note: no try/catch — search failures are non-critical

  try {
    const members = await prisma.member.findMany({
      where: {
        user: {
          deletedAt: null,
          ...(query.trim() ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
            ],
          } : {}),
        },
      },
      include: { user: true },
      take: 10,
      orderBy: { user: { name: "asc" } },
    });
    return { success: true, data: members.map(m => ({ id: m.userId, name: m.user.name, memberNumber: m.memberNumber, memberType: m.memberType })) };
  } catch {
    return { success: false, error: "SEARCH_ERROR" };
  }
}

export async function searchBooks(query: string): Promise<ActionResult<BookSearchResult[]>> {
  await requireRole("LIBRARIAN");

  try {
    const books = await prisma.book.findMany({
      where: {
        deletedAt: null,
        ...(query.trim() ? {
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { isbn: { contains: query } },
            { author: { name: { contains: query, mode: "insensitive" } } },
          ],
        } : {}),
      },
      include: { copies: true, author: true },
      take: 10,
      orderBy: { title: "asc" },
    });
    return {
      success: true,
      data: books.map(b => ({
        id: b.id,
        title: b.title,
        author: b.author.name,
        isbn: b.isbn,
        availableCount: b.copies.filter(c => c.status === "AVAILABLE").length,
      })),
    };
  } catch {
    return { success: false, error: "SEARCH_ERROR" };
  }
}
```

---

### `src/components/layout/AppSidebar.tsx` (layout component) — UPDATE

**Analog:** self — existing file (full file already read)

**Change:** In `LIBRARIAN_NAV` (lines 52-58), remove `disabled: true` from the Loans entry:

```typescript
// BEFORE (line 57):
{ href: "/loans", label: "Loans", icon: BookMarked, disabled: true },

// AFTER:
{ href: "/loans", label: "Loans", icon: BookMarked },
```

No other changes needed. The `NavLink` component already handles active state via `pathname.startsWith(item.href)` (line 175-177).

---

## Shared Patterns

### Authentication Guard (all Server Actions)
**Source:** `src/lib/require-role.ts` (full file — 21 lines)
**Apply to:** `src/features/loans/actions.ts`, `src/features/loans/loan-search.ts`

```typescript
// Pattern A — mutations (wrap in try/catch, return ActionResult):
try {
  await requireRole("LIBRARIAN");
} catch (err) {
  return { success: false, error: err instanceof Error ? err.message : "FORBIDDEN" };
}

// Pattern B — search actions (throw propagates, non-critical):
await requireRole("LIBRARIAN");
```

### ActionResult<T> Type
**Source:** `src/features/catalog/actions.ts` lines 8-11
**Apply to:** all files in `src/features/loans/`
```typescript
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };
```

### Toast Feedback
**Source:** `src/features/catalog/BookFormSheet.tsx` lines 120-125 and `src/features/catalog/CatalogTable.tsx` lines 112-118
**Apply to:** `CheckoutSheet.tsx`, `ReturnModal.tsx`, `LoansTable.tsx`
```typescript
import { toast } from "sonner";
// success: toast.success("...")
// error:   toast.error("...")
```

### Prisma Singleton Import
**Source:** `src/lib/db.ts`
**Apply to:** `src/features/loans/actions.ts`, `src/features/loans/loan-search.ts`
```typescript
import { prisma } from "@/lib/db";
// Use prisma.$transaction(async (tx) => { ... }) for checkout action
```

### Page Auth (Server Component pages)
**Source:** `src/app/(app)/my-loans/page.tsx` lines 16-17
**Apply to:** `src/app/(app)/loans/page.tsx`
```typescript
const session = await auth.api.getSession({ headers: await headers() });
if (!session) redirect("/login");
// Additionally for librarian page:
if (session.user.role !== "LIBRARIAN") redirect("/dashboard");
```

### Badge Variants for Loan Status
**Source:** `src/app/(app)/my-loans/page.tsx` lines 89-97
**Apply to:** `LoansTable.tsx`, updated `my-loans/page.tsx`
```typescript
// ACTIVE:  <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>
// OVERDUE: <Badge variant="destructive">Overdue</Badge>
// RETURNED:<Badge variant="outline">Returned</Badge>
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| Type-ahead dropdown UI (inside CheckoutSheet) | component | event-driven | No autocomplete/combobox component exists in the codebase. Use `useState` + `useTransition` + positioned `<ul>` list, or add shadcn `Combobox` (Radix Popover + Command). Prefer the Combobox primitive from shadcn for accessibility. |
| `SELECT FOR UPDATE` transaction (inside actions.ts) | db query | transaction | No optimistic lock pattern in codebase. Use `prisma.$queryRaw` template literal inside `prisma.$transaction`. See `.planning/research/PITFALLS.md`. |

---

## Metadata

**Analog search scope:** `src/features/`, `src/app/(app)/`, `src/lib/`, `src/components/layout/`
**Files scanned:** 11 feature files + 7 page files + 2 lib files + 1 layout component
**Pattern extraction date:** 2026-06-15
