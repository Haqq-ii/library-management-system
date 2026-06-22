import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface FineSummaryCardsProps {
  recorded: number;
  waived: number;
  outstanding: number;
}

export function FineSummaryCards({
  recorded,
  waived,
  outstanding,
}: FineSummaryCardsProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        {/* Card 1: Total Fines Recorded */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Fines Recorded
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">${recorded.toFixed(2)}</p>
          </CardContent>
        </Card>

        {/* Card 2: Total Waived */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Waived
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">${waived.toFixed(2)}</p>
            <Badge className="mt-1 bg-orange-100 text-orange-800">Waived</Badge>
          </CardContent>
        </Card>

        {/* Card 3: Total Outstanding */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Outstanding
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">${outstanding.toFixed(2)}</p>
            <Badge className="mt-1 bg-red-100 text-red-800">Outstanding</Badge>
          </CardContent>
        </Card>
      </div>

      <p className="text-sm text-muted-foreground">
        Outstanding = Recorded minus Waived
      </p>
    </div>
  );
}
