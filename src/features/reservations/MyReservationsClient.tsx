"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cancelReservation } from "@/features/reservations/actions";
import { PICKUP_WINDOW_HOURS } from "@/lib/constants";

type ReservationStatus = "PENDING" | "READY" | "FULFILLED" | "CANCELLED";

interface ReservationItem {
  id: string;
  bookId: string;
  book: { title: string };
  status: ReservationStatus;
  queuePosition: number;
  requestedAt: Date;
  notifiedAt: Date | null;
  memberId: string;
}

interface MyReservationsClientProps {
  reservations: ReservationItem[];
}

function StatusBadge({ status }: { status: ReservationStatus }) {
  const classMap: Record<ReservationStatus, string> = {
    PENDING: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
    READY: "bg-green-100 text-green-800 hover:bg-green-100",
    FULFILLED: "bg-gray-100 text-gray-600 hover:bg-gray-100",
    CANCELLED: "bg-red-100 text-red-800 hover:bg-red-100",
  };
  return <Badge className={classMap[status]}>{status}</Badge>;
}

export function MyReservationsClient({
  reservations,
}: MyReservationsClientProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<{
    id: string;
    bookTitle: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  function openDialog(reservation: ReservationItem) {
    setSelectedReservation({
      id: reservation.id,
      bookTitle: reservation.book.title,
    });
    setDialogOpen(true);
  }

  function handleCancel() {
    if (!selectedReservation) return;
    const reservationId = selectedReservation.id;
    startTransition(async () => {
      const result = await cancelReservation(reservationId);
      if (result.success) {
        toast.success("Reservation cancelled.");
        setDialogOpen(false);
      } else {
        toast.error("Couldn't cancel reservation. Please try again.");
      }
    });
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Book Title</TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
            <TableHead className="w-[100px]">Queue Position</TableHead>
            <TableHead className="w-[120px]">Date Requested</TableHead>
            <TableHead className="w-[120px]">Expires</TableHead>
            <TableHead className="w-[80px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reservations.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="text-center text-muted-foreground py-8"
              >
                <p className="font-semibold">No reservations</p>
                <p className="text-sm mt-1">
                  When a book you want is unavailable, click Reserve on the
                  catalog page to join the queue.
                </p>
              </TableCell>
            </TableRow>
          ) : (
            reservations.map((reservation) => {
              // Compute pickup deadline for READY reservations — UTC epoch math (no setDate)
              const pickupDeadline =
                reservation.status === "READY" && reservation.notifiedAt
                  ? new Date(
                      new Date(reservation.notifiedAt).getTime() +
                        PICKUP_WINDOW_HOURS * 60 * 60 * 1000
                    )
                  : null;
              const isExpired = pickupDeadline
                ? pickupDeadline < new Date()
                : false;

              return (
                <TableRow key={reservation.id}>
                  <TableCell className="font-semibold">
                    {reservation.book.title}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={reservation.status} />
                  </TableCell>
                  <TableCell>
                    {reservation.status === "PENDING" ? (
                      <span className="text-sm text-muted-foreground">
                        Position {reservation.queuePosition} in queue
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(reservation.requestedAt).toLocaleDateString(
                      "en-US",
                      { month: "short", day: "numeric", year: "numeric" }
                    )}
                  </TableCell>
                  <TableCell>
                    {pickupDeadline ? (
                      <span
                        className={
                          isExpired
                            ? "text-red-600 font-semibold"
                            : "text-green-800"
                        }
                      >
                        Pick up by{" "}
                        {pickupDeadline.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {reservation.status === "PENDING" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openDialog(reservation)}
                      >
                        Cancel
                      </Button>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      {/* Cancellation Dialog (D-10) */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(isOpen) => {
          if (!isPending) setDialogOpen(isOpen);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Reservation</DialogTitle>
            <DialogDescription>
              Cancel your reservation for &apos;{selectedReservation?.bookTitle}
              &apos;? You will lose your place in the queue.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isPending}
            >
              Keep Reservation
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={isPending}
            >
              Yes, Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
