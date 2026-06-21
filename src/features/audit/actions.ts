"use server";

import { requireRole } from "@/lib/require-role";
import { prisma } from "@/lib/db";

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// AuditAction values mirroring the Prisma enum (schema.prisma AuditAction)
type AuditAction =
  | "CHECKOUT"
  | "RETURN"
  | "FINE_WAIVED"
  | "BOOK_ADDED"
  | "BOOK_EDITED"
  | "BOOK_DELETED"
  | "MEMBER_ADDED"
  | "MEMBER_EDITED"
  | "MEMBER_DEACTIVATED";

const VALID_AUDIT_ACTIONS: AuditAction[] = [
  "CHECKOUT",
  "RETURN",
  "FINE_WAIVED",
  "BOOK_ADDED",
  "BOOK_EDITED",
  "BOOK_DELETED",
  "MEMBER_ADDED",
  "MEMBER_EDITED",
  "MEMBER_DEACTIVATED",
];

export type AuditLogEntry = {
  id: string;
  actorId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  details: unknown;
  createdAt: Date;
  actor: {
    id: string;
    name: string;
    email: string;
  };
};

const PAGE_SIZE = 20;

export async function getAuditLog(params: {
  page: number;
  fromDate?: string;
  toDate?: string;
  actions?: string[];
}): Promise<ActionResult<{ entries: AuditLogEntry[]; total: number }>> {
  // Enforce LIBRARIAN-only access (T-03-05-01)
  try {
    await requireRole("LIBRARIAN");
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "FORBIDDEN" };
  }

  const skip = (params.page - 1) * PAGE_SIZE;

  // Build where clause from filter params (T-03-05-03 — safe date parsing)
  const where: {
    createdAt?: { gte?: Date; lte?: Date };
    action?: { in: AuditAction[] };
  } = {};

  if (params.fromDate) {
    const fromDate = new Date(params.fromDate);
    if (!isNaN(fromDate.getTime())) {
      where.createdAt = { ...where.createdAt, gte: fromDate };
    }
  }
  if (params.toDate) {
    // Set to end of day for inclusive date range
    const toDate = new Date(params.toDate);
    if (!isNaN(toDate.getTime())) {
      toDate.setUTCHours(23, 59, 59, 999);
      where.createdAt = { ...where.createdAt, lte: toDate };
    }
  }
  if (params.actions?.length) {
    // Filter to valid AuditAction enum values only (T-03-05-03 — Prisma rejects invalid enum values)
    const filtered = params.actions.filter((a): a is AuditAction =>
      VALID_AUDIT_ACTIONS.includes(a as AuditAction)
    );
    if (filtered.length > 0) {
      where.action = { in: filtered };
    }
  }

  try {
    const [entries, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { actor: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: PAGE_SIZE,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { success: true, data: { entries: entries as unknown as AuditLogEntry[], total } };
  } catch (err) {
    console.error("[getAuditLog]", err);
    return { success: false, error: "DB_ERROR" };
  }
}
