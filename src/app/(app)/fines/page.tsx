import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FinesTable } from "@/features/fines/FinesTable";

interface FinesPageProps {
  searchParams: Promise<{ tab?: string }>;
}

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

  const serializedFines = fines.map((f) => ({
    ...f,
    amount: Number(f.amount),
  }));

  const unpaidCount = serializedFines.filter((f) => f.status === "UNPAID").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Fines</h1>
        <span className="text-sm text-muted-foreground">
          {unpaidCount} unpaid
        </span>
      </div>
      <FinesTable fines={serializedFines} activeTab={activeTab} />
    </div>
  );
}
