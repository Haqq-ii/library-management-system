"use server";

import { requireRole } from "@/lib/require-role";
import { prisma } from "@/lib/db";

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export type MemberSearchResult = {
  id: string;
  name: string;
  memberNumber: string;
  memberType: string;
};

export type BookSearchResult = {
  id: string;
  title: string;
  author: string;
  isbn: string;
  availableCount: number;
};

export async function searchMembers(
  query: string
): Promise<ActionResult<MemberSearchResult[]>> {
  await requireRole("LIBRARIAN");

  try {
    const members = await prisma.member.findMany({
      where: {
        user: { deletedAt: null },
        ...(query.trim()
          ? {
              OR: [
                { user: { name: { contains: query, mode: "insensitive" } } },
                { user: { email: { contains: query, mode: "insensitive" } } },
                { memberNumber: { contains: query, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: { user: true },
      take: 10,
      orderBy: { user: { name: "asc" } },
    });

    return {
      success: true,
      data: members.map((m) => ({
        id: m.id,
        name: m.user.name,
        memberNumber: m.memberNumber,
        memberType: m.memberType,
      })),
    };
  } catch {
    return { success: false, error: "SEARCH_ERROR" };
  }
}

export async function searchBooks(
  query: string
): Promise<ActionResult<BookSearchResult[]>> {
  await requireRole("LIBRARIAN");

  try {
    const books = await prisma.book.findMany({
      where: {
        deletedAt: null,
        ...(query.trim()
          ? {
              OR: [
                { title: { contains: query, mode: "insensitive" } },
                { isbn: { contains: query } },
                { author: { name: { contains: query, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      include: { copies: true, author: true },
      take: 10,
      orderBy: { title: "asc" },
    });

    return {
      success: true,
      data: books.map((b: { id: string; title: string; author: { name: string }; isbn: string; copies: { status: string }[] }) => ({
        id: b.id,
        title: b.title,
        author: b.author.name,
        isbn: b.isbn,
        availableCount: b.copies.filter((c: { status: string }) => c.status === "AVAILABLE").length,
      })),
    };
  } catch {
    return { success: false, error: "SEARCH_ERROR" };
  }
}
