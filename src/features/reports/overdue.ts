"use server";

import { requireRole } from "@/lib/require-role";
import { prisma } from "@/lib/db";
import type { ActionResult } from "@/features/reports/actions";

export type OverdueLoanRow = {
  id: string;
  memberName: string;
  bookTitle: string;
  dueAt: string;
  daysLate: number;
};

export async function getOverdueLoans(): Promise<ActionResult<OverdueLoanRow[]>> {
  // Enforce LIBRARIAN-only access (T-05-04)
  try {
    await requireRole("LIBRARIAN");
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "FORBIDDEN",
    };
  }

  try {
    const now = new Date();

    const loans = await prisma.loan.findMany({
      where: {
        returnedAt: null,
        dueAt: { lt: now },
      },
      include: {
        copy: { include: { book: true } },
        member: { include: { user: true } },
      },
      orderBy: { dueAt: "asc" },
    });

    const rows: OverdueLoanRow[] = loans.map((loan: {
      id: string;
      dueAt: Date;
      member: { user: { name: string } };
      copy: { book: { title: string } };
    }) => ({
      id: loan.id,
      memberName: loan.member.user.name,
      bookTitle: loan.copy.book.title,
      dueAt: loan.dueAt.toISOString(),
      daysLate: Math.floor(
        (now.getTime() - loan.dueAt.getTime()) / 86_400_000
      ),
    }));

    return { success: true, data: rows };
  } catch (err) {
    console.error("[getOverdueLoans]", err);
    return { success: false, error: "DB_ERROR" };
  }
}
