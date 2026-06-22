import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getFineSummary } from "@/features/reports/actions";
import { FineSummaryCards } from "@/features/reports/FineSummaryCards";
import { getOverdueLoans } from "@/features/reports/overdue";
import { OverdueLoansTable } from "@/features/reports/OverdueLoansTable";
import { getPopularBooks } from "@/features/reports/popular";
import { PopularBooksTable } from "@/features/reports/PopularBooksTable";

export default async function ReportsPage() {
  // Auth guard: only librarians may access reports (T-05-01)
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (session.user.role !== "LIBRARIAN") redirect("/dashboard");

  // Fetch fine summary server-side (RPT-04)
  const result = await getFineSummary();
  const { recorded, waived, outstanding } = result.success
    ? result.data
    : { recorded: 0, waived: 0, outstanding: 0 };

  // Fetch overdue loans server-side (RPT-01)
  const overdueResult = await getOverdueLoans();
  const overdueRows = overdueResult.success ? overdueResult.data : [];

  // Fetch popular books server-side for default last-30-days range (RPT-02)
  const today = new Date();
  const toStr = today.toISOString().slice(0, 10);
  const fromStr = new Date(today.getTime() - 30 * 86_400_000).toISOString().slice(0, 10);
  const popularResult = await getPopularBooks({ fromDate: fromStr, toDate: toStr });
  const popularRows = popularResult.success ? popularResult.data : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Reports</h1>

      <Tabs defaultValue="overdue">
        <TabsList>
          <TabsTrigger value="overdue">Overdue Loans</TabsTrigger>
          <TabsTrigger value="popular">Popular Books</TabsTrigger>
          <TabsTrigger value="activity">Borrowing Activity</TabsTrigger>
          <TabsTrigger value="fines">Fine Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="overdue">
          <OverdueLoansTable rows={overdueRows} />
        </TabsContent>

        <TabsContent value="popular">
          <PopularBooksTable
            initialRows={popularRows}
            initialFrom={fromStr}
            initialTo={toStr}
          />
        </TabsContent>

        <TabsContent value="activity">
          <p className="text-sm text-muted-foreground py-12 text-center">
            Coming soon
          </p>
        </TabsContent>

        <TabsContent value="fines">
          <FineSummaryCards
            recorded={recorded}
            waived={waived}
            outstanding={outstanding}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
