import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { partitionLoans } from "@/features/loans/loan-display";
import { ActiveLoansClient } from "@/features/loans/ActiveLoansClient";

export default async function MyLoansPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const member = await prisma.member.findUnique({
    where: { userId: session.user.id },
    include: {
      loans: {
        include: { copy: { include: { book: { include: { author: true } } } } },
        orderBy: { issuedAt: "desc" },
      },
    },
  });

  if (!member) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">My Loans</h1>
        <p className="text-muted-foreground">
          No member record found for your account.
        </p>
      </div>
    );
  }

  const loans = member.loans;
  const { active, history } = partitionLoans(loans);

  // Sort active loans by dueAt ascending (soonest due first)
  const sortedActive = [...active].sort(
    (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
  );

  // History is already in reverse-chronological order (issuedAt: "desc" from query)
  const sortedHistory = history;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">My Loans</h1>

      {/* Active Loans section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Active Loans</h2>
          <span className="text-sm text-muted-foreground">
            ({sortedActive.length})
          </span>
        </div>

        <ActiveLoansClient loans={sortedActive} />
      </section>

      {/* Loan History section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Loan History</h2>
          <span className="text-sm text-muted-foreground">
            ({sortedHistory.length})
          </span>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Book</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>Issued</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedHistory.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground py-8"
                >
                  No past loans
                </TableCell>
              </TableRow>
            ) : (
              sortedHistory.map((loan) => (
                <TableRow key={loan.id}>
                  <TableCell className="font-medium">
                    {loan.copy.book.title}
                  </TableCell>
                  <TableCell>{loan.copy.book.author.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(loan.issuedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(loan.dueAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">Returned</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
