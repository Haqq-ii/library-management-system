// src/lib/notifications.ts
// Notification wrapper functions that build email payloads and delegate to sendAndLog.
//
// Design: these wrappers convert loan + member + book data into typed sendAndLog calls.
// They never interact with Prisma directly — the cron job handler (overdue-scan.ts)
// owns the query layer. sendAndLog handles Resend + NotificationLog writes (NOTF-04).
//
// Loan type from Prisma include shape:
//   loan.member.user.name / .email
//   loan.copy.book.title
//   loan.memberId, loan.dueAt, loan.id

import * as React from "react";
import { sendAndLog, type NotificationType } from "@/lib/email";
import { DueDateReminderEmail } from "@/emails/DueDateReminderEmail";
import { OverdueAlertEmail } from "@/emails/OverdueAlertEmail";
import { HoldReadyEmail } from "@/emails/HoldReadyEmail";

// Minimal loan shape required by notification wrappers — mirrors the Prisma
// include used in overdue-scan.ts (member.user + copy.book)
interface NotificationLoan {
  id: string;
  memberId: string;
  dueAt: Date;
  member: {
    user: {
      name: string;
      email: string;
    };
  };
  copy: {
    book: {
      title: string;
    };
  };
}

export interface SendDueDateReminderOpts {
  loan: NotificationLoan;
  daysUntilDue: number;
  idempotencyKey: string;
  type: "DUE_DATE_3DAY" | "DUE_DATE_SAME";
}

/**
 * Send a due-date reminder email (NOTF-01).
 * Builds a DueDateReminderEmail element and calls sendAndLog.
 * daysUntilDue === 0 → subject "Your book is due today" (DUE_DATE_SAME)
 * daysUntilDue > 0  → subject "Your book is due in N days" (DUE_DATE_3DAY)
 */
export async function sendDueDateReminder(
  opts: SendDueDateReminderOpts
): Promise<{ success: boolean }> {
  const { loan, daysUntilDue, idempotencyKey, type } = opts;
  const memberName = loan.member.user.name;
  const memberEmail = loan.member.user.email;
  const bookTitle = loan.copy.book.title;
  // Pre-format dueDate as UTC date string (consistent with UTC epoch math convention)
  const dueDate = new Date(loan.dueAt).toISOString().slice(0, 10);

  const subject =
    daysUntilDue === 0
      ? "Your book is due today"
      : `Your book is due in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}`;

  return sendAndLog({
    to: memberEmail,
    subject,
    react: React.createElement(DueDateReminderEmail, {
      memberName,
      bookTitle,
      dueDate,
      daysUntilDue,
    }),
    memberId: loan.memberId,
    type: type as NotificationType,
    idempotencyKey,
  });
}

export interface SendOverdueAlertOpts {
  loan: NotificationLoan;
  idempotencyKey: string;
  daysOverdue?: number;
}

/**
 * Send an overdue alert email (NOTF-02).
 * Builds an OverdueAlertEmail element and calls sendAndLog.
 * daysOverdue is optional — if provided, shown in the email body.
 */
export async function sendOverdueAlert(
  opts: SendOverdueAlertOpts
): Promise<{ success: boolean }> {
  const { loan, idempotencyKey, daysOverdue } = opts;
  const memberName = loan.member.user.name;
  const memberEmail = loan.member.user.email;
  const bookTitle = loan.copy.book.title;

  return sendAndLog({
    to: memberEmail,
    subject: "Overdue book reminder",
    react: React.createElement(OverdueAlertEmail, {
      memberName,
      bookTitle,
      daysOverdue,
    }),
    memberId: loan.memberId,
    type: "OVERDUE_ALERT",
    idempotencyKey,
  });
}

export interface SendHoldReadyOpts {
  memberId: string;
  memberEmail: string;
  memberName: string;
  bookTitle: string;
  pickupWindowHours: number;
  idempotencyKey: string;
}

/**
 * Send a hold-ready pickup notification email (NOTF-03).
 * Called post-transaction when a returned copy advances a PENDING reservation to READY.
 * idempotencyKey format: HOLD_READY/<reservationId> — NO date component (reservation ID
 * is globally unique so no date suffix is needed for deduplication).
 * Never call this inside a Prisma transaction.
 */
export async function sendHoldReady(
  opts: SendHoldReadyOpts
): Promise<{ success: boolean }> {
  const { memberId, memberEmail, memberName, bookTitle, pickupWindowHours, idempotencyKey } = opts;

  return sendAndLog({
    to: memberEmail,
    subject: "Your reserved book is ready for pickup",
    react: React.createElement(HoldReadyEmail, {
      memberName,
      bookTitle,
      pickupWindowHours,
    }),
    memberId,
    type: "HOLD_READY" as NotificationType,
    idempotencyKey,
  });
}
