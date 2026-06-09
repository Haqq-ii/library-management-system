import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function MyProfilePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const member = await prisma.member.findUnique({
    where: { userId: session.user.id },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">My Profile</h1>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-base font-medium">Account details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-[120px_1fr] gap-y-3 text-sm">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium">{session.user.name}</span>

            <span className="text-muted-foreground">Email</span>
            <span>{session.user.email}</span>

            <span className="text-muted-foreground">Role</span>
            <span>
              <Badge variant="outline">
                {session.user.role === "LIBRARIAN" ? "Librarian" : "Member"}
              </Badge>
            </span>

            {member && (
              <>
                <span className="text-muted-foreground">Member #</span>
                <span className="font-mono text-xs">{member.memberNumber}</span>

                <span className="text-muted-foreground">Type</span>
                <span>
                  <Badge variant="outline">{member.memberType}</Badge>
                </span>

                <span className="text-muted-foreground">Status</span>
                <span>
                  {member.isActive ? (
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="destructive">Inactive</Badge>
                  )}
                </span>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
