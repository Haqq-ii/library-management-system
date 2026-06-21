import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { AuditTable } from "@/features/audit/AuditTable";
import { getAuditLog } from "@/features/audit/actions";

interface AuditPageProps {
  searchParams: Promise<{ from?: string; to?: string; actions?: string; page?: string }>;
}

export default async function AuditPage({ searchParams }: AuditPageProps) {
  // Auth guard: only librarians may access the audit log (T-03-05-02)
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (session.user.role !== "LIBRARIAN") redirect("/dashboard");

  const params = await searchParams;
  const fromDate = params.from ?? undefined;
  const toDate = params.to ?? undefined;
  const actions = params.actions ? params.actions.split(",").filter(Boolean) : undefined;
  const page = parseInt(params.page ?? "1") || 1;

  // Fetch initial audit log data server-side (AUD-02)
  const result = await getAuditLog({ page, fromDate, toDate, actions });

  const entries = result.success ? result.data.entries : [];
  const total = result.success ? result.data.total : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Audit Log</h1>
      <AuditTable entries={entries} total={total} page={page} />
    </div>
  );
}
