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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My Loans</h1>
        <span className="text-sm text-muted-foreground">
          {loans.length} loan{loans.length !== 1 ? "s" : ""}
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
          {loans.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                No active loans
              </TableCell>
            </TableRow>
          ) : (
            loans.map((loan) => {
              const isOverdue =
                loan.status === "OVERDUE" ||
                (loan.status === "ACTIVE" && new Date(loan.dueAt) < new Date());
              return (
                <TableRow key={loan.id}>
                  <TableCell className="font-medium">
                    {loan.copy.book.title}
                  </TableCell>
                  <TableCell>{loan.copy.book.author.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(loan.issuedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell
                    className={
                      isOverdue ? "text-red-600 font-medium" : "text-sm"
                    }
                  >
                    {new Date(loan.dueAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {loan.returnedAt ? (
                      <Badge variant="outline">Returned</Badge>
                    ) : isOverdue ? (
                      <Badge variant="destructive">Overdue</Badge>
                    ) : (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                        Active
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
