/**
 * Pure display helpers for loan status and partitioning.
 * No "use server" directive — importable by both page components and unit tests.
 */

/**
 * Returns true if the loan is considered overdue:
 * - status is explicitly OVERDUE, OR
 * - status is ACTIVE and the due date has already passed
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isLoanOverdue(loan: Record<string, any>): boolean {
  return (
    loan.status === "OVERDUE" ||
    (loan.status === "ACTIVE" && new Date(loan.dueAt) < new Date())
  );
}

/**
 * Partitions an array of loans into two groups:
 * - active: loans with status ACTIVE or OVERDUE (not yet returned)
 * - history: loans with a non-null returnedAt (returned loans)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function partitionLoans<T extends Record<string, any>>(
  loans: T[]
): { active: T[]; history: T[] } {
  const active = loans.filter(
    (l) => l.status === "ACTIVE" || l.status === "OVERDUE"
  );
  const history = loans.filter((l) => l.returnedAt !== null);
  return { active, history };
}
