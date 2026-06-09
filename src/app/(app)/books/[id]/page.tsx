import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CopiesSubTable } from "@/features/catalog/CopiesSubTable";

interface BookDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function BookDetailPage({ params }: BookDetailPageProps) {
  const { id } = await params;

  const book = await prisma.book.findUnique({
    where: { id, deletedAt: null },
    include: {
      author: true,
      copies: { orderBy: { addedAt: "asc" } },
    },
  });

  if (!book) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold">{book.title}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Book information</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[140px_1fr] gap-y-3 text-sm">
            <dt className="text-muted-foreground">Author</dt>
            <dd>{book.author.name}</dd>

            <dt className="text-muted-foreground">ISBN</dt>
            <dd className="font-mono">{book.isbn}</dd>

            {book.genre && (
              <>
                <dt className="text-muted-foreground">Genre</dt>
                <dd>
                  <Badge variant="outline">{book.genre}</Badge>
                </dd>
              </>
            )}

            {book.publisher && (
              <>
                <dt className="text-muted-foreground">Publisher</dt>
                <dd>{book.publisher}</dd>
              </>
            )}

            {book.publishedYear && (
              <>
                <dt className="text-muted-foreground">Published</dt>
                <dd>{book.publishedYear}</dd>
              </>
            )}

            <dt className="text-muted-foreground">Total copies</dt>
            <dd>{book.totalCopies}</dd>
          </dl>
        </CardContent>
      </Card>

      <CopiesSubTable bookId={book.id} copies={book.copies} />
    </div>
  );
}
