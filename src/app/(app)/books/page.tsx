import { prisma } from "@/lib/db";
import { CatalogTable } from "@/features/catalog/CatalogTable";

interface BooksPageProps {
  searchParams: Promise<{ inactive?: string }>;
}

export default async function BooksPage({ searchParams }: BooksPageProps) {
  const params = await searchParams;
  const showInactive = params.inactive === "1";

  const books = await prisma.book.findMany({
    where: showInactive ? {} : { deletedAt: null },
    include: { author: true, copies: true },
    orderBy: { title: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Books</h1>
        <span className="text-sm text-muted-foreground">
          {books.length} title{books.length !== 1 ? "s" : ""}
        </span>
      </div>
      <CatalogTable books={books} showInactive={showInactive} />
    </div>
  );
}
