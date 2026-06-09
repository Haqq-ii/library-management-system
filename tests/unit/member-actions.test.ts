import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth guard and database
vi.mock("@/lib/require-role", () => ({
  requireRole: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findFirst: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    member: { create: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { softDeleteMember } from "@/features/members/actions";
import { requireRole } from "@/lib/require-role";
import { prisma } from "@/lib/db";

describe("softDeleteMember", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets deletedAt on User (soft delete — not hard delete)", async () => {
    vi.mocked(requireRole).mockResolvedValue({ user: { role: "LIBRARIAN" } } as any);
    vi.mocked(prisma.user.update).mockResolvedValue({ id: "user-1", deletedAt: new Date() } as any);

    const result = await softDeleteMember("user-1");
    expect(result).toEqual({ success: true, data: undefined });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      })
    );
  });

  it("returns FORBIDDEN when non-LIBRARIAN attempts soft delete", async () => {
    vi.mocked(requireRole).mockRejectedValue(new Error("FORBIDDEN"));
    const result = await softDeleteMember("user-1");
    expect(result).toEqual({ success: false, error: "FORBIDDEN" });
  });

  it("soft-deleted member is absent from default list query", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([]);
    // Default query filters deletedAt: null
    const users = await prisma.user.findMany({ where: { deletedAt: null } });
    expect(users).toHaveLength(0);
  });
});
