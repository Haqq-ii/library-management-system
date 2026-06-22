"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronUp, ChevronDown } from "lucide-react";
import type { OverdueLoanRow } from "./overdue";

type SortKey = "daysLate" | "memberName" | "bookTitle";
type SortDir = "asc" | "desc";

// Default sort direction for each key
const DEFAULT_DIR: Record<SortKey, SortDir> = {
  daysLate: "desc",
  memberName: "asc",
  bookTitle: "asc",
};

interface OverdueLoansTableProps {
  rows: OverdueLoanRow[];
}

export function OverdueLoansTable({ rows }: OverdueLoansTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("daysLate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      // Toggle direction on re-click
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(DEFAULT_DIR[key]);
    }
  }

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      let cmp: number;
      if (sortKey === "daysLate") {
        cmp = a.daysLate - b.daysLate;
      } else if (sortKey === "memberName") {
        cmp = a.memberName.localeCompare(b.memberName);
      } else {
        cmp = a.bookTitle.localeCompare(b.bookTitle);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir]);

  function SortButton({
    label,
    colKey,
  }: {
    label: string;
    colKey: SortKey;
  }) {
    const isActive = sortKey === colKey;
    const ariaSort = isActive
      ? sortDir === "asc"
        ? "ascending"
        : "descending"
      : "none";
    const nextLabel = isActive
      ? sortDir === "asc"
        ? "Sort descending"
        : "Sort ascending"
      : `Sort ascending`;

    return (
      <button
        type="button"
        className="flex items-center gap-1 min-h-[44px] font-medium"
        onClick={() => handleSort(colKey)}
        aria-sort={ariaSort}
        aria-label={nextLabel}
      >
        {label}
        {isActive ? (
          sortDir === "asc" ? (
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          )
        ) : (
          <ChevronDown className="h-4 w-4 opacity-40" aria-hidden="true" />
        )}
      </button>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <SortButton label="Member" colKey="memberName" />
            </TableHead>
            <TableHead>
              <SortButton label="Book Title" colKey="bookTitle" />
            </TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>
              <SortButton label="Days Late" colKey="daysLate" />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-12">
                <p className="text-base font-semibold">No overdue loans</p>
                <p className="text-sm text-muted-foreground mt-1">
                  All loans are currently on time.
                </p>
              </TableCell>
            </TableRow>
          ) : (
            sorted.map((row) => (
              <TableRow key={row.id} className="bg-red-50">
                <TableCell className="font-semibold">{row.memberName}</TableCell>
                <TableCell>{row.bookTitle}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(row.dueAt).toLocaleDateString("en-US", {
                    timeZone: "UTC",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </TableCell>
                <TableCell className="text-red-600 font-medium">
                  {row.daysLate}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
