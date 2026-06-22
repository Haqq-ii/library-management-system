"use client";

import { useState, useTransition } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getBorrowingActivity, type ActivityPoint } from "./activity";

interface BorrowingActivityChartProps {
  initialData: ActivityPoint[];
  initialFrom: string;
  initialTo: string;
}

export function BorrowingActivityChart({
  initialData,
  initialFrom,
  initialTo,
}: BorrowingActivityChartProps) {
  const [data, setData] = useState<ActivityPoint[]>(initialData);
  const [fromDate, setFromDate] = useState(initialFrom);
  const [toDate, setToDate] = useState(initialTo);
  const [isPending, startTransition] = useTransition();

  function handleApply() {
    startTransition(async () => {
      const r = await getBorrowingActivity({ fromDate, toDate });
      if (r.success) {
        setData(r.data);
      }
    });
  }

  // Determine if all data points have zero activity
  const isEmpty =
    data.length === 0 ||
    data.every((p) => p.loanCount === 0 && p.returnCount === 0);

  // Show every 7th label when range exceeds 14 days
  const xAxisInterval = data.length > 14 ? 6 : 0;

  return (
    <div className="space-y-4">
      {/* Filter bar — identical structure to PopularBooksTable */}
      <div className="flex items-end gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground font-medium">From</label>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-36"
            disabled={isPending}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground font-medium">To</label>
          <Input
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

      {/* Chart card */}
      <Card>
        <CardHeader>
          <CardTitle>Borrowing Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <Skeleton className="h-[320px] w-full rounded-md" />
          ) : isEmpty ? (
            <div className="py-12 text-center">
              <p className="text-base font-semibold">No activity data</p>
              <p className="text-sm text-muted-foreground mt-1">
                No loans or returns recorded in the selected date range. Try a wider range.
              </p>
            </div>
          ) : (
            <figure>
              <figcaption className="sr-only">
                Borrowing activity chart showing loans issued and returned over time
              </figcaption>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    interval={xAxisInterval}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip contentStyle={{ fontSize: "12px" }} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="loanCount"
                    name="Loans Issued"
                    stroke="var(--chart-1)"
                  />
                  <Line
                    type="monotone"
                    dataKey="returnCount"
                    name="Loans Returned"
                    stroke="var(--chart-2)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </figure>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
