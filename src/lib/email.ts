// src/lib/email.ts
// Resend client singleton + sendAndLog() helper
// SECURITY: RESEND_API_KEY is a server-only secret — never expose it to the client bundle

import { Resend } from "resend";
import type * as React from "react";
import { prisma } from "@/lib/db";

// Singleton pattern mirrors src/lib/db.ts (globalThis guard for Next.js hot-reload)
const globalForResend = globalThis as unknown as { resend: Resend | null | undefined };

// null when RESEND_API_KEY is absent — sendAndLog skips sending and logs a warning.
// Instantiating Resend without a key throws at module load time.
const resend: Resend | null =
  globalForResend.resend !== undefined
    ? globalForResend.resend
    : process.env.RESEND_API_KEY
      ? new Resend(process.env.RESEND_API_KEY)
      : null;

if (process.env.NODE_ENV !== "production") {
  globalForResend.resend = resend;
}

export type NotificationType =
  | "DUE_DATE_3DAY"
  | "DUE_DATE_SAME"
  | "OVERDUE_ALERT"
  | "HOLD_READY";

export interface SendAndLogOpts {
  to: string;
  subject: string;
  react: React.ReactElement;
  memberId: string;
  type: NotificationType;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}

/**
 * Send a transactional email via Resend and record the attempt to NotificationLog.
 *
 * NOTF-04: A NotificationLog row is ALWAYS written — on success and on failure.
 * This function never throws; Resend errors are caught and logged as success:false.
 *
 * @param opts - Email send options
 * @returns { success: boolean }
 */
export async function sendAndLog(
  opts: SendAndLogOpts
): Promise<{ success: boolean }> {
  let success = false;

  if (!resend) {
    // RESEND_API_KEY not set — skip sending in development, continue workflow
    console.warn(
      `[email] RESEND_API_KEY missing — skipping ${opts.type} email to ${opts.to}`
    );
  } else {
    try {
      const { data, error } = await resend.emails.send(
        {
          from:
            process.env.RESEND_FROM_EMAIL ?? "Library <onboarding@resend.dev>",
          to: [opts.to],
          subject: opts.subject,
          react: opts.react,
        },
        { idempotencyKey: opts.idempotencyKey }
      );

      success = !error && !!data?.id;
    } catch {
      // Resend network/SDK error — log failure, do not rethrow (NOTF-04)
      success = false;
    }
  }

  // ALWAYS write NotificationLog — outside any transaction (Pitfall 2)
  await prisma.notificationLog.create({
    data: {
      memberId: opts.memberId,
      type: opts.type,
      channel: "EMAIL",
      success,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metadata: opts.metadata as any,
    },
  });

  return { success };
}
