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
    const loan = await prisma.$transaction(async (tx) => {
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

export async function returnBook(
  loanId: string
): Promise<ActionResult<{ holdTriggered: boolean; holdMemberName?: string }>> {
  // Step 1: Auth guard (T-02-06 — requireRole first, middleware not trusted CVE-2025-29927)
  try {
    await requireRole("LIBRARIAN");
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "FORBIDDEN",
    };
  }

  // Step 2: Run everything inside a single transaction (T-02-08 — atomic return)
  try {
    const data = await prisma.$transaction(
      async (tx) => {
        // Load the loan with copy (including bookId) and member info
        const loan = await tx.loan.findUnique({
          where: { id: loanId },
          include: {
            copy: { include: { book: true } },
            member: { include: { user: true } },
          },
        });

        if (!loan) {
          throw new Error("NOT_FOUND");
        }

        // Guard: reject double-return (T-02-07 idempotency)
        if (loan.returnedAt !== null) {
          throw new Error("ALREADY_RETURNED");
        }

        const now = new Date();
        const bookId = loan.copy.bookId;

        // Compute overdue days using UTC epoch math (PITFALLS section 4 — no toLocaleDateString)
        const overdueMs = now.getTime() - new Date(loan.dueAt).getTime();
        const overdueDays = Math.max(0, Math.ceil(overdueMs / (24 * 60 * 60 * 1000)));

        // Create fine if overdue (T-02-10 — amount derived server-side from policy)
        if (overdueDays > 0) {
          const policy = await tx.loanPolicy.findUnique({
            where: { memberType: loan.member.memberType },
          });

          if (policy) {
            const fineAmount = Number(policy.fineDailyRate) * overdueDays;
            await tx.fine.create({
              data: {
                loanId,
                memberId: loan.memberId,
                amount: fineAmount,
                reason: "OVERDUE",
                status: "UNPAID",
              },
            });
          }
          // Fallback: if no policy found, skip fine but still close the loan
          // (can happen if policy was deleted after the loan was issued)
        }

        // Close the loan
        await tx.loan.update({
          where: { id: loanId },
          data: { returnedAt: now, status: "RETURNED" },
        });

        // Hold check (D-09): find earliest PENDING reservation for this book title
        const pendingReservation = await tx.reservation.findFirst({
          where: { bookId, status: "PENDING" },
          orderBy: [{ queuePosition: "asc" }, { requestedAt: "asc" }],
          include: { member: { include: { user: true } } },
        });

        if (pendingReservation) {
          // Set copy to RESERVED and advance the reservation to READY
          await tx.bookCopy.update({
            where: { id: loan.copyId },
            data: { status: "RESERVED" },
          });

          await tx.reservation.update({
            where: { id: pendingReservation.id },
            data: { status: "READY", notifiedAt: now },
          });

          return {
            holdTriggered: true,
            holdMemberName: pendingReservation.member.user.name,
          };
        } else {
          // No hold: set copy back to AVAILABLE
          await tx.bookCopy.update({
            where: { id: loan.copyId },
            data: { status: "AVAILABLE" },
          });

          return { holdTriggered: false };
        }
      }
    );

    // Step 3: Revalidate pages and return success
    revalidatePath("/loans");
    revalidatePath("/my-loans");
    return { success: true, data };
  } catch (err) {
    if (err instanceof Error && err.message === "ALREADY_RETURNED") {
      return { success: false, error: "ALREADY_RETURNED" };
    }
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return { success: false, error: "NOT_FOUND" };
    }
    console.error("[returnBook]", err);
    return { success: false, error: "DB_ERROR" };
  }
}
