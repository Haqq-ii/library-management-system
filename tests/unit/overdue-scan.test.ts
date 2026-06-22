import { describe, it } from "vitest";

// Wave 0 scaffold for NOTF-01 and NOTF-02 coverage.
// Plan 02 (src/jobs/overdue-scan.ts) implements scanAndNotify() and wires the real assertions.
// The import below is intentionally commented out — uncomment when plan 02 creates the module.
//
// import { scanAndNotify } from "@/jobs/overdue-scan";

describe("scanAndNotify (wave 0 scaffold — implemented in plan 02)", () => {
  // NOTF-01: scanAndNotify() calls sendDueDateReminder for loans due in ≤3 days
  it.todo("NOTF-01: sends due-date reminder for loans due in ≤3 days");

  // NOTF-01: sendDueDateReminder is NOT called for loans due >3 days away
  it.todo("NOTF-01: does not send reminder for loans due >3 days away");

  // NOTF-02: scanAndNotify() calls sendOverdueAlert for loans where dueAt < now AND returnedAt IS NULL
  it.todo("NOTF-02: sends overdue alert for loans where dueAt < now and not returned");

  // NOTF-02: sendOverdueAlert is NOT called for loans that have been returned
  it.todo("NOTF-02: does not send overdue alert for returned loans");
});
