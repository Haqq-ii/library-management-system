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
import { Input } from "@/components/ui/input";
import { getAuditLog, type AuditLogEntry } from "./actions";

// AuditAction enum values (matches prisma schema)
const AUDIT_ACTIONS = [
  "CHECKOUT",
  "RETURN",
  "FINE_WAIVED",
  "BOOK_ADDED",
  "BOOK_EDITED",
  "BOOK_DELETED",
  "MEMBER_ADDED",
  "MEMBER_EDITED",
  "MEMBER_DEACTIVATED",
] as const;

type AuditAction = (typeof AUDIT_ACTIONS)[number];

const PAGE_SIZE = 20;

// Semantic badge classes per action type (per UI-SPEC.md color contract)
function getActionBadgeClass(action: AuditAction): string {
  switch (action) {
    case "CHECKOUT":
      return "bg-blue-100 text-blue-800 hover:bg-blue-100";
    case "RETURN":
      return "bg-green-100 text-green-800 hover:bg-green-100";
    case "FINE_WAIVED":
      return "bg-orange-100 text-orange-800 hover:bg-orange-100";
    case "BOOK_ADDED":
    case "BOOK_EDITED":
    case "BOOK_DELETED":
      return "bg-purple-100 text-purple-800 hover:bg-purple-100";
    case "MEMBER_ADDED":
    case "MEMBER_EDITED":
    case "MEMBER_DEACTIVATED":
      return "bg-indigo-100 text-indigo-800 hover:bg-indigo-100";
    default:
      return "bg-gray-100 text-gray-600 hover:bg-gray-100";
  }
}

interface AuditTableProps {
  entries: AuditLogEntry[];
  total: number;
  page: number;
}

export function AuditTable({ entries: initialEntries, total: initialTotal, page: initialPage }: AuditTableProps) {
  const [entries, setEntries] = useState<AuditLogEntry[]>(initialEntries);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(initialPage);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = fromDate !== "" || toDate !== "" || selectedActions.length > 0;

  function fetchAuditLog(
    newPage: number,
    newFromDate: string,
    newToDate: string,
    newActions: string[]
  ) {
    startTransition(async () => {
      const result = await getAuditLog({
        page: newPage,
        fromDate: newFromDate || undefined,
        toDate: newToDate || undefined,
        actions: newActions.length > 0 ? newActions : undefined,
      });

      if (result.success) {
        setEntries(result.data.entries);
        setTotal(result.data.total);
        setPage(newPage);
      }
    });
  }

  function handleFromDateChange(value: string) {
    setFromDate(value);
    fetchAuditLog(1, value, toDate, selectedActions);
  }

  function handleToDateChange(value: string) {
    setToDate(value);
    fetchAuditLog(1, fromDate, value, selectedActions);
  }

  function handleActionChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newSelected = Array.from(e.target.selectedOptions, (opt) => opt.value);
    setSelectedActions(newSelected);
    fetchAuditLog(1, fromDate, toDate, newSelected);
  }

  function handleClear() {
    setFromDate("");
    setToDate("");
    setSelectedActions([]);
    fetchAuditLog(1, "", "", []);
  }

  function handlePrev() {
    if (page > 1) {
      fetchAuditLog(page - 1, fromDate, toDate, selectedActions);
    }
  }

  function handleNext() {
    if (page < totalPages) {
      fetchAuditLog(page + 1, fromDate, toDate, selectedActions);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground font-medium">From</label>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => handleFromDateChange(e.target.value)}
            className="w-36"
            disabled={isPending}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground font-medium">To</label>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => handleToDateChange(e.target.value)}
            className="w-36"
            disabled={isPending}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground font-medium">Action Type</label>
          <select
            multiple
            value={selectedActions}
            onChange={handleActionChange}
            className="border rounded px-2 py-1 text-sm h-24"
            disabled={isPending}
          >
            {AUDIT_ACTIONS.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
        </div>
        {hasFilters && (
          <div className="flex items-end pb-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              disabled={isPending}
            >
              Clear
            </Button>
          </div>
        )}
      </div>

      {/* Audit table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">Timestamp</TableHead>
              <TableHead className="w-36">Librarian</TableHead>
              <TableHead className="w-36">Action</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12">
                  <p className="text-base font-semibold">
                    {hasFilters ? "No results" : "No audit entries"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {hasFilters
                      ? "No audit entries match your current filters. Try adjusting the date range or action type."
                      : "Librarian actions will appear here once recorded."}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-sm text-muted-foreground w-40">
                    {new Date(entry.createdAt).toLocaleString("en-US", {
                      timeZone: "UTC",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </TableCell>
                  <TableCell className="font-semibold w-36">
                    {entry.actor.name}
                  </TableCell>
                  <TableCell className="w-36">
                    <Badge className={getActionBadgeClass(entry.action as AuditAction)}>
                      {entry.action}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {(entry.details as { description?: string })?.description ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrev}
            disabled={page === 1 || isPending}
          >
            Prev
          </Button>
          <span>Page {page} of {totalPages}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNext}
            disabled={page === totalPages || isPending}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
