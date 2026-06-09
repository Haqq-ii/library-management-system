"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fetchBookByISBN, createBook, updateBook } from "./actions";

const BookFormSchema = z.object({
  isbn: z.string().min(10).max(13),
  title: z.string().min(1),
  authorName: z.string().min(1),
  genre: z.string().optional(),
  publisher: z.string().optional(),
  publishedYear: z.string().optional(),
});

type BookFormValues = z.infer<typeof BookFormSchema>;

type EditBook = {
  id: string;
  isbn: string;
  title: string;
  author: { name: string };
  genre: string | null;
  publisher: string | null;
  publishedYear: number | null;
};

interface BookFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  book?: EditBook | null;
}

export function BookFormSheet({ open, onOpenChange, book }: BookFormSheetProps) {
  const [isbnLoading, setIsbnLoading] = useState(false);
  const [isbnError, setIsbnError] = useState<string | null>(null);
  const isEditing = !!book;

  const form = useForm<BookFormValues>({
    resolver: zodResolver(BookFormSchema),
    defaultValues: {
      isbn: book?.isbn ?? "",
      title: book?.title ?? "",
      authorName: book?.author?.name ?? "",
      genre: book?.genre ?? "",
      publisher: book?.publisher ?? "",
      publishedYear: book?.publishedYear != null ? String(book.publishedYear) : undefined,
    },
  });

  // Reset form whenever the sheet opens or the target book changes
  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      form.reset({
        isbn: book?.isbn ?? "",
        title: book?.title ?? "",
        authorName: book?.author?.name ?? "",
        genre: book?.genre ?? "",
        publisher: book?.publisher ?? "",
        publishedYear: book?.publishedYear != null ? String(book.publishedYear) : undefined,
      });
      setIsbnError(null);
    }
    onOpenChange(nextOpen);
  }

  async function handleAutoFill() {
    const isbn = form.getValues("isbn");
    if (!isbn) {
      form.setError("isbn", { message: "Enter an ISBN first." });
      return;
    }
    setIsbnLoading(true);
    setIsbnError(null);

    const result = await fetchBookByISBN(isbn);
    setIsbnLoading(false);

    if (!result.success) {
      setIsbnError(
        result.error === "ISBN_NOT_FOUND"
          ? "No book found for this ISBN."
          : "Auto-fill is unavailable right now. Enter details manually."
      );
      return;
    }

    if (result.data.title) form.setValue("title", result.data.title);
    if (result.data.author) form.setValue("authorName", result.data.author);
    if (result.data.publisher) form.setValue("publisher", result.data.publisher);
    if (result.data.publishedYear) form.setValue("publishedYear", String(result.data.publishedYear));
  }

  async function onSubmit(values: BookFormValues) {
    const payload = {
      isbn: values.isbn,
      title: values.title,
      authorName: values.authorName,
      genre: values.genre || undefined,
      publisher: values.publisher || undefined,
      publishedYear: values.publishedYear ? parseInt(values.publishedYear) || undefined : undefined,
    };

    const result = isEditing
      ? await updateBook(book!.id, payload)
      : await createBook(payload);

    if (result.success) {
      toast.success(isEditing ? "Book updated successfully." : "Book added successfully.");
      onOpenChange(false);
    } else {
      toast.error("Couldn't save the book. Please check your input and try again.");
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Edit Book" : "Add Book"}</SheetTitle>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4 px-1">
            {/* ISBN + Auto-fill */}
            <FormField
              control={form.control}
              name="isbn"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ISBN</FormLabel>
                  <div className="flex gap-2">
                    <FormControl>
                      <Input placeholder="e.g. 9780140449136" {...field} />
                    </FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAutoFill}
                      disabled={isbnLoading}
                      className="shrink-0"
                    >
                      {isbnLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Auto-fill"
                      )}
                    </Button>
                  </div>
                  <FormMessage />
                  {isbnError && (
                    <p className="text-sm text-destructive mt-1">{isbnError}</p>
                  )}
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Book title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="authorName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Author</FormLabel>
                  <FormControl>
                    <Input placeholder="Author name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="genre"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Genre</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Fiction, Science" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="publisher"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Publisher</FormLabel>
                  <FormControl>
                    <Input placeholder="Publisher name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="publishedYear"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Year</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="e.g. 2024"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <SheetFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Save Book
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
