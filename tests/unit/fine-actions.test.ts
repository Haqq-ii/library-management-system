import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth guard and database
vi.mock("@/lib/require-role", () => ({
  requireRole: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const tx = {
    fine: { update: vi.fn() },
    auditLog: { create: vi.fn() },
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

import { waiveFine } from "@/features/fines/actions";
import { requireRole } from "@/lib/require-role";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

const tx = (
  prisma as unknown as {
    _tx: {
      fine: { update: ReturnType<typeof vi.fn> };
      auditLog: { create: ReturnType<typeof vi.fn> };
    };
  }
)._tx;

const mockFine = {
  id: "fine-1",
  memberId: "member-1",
  amount: 5.0,
  member: { user: { name: "Alice Smith" } },
  loan: { copy: { book: { title: "The Great Gatsby" } } },
  waivedAt: new Date(),
  waivedBy: "librarian-1",
  waivedReason: "Student hardship",
  status: "WAIVED",
};

describe("waiveFine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Test 1: MEMBER role returns FORBIDDEN", async () => {
    vi.mocked(requireRole).mockRejectedValue(new Error("FORBIDDEN"));

    const result = await waiveFine({ fineId: "fine-1", reason: "hardship" });

    expect(result).toEqual({ success: false, error: "FORBIDDEN" });
    expect(tx.fine.update).not.toHaveBeenCalled();
  });

  it("Test 2: empty fineId returns INVALID_INPUT", async () => {
    vi.mocked(requireRole).mockResolvedValue({
      user: { id: "librarian-1", role: "LIBRARIAN" },
    } as never);

    const result = await waiveFine({ fineId: "", reason: "hardship" });

    expect(result).toEqual({ success: false, error: "INVALID_INPUT" });
    expect(tx.fine.update).not.toHaveBeenCalled();
  });

  it("Test 3: empty reason returns INVALID_INPUT", async () => {
    vi.mocked(requireRole).mockResolvedValue({
      user: { id: "librarian-1", role: "LIBRARIAN" },
    } as never);

    const result = await waiveFine({ fineId: "fine-1", reason: "" });

    expect(result).toEqual({ success: false, error: "INVALID_INPUT" });
    expect(tx.fine.update).not.toHaveBeenCalled();
  });

  it("Test 4: non-existent fineId returns DB_ERROR (P2025 from update)", async () => {
    vi.mocked(requireRole).mockResolvedValue({
      user: { id: "librarian-1", role: "LIBRARIAN" },
    } as never);
    const p2025Error = Object.assign(new Error("Record not found"), {
      code: "P2025",
    });
    vi.mocked(prisma.$transaction).mockRejectedValue(p2025Error);

    const result = await waiveFine({ fineId: "non-existent", reason: "test" });

    expect(result).toEqual({ success: false, error: "DB_ERROR" });
  });

  it("Test 5: valid librarian + valid fineId sets WAIVED, creates AuditLog, returns success", async () => {
    vi.mocked(requireRole).mockResolvedValue({
      user: { id: "librarian-1", role: "LIBRARIAN" },
    } as never);
    tx.fine.update.mockResolvedValue(mockFine);
    tx.auditLog.create.mockResolvedValue({ id: "audit-1" });

    const result = await waiveFine({ fineId: "fine-1", reason: "Student hardship" });

    expect(result).toEqual({ success: true, data: undefined });

    // Check fine.update was called with WAIVED status
    expect(tx.fine.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "fine-1" },
        data: expect.objectContaining({
          status: "WAIVED",
          waivedReason: "Student hardship",
          waivedBy: "librarian-1",
        }),
      })
    );

    // Check auditLog.create was called
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: "librarian-1",
          action: "FINE_WAIVED",
          entityType: "Fine",
          entityId: "fine-1",
        }),
      })
    );

    // Check revalidatePath was called
    expect(revalidatePath).toHaveBeenCalledWith("/fines");
  });

  it("Test 6: AuditLog details contains description with amount, memberName, bookTitle, reason", async () => {
    vi.mocked(requireRole).mockResolvedValue({
      user: { id: "librarian-1", role: "LIBRARIAN" },
    } as never);
    tx.fine.update.mockResolvedValue(mockFine);
    tx.auditLog.create.mockResolvedValue({ id: "audit-1" });

    await waiveFine({ fineId: "fine-1", reason: "Student hardship" });

    const auditCall = tx.auditLog.create.mock.calls[0][0];
    const details = auditCall.data.details;

    expect(details.description).toContain("5.00");
    expect(details.description).toContain("Alice Smith");
    expect(details.description).toContain("The Great Gatsby");
    expect(details.description).toContain("Student hardship");
    expect(details.memberName).toBe("Alice Smith");
    expect(details.bookTitle).toBe("The Great Gatsby");
    expect(details.reason).toBe("Student hardship");
    expect(details.amount).toBe(5.0);
  });
});
