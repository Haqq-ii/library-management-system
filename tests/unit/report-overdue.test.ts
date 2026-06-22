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

import { getOverdueLoans } from "@/features/reports/overdue";
import { requireRole } from "@/lib/require-role";
import { prisma } from "@/lib/db";

// Helper: builds a mock loan object with the nested relations getOverdueLoans expects
function makeLoan(daysAgo: number, opts: { returnedAt?: Date } = {}) {
  const dueAt = new Date(Date.now() - daysAgo * 86_400_000);
  return {
    id: `loan-${daysAgo}`,
    dueAt,
    returnedAt: opts.returnedAt ?? null,
    member: { user: { name: `Member ${daysAgo}` } },
    copy: { book: { title: `Book ${daysAgo}` } },
  };
}

describe("getOverdueLoans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Test 1: requireRole rejects → returns FORBIDDEN, no DB query", async () => {
    vi.mocked(requireRole).mockRejectedValue(new Error("FORBIDDEN"));

    const result = await getOverdueLoans();

    expect(result).toEqual({ success: false, error: "FORBIDDEN" });
    expect(vi.mocked(prisma.loan.findMany)).not.toHaveBeenCalled();
  });

  it("Test 2: LIBRARIAN role with two overdue loans → returns rows with memberName, bookTitle, dueAt (ISO string), daysLate", async () => {
    vi.mocked(requireRole).mockResolvedValue({
      user: { id: "librarian-1", role: "LIBRARIAN" },
    } as never);

    const loan10 = makeLoan(10);
    const loan3 = makeLoan(3);
    vi.mocked(prisma.loan.findMany).mockResolvedValue([loan10, loan3] as never);

    const result = await getOverdueLoans();

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data).toHaveLength(2);

    const row10 = result.data.find((r) => r.id === "loan-10");
    expect(row10).toBeDefined();
    expect(row10!.memberName).toBe("Member 10");
    expect(row10!.bookTitle).toBe("Book 10");
    // dueAt must be an ISO string
    expect(typeof row10!.dueAt).toBe("string");
    expect(row10!.dueAt).toBe(loan10.dueAt.toISOString());
    // daysLate should be ~10 (allow ±1 for timing)
    expect(row10!.daysLate).toBeGreaterThanOrEqual(9);
    expect(row10!.daysLate).toBeLessThanOrEqual(11);

    const row3 = result.data.find((r) => r.id === "loan-3");
    expect(row3).toBeDefined();
    expect(row3!.daysLate).toBeGreaterThanOrEqual(2);
    expect(row3!.daysLate).toBeLessThanOrEqual(4);
  });

  it("Test 3: query where clause includes returnedAt: null and dueAt: { lt: Date }", async () => {
    vi.mocked(requireRole).mockResolvedValue({
      user: { id: "librarian-1", role: "LIBRARIAN" },
    } as never);
    vi.mocked(prisma.loan.findMany).mockResolvedValue([] as never);

    await getOverdueLoans();

    expect(vi.mocked(prisma.loan.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          returnedAt: null,
          dueAt: expect.objectContaining({
            lt: expect.any(Date),
          }),
        }),
      })
    );
  });

  it("Test 4: dueAt in returned rows is a string (ISO), not a Date object", async () => {
    vi.mocked(requireRole).mockResolvedValue({
      user: { id: "librarian-1", role: "LIBRARIAN" },
    } as never);

    const loan = makeLoan(5);
    vi.mocked(prisma.loan.findMany).mockResolvedValue([loan] as never);

    const result = await getOverdueLoans();

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data).toHaveLength(1);
    // Must be string, not Date object
    expect(typeof result.data[0].dueAt).toBe("string");
    expect(result.data[0].dueAt instanceof Date).toBe(false);
    // Must be valid ISO string parseable back to a Date
    expect(() => new Date(result.data[0].dueAt)).not.toThrow();
    expect(new Date(result.data[0].dueAt).toISOString()).toBe(result.data[0].dueAt);
  });
});
