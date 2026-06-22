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
    // Run all three aggregates in parallel for efficiency
    const [recordedAgg, waivedAgg, paidAgg] = await Promise.all([
      // Sum of ALL fines (no status filter) — total fines recorded
      prisma.fine.aggregate({ _sum: { amount: true } }),
      // Sum of WAIVED fines
      prisma.fine.aggregate({ _sum: { amount: true }, where: { status: "WAIVED" } }),
      // Sum of PAID fines
      prisma.fine.aggregate({ _sum: { amount: true }, where: { status: "PAID" } }),
    ]);

    // Convert Prisma Decimal to number; coerce null sums to 0
    const recorded = Number(recordedAgg._sum.amount ?? 0);
    const waived   = Number(waivedAgg._sum.amount ?? 0);
    const paid     = Number(paidAgg._sum.amount ?? 0);
    // Outstanding = only UNPAID fines (recorded minus both waived and paid)
    const outstanding = recorded - waived - paid;

    return {
      success: true,
      data: { recorded, waived, outstanding },
    };
  } catch (err) {
    console.error("[getFineSummary]", err);
    return { success: false, error: "DB_ERROR" };
  }
}
