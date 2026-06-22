import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { NotificationLogTable } from "@/features/notifications/NotificationLogTable";
import { getNotificationLog } from "@/features/notifications/actions";

interface NotificationsPageProps {
  searchParams: Promise<{ type?: string; page?: string }>;
}

export default async function NotificationsPage({
  searchParams,
}: NotificationsPageProps) {
  // Auth guard: only librarians may access the notification log (T-04-11)
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (session.user.role !== "LIBRARIAN") redirect("/dashboard");

  const params = await searchParams;
  const type = params.type ?? undefined;
  const page = parseInt(params.page ?? "1") || 1;

  // Fetch initial notification log data server-side (NOTF-04)
  const result = await getNotificationLog({ page, type });

  const entries = result.success ? result.data.entries : [];
  const total = result.success ? result.data.total : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Notification Log</h1>
      <NotificationLogTable entries={entries} total={total} page={page} />
    </div>
  );
}
