"use server";

import { requireRole } from "@/lib/require-role";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { revalidatePath } from "next/cache";

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

const WaiveFineSchema = z.object({
  fineId: z.string().min(1),
  reason: z.string().min(1),
});

export async function waiveFine(raw: unknown): Promise<ActionResult<void>> {
  // Step 1: Auth — capture session for actorId
  let session;
  try {
    session = await requireRole("LIBRARIAN");
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "FORBIDDEN" };
  }

  // Step 2: Validate input
  const parsed = WaiveFineSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: "INVALID_INPUT" };

  const { fineId, reason } = parsed.data;

  // Step 3: Mutate + audit write in one transaction
  try {
    await prisma.$transaction(async (tx) => {
      const fine = await tx.fine.update({
        where: { id: fineId },
        data: {
          status: "WAIVED",
          waivedAt: new Date(),
          waivedBy: session.user.id,
          waivedReason: reason,
        },
        include: {
          member: { include: { user: true } },
          loan: { include: { copy: { include: { book: true } } } },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          action: "FINE_WAIVED",
          entityType: "Fine",
          entityId: fine.id,
          details: {
            description: `Waived $${Number(fine.amount).toFixed(2)} fine on '${fine.loan.copy.book.title}' for ${fine.member.user.name}. Reason: ${reason}`,
            fineId: fine.id,
            memberId: fine.memberId,
            memberName: fine.member.user.name,
            bookTitle: fine.loan.copy.book.title,
            amount: Number(fine.amount),
            reason,
          },
        },
      });
    });

    revalidatePath("/fines");
    return { success: true, data: undefined };
  } catch (err) {
    console.error("[waiveFine]", err);
    return { success: false, error: "DB_ERROR" };
  }
}
