import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth guard and database
vi.mock("@/lib/require-role", () => ({
  requireRole: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const tx = {
    $queryRaw: vi.fn(),
    bookCopy: { update: vi.fn(), findUnique: vi.fn().mockResolvedValue({ barcode: "BC-001" }) },
    book: { findUnique: vi.fn().mockResolvedValue({ title: "Test Book" }) },
    loan: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return {
    prisma: {
      member: { findUnique: vi.fn() },
      loanPolicy: { findUnique: vi.fn() },
      fine: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }) },
      $transaction: vi.fn((cb) => cb(tx)),
      _tx: tx,
    },
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { checkoutBook } from "@/features/loans/actions";
import { requireRole } from "@/lib/require-role";
import { prisma } from "@/lib/db";

// Access the mocked tx object
const tx = (prisma as unknown as { _tx: { $queryRaw: ReturnType<typeof vi.fn>; bookCopy: { update: ReturnType<typeof vi.fn> }; loan: { create: ReturnType<typeof vi.fn> } } })._tx;

describe("checkoutBook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Test 1: valid checkout returns success with loan id and creates loan", async () => {
    vi.mocked(requireRole).mockResolvedValue({ user: { role: "LIBRARIAN", id: "librarian-1" } } as never);
    vi.mocked(prisma.member.findUnique).mockResolvedValue({
      id: "member-1",
      memberType: "STUDENT",
      user: { id: "user-1", name: "Alice Student" },
    } as never);
    vi.mocked(prisma.loanPolicy.findUnique).mockResolvedValue({
      memberType: "STUDENT",
      loanDays: 14,
    } as never);
    tx.$queryRaw.mockResolvedValue([{ id: "copy-1" }]);
    tx.bookCopy.update.mockResolvedValue({ id: "copy-1", status: "CHECKED_OUT" });
    tx.loan.create.mockResolvedValue({ id: "loan-1" });

    const result = await checkoutBook({ memberId: "member-1", bookId: "book-1" });

    expect(result).toEqual({ success: true, data: { id: "loan-1" } });
    expect(tx.bookCopy.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "copy-1" },
        data: { status: "CHECKED_OUT" },
      })
    );
    expect(tx.loan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          copyId: "copy-1",
          memberId: "member-1",
          status: "ACTIVE",
        }),
      })
    );
  });

  it("Test 2: no AVAILABLE copy returns NO_COPIES and creates no Loan", async () => {
    vi.mocked(requireRole).mockResolvedValue({ user: { role: "LIBRARIAN", id: "librarian-1" } } as never);
    vi.mocked(prisma.member.findUnique).mockResolvedValue({
      id: "member-1",
      memberType: "STUDENT",
      user: { id: "user-1", name: "Alice Student" },
    } as never);
    vi.mocked(prisma.loanPolicy.findUnique).mockResolvedValue({
      memberType: "STUDENT",
      loanDays: 14,
    } as never);
    // Empty array = no available copy
    tx.$queryRaw.mockResolvedValue([]);

    const result = await checkoutBook({ memberId: "member-1", bookId: "book-1" });

    expect(result).toEqual({ success: false, error: "NO_COPIES" });
    expect(tx.loan.create).not.toHaveBeenCalled();
  });

  it("Test 3: non-LIBRARIAN caller returns FORBIDDEN", async () => {
    vi.mocked(requireRole).mockRejectedValue(new Error("FORBIDDEN"));

    const result = await checkoutBook({ memberId: "member-1", bookId: "book-1" });

    expect(result).toEqual({ success: false, error: "FORBIDDEN" });
  });

  it("Test 4: missing LoanPolicy returns NO_POLICY", async () => {
    vi.mocked(requireRole).mockResolvedValue({ user: { role: "LIBRARIAN", id: "librarian-1" } } as never);
    vi.mocked(prisma.member.findUnique).mockResolvedValue({
      id: "member-1",
      memberType: "STAFF",
      user: { id: "user-1", name: "Alice Student" },
    } as never);
    vi.mocked(prisma.loanPolicy.findUnique).mockResolvedValue(null);

    const result = await checkoutBook({ memberId: "member-1", bookId: "book-1" });

    expect(result).toEqual({ success: false, error: "NO_POLICY" });
  });

  it("Test 5: invalid input (missing memberId) returns INVALID_INPUT", async () => {
    vi.mocked(requireRole).mockResolvedValue({ user: { role: "LIBRARIAN" } } as never);

    const result = await checkoutBook({ memberId: "", bookId: "book-1" });

    expect(result).toEqual({ success: false, error: "INVALID_INPUT" });
  });
});
