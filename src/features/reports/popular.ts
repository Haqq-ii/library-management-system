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

  try {
    // Query loans in range with book info included
    const loans = await prisma.loan.findMany({
      where: {
        issuedAt: {
          gte: from,
          lte: to,
        },
      },
      include: {
        copy: {
          include: {
            book: {
              include: {
                author: true,
              },
            },
          },
        },
      },
    });

    // Aggregate counts per book in JS (Loan has copyId, not bookId directly)
    const bookMap = new Map<
      string,
      { title: string; author: string; borrowCount: number }
    >();

    for (const loan of loans as Array<{
      copy: {
        book: {
          id: string;
          title: string;
          author: { name: string };
        };
      };
    }>) {
      const book = loan.copy.book;
      const existing = bookMap.get(book.id);
      if (existing) {
        existing.borrowCount += 1;
      } else {
        bookMap.set(book.id, {
          title: book.title,
          author: book.author.name,
          borrowCount: 1,
        });
      }
    }

    // Produce sorted result — borrowCount descending, limit top 50 (T-05-09)
    const rows: PopularBookRow[] = Array.from(bookMap.entries())
      .map(([bookId, data]) => ({ bookId, ...data }))
      .sort((a, b) => b.borrowCount - a.borrowCount)
      .slice(0, 50);

    return { success: true, data: rows };
  } catch (err) {
    console.error("[getPopularBooks]", err);
    return { success: false, error: "DB_ERROR" };
  }
}
