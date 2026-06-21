"use server";

import { requireRole } from "@/lib/require-role";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { PICKUP_WINDOW_HOURS } from "@/lib/constants";

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

const CopyStatusSchema = z.enum([
  "AVAILABLE",
  "CHECKED_OUT",
  "RESERVED",
  "LOST",
  "WITHDRAWN",
]);

export async function addCopy(
  bookId: string,
  barcode?: string
): Promise<ActionResult<{ id: string }>> {
  try {
    await requireRole("LIBRARIAN");
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "FORBIDDEN",
    };
  }

  try {
    const generatedBarcode =
      barcode ??
      `BC-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    const copy = await prisma.bookCopy.create({
      data: { bookId, barcode: generatedBarcode, status: "AVAILABLE" },
    });

    await prisma.book.update({
      where: { id: bookId },
      data: { totalCopies: { increment: 1 } },
    });

    revalidatePath(`/books/${bookId}`);
    revalidatePath("/books");
    return { success: true, data: { id: copy.id } };
  } catch (err) {
    console.error("[addCopy]", err);
    return { success: false, error: "DB_ERROR" };
  }
}

export async function setCopyStatus(
  copyId: string,
  status: string
): Promise<ActionResult<void>> {
  try {
    await requireRole("LIBRARIAN");
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "FORBIDDEN",
    };
  }

  const parsed = CopyStatusSchema.safeParse(status);
  if (!parsed.success) {
    return { success: false, error: "INVALID_STATUS" };
  }

  try {
    const copy = await prisma.bookCopy.update({
      where: { id: copyId },
      data: { status: parsed.data },
    });

    revalidatePath(`/books/${copy.bookId}`);
    revalidatePath("/books");
    return { success: true, data: undefined };
  } catch (err) {
    console.error("[setCopyStatus]", err);
    return { success: false, error: "DB_ERROR" };
  }
}

export async function reserveBook(bookId: string): Promise<ActionResult<void>> {
  let session;
  try {
    session = await requireRole("MEMBER");
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "FORBIDDEN" };
  }

  try {
    const member = await prisma.member.findUnique({
      where: { userId: session.user.id },
    });
    if (!member) return { success: false, error: "NO_MEMBER" };

    const existing = await prisma.reservation.findFirst({
      where: { bookId, memberId: member.id, status: "PENDING" },
    });
    if (existing) return { success: false, error: "ALREADY_RESERVED" };

    // Wrap reservation creation in a transaction: lazy expiry → hold-advance → create PENDING
    // This ensures atomicity per T-03-03-03 (D-12 lazy cancellation + D-13 expiry-then-advance)
    await prisma.$transaction(async (tx) => {
      const now = new Date();
      const pickupWindowMs = PICKUP_WINDOW_HOURS * 60 * 60 * 1000;

      // Step 1: Lazy expiry — cancel READY reservations past the 48h pickup window (D-12)
      const expiredReady = await tx.reservation.findMany({
        where: {
          bookId,
          status: "READY",
          notifiedAt: { lt: new Date(now.getTime() - pickupWindowMs) },
        },
      });

      for (const expired of expiredReady) {
        await tx.reservation.update({
          where: { id: expired.id },
          data: { status: "CANCELLED" },
        });
      }

      // Step 2: If any READY reservations expired, advance the next PENDING to READY (D-13)
      if (expiredReady.length > 0) {
        const nextPending = await tx.reservation.findFirst({
          where: { bookId, status: "PENDING" },
          orderBy: [{ queuePosition: "asc" }, { requestedAt: "asc" }],
        });

        if (nextPending) {
          // Find a RESERVED copy that was freed by the expiry
          const reservedCopy = await tx.bookCopy.findFirst({
            where: { bookId, status: "RESERVED" },
          });

          if (reservedCopy) {
            // Advance next PENDING reservation to READY (hold-advance — D-13)
            await tx.reservation.update({
              where: { id: nextPending.id },
              data: { status: "READY", notifiedAt: now },
            });
            // Copy remains RESERVED — now assigned to the newly advanced reservation
          }
        }
      }

      // Step 3: Create the new PENDING reservation with correct queuePosition
      const last = await tx.reservation.findFirst({
        where: { bookId, status: "PENDING" },
        orderBy: { queuePosition: "desc" },
      });

      await tx.reservation.create({
        data: {
          bookId,
          memberId: member.id,
          status: "PENDING",
          queuePosition: (last?.queuePosition ?? 0) + 1,
        },
      });
    });

    revalidatePath("/catalog");
    return { success: true, data: undefined };
  } catch (err) {
    console.error("[reserveBook]", err);
    return { success: false, error: "DB_ERROR" };
  }
}

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
