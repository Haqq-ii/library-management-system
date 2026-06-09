// src/lib/require-role.ts
// CVE-2025-29927 defense: requireRole() MUST be called from every Server Action
// and Route Handler that accesses protected data. Never rely on middleware alone.
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export type UserRole = "LIBRARIAN" | "MEMBER";

export async function requireRole(role: UserRole) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    throw new Error("UNAUTHENTICATED");
  }
  // Better Auth admin plugin stores role as string on session.user.role
  if (session.user.role !== role) {
    throw new Error("FORBIDDEN");
  }
  return session;
}
