"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { BookCopy } from "@/generated/prisma";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BookStatusBadge } from "@/components/catalog/BookStatusBadge";
import { addCopy, setCopyStatus } from "@/features/catalog/actions";

interface CopiesSubTableProps {
  bookId: string;
  copies: BookCopy[];
}

type PendingAction =
  | { type: "lost"; copyId: string }
  | { type: "withdrawn"; copyId: string }
  | null;

export function CopiesSubTable({ bookId, copies }: CopiesSubTableProps) {
  const [pending, setPending] = useState<PendingAction>(null);
  const [busy, setBusy] = useState(false);

  async function handleAddCopy() {
    setBusy(true);
    const result = await addCopy(bookId);
    setBusy(false);
    if (result.success) {
      toast.success("Copy added");
    } else {
      toast.error("Failed to add copy");
    }
  }

  async function handleConfirm() {
    if (!pending) return;
    setBusy(true);
    const status = pending.type === "lost" ? "LOST" : "WITHDRAWN";
    const result = await setCopyStatus(pending.copyId, status);
    setBusy(false);
    setPending(null);
    if (result.success) {
      toast.success(`Copy marked as ${status.toLowerCase()}`);
    } else {
      toast.error("Failed to update copy status");
    }
  }

  const isTerminal = (s: string) => s === "LOST" || s === "WITHDRAWN";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Copies</h2>
        <Button size="sm" onClick={handleAddCopy} disabled={busy}>
          Add Copy
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Barcode</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Added</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {copies.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={4}
                className="py-6 text-center text-muted-foreground"
              >
                No copies yet.
              </TableCell>
            </TableRow>
          ) : (
            copies.map((copy) => (
              <TableRow key={copy.id}>
                <TableCell className="font-mono text-xs">
                  {copy.barcode}
                </TableCell>
                <TableCell>
                  <BookStatusBadge status={copy.status as Parameters<typeof BookStatusBadge>[0]["status"]} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(copy.addedAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="space-x-1 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy || isTerminal(copy.status)}
                    onClick={() =>
                      setPending({ type: "lost", copyId: copy.id })
                    }
                  >
                    Mark Lost
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy || isTerminal(copy.status)}
                    onClick={() =>
                      setPending({ type: "withdrawn", copyId: copy.id })
                    }
                  >
                    Mark Withdrawn
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Dialog open={!!pending} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pending?.type === "lost"
                ? "Mark copy as lost?"
                : "Mark copy as withdrawn?"}
            </DialogTitle>
            <DialogDescription>
              {pending?.type === "lost"
                ? "This copy will be marked as lost and removed from circulation."
                : "This copy will be marked as withdrawn and removed from circulation."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPending(null)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirm} disabled={busy}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
