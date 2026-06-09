import { Badge } from "@/components/ui/badge";

export type CopyStatus = "AVAILABLE" | "CHECKED_OUT" | "RESERVED" | "LOST" | "WITHDRAWN";

const colorMap: Record<CopyStatus, string> = {
  AVAILABLE: "bg-green-100 text-green-800 hover:bg-green-100",
  CHECKED_OUT: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
  RESERVED: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  LOST: "bg-red-100 text-red-800 hover:bg-red-100",
  WITHDRAWN: "bg-red-50 text-red-700 hover:bg-red-50",
};

const labelMap: Record<CopyStatus, string> = {
  AVAILABLE: "AVAILABLE",
  CHECKED_OUT: "CHECKED OUT",
  RESERVED: "RESERVED",
  LOST: "LOST",
  WITHDRAWN: "WITHDRAWN",
};

export function BookStatusBadge({ status }: { status: CopyStatus }) {
  return (
    <Badge className={colorMap[status]}>
      {labelMap[status]}
    </Badge>
  );
}
