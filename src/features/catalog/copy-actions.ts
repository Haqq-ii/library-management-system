"use server";

import { requireRole } from "@/lib/require-role";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { revalidatePath } from "next/cache";

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

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
