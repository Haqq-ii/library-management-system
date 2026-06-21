"use server";

import { requireRole } from "@/lib/require-role";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { hashPassword } from "better-auth/crypto";

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

const CreateMemberSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  memberType: z.enum(["STUDENT", "FACULTY"]),
});

const UpdateMemberSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  memberType: z.enum(["STUDENT", "FACULTY"]),
});

export async function createMember(raw: unknown): Promise<ActionResult<{ id: string }>> {
  // Capture session for AuditLog actorId (AUD-01)
  let session;
  try {
    session = await requireRole("LIBRARIAN");
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "FORBIDDEN" };
  }

  const parsed = CreateMemberSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: "INVALID_INPUT" };

  const existing = await prisma.user.findFirst({ where: { email: parsed.data.email } });
  if (existing) return { success: false, error: "EMAIL_EXISTS" };

  try {
    const hashed = await hashPassword(parsed.data.password);
    const memberNumber = `M-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const userId = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: parsed.data.email,
          name: parsed.data.name,
          emailVerified: true,
          role: "MEMBER",
        },
      });

      await tx.account.create({
        data: {
          accountId: user.id,
          providerId: "credential",
          userId: user.id,
          password: hashed,
        },
      });

      await tx.member.create({
        data: {
          userId: user.id,
          memberNumber,
          memberType: parsed.data.memberType,
        },
      });

      // AuditLog write inside the same transaction (T-03-05-05, AUD-01)
      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          action: "MEMBER_ADDED",
          entityType: "Member",
          entityId: user.id,
          details: {
            description: `Registered member ${parsed.data.name} (${parsed.data.email}) as ${parsed.data.memberType}`,
            memberId: user.id,
            name: parsed.data.name,
            email: parsed.data.email,
            memberType: parsed.data.memberType,
          },
        },
      });

      return user.id;
    });

    revalidatePath("/members");
    return { success: true, data: { id: userId } };
  } catch (err: any) {
    if (err?.code === "P2002") return { success: false, error: "EMAIL_EXISTS" };
    console.error("[createMember]", err);
    return { success: false, error: "DB_ERROR" };
  }
}

export async function updateMember(id: string, raw: unknown): Promise<ActionResult<void>> {
  // Capture session for AuditLog actorId (AUD-01)
  let session;
  try {
    session = await requireRole("LIBRARIAN");
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "FORBIDDEN" };
  }

  const parsed = UpdateMemberSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: "INVALID_INPUT" };

  try {
    // Wrap both updates and audit write in a single transaction (T-03-05-05)
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { name: parsed.data.name, email: parsed.data.email },
      });

      await tx.member.update({
        where: { userId: id },
        data: { memberType: parsed.data.memberType },
      });

      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          action: "MEMBER_EDITED",
          entityType: "Member",
          entityId: id,
          details: {
            description: `Updated member ${parsed.data.name}'s profile`,
            memberId: id,
            name: parsed.data.name,
          },
        },
      });
    });

    revalidatePath("/members");
    return { success: true, data: undefined };
  } catch (err) {
    console.error("[updateMember]", err);
    return { success: false, error: "DB_ERROR" };
  }
}

export async function softDeleteMember(id: string): Promise<ActionResult<void>> {
  // Capture session for AuditLog actorId (AUD-01)
  let session;
  try {
    session = await requireRole("LIBRARIAN");
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "FORBIDDEN" };
  }

  try {
    // Wrap user update and audit write in a single transaction (T-03-05-05)
    await prisma.$transaction(async (tx) => {
      // Read user name before soft-delete for audit description
      const existingUser = await tx.user.findUnique({
        where: { id },
        select: { name: true },
      });

      await tx.user.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          action: "MEMBER_DEACTIVATED",
          entityType: "Member",
          entityId: id,
          details: {
            description: `Deactivated member ${existingUser?.name ?? id}'s account`,
            memberId: id,
            name: existingUser?.name ?? id,
          },
        },
      });
    });

    revalidatePath("/members");
    return { success: true, data: undefined };
  } catch (err) {
    console.error("[softDeleteMember]", err);
    return { success: false, error: "DB_ERROR" };
  }
}
