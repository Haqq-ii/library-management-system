import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MyReservationsClient } from "@/features/reservations/MyReservationsClient";

export default async function MyReservationsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  // No role check — any authenticated user with a member record can view (T-03-03-04)

  const member = await prisma.member.findUnique({
    where: { userId: session.user.id },
    include: {
      reservations: {
        include: { book: true },
        orderBy: { requestedAt: "desc" },
      },
    },
  });

  if (!member) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">My Reservations</h1>
        <p className="text-muted-foreground">
          No member record found for your account.
        </p>
      </div>
    );
  }

  const reservations = member.reservations;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold">My Reservations</h1>
        <span className="text-sm text-muted-foreground">
          ({reservations.length} reservations)
        </span>
      </div>
      <MyReservationsClient reservations={reservations} />
    </div>
  );
}
