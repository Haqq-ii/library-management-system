"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { returnBook } from "./actions";

interface ReturnModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loan: {
    id: string;
    memberName: string;
    daysOverdue: number;
    fineAmount: number;
  } | null;
}

export function ReturnModal({ open, onOpenChange, loan }: ReturnModalProps) {
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    if (!loan) return;
    const loanId = loan.id;
    onOpenChange(false);
    startTransition(async () => {
      const result = await returnBook(loanId);
      if (result.success) {
        if (result.data.holdTriggered) {
          toast.success(
            `Returned. Hold triggered for ${result.data.holdMemberName} — copy reserved.`
          );
        } else {
          toast.success("Book returned successfully.");
        }
      } else {
        toast.error("Couldn't process return. Please try again.");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isPending) onOpenChange(isOpen);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Return Overdue Book?</DialogTitle>
          <DialogDescription>
            {loan ? (
              <>
                This book is{" "}
                <strong>{loan.daysOverdue} days overdue</strong>. A fine of{" "}
                <strong>${loan.fineAmount.toFixed(2)}</strong> will be recorded on{" "}
                <strong>{loan.memberName}</strong>&apos;s account.
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isPending}
          >
            Confirm Return
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
