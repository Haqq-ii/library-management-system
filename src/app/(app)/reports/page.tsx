import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getFineSummary } from "@/features/reports/actions";
import { FineSummaryCards } from "@/features/reports/FineSummaryCards";
import { getOverdueLoans } from "@/features/reports/overdue";
import { OverdueLoansTable } from "@/features/reports/OverdueLoansTable";

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
          <p className="text-sm text-muted-foreground py-12 text-center">
            Coming soon
          </p>
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
