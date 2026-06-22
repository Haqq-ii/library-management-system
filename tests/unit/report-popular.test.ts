import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth guard and database
vi.mock("@/lib/require-role", () => ({
  requireRole: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    loan: {
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
    expect(prisma.loan.findMany).not.toHaveBeenCalled();
  });

  it("Test 2: LIBRARIAN with no fromDate/toDate → default 30-day window, returns ranked rows", async () => {
    vi.mocked(requireRole).mockResolvedValue({ user: { id: "lib-1", role: "LIBRARIAN" } } as never);

    // Two loans for book-A, one for book-B
    const mockLoans = [
      {
        copyId: "copy-1",
        copy: { book: { id: "book-A", title: "Dune", author: { name: "Frank Herbert" } } },
      },
      {
        copyId: "copy-2",
        copy: { book: { id: "book-A", title: "Dune", author: { name: "Frank Herbert" } } },
      },
      {
        copyId: "copy-3",
        copy: { book: { id: "book-B", title: "1984", author: { name: "George Orwell" } } },
      },
    ];
    vi.mocked(prisma.loan.findMany).mockResolvedValue(mockLoans as never);

    const beforeCall = new Date();
    const result = await getPopularBooks({});

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Expected success");

    // Default window: gte should be ~30 days before now
    const callArg = vi.mocked(prisma.loan.findMany).mock.calls[0][0] as {
      where: { issuedAt: { gte: Date; lte: Date } };
    };
    const gteDate = callArg.where.issuedAt.gte;
    const lteDate = callArg.where.issuedAt.lte;

    expect(gteDate).toBeInstanceOf(Date);
    expect(lteDate).toBeInstanceOf(Date);
    // gte should be approximately 30 days ago
    const thirtyDaysAgo = new Date(beforeCall.getTime() - 30 * 86400000);
    expect(Math.abs(gteDate.getTime() - thirtyDaysAgo.getTime())).toBeLessThan(5000);

    // Returns ranked rows
    expect(result.data).toHaveLength(2);
    expect(result.data[0].bookId).toBe("book-A");
    expect(result.data[0].borrowCount).toBe(2);
  });

  it("Test 3: provided fromDate/toDate → query uses parsed dates with end-of-day for toDate", async () => {
    vi.mocked(requireRole).mockResolvedValue({ user: { id: "lib-1", role: "LIBRARIAN" } } as never);

    const mockLoans = [
      {
        copyId: "copy-1",
        copy: { book: { id: "book-A", title: "Dune", author: { name: "Frank Herbert" } } },
      },
    ];
    vi.mocked(prisma.loan.findMany).mockResolvedValue(mockLoans as never);

    const result = await getPopularBooks({ fromDate: "2025-01-01", toDate: "2025-01-31" });

    expect(result.success).toBe(true);

    const callArg = vi.mocked(prisma.loan.findMany).mock.calls[0][0] as {
      where: { issuedAt: { gte: Date; lte: Date } };
    };

    const gteDate = callArg.where.issuedAt.gte;
    const lteDate = callArg.where.issuedAt.lte;

    // gte = 2025-01-01
    expect(gteDate).toBeInstanceOf(Date);
    expect(gteDate.toISOString().startsWith("2025-01-01")).toBe(true);

    // lte = 2025-01-31 at end of day
    expect(lteDate).toBeInstanceOf(Date);
    expect(lteDate.toISOString().startsWith("2025-01-31")).toBe(true);
    expect(lteDate.getUTCHours()).toBe(23);
    expect(lteDate.getUTCMinutes()).toBe(59);
    expect(lteDate.getUTCSeconds()).toBe(59);
  });

  it("Test 4: invalid date string is ignored, falls back to defaults — no NaN in query", async () => {
    vi.mocked(requireRole).mockResolvedValue({ user: { id: "lib-1", role: "LIBRARIAN" } } as never);
    vi.mocked(prisma.loan.findMany).mockResolvedValue([] as never);

    const result = await getPopularBooks({ fromDate: "not-a-date", toDate: "also-invalid" });

    expect(result.success).toBe(true);

    const callArg = vi.mocked(prisma.loan.findMany).mock.calls[0][0] as {
      where: { issuedAt: { gte: Date; lte: Date } };
    };

    const gteDate = callArg.where.issuedAt.gte;
    const lteDate = callArg.where.issuedAt.lte;

    // Must be valid Date instances, NOT NaN
    expect(gteDate).toBeInstanceOf(Date);
    expect(lteDate).toBeInstanceOf(Date);
    expect(isNaN(gteDate.getTime())).toBe(false);
    expect(isNaN(lteDate.getTime())).toBe(false);
  });

  it("Test 5: book borrowed 3 times ranks above one borrowed 1 time; rows ordered descending", async () => {
    vi.mocked(requireRole).mockResolvedValue({ user: { id: "lib-1", role: "LIBRARIAN" } } as never);

    const mockLoans = [
      {
        copyId: "copy-1",
        copy: { book: { id: "book-A", title: "Popular Book", author: { name: "Author A" } } },
      },
      {
        copyId: "copy-1b",
        copy: { book: { id: "book-A", title: "Popular Book", author: { name: "Author A" } } },
      },
      {
        copyId: "copy-1c",
        copy: { book: { id: "book-A", title: "Popular Book", author: { name: "Author A" } } },
      },
      {
        copyId: "copy-2",
        copy: { book: { id: "book-B", title: "Less Popular", author: { name: "Author B" } } },
      },
    ];
    vi.mocked(prisma.loan.findMany).mockResolvedValue(mockLoans as never);

    const result = await getPopularBooks({});

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Expected success");

    expect(result.data).toHaveLength(2);
    // book-A with 3 borrows comes first
    expect(result.data[0].bookId).toBe("book-A");
    expect(result.data[0].borrowCount).toBe(3);
    // book-B with 1 borrow comes second
    expect(result.data[1].bookId).toBe("book-B");
    expect(result.data[1].borrowCount).toBe(1);

    // Type assertions for PopularBookRow
    const row: PopularBookRow = result.data[0];
    expect(typeof row.bookId).toBe("string");
    expect(typeof row.title).toBe("string");
    expect(typeof row.author).toBe("string");
    expect(typeof row.borrowCount).toBe("number");
  });
});
