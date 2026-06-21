"use client";

import { useTransition } from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { reserveBook } from "@/features/catalog/actions";
import type { BookCardData } from "@/features/catalog/catalog-search";

// RES-01 (D-07): Reserve button wired to reserveBook — verified Phase 3 Plan 03
export function BookCard({ book }: { book: BookCardData }) {
  const [isPending, startTransition] = useTransition();

  function handleReserve() {
    startTransition(async () => {
      const result = await reserveBook(book.id);
      if (result.success) {
        toast.success("You're on the waitlist for this book.");
      } else if (result.error === "ALREADY_RESERVED") {
        toast.info("You already have a reservation for this book.");
      } else {
        toast.error("Couldn't place reservation. Please try again.");
      }
    });
  }

  return (
    <Card data-testid="book-card" className="flex flex-col">
      <Link href={`/books/${book.id}`} className="flex flex-col flex-1">
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
      </Link>
      <CardFooter>
        <Button
          className="w-full"
          disabled={book.availableCount > 0 || isPending}
          onClick={handleReserve}
        >
          Reserve
        </Button>
      </CardFooter>
    </Card>
  );
}
