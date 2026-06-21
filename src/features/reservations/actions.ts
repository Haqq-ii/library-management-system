"use server";

import { requireRole } from "@/lib/require-role";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function cancelReservation(
  reservationId: string
): Promise<ActionResult<void>> {
  let session;
  try {
    session = await requireRole("MEMBER");
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "FORBIDDEN",
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id: reservationId },
        include: { member: { include: { user: true } }, book: true },
      });

      if (!reservation) throw new Error("NOT_FOUND");

      // Guard: member can only cancel their own reservation (IDOR — T-03-03-02)
      if (reservation.member.userId !== session.user.id)
        throw new Error("FORBIDDEN");

      // Guard: only PENDING reservations can be cancelled
      if (reservation.status !== "PENDING") throw new Error("NOT_CANCELLABLE");

      await tx.reservation.update({
        where: { id: reservationId },
        data: { status: "CANCELLED" },
      });
      // Note: queue position gaps after cancellation are acceptable for v1 (T-03-03-05)
    });

    revalidatePath("/my-reservations");
    return { success: true, data: undefined };
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND")
      return { success: false, error: "NOT_FOUND" };
    if (err instanceof Error && err.message === "FORBIDDEN")
      return { success: false, error: "FORBIDDEN" };
    if (err instanceof Error && err.message === "NOT_CANCELLABLE")
      return { success: false, error: "NOT_CANCELLABLE" };
    console.error("[cancelReservation]", err);
    return { success: false, error: "DB_ERROR" };
  }
}
