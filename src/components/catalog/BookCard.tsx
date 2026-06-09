import { BookOpen } from "lucide-react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BookCardData } from "@/features/catalog/catalog-search";

export function BookCard({ book }: { book: BookCardData }) {
  return (
    <Card data-testid="book-card" className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex h-32 items-center justify-center rounded-md bg-muted">
          <BookOpen className="h-12 w-12 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-1 pb-2">
        <p className="line-clamp-2 font-medium leading-snug">{book.title}</p>
        <p className="text-sm text-muted-foreground">{book.author}</p>
        {book.availableCount > 0 ? (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            {book.availableCount} of {book.totalCount} available
          </Badge>
        ) : (
          <Badge variant="secondary">
            0 of {book.totalCount} available
          </Badge>
        )}
      </CardContent>
      <CardFooter>
        <Button className="w-full" disabled title="Coming in Phase 3">
          Reserve
        </Button>
      </CardFooter>
    </Card>
  );
}
