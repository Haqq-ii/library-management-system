import { describe, it, expect } from "vitest";
import { isLoanOverdue, partitionLoans } from "@/features/loans/loan-display";

// Helper to create a past date (N days ago)
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

// Helper to create a future date (N days from now)
function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

describe("partitionLoans", () => {
  it("puts ACTIVE loans into active array", () => {
    const loans = [
      { status: "ACTIVE", returnedAt: null, dueAt: daysFromNow(7) },
    ];
    const { active, history } = partitionLoans(loans);
    expect(active).toHaveLength(1);
    expect(history).toHaveLength(0);
  });

  it("puts OVERDUE loans into active array", () => {
    const loans = [
      { status: "OVERDUE", returnedAt: null, dueAt: daysAgo(3) },
    ];
    const { active, history } = partitionLoans(loans);
    expect(active).toHaveLength(1);
    expect(history).toHaveLength(0);
  });

  it("puts returned loans (non-null returnedAt) into history array", () => {
    const loans = [
      { status: "RETURNED", returnedAt: daysAgo(5), dueAt: daysAgo(10) },
    ];
    const { active, history } = partitionLoans(loans);
    expect(active).toHaveLength(0);
    expect(history).toHaveLength(1);
  });

  it("correctly partitions a mixed array", () => {
    const loans = [
      { status: "ACTIVE", returnedAt: null, dueAt: daysFromNow(3) },
      { status: "OVERDUE", returnedAt: null, dueAt: daysAgo(2) },
      { status: "RETURNED", returnedAt: daysAgo(10), dueAt: daysAgo(15) },
      { status: "RETURNED", returnedAt: daysAgo(30), dueAt: daysAgo(35) },
    ];
    const { active, history } = partitionLoans(loans);
    expect(active).toHaveLength(2);
    expect(history).toHaveLength(2);
  });

  it("returns empty arrays for empty input", () => {
    const { active, history } = partitionLoans([]);
    expect(active).toHaveLength(0);
    expect(history).toHaveLength(0);
  });
});

describe("isLoanOverdue", () => {
  it("flags an OVERDUE status loan as overdue", () => {
    const loan = { status: "OVERDUE", dueAt: daysAgo(3) };
    expect(isLoanOverdue(loan)).toBe(true);
  });

  it("flags an ACTIVE loan with a past dueAt as overdue", () => {
    const loan = { status: "ACTIVE", dueAt: daysAgo(1) };
    expect(isLoanOverdue(loan)).toBe(true);
  });

  it("does NOT flag an ACTIVE loan with a future dueAt as overdue", () => {
    const loan = { status: "ACTIVE", dueAt: daysFromNow(7) };
    expect(isLoanOverdue(loan)).toBe(false);
  });

  it("does NOT flag a RETURNED loan as overdue", () => {
    const loan = { status: "RETURNED", dueAt: daysAgo(5) };
    expect(isLoanOverdue(loan)).toBe(false);
  });

  it("accepts string dates for dueAt", () => {
    const pastDate = daysAgo(2).toISOString();
    const futureDate = daysFromNow(2).toISOString();
    expect(isLoanOverdue({ status: "ACTIVE", dueAt: pastDate })).toBe(true);
    expect(isLoanOverdue({ status: "ACTIVE", dueAt: futureDate })).toBe(false);
  });
});
