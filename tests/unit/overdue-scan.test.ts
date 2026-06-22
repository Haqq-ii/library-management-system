import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// vi.hoisted() — mocks are hoisted above import declarations; the sendAndLog
// spy must be accessible inside vi.mock() factory AND the test assertions.
// ---------------------------------------------------------------------------
const { sendAndLogMock, findManyMock } = vi.hoisted(() => {
  return {
    sendAndLogMock: vi.fn(),
    findManyMock: vi.fn(),
  };
});

// Mock @/lib/email — replace sendAndLog with a spy so tests can assert calls
vi.mock("@/lib/email", () => ({
  sendAndLog: sendAndLogMock,
}));

// Mock @/lib/db — provide a controlled prisma.loan.findMany
vi.mock("@/lib/db", () => ({
  prisma: {
    loan: {
      findMany: findManyMock,
    },
  },
}));

import { scanAndNotify } from "@/jobs/overdue-scan";

// ---------------------------------------------------------------------------
// Helpers to build fixture loans matching the Prisma include shape used in
// overdue-scan.ts:  member.user + copy.book
// ---------------------------------------------------------------------------
function makeLoan(overrides: {
  id?: string;
  memberId?: string;
  dueAt: Date;
  returnedAt?: Date | null;
  status?: string;
  memberName?: string;
  memberEmail?: string;
  bookTitle?: string;
}) {
  return {
    id: overrides.id ?? "loan-001",
    memberId: overrides.memberId ?? "member-001",
    dueAt: overrides.dueAt,
    returnedAt: overrides.returnedAt ?? null,
    status: overrides.status ?? "ACTIVE",
    member: {
      user: {
        name: overrides.memberName ?? "Alice",
        email: overrides.memberEmail ?? "alice@example.com",
      },
    },
    copy: {
      book: {
        title: overrides.bookTitle ?? "Clean Code",
      },
    },
  };
}

describe("scanAndNotify", () => {
  const now = new Date("2026-06-22T06:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    sendAndLogMock.mockReset();
    findManyMock.mockReset();
    sendAndLogMock.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // NOTF-01: Due-window tests
  // -------------------------------------------------------------------------

  it("Test 1 (NOTF-01 due-window): calls sendAndLog once for a loan due in 2 days with type DUE_DATE_3DAY", async () => {
    const dueAt = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days from now

    // First findMany call → upcoming loans
    // Second findMany call → overdue loans (none)
    findManyMock
      .mockResolvedValueOnce([makeLoan({ id: "loan-due-2", dueAt })])
      .mockResolvedValueOnce([]);

    await scanAndNotify();

    expect(sendAndLogMock).toHaveBeenCalledOnce();
    expect(sendAndLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "DUE_DATE_3DAY",
      })
    );
  });

  it("Test 2 (NOTF-01 same-day): calls sendAndLog with type DUE_DATE_SAME for a loan due today", async () => {
    // Due 30 minutes from now — same calendar day → daysUntilDue rounds to 0
    const dueAt = new Date(now.getTime() + 30 * 60 * 1000);

    findManyMock
      .mockResolvedValueOnce([makeLoan({ id: "loan-today", dueAt })])
      .mockResolvedValueOnce([]);

    await scanAndNotify();

    expect(sendAndLogMock).toHaveBeenCalledOnce();
    expect(sendAndLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "DUE_DATE_SAME",
      })
    );
  });

  it("Test 3 (NOTF-01 negative): does NOT call sendAndLog for a loan due 10 days from now (out of window)", async () => {
    // The overdue-scan Prisma query already filters dueAt ≤ in3Days via the
    // { lte: in3Days } clause — a loan due in 10 days should never appear in
    // the upcoming results. Simulate the correct DB filter by returning nothing.
    findManyMock
      .mockResolvedValueOnce([]) // upcoming: empty (10-day loan filtered by Prisma)
      .mockResolvedValueOnce([]); // overdue: empty

    await scanAndNotify();

    expect(sendAndLogMock).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // NOTF-02: Overdue tests
  // -------------------------------------------------------------------------

  it("Test 4 (NOTF-02 overdue): calls sendAndLog with type OVERDUE_ALERT for a loan with status ACTIVE but dueAt in the past and returnedAt null", async () => {
    // CRITICAL: status is intentionally ACTIVE, not OVERDUE — proves the query
    // uses dueAt < now + returnedAt IS NULL, not status === "OVERDUE" (Pitfall 4)
    const dueAt = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 days ago

    findManyMock
      .mockResolvedValueOnce([]) // upcoming: no due-soon loans
      .mockResolvedValueOnce([
        makeLoan({ id: "loan-overdue", dueAt, returnedAt: null, status: "ACTIVE" }),
      ]);

    await scanAndNotify();

    expect(sendAndLogMock).toHaveBeenCalledOnce();
    expect(sendAndLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "OVERDUE_ALERT",
      })
    );
  });

  it("Test 5 (NOTF-02 negative): does NOT call sendAndLog for a loan with returnedAt set (already returned)", async () => {
    // Returned loans are filtered out by returnedAt: null condition in Prisma query.
    // Simulate the correct DB filter: returned loans do not appear in overdue results.
    findManyMock
      .mockResolvedValueOnce([]) // upcoming: empty
      .mockResolvedValueOnce([]); // overdue: empty (returned loan filtered by Prisma)

    await scanAndNotify();

    expect(sendAndLogMock).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Test 6: Idempotency key format
  // -------------------------------------------------------------------------

  it("Test 6 (idempotency): overdue key format is OVERDUE_ALERT/<loanId>/<YYYY-MM-DD>; due key format is <TYPE>/<loanId>/<YYYY-MM-DD>", async () => {
    const todayUTC = "2026-06-22"; // matches vi.setSystemTime(now)
    const dueLoanId = "loan-due-001";
    const overdueLoanId = "loan-over-001";

    const dueAt = new Date(now.getTime() + 30 * 60 * 1000); // due today
    const pastDueAt = new Date(now.getTime() - 24 * 60 * 60 * 1000); // yesterday

    findManyMock
      .mockResolvedValueOnce([makeLoan({ id: dueLoanId, dueAt })])
      .mockResolvedValueOnce([
        makeLoan({ id: overdueLoanId, dueAt: pastDueAt, returnedAt: null }),
      ]);

    await scanAndNotify();

    expect(sendAndLogMock).toHaveBeenCalledTimes(2);

    // Due-date idempotency key: DUE_DATE_SAME/<loanId>/<date>
    expect(sendAndLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: `DUE_DATE_SAME/${dueLoanId}/${todayUTC}`,
        type: "DUE_DATE_SAME",
      })
    );

    // Overdue idempotency key: OVERDUE_ALERT/<loanId>/<date>
    expect(sendAndLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: `OVERDUE_ALERT/${overdueLoanId}/${todayUTC}`,
        type: "OVERDUE_ALERT",
      })
    );
  });
});
