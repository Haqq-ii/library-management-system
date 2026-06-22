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

import { getBorrowingActivity, type ActivityPoint } from "@/features/reports/activity";
import { requireRole } from "@/lib/require-role";
import { prisma } from "@/lib/db";

describe("getBorrowingActivity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Test 1: requireRole rejects → FORBIDDEN, no DB query", async () => {
    vi.mocked(requireRole).mockRejectedValue(new Error("FORBIDDEN"));

    const result = await getBorrowingActivity({});

    expect(result).toEqual({ success: false, error: "FORBIDDEN" });
    expect(prisma.loan.findMany).not.toHaveBeenCalled();
  });

  it("Test 2: LIBRARIAN, default range → returns one ActivityPoint per day in window (continuous, zero-filled)", async () => {
    vi.mocked(requireRole).mockResolvedValue({ user: { id: "lib-1", role: "LIBRARIAN" } } as never);

    // First call = issued loans, second call = returned loans (use mockResolvedValueOnce twice)
    vi.mocked(prisma.loan.findMany)
      .mockResolvedValueOnce([] as never)   // issued loans
      .mockResolvedValueOnce([] as never);  // returned loans

    const result = await getBorrowingActivity({});

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Expected success");

    // Should have ~31 points (30 days + 1 inclusive of today)
    expect(result.data.length).toBeGreaterThanOrEqual(30);
    expect(result.data.length).toBeLessThanOrEqual(31);

    // Every point should have zero counts
    for (const point of result.data) {
      expect(point.loanCount).toBe(0);
      expect(point.returnCount).toBe(0);
    }
  });

  it("Test 3: loans issued/returned counted independently per day", async () => {
    vi.mocked(requireRole).mockResolvedValue({ user: { id: "lib-1", role: "LIBRARIAN" } } as never);

    const day1 = "2025-03-01";
    const day2 = "2025-03-02";

    // Loan issued on day1, another on day2
    const issuedLoans = [
      { issuedAt: new Date(`${day1}T10:00:00Z`) },
      { issuedAt: new Date(`${day2}T09:00:00Z`) },
    ];
    // Loan returned on day1 (possibly the loan issued earlier or a different loan)
    const returnedLoans = [
      { returnedAt: new Date(`${day1}T14:00:00Z`) },
    ];

    vi.mocked(prisma.loan.findMany)
      .mockResolvedValueOnce(issuedLoans as never)   // issued
      .mockResolvedValueOnce(returnedLoans as never); // returned

    const result = await getBorrowingActivity({
      fromDate: "2025-03-01",
      toDate: "2025-03-02",
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Expected success");

    // Should have exactly 2 points for 2 days
    expect(result.data).toHaveLength(2);

    const day1Point = result.data.find((p) => p.date === day1);
    const day2Point = result.data.find((p) => p.date === day2);

    expect(day1Point).toBeDefined();
    expect(day1Point!.loanCount).toBe(1);   // 1 issued on day1
    expect(day1Point!.returnCount).toBe(1); // 1 returned on day1

    expect(day2Point).toBeDefined();
    expect(day2Point!.loanCount).toBe(1);   // 1 issued on day2
    expect(day2Point!.returnCount).toBe(0); // none returned on day2
  });

  it("Test 4: invalid fromDate/toDate strings fall back to defaults — no NaN dates passed to Prisma", async () => {
    vi.mocked(requireRole).mockResolvedValue({ user: { id: "lib-1", role: "LIBRARIAN" } } as never);

    vi.mocked(prisma.loan.findMany)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);

    const result = await getBorrowingActivity({
      fromDate: "not-a-date",
      toDate: "also-invalid",
    });

    expect(result.success).toBe(true);

    // Both calls should have been made with valid Date objects (not NaN)
    expect(prisma.loan.findMany).toHaveBeenCalledTimes(2);
    const firstCall = vi.mocked(prisma.loan.findMany).mock.calls[0][0] as {
      where: { issuedAt: { gte: Date; lte: Date } };
    };
    const gteDate = firstCall.where.issuedAt.gte;
    const lteDate = firstCall.where.issuedAt.lte;

    expect(gteDate).toBeInstanceOf(Date);
    expect(lteDate).toBeInstanceOf(Date);
    expect(isNaN(gteDate.getTime())).toBe(false);
    expect(isNaN(lteDate.getTime())).toBe(false);
  });

  it("Test 5: all output date fields are YYYY-MM-DD strings (not Date objects)", async () => {
    vi.mocked(requireRole).mockResolvedValue({ user: { id: "lib-1", role: "LIBRARIAN" } } as never);

    vi.mocked(prisma.loan.findMany)
      .mockResolvedValueOnce([
        { issuedAt: new Date("2025-05-01T08:00:00Z") },
      ] as never)
      .mockResolvedValueOnce([] as never);

    const result = await getBorrowingActivity({
      fromDate: "2025-05-01",
      toDate: "2025-05-01",
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Expected success");

    expect(result.data).toHaveLength(1);
    const point = result.data[0];

    // date must be a string in YYYY-MM-DD form
    expect(typeof point.date).toBe("string");
    expect(point.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(point.date).toBe("2025-05-01");

    // loanCount and returnCount must be numbers
    expect(typeof point.loanCount).toBe("number");
    expect(typeof point.returnCount).toBe("number");

    // Type assertion for ActivityPoint
    const typed: ActivityPoint = point;
    expect(typed).toBeDefined();
  });
});
