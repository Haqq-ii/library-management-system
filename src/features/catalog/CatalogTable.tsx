"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { BookOpen, MoreHorizontal, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { softDeleteBook } from "./actions";
import { BookFormSheet } from "./BookFormSheet";

type BookWithDetails = {
  id: string;
  isbn: string;
  title: string;
  author: { name: string };
  genre: string | null;
  publisher: string | null;
  publishedYear: number | null;
  totalCopies: number;
  deletedAt: Date | string | null;
  copies: { status: string }[];
};

type SortKey = "title" | "author" | "isbn";
type SortDir = "asc" | "desc" | null;

const PAGE_SIZE = 20;

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey | null; sortDir: SortDir }) {
  if (sortKey !== col) return <ChevronsUpDown className="ml-1 h-3 w-3 text-muted-foreground" />;
  if (sortDir === "asc") return <ChevronUp className="ml-1 h-3 w-3" />;
  return <ChevronDown className="ml-1 h-3 w-3" />;
}

export function CatalogTable({
  books,
  showInactive,
}: {
  books: BookWithDetails[];
  showInactive: boolean;
}) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [page, setPage] = useState(1);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<BookWithDetails | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<BookWithDetails | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleToggleInactive(checked: boolean) {
    setPage(1);
    router.push(checked ? "/books?inactive=1" : "/books");
  }

  function handleSort(key: SortKey) {
    setPage(1);
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortKey(null);
      setSortDir(null);
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return books;
    return [...books].sort((a, b) => {
      const aVal =
        sortKey === "title" ? a.title : sortKey === "author" ? a.author.name : a.isbn;
      const bVal =
        sortKey === "title" ? b.title : sortKey === "author" ? b.author.name : b.isbn;
      return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
  }, [books, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleEdit(book: BookWithDetails) {
    setEditingBook(book);
    setIsSheetOpen(true);
  }

  function handleAdd() {
    setEditingBook(null);
    setIsSheetOpen(true);
  }

  function handleDeactivate() {
    if (!deactivateTarget) return;
    const id = deactivateTarget.id;
    setDeactivateTarget(null);
    startTransition(async () => {
      const result = await softDeleteBook(id);
      if (result.success) {
        toast.success("Book deactivated");
      } else {
        toast.error("Couldn't deactivate the book. Please try again.");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Switch
            id="show-inactive"
            checked={showInactive}
            onCheckedChange={handleToggleInactive}
          />
          <Label htmlFor="show-inactive" className="cursor-pointer">
            Show inactive
          </Label>
        </div>
        <Button onClick={handleAdd}>Add Book</Button>
      </div>

      {/* Table */}
      {paginated.length === 0 && !showInactive ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No books yet</h3>
          <p className="text-muted-foreground mt-1 mb-4">
            Add your first book to start building the catalog.
          </p>
          <Button onClick={handleAdd}>Add Book</Button>
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort("title")}
                >
                  <span className="inline-flex items-center">
                    Title <SortIcon col="title" sortKey={sortKey} sortDir={sortDir} />
                  </span>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort("author")}
                >
                  <span className="inline-flex items-center">
                    Author <SortIcon col="author" sortKey={sortKey} sortDir={sortDir} />
                  </span>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort("isbn")}
                >
                  <span className="inline-flex items-center">
                    ISBN <SortIcon col="isbn" sortKey={sortKey} sortDir={sortDir} />
                  </span>
                </TableHead>
                <TableHead>Genre</TableHead>
                <TableHead className="text-right">Copies</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((book) => {
                const available = book.copies.filter((c) => c.status === "AVAILABLE").length;
                const isInactive = !!book.deletedAt;
                return (
                  <TableRow key={book.id} className={isInactive ? "opacity-60" : undefined}>
                    <TableCell className="font-medium">
                      {book.title}
                      {isInactive && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{book.author.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {book.isbn}
                    </TableCell>
                    <TableCell>
                      {book.genre ? (
                        <Badge variant="outline">{book.genre}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={available > 0 ? "text-green-600 font-medium" : "text-red-500"}
                      >
                        {available}
                      </span>
                      <span className="text-muted-foreground">/{book.totalCopies}</span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(book)}>
                            Edit
                          </DropdownMenuItem>
                          {!isInactive && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeactivateTarget(book)}
                            >
                              Deactivate
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Pagination */}
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

      {/* Add / Edit sheet */}
      <BookFormSheet
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        book={editingBook}
      />

      {/* Deactivate confirmation dialog */}
      <Dialog
        open={!!deactivateTarget}
        onOpenChange={(open) => { if (!open) setDeactivateTarget(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate book?</DialogTitle>
            <DialogDescription>
              This book will be hidden from the catalog. Existing loan records are preserved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeactivate} disabled={isPending}>
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
