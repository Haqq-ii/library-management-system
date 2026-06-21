"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { renewLoan } from "@/features/loans/actions";
import { isLoanOverdue } from "@/features/loans/loan-display";

interface ActiveLoan {
  id: string;
  issuedAt: Date;
  dueAt: Date;
  status: string;
  renewCount: number;
  copy: {
    book: {
      title: string;
      author: { name: string };
    };
  };
}

interface ActiveLoansClientProps {
  loans: ActiveLoan[];
}

export function ActiveLoansClient({ loans }: ActiveLoansClientProps) {
  const [isPending, startTransition] = useTransition();

  function handleRenew(loanId: string) {
    startTransition(async () => {
      const result = await renewLoan(loanId);
      if (result.success) {
        const dateStr = new Date(result.data.newDueAt).toLocaleDateString(
          "en-US",
          { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }
        );
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

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Book</TableHead>
          <TableHead>Author</TableHead>
          <TableHead>Issued</TableHead>
          <TableHead>Due</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-24">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loans.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={6}
              className="text-center text-muted-foreground py-8"
            >
              No active loans
            </TableCell>
          </TableRow>
        ) : (
          loans.map((loan) => {
            const overdue = isLoanOverdue(loan);
            return (
              <TableRow
                key={loan.id}
                className={overdue ? "bg-red-50" : undefined}
              >
                <TableCell className="font-medium">
                  {loan.copy.book.title}
                </TableCell>
                <TableCell>{loan.copy.book.author.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(loan.issuedAt).toLocaleDateString("en-US", { timeZone: "UTC" })}
                </TableCell>
                <TableCell
                  className={overdue ? "text-red-600 font-medium" : "text-sm"}
                >
                  {new Date(loan.dueAt).toLocaleDateString("en-US", { timeZone: "UTC" })}
                </TableCell>
                <TableCell>
                  {overdue ? (
                    <Badge variant="destructive">Overdue</Badge>
                  ) : (
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                      Active
                    </Badge>
                  )}
                </TableCell>
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
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
