import { prisma } from "@/lib/db";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default async function CatalogPage() {
  const books = await prisma.book.findMany({
    where: { deletedAt: null },
    include: { author: true, copies: true },
    orderBy: { title: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Search Catalog</h1>
        <span className="text-sm text-muted-foreground">
          {books.length} title{books.length !== 1 ? "s" : ""} available
        </span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Author</TableHead>
            <TableHead>Genre</TableHead>
            <TableHead>Publisher</TableHead>
            <TableHead className="text-right">Available</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {books.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                No books in the catalog yet.
              </TableCell>
            </TableRow>
          ) : (
            books.map((book) => {
              const available = book.copies.filter(
                (c) => c.status === "AVAILABLE"
              ).length;
              return (
                <TableRow key={book.id}>
                  <TableCell className="font-medium">{book.title}</TableCell>
                  <TableCell>{book.author.name}</TableCell>
                  <TableCell>
                    {book.genre ? (
                      <Badge variant="outline">{book.genre}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {book.publisher ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {available > 0 ? (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                        {available} available
                      </Badge>
                    ) : (
                      <Badge variant="destructive">Checked out</Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
