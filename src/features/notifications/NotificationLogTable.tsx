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
import { getNotificationLog, type NotificationLogEntry } from "./actions";

// Notification type values matching the server action allow-list
const NOTIFICATION_TYPES = [
  "DUE_DATE_3DAY",
  "DUE_DATE_SAME",
  "OVERDUE_ALERT",
  "HOLD_READY",
] as const;

const PAGE_SIZE = 20;

interface NotificationLogTableProps {
  entries: NotificationLogEntry[];
  total: number;
  page: number;
}

export function NotificationLogTable({
  entries: initialEntries,
  total: initialTotal,
  page: initialPage,
}: NotificationLogTableProps) {
  const [entries, setEntries] = useState<NotificationLogEntry[]>(initialEntries);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(initialPage);
  const [selectedType, setSelectedType] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function fetchNotificationLog(newPage: number, newType: string) {
    startTransition(async () => {
      const result = await getNotificationLog({
        page: newPage,
        type: newType || undefined,
      });

      if (result.success) {
        setEntries(result.data.entries);
        setTotal(result.data.total);
        setPage(newPage);
      }
    });
  }

  function handleTypeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newType = e.target.value;
    setSelectedType(newType);
    fetchNotificationLog(1, newType);
  }

  function handleClear() {
    setSelectedType("");
    fetchNotificationLog(1, "");
  }

  function handlePrev() {
    if (page > 1) {
      fetchNotificationLog(page - 1, selectedType);
    }
  }

  function handleNext() {
    if (page < totalPages) {
      fetchNotificationLog(page + 1, selectedType);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filter bar — type filter only (no date-range for notification log v1) */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground font-medium">
            Notification Type
          </label>
          <select
            value={selectedType}
            onChange={handleTypeChange}
            className="border rounded px-2 py-1 text-sm h-8"
            disabled={isPending}
          >
            <option value="">All types</option>
            {NOTIFICATION_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        {selectedType && (
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

      {/* Notification log table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-44">Sent At</TableHead>
              <TableHead className="w-36">Member</TableHead>
              <TableHead className="w-36">Type</TableHead>
              <TableHead className="w-28">Channel</TableHead>
              <TableHead className="w-24">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <p className="text-base font-semibold">
                    {selectedType ? "No results" : "No notification log entries"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedType
                      ? "No notifications match the selected type. Try a different filter."
                      : "Notification delivery attempts will appear here once notifications are sent."}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-sm text-muted-foreground w-44">
                    {new Date(entry.sentAt).toLocaleString("en-US", {
                      timeZone: "UTC",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </TableCell>
                  <TableCell className="font-semibold w-36">
                    {entry.memberName}
                  </TableCell>
                  <TableCell className="w-36">
                    <span className="text-sm font-mono">{entry.type}</span>
                  </TableCell>
                  <TableCell className="w-28 text-sm">{entry.channel}</TableCell>
                  <TableCell className="w-24">
                    {entry.success ? (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                        Sent
                      </Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
                        Failed
                      </Badge>
                    )}
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
          <span>
            Page {page} of {totalPages}
          </span>
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
