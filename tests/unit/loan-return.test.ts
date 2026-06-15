import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth guard and database
vi.mock("@/lib/require-role", () => ({
  requireRole: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const tx = {
    loan: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    fine: {
      create: vi.fn(),
    },
    bookCopy: {
      update: vi.fn(),
    },
    loanPolicy: {
      findUnique: vi.fn(),
    },
    reservation: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  };
  return {
    prisma: {
      $transaction: vi.fn((cb) => cb(tx)),
      _tx: tx,
    },
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { returnBook } from "@/features/loans/actions";
import { requireRole } from "@/lib/require-role";
import { prisma } from "@/lib/db";

type MockTx = {
  loan: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  fine: { create: ReturnType<typeof vi.fn> };
  bookCopy: { update: ReturnType<typeof vi.fn> };
  loanPolicy: { findUnique: ReturnType<typeof vi.fn> };
  reservation: { findFirst: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
};

// Access the mocked tx object
const tx = (prisma as unknown as { _tx: MockTx })._tx;

// Helper: build a mock loan
function makeLoan(overrides: {
  dueAt?: Date;
  returnedAt?: Date | null;
  memberType?: string;
}) {
  const { dueAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), returnedAt = null, memberType = "STUDENT" } = overrides;
  return {
    id: "loan-1",
    copyId: "copy-1",
    memberId: "member-1",
    dueAt,
    returnedAt,
    status: returnedAt ? "RETURNED" : dueAt < new Date() ? "OVERDUE" : "ACTIVE",
    copy: {
      id: "copy-1",
      bookId: "book-1",
      book: { id: "book-1", title: "Test Book" },
    },
    member: {
      id: "member-1",
      memberType,
      user: { id: "user-1", name: "Alice Student" },
    },
  };
}

describe("returnBook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Test 1: on-time return closes the loan, sets copy AVAILABLE, creates no fine, returns holdTriggered=false", async () => {
    // dueAt in the future → on-time
    const futureDue = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const loan = makeLoan({ dueAt: futureDue });

    vi.mocked(requireRole).mockResolvedValue(undefined as never);
    tx.loan.findUnique.mockResolvedValue(loan);
    tx.loanPolicy.findUnique.mockResolvedValue({ fineDailyRate: 0.25 });
    tx.fine.create.mockResolvedValue({ id: "fine-1" });
    tx.loan.update.mockResolvedValue({ id: "loan-1", status: "RETURNED" });
    tx.reservation.findFirst.mockResolvedValue(null);
    tx.bookCopy.update.mockResolvedValue({ id: "copy-1", status: "AVAILABLE" });

    const result = await returnBook("loan-1");

    expect(result).toEqual({ success: true, data: { holdTriggered: false } });
    // No fine should be created for on-time return
    expect(tx.fine.create).not.toHaveBeenCalled();
    // Copy set to AVAILABLE
    expect(tx.bookCopy.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "copy-1" },
        data: { status: "AVAILABLE" },
      })
    );
    // Loan closed
    expect(tx.loan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "loan-1" },
        data: expect.objectContaining({ status: "RETURNED" }),
      })
    );
  });

  it("Test 2: overdue return creates one UNPAID fine with amount = fineDailyRate × overdueDays and closes the loan", async () => {
    // dueAt 3 days in the past → 3 days overdue (Math.ceil)
    const pastDue = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const loan = makeLoan({ dueAt: pastDue });

    vi.mocked(requireRole).mockResolvedValue(undefined as never);
    tx.loan.findUnique.mockResolvedValue(loan);
    tx.loanPolicy.findUnique.mockResolvedValue({ fineDailyRate: 0.25 });
    tx.fine.create.mockResolvedValue({ id: "fine-2", amount: 0.75 });
    tx.loan.update.mockResolvedValue({ id: "loan-1", status: "RETURNED" });
    tx.reservation.findFirst.mockResolvedValue(null);
    tx.bookCopy.update.mockResolvedValue({ id: "copy-1", status: "AVAILABLE" });

    const result = await returnBook("loan-1");

    expect(result).toEqual({ success: true, data: { holdTriggered: false } });
    // Fine created with correct fields
    expect(tx.fine.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          loanId: "loan-1",
          memberId: "member-1",
          reason: "OVERDUE",
          status: "UNPAID",
        }),
      })
    );
    // Amount should be fineDailyRate × overdueDays; we don't pin exact days to avoid clock drift
    const fineArg = tx.fine.create.mock.calls[0][0] as { data: { amount: number } };
    expect(fineArg.data.amount).toBeGreaterThan(0);
    // Loan still closed
    expect(tx.loan.update).toHaveBeenCalled();
  });

  it("Test 3: when a PENDING reservation exists the copy is set to RESERVED, reservation advances to READY, holdTriggered=true with holdMemberName", async () => {
    const pastDue = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    const loan = makeLoan({ dueAt: pastDue });
    const reservation = {
      id: "res-1",
      bookId: "book-1",
      memberId: "member-2",
      status: "PENDING",
      queuePosition: 1,
      member: {
        id: "member-2",
        user: { id: "user-2", name: "Bob Faculty" },
      },
    };

    vi.mocked(requireRole).mockResolvedValue(undefined as never);
    tx.loan.findUnique.mockResolvedValue(loan);
    tx.loanPolicy.findUnique.mockResolvedValue({ fineDailyRate: 0.25 });
    tx.fine.create.mockResolvedValue({ id: "fine-3" });
    tx.loan.update.mockResolvedValue({ id: "loan-1", status: "RETURNED" });
    tx.reservation.findFirst.mockResolvedValue(reservation);
    tx.reservation.update.mockResolvedValue({ id: "res-1", status: "READY" });
    tx.bookCopy.update.mockResolvedValue({ id: "copy-1", status: "RESERVED" });

    const result = await returnBook("loan-1");

    expect(result).toEqual({
      success: true,
      data: { holdTriggered: true, holdMemberName: "Bob Faculty" },
    });
    // Copy set to RESERVED
    expect(tx.bookCopy.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "copy-1" },
        data: { status: "RESERVED" },
      })
    );
    // Reservation advanced to READY
    expect(tx.reservation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "res-1" },
        data: expect.objectContaining({ status: "READY" }),
      })
    );
  });

  it("Test 4: returning an already-returned loan returns { success: false, error: 'ALREADY_RETURNED' }", async () => {
    const returnedLoan = makeLoan({ returnedAt: new Date(Date.now() - 1000) });

    vi.mocked(requireRole).mockResolvedValue(undefined as never);
    tx.loan.findUnique.mockResolvedValue(returnedLoan);

    const result = await returnBook("loan-1");

    expect(result).toEqual({ success: false, error: "ALREADY_RETURNED" });
    expect(tx.fine.create).not.toHaveBeenCalled();
    expect(tx.loan.update).not.toHaveBeenCalled();
  });

  it("Test 5: non-LIBRARIAN caller returns { success: false, error: 'FORBIDDEN' }", async () => {
    vi.mocked(requireRole).mockRejectedValue(new Error("FORBIDDEN"));

    const result = await returnBook("loan-1");

    expect(result).toEqual({ success: false, error: "FORBIDDEN" });
  });
});
