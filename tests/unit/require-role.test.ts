import { describe, it, expect, vi } from "vitest";

// Mock Better Auth and Next headers before importing the module under test
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(() => new Headers()),
}));

import { requireRole } from "@/lib/require-role";
import { auth } from "@/lib/auth";

describe("requireRole", () => {
  it("throws UNAUTHENTICATED when no session exists", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as any);
    await expect(requireRole("LIBRARIAN")).rejects.toThrow("UNAUTHENTICATED");
  });

  it("throws FORBIDDEN when user has wrong role", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { role: "MEMBER" },
      session: {},
    } as any);
    await expect(requireRole("LIBRARIAN")).rejects.toThrow("FORBIDDEN");
  });

  it("returns session when user has correct LIBRARIAN role", async () => {
    const mockSession = { user: { role: "LIBRARIAN", id: "user-1" }, session: { id: "sess-1" } };
    vi.mocked(auth.api.getSession).mockResolvedValue(mockSession as any);
    const result = await requireRole("LIBRARIAN");
    expect(result).toEqual(mockSession);
  });

  it("returns session when user has correct MEMBER role", async () => {
    const mockSession = { user: { role: "MEMBER", id: "user-2" }, session: { id: "sess-2" } };
    vi.mocked(auth.api.getSession).mockResolvedValue(mockSession as any);
    const result = await requireRole("MEMBER");
    expect(result).toEqual(mockSession);
  });

  it("throws FORBIDDEN when LIBRARIAN accesses MEMBER-only resource", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { role: "LIBRARIAN" },
      session: {},
    } as any);
    await expect(requireRole("MEMBER")).rejects.toThrow("FORBIDDEN");
  });
});
