"use server";

import { requireRole } from "@/lib/require-role";
import { prisma } from "@/lib/db";

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// NotificationType values mirroring the cron job and email helper types
type NotificationType =
  | "DUE_DATE_3DAY"
  | "DUE_DATE_SAME"
  | "OVERDUE_ALERT"
  | "HOLD_READY";

const VALID_NOTIFICATION_TYPES: NotificationType[] = [
  "DUE_DATE_3DAY",
  "DUE_DATE_SAME",
  "OVERDUE_ALERT",
  "HOLD_READY",
];

export type NotificationLogEntry = {
  id: string;
  memberId: string;
  memberName: string;
  memberEmail: string;
  type: string;
  channel: string;
  success: boolean;
  sentAt: Date;
};

const PAGE_SIZE = 20;

export async function getNotificationLog(params: {
  page: number;
  type?: string;
}): Promise<ActionResult<{ entries: NotificationLogEntry[]; total: number }>> {
  // Enforce LIBRARIAN-only access (T-04-11)
  try {
    await requireRole("LIBRARIAN");
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "FORBIDDEN" };
  }

  const skip = (params.page - 1) * PAGE_SIZE;

  // Build where clause — validate type filter against allow-list (T-04-12)
  const where: { type?: string } = {};

  if (params.type) {
    const isValid = VALID_NOTIFICATION_TYPES.includes(
      params.type as NotificationType
    );
    if (isValid) {
      where.type = params.type;
    }
    // Invalid type values are silently dropped (not an error)
  }

  try {
    const [rows, total] = await Promise.all([
      prisma.notificationLog.findMany({
        where,
        orderBy: { sentAt: "desc" },
        skip,
        take: PAGE_SIZE,
      }),
      prisma.notificationLog.count({ where }),
    ]);

    // Resolve member names via a separate query — NotificationLog has no Prisma relation
    const memberIds = [...new Set(rows.map((r: { memberId: string }) => r.memberId))];
    const members = await prisma.member.findMany({
      where: { id: { in: memberIds } },
      include: { user: true },
    });
    const memberMap = new Map<string, { name: string; email: string }>(
      members.map((m: { id: string; user: { name: string; email: string } }) => [
        m.id,
        { name: m.user.name, email: m.user.email },
      ])
    );

    const entries: NotificationLogEntry[] = rows.map(
      (row: {
        id: string;
        memberId: string;
        type: string;
        channel: string;
        success: boolean;
        sentAt: Date;
      }) => {
        const member = memberMap.get(row.memberId);
        return {
          id: row.id,
          memberId: row.memberId,
          memberName: member?.name ?? row.memberId,
          memberEmail: member?.email ?? "",
          type: row.type,
          channel: row.channel,
          success: row.success,
          sentAt: row.sentAt,
        };
      }
    );

    return { success: true, data: { entries, total } };
  } catch (err) {
    console.error("[getNotificationLog]", err);
    return { success: false, error: "DB_ERROR" };
  }
}
