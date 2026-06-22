// src/jobs/overdue-scan.ts
// Daily cron job handler — queries loans and dispatches due-date/overdue emails.
//
// Called by server.ts via:  cron.schedule("0 6 * * *", scanAndNotify, { timezone: "UTC" })
//
// Design decisions:
// - Query filter uses dueAt < now AND returnedAt IS NULL for overdue detection,
//   NOT loan.status === "OVERDUE" — on first run, overdue loans may still have
//   status "ACTIVE" (Pitfall 4; RESEARCH.md Anti-Patterns).
// - Idempotency keys: <TYPE>/<loanId>/<YYYY-MM-DD> prevent duplicate sends
//   within 24h on cron restart/drift (T-04-04 threat mitigation).
// - try/catch around the full scan body: one malformed loan does not abort the
//   entire run (T-04-05 threat mitigation).
// - Date arithmetic uses getTime() epoch math (UTC) — consistent with
//   src/features/loans/actions.ts pattern; never toLocaleDateString().

import { prisma } from "@/lib/db";
import { sendAndLog } from "@/lib/email";
import { DueDateReminderEmail } from "@/emails/DueDateReminderEmail";
import { OverdueAlertEmail } from "@/emails/OverdueAlertEmail";
import * as React from "react";

export async function scanAndNotify(): Promise<void> {
  try {
    const now = new Date();
    // Date key for idempotency: "2026-06-22"
    const todayUTC = now.toISOString().slice(0, 10);
    // Due-window upper bound: loans due within the next 3 days (inclusive)
    const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    // -------------------------------------------------------------------------
    // NOTF-01: Upcoming loans due in 0-3 days
    // -------------------------------------------------------------------------
    const upcomingLoans = await prisma.loan.findMany({
      where: {
        status: "ACTIVE",
        dueAt: { lte: in3Days, gte: now },
        returnedAt: null,
      },
      include: {
        member: { include: { user: true } },
        copy: { include: { book: true } },
      },
    });

    for (const loan of upcomingLoans) {
      // UTC epoch math — consistent with src/features/loans/actions.ts
      const daysUntilDue = Math.round(
        (new Date(loan.dueAt).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      );
      const type = daysUntilDue === 0 ? "DUE_DATE_SAME" : "DUE_DATE_3DAY";
      const idempotencyKey = `${type}/${loan.id}/${todayUTC}`;

      await sendAndLog({
        to: loan.member.user.email,
        subject:
          daysUntilDue === 0
            ? "Your book is due today"
            : `Your book is due in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}`,
        react: React.createElement(DueDateReminderEmail, {
          memberName: loan.member.user.name,
          bookTitle: loan.copy.book.title,
          dueDate: new Date(loan.dueAt).toISOString().slice(0, 10),
          daysUntilDue,
        }),
        memberId: loan.memberId,
        type,
        idempotencyKey,
      });
    }

    // -------------------------------------------------------------------------
    // NOTF-02: Overdue loans — dueAt < now AND returnedAt IS NULL
    // NOT filtered by status === "OVERDUE" (Pitfall 4: status is app-managed,
    // not auto-updated by Postgres; on first cron run overdue loans are ACTIVE)
    // -------------------------------------------------------------------------
    const overdueLoans = await prisma.loan.findMany({
      where: {
        returnedAt: null,
        dueAt: { lt: now },
      },
      include: {
        member: { include: { user: true } },
        copy: { include: { book: true } },
      },
    });

    for (const loan of overdueLoans) {
      const idempotencyKey = `OVERDUE_ALERT/${loan.id}/${todayUTC}`;

      await sendAndLog({
        to: loan.member.user.email,
        subject: "Overdue book reminder",
        react: React.createElement(OverdueAlertEmail, {
          memberName: loan.member.user.name,
          bookTitle: loan.copy.book.title,
        }),
        memberId: loan.memberId,
        type: "OVERDUE_ALERT",
        idempotencyKey,
      });
    }
  } catch (err) {
    // Log and swallow — one bad loan must not abort the entire cron run (T-04-05)
    console.error("[scanAndNotify]", err);
  }
}
