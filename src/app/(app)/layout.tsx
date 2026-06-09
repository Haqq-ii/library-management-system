/**
 * src/app/(app)/layout.tsx
 *
 * Session-gated app shell.
 *
 * This redirect is a UX convenience — it prevents unnecessary round-trips to the
 * server when the session cookie is absent. It is NOT the security boundary.
 * Every Server Action still calls requireRole() independently (CVE-2025-29927).
 */
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { AppSidebar } from "@/components/layout/AppSidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar
        role={session.user.role as "LIBRARIAN" | "MEMBER"}
        user={{
          name: session.user.name ?? session.user.email,
          email: session.user.email,
        }}
      />
      <main
        id="main"
        className="flex-1 overflow-y-auto p-6"
      >
        {children}
      </main>
    </div>
  );
}
