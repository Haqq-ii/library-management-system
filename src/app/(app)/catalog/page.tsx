"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { BookCard } from "@/components/catalog/BookCard";
import { searchCatalog } from "@/features/catalog/catalog-search";
import type { BookCardData } from "@/features/catalog/catalog-search";

export default function CatalogPage() {
  const [query, setQuery] = useState("");
  const [books, setBooks] = useState<BookCardData[]>([]);
  const [loaded, setLoaded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    searchCatalog("").then((r) => {
      if (r.success) setBooks(r.data);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const result = await searchCatalog(query);
      if (result.success) setBooks(result.data);
    }, 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, loaded]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Search Catalog</h1>
      <Input
        placeholder="Search by title, author, or ISBN…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-md"
      />
      {!loaded ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : books.length === 0 ? (
        <div className="py-12 text-center">
          <p className="font-medium">No books found</p>
          <p className="text-sm text-muted-foreground">
            Try a different title, author, or ISBN.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      )}
    </div>
  );
}
