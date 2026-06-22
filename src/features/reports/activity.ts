"use server";

import { requireRole } from "@/lib/require-role";
import { prisma } from "@/lib/db";
import type { ActionResult } from "@/features/reports/actions";

export type ActivityPoint = {
  date: string;       // YYYY-MM-DD (UTC)
  loanCount: number;
  returnCount: number;
};

export async function getBorrowingActivity(params: {
  fromDate?: string;
  toDate?: string;
}): Promise<ActionResult<ActivityPoint[]>> {
  // Enforce LIBRARIAN-only access (T-05-10)
  try {
    await requireRole("LIBRARIAN");
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "FORBIDDEN",
    };
  }

  // Safe date parsing: fall back to defaults for invalid/missing dates (T-05-11)
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 30 * 86_400_000);

  let from = defaultFrom;
  if (params.fromDate) {
    const parsed = new Date(params.fromDate);
    if (!isNaN(parsed.getTime())) {
      from = parsed;
    }
  }

  let to = now;
  if (params.toDate) {
    const parsed = new Date(params.toDate);
    if (!isNaN(parsed.getTime())) {
      // Inclusive end-of-day (matches audit/actions.ts + popular.ts pattern)
      parsed.setUTCHours(23, 59, 59, 999);
      to = parsed;
    }
  }

  // Guard against inverted date range — PostgreSQL would return 0 rows silently
  if (from > to) {
    return { success: false, error: "INVALID_DATE_RANGE" };
  }

  try {
    // Run both queries in parallel (T-05-12 — two bounded findMany selects, no N+1)
    const [issuedLoans, returnedLoans] = await Promise.all([
      prisma.loan.findMany({
        where: {
          issuedAt: {
            gte: from,
            lte: to,
          },
        },
        select: { issuedAt: true },
      }),
      prisma.loan.findMany({
        where: {
          returnedAt: {
            gte: from,
            lte: to,
          },
        },
        select: { returnedAt: true },
      }),
    ]);

    // Build a map: YYYY-MM-DD (UTC) → { loanCount, returnCount }
    const dayMap = new Map<string, { loanCount: number; returnCount: number }>();

    const getOrCreate = (day: string) => {
      if (!dayMap.has(day)) {
        dayMap.set(day, { loanCount: 0, returnCount: 0 });
      }
      return dayMap.get(day)!;
    };

    for (const loan of issuedLoans as Array<{ issuedAt: Date }>) {
      const day = loan.issuedAt.toISOString().slice(0, 10);
      getOrCreate(day).loanCount += 1;
    }

    for (const loan of returnedLoans as Array<{ returnedAt: Date | null }>) {
      if (loan.returnedAt) {
        const day = loan.returnedAt.toISOString().slice(0, 10);
        getOrCreate(day).returnCount += 1;
      }
    }

    // Generate continuous ordered array of ActivityPoints from `from` day to `to` day
    // inclusive (one per UTC day), filling missing days with zeros
    const points: ActivityPoint[] = [];
    // Normalize from to start-of-UTC-day
    const fromDay = new Date(
      Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
    );
    // Normalize to to start-of-UTC-day
    const toDay = new Date(
      Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate())
    );

    const current = new Date(fromDay);
    while (current <= toDay) {
      const dateStr = current.toISOString().slice(0, 10);
      const entry = dayMap.get(dateStr) ?? { loanCount: 0, returnCount: 0 };
      points.push({ date: dateStr, loanCount: entry.loanCount, returnCount: entry.returnCount });
      // Advance to next UTC day
      current.setUTCDate(current.getUTCDate() + 1);
    }

    return { success: true, data: points };
  } catch (err) {
    console.error("[getBorrowingActivity]", err);
    return { success: false, error: "DB_ERROR" };
  }
}
