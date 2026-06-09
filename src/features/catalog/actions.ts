"use server";

import { requireRole } from "@/lib/require-role";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { revalidatePath } from "next/cache";

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

const BookSchema = z.object({
  isbn: z.string().min(10).max(13),
  title: z.string().min(1),
  authorName: z.string().min(1),
  genre: z.string().optional(),
  publisher: z.string().optional(),
  publishedYear: z.number().int().optional(),
});

// Zod schema for Open Library API response — prevents response injection (T-06)
const OpenLibraryEntrySchema = z.object({
  title: z.string().optional(),
  authors: z.array(z.object({ name: z.string() })).optional(),
  publishers: z.array(z.object({ name: z.string() })).optional(),
  publish_date: z.string().nullable().optional(),
});

export async function createBook(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  try {
    await requireRole("LIBRARIAN");
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "FORBIDDEN" };
  }

  const parsed = BookSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: "INVALID_INPUT" };
  }

  try {
    const author = await prisma.author.upsert({
      where: { name: parsed.data.authorName },
      update: {},
      create: { name: parsed.data.authorName },
    });

    const book = await prisma.book.create({
      data: {
        isbn: parsed.data.isbn,
        title: parsed.data.title,
        authorId: author.id,
        genre: parsed.data.genre,
        publisher: parsed.data.publisher,
        publishedYear: parsed.data.publishedYear,
      },
    });

    revalidatePath("/books");
    return { success: true, data: { id: book.id } };
  } catch (err) {
    console.error("[createBook]", err);
    return { success: false, error: "DB_ERROR" };
  }
}

export async function updateBook(
  id: string,
  raw: unknown
): Promise<ActionResult<void>> {
  try {
    await requireRole("LIBRARIAN");
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "FORBIDDEN" };
  }

  const parsed = BookSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: "INVALID_INPUT" };
  }

  try {
    const author = await prisma.author.upsert({
      where: { name: parsed.data.authorName },
      update: {},
      create: { name: parsed.data.authorName },
    });

    await prisma.book.update({
      where: { id },
      data: {
        isbn: parsed.data.isbn,
        title: parsed.data.title,
        authorId: author.id,
        genre: parsed.data.genre,
        publisher: parsed.data.publisher,
        publishedYear: parsed.data.publishedYear,
      },
    });

    revalidatePath("/books");
    return { success: true, data: undefined };
  } catch (err) {
    console.error("[updateBook]", err);
    return { success: false, error: "DB_ERROR" };
  }
}

export async function softDeleteBook(id: string): Promise<ActionResult<void>> {
  try {
    await requireRole("LIBRARIAN");
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "FORBIDDEN" };
  }

  try {
    await prisma.book.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    revalidatePath("/books");
    return { success: true, data: undefined };
  } catch (err) {
    console.error("[softDeleteBook]", err);
    return { success: false, error: "DB_ERROR" };
  }
}

export { addCopy, setCopyStatus } from "./copy-actions";

export async function fetchBookByISBN(isbn: string): Promise<
  ActionResult<{
    title: string | null;
    author: string | null;
    publisher: string | null;
    publishedYear: number | null;
  }>
> {
  try {
    await requireRole("LIBRARIAN");
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "FORBIDDEN" };
  }

  const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": "LibraryManagementSystem/1.0 contact@library.edu" },
      next: { revalidate: 86400 },
    });
  } catch {
    return { success: false, error: "API_UNREACHABLE" };
  }

  if (!res.ok) return { success: false, error: "API_UNREACHABLE" };

  const raw = await res.json();
  const key = `ISBN:${isbn}`;
  if (!raw[key]) return { success: false, error: "ISBN_NOT_FOUND" };

  const parsed = OpenLibraryEntrySchema.safeParse(raw[key]);
  if (!parsed.success) return { success: false, error: "ISBN_NOT_FOUND" };

  const entry = parsed.data;
  return {
    success: true,
    data: {
      title: entry.title ?? null,
      author: entry.authors?.[0]?.name ?? null,
      publisher: entry.publishers?.[0]?.name ?? null,
      publishedYear: entry.publish_date ? parseInt(entry.publish_date) || null : null,
    },
  };
}
