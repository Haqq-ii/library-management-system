"use client";

import { useState, useTransition } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { waiveFine } from "./actions";

interface FineData {
  id: string;
  amount: number | { toNumber: () => number };
  status: string;
  createdAt: Date | string;
  memberId: string;
  member: {
    user: { name: string };
  };
  loan: {
    copy: {
      book: { title: string };
    };
  };
}

interface FinesTableProps {
  fines: FineData[];
  activeTab: "unpaid" | "all";
}

interface WaiveFineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fine: {
    id: string;
    amount: number;
    memberName: string;
  } | null;
}

function WaiveFineDialog({ open, onOpenChange, fine }: WaiveFineDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [reason, setReason] = useState("");

  function handleConfirm() {
    if (!fine) return;
    const fineId = fine.id;
    const waiveReason = reason;
    startTransition(async () => {
      const result = await waiveFine({ fineId, reason: waiveReason });
      if (result.success) {
        toast.success("Fine waived successfully.");
        onOpenChange(false);
        setReason("");
      } else {
        toast.error("Couldn't waive fine. Please try again.");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isPending) {
          onOpenChange(isOpen);
          if (!isOpen) setReason("");
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Waive Fine</DialogTitle>
          <DialogDescription>
            {fine
              ? `Waive fine of $${fine.amount.toFixed(2)} for ${fine.memberName}? This action cannot be undone.`
              : null}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="waive-reason">Reason (required)</Label>
          <textarea
            id="waive-reason"
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Enter reason for waiving this fine..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isPending}
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setReason("");
            }}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isPending || reason.trim().length === 0}
          >
            Confirm Waive
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FineStatusBadge({ status }: { status: string }) {
  if (status === "UNPAID") {
    return (
      <Badge className="bg-red-100 text-red-800 hover:bg-red-100">UNPAID</Badge>
    );
  }
  if (status === "PAID") {
    return (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">PAID</Badge>
    );
  }
  return (
    <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100">WAIVED</Badge>
  );
}

function formatAmount(amount: number | { toNumber: () => number }): string {
  const num = typeof amount === "number" ? amount : amount.toNumber();
  return `$${num.toFixed(2)}`;
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const PAGE_SIZE = 20;

function FinesTab({
  fines,
  emptyHeading,
  emptyBody,
}: {
  fines: FineData[];
  emptyHeading: string;
  emptyBody: string;
}) {
  const [page, setPage] = useState(1);
  const [waiveTarget, setWaiveTarget] = useState<{
    id: string;
    amount: number;
    memberName: string;
  } | null>(null);
  const [isWaiveDialogOpen, setIsWaiveDialogOpen] = useState(false);

  const totalPages = Math.max(1, Math.ceil(fines.length / PAGE_SIZE));
  const paginated = fines.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleWaive(fine: FineData) {
    const amount =
      typeof fine.amount === "number"
        ? fine.amount
        : fine.amount.toNumber();
    setWaiveTarget({
      id: fine.id,
      amount,
      memberName: fine.member.user.name,
    });
    setIsWaiveDialogOpen(true);
  }

  return (
    <div className="space-y-4">
      {fines.length === 0 ? (
        <div className="py-12 text-center">
          <p className="font-semibold">{emptyHeading}</p>
          <p className="text-sm text-muted-foreground mt-1">{emptyBody}</p>
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Book Title</TableHead>
                <TableHead className="w-20">Amount</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-28">Date</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((fine) => (
                <TableRow key={fine.id}>
                  <TableCell className="font-semibold">
                    {fine.member.user.name}
                  </TableCell>
                  <TableCell>{fine.loan.copy.book.title}</TableCell>
                  <TableCell>{formatAmount(fine.amount)}</TableCell>
                  <TableCell>
                    <FineStatusBadge status={fine.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(fine.createdAt)}
                  </TableCell>
                  <TableCell>
                    {fine.status === "UNPAID" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleWaive(fine)}
                      >
                        Waive
                      </Button>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Prev
              </Button>
              <span>
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      <WaiveFineDialog
        open={isWaiveDialogOpen}
        onOpenChange={setIsWaiveDialogOpen}
        fine={waiveTarget}
      />
    </div>
  );
}

export function FinesTable({ fines, activeTab }: FinesTableProps) {
  const unpaidFines = fines.filter((f) => f.status === "UNPAID");

  return (
    <Tabs defaultValue={activeTab}>
      <TabsList>
        <TabsTrigger value="unpaid">Unpaid</TabsTrigger>
        <TabsTrigger value="all">All</TabsTrigger>
      </TabsList>
      <TabsContent value="unpaid">
        <FinesTab
          fines={unpaidFines}
          emptyHeading="No unpaid fines"
          emptyBody="All member fines are paid or waived."
        />
      </TabsContent>
      <TabsContent value="all">
        <FinesTab
          fines={fines}
          emptyHeading="No fines recorded"
          emptyBody="Fines are created automatically when overdue books are returned."
        />
      </TabsContent>
    </Tabs>
  );
}
