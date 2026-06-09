"use server";

import { requireRole } from "@/lib/require-role";
import { prisma } from "@/lib/db";

export type BookCardData = {
  id: string;
  title: string;
  author: string;
  availableCount: number;
  totalCount: number;
};

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function searchCatalog(
  query: string
): Promise<ActionResult<BookCardData[]>> {
  await requireRole("MEMBER");

  try {
    const books = await prisma.book.findMany({
      where: {
        deletedAt: null,
        ...(query.trim()
          ? {
              OR: [
                { title: { contains: query, mode: "insensitive" } },
                { author: { name: { contains: query, mode: "insensitive" } } },
                { isbn: { contains: query } },
              ],
            }
          : {}),
      },
      include: { copies: true, author: true },
      take: 20,
      orderBy: { title: "asc" },
    });

    return {
      success: true,
      data: books.map((book) => ({
        id: book.id,
        title: book.title,
        author: book.author.name,
        availableCount: book.copies.filter((c) => c.status === "AVAILABLE")
          .length,
        totalCount: book.copies.length,
      })),
    };
  } catch {
    return { success: false, error: "SEARCH_ERROR" };
  }
}
