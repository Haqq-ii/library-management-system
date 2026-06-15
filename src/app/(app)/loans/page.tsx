import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LoansTable } from "@/features/loans/LoansTable";

interface LoansPageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function LoansPage({ searchParams }: LoansPageProps) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (session.user.role !== "LIBRARIAN") redirect("/dashboard");

  const params = await searchParams;
  const activeTab = (params.tab === "all" ? "all" : "active") as "active" | "all";

  const [loans, policies] = await Promise.all([
    prisma.loan.findMany({
      include: {
        copy: { include: { book: { include: { author: true } } } },
        member: { include: { user: true } },
      },
      orderBy: { dueAt: "asc" },
    }),
    prisma.loanPolicy.findMany(),
  ]);

  const activeCount = loans.filter(
    (l: { status: string }) => l.status === "ACTIVE" || l.status === "OVERDUE"
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Loans</h1>
        <span className="text-sm text-muted-foreground">
          {activeCount} active loan{activeCount !== 1 ? "s" : ""}
        </span>
      </div>
      <LoansTable loans={loans} activeTab={activeTab} policies={policies} />
    </div>
  );
}
