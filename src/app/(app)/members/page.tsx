import { prisma } from "@/lib/db";
import { MemberTable } from "@/features/members/MemberTable";

interface MembersPageProps {
  searchParams: Promise<{ inactive?: string }>;
}

export default async function MembersPage({ searchParams }: MembersPageProps) {
  const params = await searchParams;
  const showInactive = params.inactive === "1";

  const members = await prisma.user.findMany({
    where: showInactive
      ? { role: "MEMBER" }
      : { role: "MEMBER", deletedAt: null },
    include: { member: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Members</h1>
        <span className="text-sm text-muted-foreground">
          {members.length} member{members.length !== 1 ? "s" : ""}
        </span>
      </div>
      <MemberTable members={members} showInactive={showInactive} />
    </div>
  );
}
