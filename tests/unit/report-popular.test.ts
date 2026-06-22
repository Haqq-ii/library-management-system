import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/require-role", () => ({
  requireRole: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    loan: {
      groupBy: vi.fn(),
    },
    bookCopy: {
      findMany: vi.fn(),
    },
  },
}));

import { getPopularBooks, type PopularBookRow } from "@/features/reports/popular";
import { requireRole } from "@/lib/require-role";
import { prisma } from "@/lib/db";

describe("getPopularBooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Test 1: requireRole rejects → FORBIDDEN, no DB query", async () => {
    vi.mocked(requireRole).mockRejectedValue(new Error("FORBIDDEN"));

    const result = await getPopularBooks({});

    expect(result).toEqual({ success: false, error: "FORBIDDEN" });
    expect(prisma.loan.groupBy).not.toHaveBeenCalled();
  });

  it("Test 2: LIBRARIAN with no fromDate/toDate → default 30-day window, returns ranked rows", async () => {
    vi.mocked(requireRole).mockResolvedValue({ user: { id: "lib-1", role: "LIBRARIAN" } } as never);

    // groupBy returns copy-level counts
    vi.mocked(prisma.loan.groupBy).mockResolvedValue([
      { copyId: "copy-1", _count: { _all: 2 } },
      { copyId: "copy-3", _count: { _all: 1 } },
    ] as never);

    // bookCopy.findMany resolves copy → book info
    vi.mocked(prisma.bookCopy.findMany).mockResolvedValue([
      { id: "copy-1", book: { id: "book-A", title: "Dune", author: { name: "Frank Herbert" } } },
      { id: "copy-3", book: { id: "book-B", title: "1984", author: { name: "George Orwell" } } },
    ] as never);

    const beforeCall = new Date();
    const result = await getPopularBooks({});

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Expected success");

    // Verify date window passed to groupBy
    const callArg = vi.mocked(prisma.loan.groupBy).mock.calls[0][0] as {
      where: { issuedAt: { gte: Date; lte: Date } };
    };
    const gteDate = callArg.where.issuedAt.gte;
    const thirtyDaysAgo = new Date(beforeCall.getTime() - 30 * 86400000);
    expect(Math.abs(gteDate.getTime() - thirtyDaysAgo.getTime())).toBeLessThan(5000);

    expect(result.data).toHaveLength(2);
    expect(result.data[0].bookId).toBe("book-A");
    expect(result.data[0].borrowCount).toBe(2);
  });

  it("Test 3: provided fromDate/toDate → groupBy uses parsed dates with end-of-day for toDate", async () => {
    vi.mocked(requireRole).mockResolvedValue({ user: { id: "lib-1", role: "LIBRARIAN" } } as never);

    vi.mocked(prisma.loan.groupBy).mockResolvedValue([
      { copyId: "copy-1", _count: { _all: 1 } },
    ] as never);
    vi.mocked(prisma.bookCopy.findMany).mockResolvedValue([
      { id: "copy-1", book: { id: "book-A", title: "Dune", author: { name: "Frank Herbert" } } },
    ] as never);

    const result = await getPopularBooks({ fromDate: "2025-01-01", toDate: "2025-01-31" });

    expect(result.success).toBe(true);

    const callArg = vi.mocked(prisma.loan.groupBy).mock.calls[0][0] as {
      where: { issuedAt: { gte: Date; lte: Date } };
    };

    expect(callArg.where.issuedAt.gte.toISOString().startsWith("2025-01-01")).toBe(true);
    expect(callArg.where.issuedAt.lte.toISOString().startsWith("2025-01-31")).toBe(true);
    expect(callArg.where.issuedAt.lte.getUTCHours()).toBe(23);
    expect(callArg.where.issuedAt.lte.getUTCMinutes()).toBe(59);
    expect(callArg.where.issuedAt.lte.getUTCSeconds()).toBe(59);
  });

  it("Test 4: invalid date string is ignored, falls back to defaults — no NaN in query", async () => {
    vi.mocked(requireRole).mockResolvedValue({ user: { id: "lib-1", role: "LIBRARIAN" } } as never);
    vi.mocked(prisma.loan.groupBy).mockResolvedValue([] as never);

    const result = await getPopularBooks({ fromDate: "not-a-date", toDate: "also-invalid" });

    expect(result.success).toBe(true);

    const callArg = vi.mocked(prisma.loan.groupBy).mock.calls[0][0] as {
      where: { issuedAt: { gte: Date; lte: Date } };
    };

    expect(callArg.where.issuedAt.gte).toBeInstanceOf(Date);
    expect(callArg.where.issuedAt.lte).toBeInstanceOf(Date);
    expect(isNaN(callArg.where.issuedAt.gte.getTime())).toBe(false);
    expect(isNaN(callArg.where.issuedAt.lte.getTime())).toBe(false);
  });

  it("Test 5: book borrowed 3 times ranks above one borrowed 1 time; rows ordered descending", async () => {
    vi.mocked(requireRole).mockResolvedValue({ user: { id: "lib-1", role: "LIBRARIAN" } } as never);

    vi.mocked(prisma.loan.groupBy).mockResolvedValue([
      { copyId: "copy-1", _count: { _all: 3 } },
      { copyId: "copy-2", _count: { _all: 1 } },
    ] as never);
    vi.mocked(prisma.bookCopy.findMany).mockResolvedValue([
      { id: "copy-1", book: { id: "book-A", title: "Popular Book", author: { name: "Author A" } } },
      { id: "copy-2", book: { id: "book-B", title: "Less Popular", author: { name: "Author B" } } },
    ] as never);

    const result = await getPopularBooks({});

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Expected success");

    expect(result.data).toHaveLength(2);
    expect(result.data[0].bookId).toBe("book-A");
    expect(result.data[0].borrowCount).toBe(3);
    expect(result.data[1].bookId).toBe("book-B");
    expect(result.data[1].borrowCount).toBe(1);

    const row: PopularBookRow = result.data[0];
    expect(typeof row.bookId).toBe("string");
    expect(typeof row.title).toBe("string");
    expect(typeof row.author).toBe("string");
    expect(typeof row.borrowCount).toBe("number");
  });
});
