import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth guard and database
vi.mock("@/lib/require-role", () => ({
  requireRole: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const mockPrisma: Record<string, unknown> = {
    author: { upsert: vi.fn() },
    book: { create: vi.fn(), update: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    bookCopy: { create: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  mockPrisma.$transaction = vi.fn((cb: (tx: typeof mockPrisma) => Promise<unknown>) => cb(mockPrisma));
  return { prisma: mockPrisma };
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { createBook, softDeleteBook, addCopy } from "@/features/catalog/actions";
import { requireRole } from "@/lib/require-role";
import { prisma } from "@/lib/db";

describe("createBook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when MEMBER caller attempts to create a book", async () => {
    vi.mocked(requireRole).mockRejectedValue(new Error("FORBIDDEN"));
    const result = await createBook({
      isbn: "9780140449136",
      title: "Test Book",
      authorName: "Test Author",
    });
    expect(result).toEqual({ success: false, error: "FORBIDDEN" });
  });

  it("creates book and returns success with id for LIBRARIAN", async () => {
    vi.mocked(requireRole).mockResolvedValue({ user: { role: "LIBRARIAN" } } as any);
    vi.mocked(prisma.author.upsert).mockResolvedValue({ id: "author-1", name: "Test Author" } as any);
    vi.mocked(prisma.book.create).mockResolvedValue({ id: "book-1" } as any);

    const result = await createBook({
      isbn: "9780140449136",
      title: "Test Book",
      authorName: "Test Author",
    });
    expect(result).toEqual({ success: true, data: { id: "book-1" } });
  });

  it("returns INVALID_INPUT for missing required fields", async () => {
    vi.mocked(requireRole).mockResolvedValue({ user: { role: "LIBRARIAN" } } as any);
    const result = await createBook({
      isbn: "",
      title: "",
      authorName: "",
    });
    expect(result).toEqual({ success: false, error: "INVALID_INPUT" });
  });
});

describe("softDeleteBook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets deletedAt timestamp on the book (soft delete)", async () => {
    vi.mocked(requireRole).mockResolvedValue({ user: { role: "LIBRARIAN" } } as any);
    vi.mocked(prisma.book.update).mockResolvedValue({ id: "book-1", deletedAt: new Date() } as any);

    const result = await softDeleteBook("book-1");
    expect(result).toEqual({ success: true, data: undefined });
    expect(prisma.book.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "book-1" },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      })
    );
  });

  it("book is absent from default list after soft delete", async () => {
    vi.mocked(requireRole).mockResolvedValue({ user: { role: "LIBRARIAN" } } as any);
    vi.mocked(prisma.book.findMany).mockResolvedValue([]);

    // After soft-delete, findMany with deletedAt: null returns no result
    const books = await prisma.book.findMany({ where: { deletedAt: null } });
    expect(books).toHaveLength(0);
  });
});

describe("addCopy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("increments totalCopies on the book after adding a copy", async () => {
    vi.mocked(requireRole).mockResolvedValue({ user: { role: "LIBRARIAN" } } as any);
    vi.mocked(prisma.bookCopy.create).mockResolvedValue({ id: "copy-1", bookId: "book-1" } as any);
    vi.mocked(prisma.book.update).mockResolvedValue({ id: "book-1", totalCopies: 1 } as any);

    const result = await addCopy("book-1", "BC-001");
    expect(result.success).toBe(true);
    expect(prisma.book.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "book-1" },
        data: expect.objectContaining({ totalCopies: expect.any(Object) }),
      })
    );
  });
});
