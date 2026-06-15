"use client";

import { useState, useMemo, useTransition } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CheckoutSheet } from "./CheckoutSheet";
import { ReturnModal } from "./ReturnModal";
import { returnBook } from "./actions";

// Type shapes inferred from Prisma include
interface LoanData {
  id: string;
  status: string;
  dueAt: Date | string;
  issuedAt: Date | string;
  returnedAt: Date | string | null;
  copy: {
    barcode: string;
    book: {
      title: string;
      author: { name: string };
    };
  };
  member: {
    memberType: string;
    user: { name: string };
  };
}

interface LoanPolicy {
  memberType: string;
  loanDays: number;
  fineDailyRate: number | { toNumber: () => number };
}

interface LoansTableProps {
  loans: LoanData[];
  activeTab: "active" | "all";
  policies: LoanPolicy[];
}

interface ReturnTarget {
  id: string;
  memberName: string;
  daysOverdue: number;
  fineAmount: number;
}

const PAGE_SIZE = 20;

function getFineRate(policy: LoanPolicy): number {
  if (typeof policy.fineDailyRate === "object" && policy.fineDailyRate !== null) {
    return policy.fineDailyRate.toNumber();
  }
  return Number(policy.fineDailyRate);
}

function LoanStatusBadge({ loan }: { loan: LoanData }) {
  if (loan.returnedAt) {
    return <Badge variant="outline">Returned</Badge>;
  }
  const isOverdue =
    loan.status === "OVERDUE" ||
    (loan.status === "ACTIVE" && new Date(loan.dueAt) < new Date());
  if (isOverdue) {
    return <Badge variant="destructive">Overdue</Badge>;
  }
  return (
    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>
  );
}

function ActiveLoansTab({
  loans,
  policies,
}: {
  loans: LoanData[];
  policies: LoanPolicy[];
}) {
  const [page, setPage] = useState(1);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [returnTarget, setReturnTarget] = useState<ReturnTarget | null>(null);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const activeLoans = useMemo(
    () =>
      loans
        .filter((l) => l.status === "ACTIVE" || l.status === "OVERDUE")
        .sort(
          (a, b) =>
            new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
        ),
    [loans]
  );

  const totalPages = Math.max(1, Math.ceil(activeLoans.length / PAGE_SIZE));
  const paginated = activeLoans.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleReturn(loan: LoanData, now: Date) {
    const dueDate = new Date(loan.dueAt);
    const isOverdue =
      loan.status === "OVERDUE" ||
      (loan.status === "ACTIVE" && dueDate < now);

    if (isOverdue) {
      // Compute days overdue for the modal
      const overdueMs = now.getTime() - dueDate.getTime();
      const daysOverdue = Math.max(0, Math.ceil(overdueMs / (24 * 60 * 60 * 1000)));
      // Look up fine rate from policy matching member type
      const policy = policies.find((p) => p.memberType === loan.member.memberType);
      const fineRate = policy ? getFineRate(policy) : 0;
      const fineAmount = fineRate * daysOverdue;

      setReturnTarget({
        id: loan.id,
        memberName: loan.member.user.name,
        daysOverdue,
        fineAmount,
      });
      setIsReturnModalOpen(true);
    } else {
      // On-time return: call directly without modal
      startTransition(async () => {
        const result = await returnBook(loan.id);
        if (result.success) {
          if (result.data.holdTriggered) {
            toast.success(
              `Returned. Hold triggered for ${result.data.holdMemberName} — copy reserved.`
            );
          } else {
            toast.success("Book returned successfully.");
          }
        } else {
          toast.error("Couldn't process return. Please try again.");
        }
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setIsCheckoutOpen(true)}>Check Out</Button>
      </div>

      {paginated.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          No active loans.
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Book Title</TableHead>
                <TableHead>Copy</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((loan) => {
                const now = new Date();
                const dueDate = new Date(loan.dueAt);
                const isOverdue =
                  loan.status === "OVERDUE" ||
                  (loan.status === "ACTIVE" && dueDate < now);
                const daysOverdue = isOverdue
                  ? Math.floor(
                      (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
                    )
                  : 0;
                return (
                  <TableRow
                    key={loan.id}
                    className={cn(isOverdue ? "bg-red-50" : undefined)}
                  >
                    <TableCell className="font-medium">
                      {loan.member.user.name}
                    </TableCell>
                    <TableCell>{loan.copy.book.title}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {loan.copy.barcode}
                    </TableCell>
                    <TableCell
                      className={isOverdue ? "text-red-600 font-medium" : "text-sm"}
                    >
                      {dueDate.toLocaleDateString()}
                      {isOverdue && daysOverdue > 0 && (
                        <span className="ml-1 text-xs">({daysOverdue}d overdue)</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <LoanStatusBadge loan={loan} />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isPending}
                        onClick={() => handleReturn(loan, new Date())}
                      >
                        Return
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Prev
              </Button>
              <span>
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      <CheckoutSheet
        open={isCheckoutOpen}
        onOpenChange={setIsCheckoutOpen}
        policies={policies}
      />

      <ReturnModal
        open={isReturnModalOpen}
        onOpenChange={(isOpen) => {
          setIsReturnModalOpen(isOpen);
          if (!isOpen) setReturnTarget(null);
        }}
        loan={returnTarget}
      />
    </div>
  );
}

function AllLoansTab({ loans }: { loans: LoanData[] }) {
  const [page, setPage] = useState(1);

  const sorted = useMemo(
    () =>
      [...loans].sort(
        (a, b) =>
          new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime()
      ),
    [loans]
  );

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      {paginated.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          No loan history yet.
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Book Title</TableHead>
                <TableHead>Copy</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((loan) => (
                <TableRow key={loan.id}>
                  <TableCell className="font-medium">
                    {loan.member.user.name}
                  </TableCell>
                  <TableCell>{loan.copy.book.title}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {loan.copy.barcode}
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(loan.issuedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(loan.dueAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <LoanStatusBadge loan={loan} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">—</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Prev
              </Button>
              <span>
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function LoansTable({ loans, activeTab, policies }: LoansTableProps) {
  return (
    <Tabs defaultValue={activeTab}>
      <TabsList>
        <TabsTrigger value="active">Active</TabsTrigger>
        <TabsTrigger value="all">All Loans</TabsTrigger>
      </TabsList>

      <TabsContent value="active">
        <ActiveLoansTab loans={loans} policies={policies} />
      </TabsContent>

      <TabsContent value="all">
        <AllLoansTab loans={loans} />
      </TabsContent>
    </Tabs>
  );
}
