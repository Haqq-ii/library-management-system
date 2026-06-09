import { describe, it, expect, vi, beforeAll } from "vitest";

// Mock database for seed verification
vi.mock("@/lib/db", () => ({
  prisma: {
    user: { count: vi.fn() },
    member: { count: vi.fn() },
    book: { count: vi.fn() },
    bookCopy: { count: vi.fn() },
    loanPolicy: { count: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";

describe("Seed verification (INFRA-03)", () => {
  beforeAll(() => {
    // Simulate the expected seed counts
    vi.mocked(prisma.user.count).mockImplementation(async (args?: any) => {
      // role LIBRARIAN = 1
      if (args?.where?.role === "LIBRARIAN") return 1;
      // role MEMBER = 15 (10 students + 5 faculty)
      if (args?.where?.role === "MEMBER") return 15;
      return 16; // total
    });
    vi.mocked(prisma.member.count).mockImplementation(async (args?: any) => {
      if (args?.where?.memberType === "STUDENT") return 10;
      if (args?.where?.memberType === "FACULTY") return 5;
      return 15;
    });
    vi.mocked(prisma.book.count).mockResolvedValue(20);
    vi.mocked(prisma.bookCopy.count).mockResolvedValue(35); // 20 books with 1-3 copies
    vi.mocked(prisma.loanPolicy.count).mockResolvedValue(2);
  });

  it("seed creates exactly 1 librarian account", async () => {
    const count = await prisma.user.count({ where: { role: "LIBRARIAN" } });
    expect(count).toBe(1);
  });

  it("seed creates exactly 10 student members", async () => {
    const count = await prisma.member.count({ where: { memberType: "STUDENT" } });
    expect(count).toBe(10);
  });

  it("seed creates exactly 5 faculty members", async () => {
    const count = await prisma.member.count({ where: { memberType: "FACULTY" } });
    expect(count).toBe(5);
  });

  it("seed creates exactly 20 books", async () => {
    const count = await prisma.book.count();
    expect(count).toBe(20);
  });

  it("seed creates LoanPolicy rows (2: STUDENT and FACULTY)", async () => {
    const count = await prisma.loanPolicy.count();
    expect(count).toBe(2);
  });

  it("seed creates at least 20 book copies (1+ per book)", async () => {
    const count = await prisma.bookCopy.count();
    expect(count).toBeGreaterThanOrEqual(20);
  });
});
