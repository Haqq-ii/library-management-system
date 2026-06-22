"use server";

import { requireRole } from "@/lib/require-role";
import { prisma } from "@/lib/db";

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function getFineSummary(): Promise<
  ActionResult<{ recorded: number; waived: number; outstanding: number }>
> {
  // Enforce LIBRARIAN-only access (T-05-02)
  try {
    await requireRole("LIBRARIAN");
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "FORBIDDEN",
    };
  }

  try {
    // Sum of ALL fines (no status filter) — total fines recorded
    const recordedAgg = await prisma.fine.aggregate({
      _sum: { amount: true },
    });

    // Sum of WAIVED fines
    const waivedAgg = await prisma.fine.aggregate({
      _sum: { amount: true },
      where: { status: "WAIVED" },
    });

    // Convert Prisma Decimal to number; coerce null sums to 0
    const recorded = Number(recordedAgg._sum.amount ?? 0);
    const waived = Number(waivedAgg._sum.amount ?? 0);
    const outstanding = recorded - waived;

    return {
      success: true,
      data: { recorded, waived, outstanding },
    };
  } catch (err) {
    console.error("[getFineSummary]", err);
    return { success: false, error: "DB_ERROR" };
  }
}
