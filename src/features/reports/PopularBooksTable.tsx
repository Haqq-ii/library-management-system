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
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { getPopularBooks, type PopularBookRow } from "./popular";

interface PopularBooksTableProps {
  initialRows: PopularBookRow[];
  initialFrom: string;
  initialTo: string;
}

export function PopularBooksTable({
  initialRows,
  initialFrom,
  initialTo,
}: PopularBooksTableProps) {
  const [rows, setRows] = useState<PopularBookRow[]>(initialRows);
  const [fromDate, setFromDate] = useState(initialFrom);
  const [toDate, setToDate] = useState(initialTo);
  const [isPending, startTransition] = useTransition();

  function handleApply() {
    startTransition(async () => {
      const r = await getPopularBooks({ fromDate, toDate });
      if (r.success) {
        setRows(r.data);
      } else {
        if (r.error === "INVALID_DATE_RANGE") {
          toast.error("From date must be before To date.");
        } else {
          toast.error("Failed to load data. Please try again.");
        }
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Filter bar — matches AuditTable pattern */}
      <div className="flex items-end gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="popular-from-date"
            className="text-xs text-muted-foreground font-medium"
          >
            From
          </label>
          <Input
            id="popular-from-date"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-36"
            disabled={isPending}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="popular-to-date"
            className="text-xs text-muted-foreground font-medium"
          >
            To
          </label>
          <Input
            id="popular-to-date"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-36"
            disabled={isPending}
          />
        </div>
        <Button
          variant="default"
          onClick={handleApply}
          disabled={isPending}
        >
          {isPending ? "Applying…" : "Apply Filter"}
        </Button>
      </div>

      {/* Popular books table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Rank</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>Borrow Count</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12">
                  <p className="text-base font-semibold">No borrowing data</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    No loans were issued in the selected date range. Try a wider range.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, index) => (
                <TableRow key={row.bookId}>
                  <TableCell className="w-12 text-sm text-muted-foreground">
                    {index + 1}
                  </TableCell>
                  <TableCell className="font-medium">{row.title}</TableCell>
                  <TableCell>{row.author}</TableCell>
                  <TableCell>{row.borrowCount}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
