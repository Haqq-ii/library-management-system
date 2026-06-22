import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth guard and database
vi.mock("@/lib/require-role", () => ({
  requireRole: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    fine: {
      aggregate: vi.fn(),
    },
  },
}));

import { getFineSummary } from "@/features/reports/actions";
import { requireRole } from "@/lib/require-role";
import { prisma } from "@/lib/db";

describe("getFineSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Test 1: when requireRole rejects with FORBIDDEN, returns { success: false, error: 'FORBIDDEN' } and never queries the DB", async () => {
    vi.mocked(requireRole).mockRejectedValue(new Error("FORBIDDEN"));

    const result = await getFineSummary();

    expect(result).toEqual({ success: false, error: "FORBIDDEN" });
    expect(prisma.fine.aggregate).not.toHaveBeenCalled();
  });

  it("Test 2: with LIBRARIAN role and mocked aggregates, returns correct recorded/waived/outstanding", async () => {
    vi.mocked(requireRole).mockResolvedValue(undefined as never);
    vi.mocked(prisma.fine.aggregate)
      .mockResolvedValueOnce({ _sum: { amount: 100 } } as never) // recorded
      .mockResolvedValueOnce({ _sum: { amount: 30 } } as never);  // waived

    const result = await getFineSummary();

    expect(result).toEqual({
      success: true,
      data: { recorded: 100, waived: 30, outstanding: 70 },
    });
  });

  it("Test 3: with zero fines (null aggregates), returns data { recorded: 0, waived: 0, outstanding: 0 } — no NaN", async () => {
    vi.mocked(requireRole).mockResolvedValue(undefined as never);
    vi.mocked(prisma.fine.aggregate)
      .mockResolvedValueOnce({ _sum: { amount: null } } as never)
      .mockResolvedValueOnce({ _sum: { amount: null } } as never);

    const result = await getFineSummary();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.recorded).toBe(0);
      expect(result.data.waived).toBe(0);
      expect(result.data.outstanding).toBe(0);
      // Ensure no NaN
      expect(Number.isNaN(result.data.recorded)).toBe(false);
      expect(Number.isNaN(result.data.waived)).toBe(false);
      expect(Number.isNaN(result.data.outstanding)).toBe(false);
    }
  });

  it("Test 4: returned numeric fields are JS number type (not Prisma Decimal objects)", async () => {
    vi.mocked(requireRole).mockResolvedValue(undefined as never);
    vi.mocked(prisma.fine.aggregate)
      .mockResolvedValueOnce({ _sum: { amount: 50.75 } } as never)
      .mockResolvedValueOnce({ _sum: { amount: 10.25 } } as never);

    const result = await getFineSummary();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.data.recorded).toBe("number");
      expect(typeof result.data.waived).toBe("number");
      expect(typeof result.data.outstanding).toBe("number");
    }
  });
});
