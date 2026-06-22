"use server";

import { requireRole } from "@/lib/require-role";
import { prisma } from "@/lib/db";
import type { ActionResult } from "@/features/reports/actions";

export type PopularBookRow = {
  bookId: string;
  title: string;
  author: string;
  borrowCount: number;
};

export async function getPopularBooks(params: {
  fromDate?: string;
  toDate?: string;
}): Promise<ActionResult<PopularBookRow[]>> {
  // Enforce LIBRARIAN-only access (T-05-07)
  try {
    await requireRole("LIBRARIAN");
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "FORBIDDEN",
    };
  }

  // Safe date parsing: fall back to defaults for invalid/missing dates (T-05-08)
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
      // Inclusive end-of-day (T-05-08, matches audit/actions.ts pattern)
      parsed.setUTCHours(23, 59, 59, 999);
      to = parsed;
    }
  }

  // Guard against inverted date range — PostgreSQL would return 0 rows silently
  if (from > to) {
    return { success: false, error: "INVALID_DATE_RANGE" };
  }

  try {
    // Aggregate loan counts per copy at the DB level — avoids loading all rows into Node.js memory
    const groups = await prisma.loan.groupBy({
      by: ["copyId"],
      where: { issuedAt: { gte: from, lte: to } },
      _count: { _all: true },
      orderBy: { _count: { copyId: "desc" } },
      take: 50,
    });

    if (groups.length === 0) {
      return { success: true, data: [] };
    }

    // Resolve book info for the top-50 copyIds with a single findMany
    const copyIds = groups.map((g) => g.copyId);
    const copies = await prisma.bookCopy.findMany({
      where: { id: { in: copyIds } },
      include: { book: { include: { author: true } } },
    });

    // Build a lookup map from copyId → book info
    const copyMap = new Map(
      copies.map((c: {
        id: string;
        book: { id: string; title: string; author: { name: string } };
      }) => [c.id, c.book])
    );

    // Merge group counts with book info, aggregating counts per book
    // (multiple copies of the same book are merged into one row)
    const bookAgg = new Map<
      string,
      { title: string; author: string; borrowCount: number }
    >();

    for (const group of groups) {
      const book = copyMap.get(group.copyId);
      if (!book) continue;
      const existing = bookAgg.get(book.id);
      if (existing) {
        existing.borrowCount += group._count._all;
      } else {
        bookAgg.set(book.id, {
          title: book.title,
          author: book.author.name,
          borrowCount: group._count._all,
        });
      }
    }

    // Sort by borrow count descending (already roughly sorted, but re-sort after book merging)
    const rows: PopularBookRow[] = Array.from(bookAgg.entries())
      .map(([bookId, data]) => ({ bookId, ...data }))
      .sort((a, b) => b.borrowCount - a.borrowCount)
      .slice(0, 50);

    return { success: true, data: rows };
  } catch (err) {
    console.error("[getPopularBooks]", err);
    return { success: false, error: "DB_ERROR" };
  }
}
