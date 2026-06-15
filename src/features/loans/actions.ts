"use server";

import { requireRole } from "@/lib/require-role";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { revalidatePath } from "next/cache";

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

const CheckoutSchema = z.object({
  memberId: z.string().min(1),
  bookId: z.string().min(1),
});

export async function checkoutBook(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  // Step 1: Auth guard (Pattern A — mutations)
  try {
    await requireRole("LIBRARIAN");
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "FORBIDDEN",
    };
  }

  // Step 2: Validate input
  const parsed = CheckoutSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: "INVALID_INPUT" };
  }
  const { memberId, bookId } = parsed.data;

  // Step 3: Look up member and loan policy
  const member = await prisma.member.findUnique({
    where: { id: memberId },
  });
  if (!member) {
    return { success: false, error: "INVALID_INPUT" };
  }

  const policy = await prisma.loanPolicy.findUnique({
    where: { memberType: member.memberType },
  });
  if (!policy) {
    return { success: false, error: "NO_POLICY" };
  }

  const loanDays = policy.loanDays;

  // Step 4: Run transaction with SELECT FOR UPDATE SKIP LOCKED
  try {
    const loan = await prisma.$transaction(async (tx: { $queryRaw: <T>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T>; bookCopy: { update: (args: unknown) => Promise<{ id: string }> }; loan: { create: (args: unknown) => Promise<{ id: string }> } }) => {
      // Lock the first AVAILABLE copy to prevent double-checkout (T-02-03)
      const copies = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "BookCopy"
        WHERE "bookId" = ${bookId} AND status = 'AVAILABLE'
        ORDER BY "addedAt" ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `;

      if (copies.length === 0) {
        throw new Error("NO_COPIES");
      }

      const copyId = copies[0].id;

      // Mark the copy as checked out
      await tx.bookCopy.update({
        where: { id: copyId },
        data: { status: "CHECKED_OUT" },
      });

      // Compute due date in UTC epoch math (PITFALLS section 4 — no local timezone)
      const dueAt = new Date(Date.now() + loanDays * 24 * 60 * 60 * 1000);

      // Create the loan record
      const newLoan = await tx.loan.create({
        data: {
          copyId,
          memberId,
          dueAt,
          status: "ACTIVE",
        },
      });

      return newLoan;
    });

    // Step 5: Revalidate pages and return success
    revalidatePath("/loans");
    revalidatePath("/my-loans");
    return { success: true, data: { id: loan.id } };
  } catch (err) {
    if (err instanceof Error && err.message === "NO_COPIES") {
      return { success: false, error: "NO_COPIES" };
    }
    console.error("[checkoutBook]", err);
    return { success: false, error: "DB_ERROR" };
  }
}
