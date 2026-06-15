"use client";

import { useState, useTransition, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { searchMembers, searchBooks } from "./loan-search";
import type { MemberSearchResult, BookSearchResult } from "./loan-search";
import { checkoutBook } from "./actions";

interface LoanPolicy {
  memberType: string;
  loanDays: number;
}

interface CheckoutSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policies: LoanPolicy[];
}

export function CheckoutSheet({
  open,
  onOpenChange,
  policies,
}: CheckoutSheetProps) {
  // Member search state
  const [memberQuery, setMemberQuery] = useState("");
  const [memberResults, setMemberResults] = useState<MemberSearchResult[]>([]);
  const [selectedMember, setSelectedMember] = useState<MemberSearchResult | null>(null);
  const [showMemberResults, setShowMemberResults] = useState(false);

  // Book search state
  const [bookQuery, setBookQuery] = useState("");
  const [bookResults, setBookResults] = useState<BookSearchResult[]>([]);
  const [selectedBook, setSelectedBook] = useState<BookSearchResult | null>(null);
  const [showBookResults, setShowBookResults] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, startMemberTransition] = useTransition();
  const [, startBookTransition] = useTransition();

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      // Reset all state on close
      setMemberQuery("");
      setMemberResults([]);
      setSelectedMember(null);
      setShowMemberResults(false);
      setBookQuery("");
      setBookResults([]);
      setSelectedBook(null);
      setShowBookResults(false);
    }
    onOpenChange(nextOpen);
  }

  function handleMemberQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setMemberQuery(q);
    setSelectedMember(null);
    setShowMemberResults(true);
    startMemberTransition(async () => {
      const result = await searchMembers(q);
      if (result.success) setMemberResults(result.data);
    });
  }

  function handleSelectMember(m: MemberSearchResult) {
    setSelectedMember(m);
    setMemberQuery(`${m.name} (${m.memberNumber})`);
    setShowMemberResults(false);
  }

  function handleBookQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setBookQuery(q);
    setSelectedBook(null);
    setShowBookResults(true);
    startBookTransition(async () => {
      const result = await searchBooks(q);
      if (result.success) setBookResults(result.data);
    });
  }

  function handleSelectBook(b: BookSearchResult) {
    if (b.availableCount === 0) return;
    setSelectedBook(b);
    setBookQuery(`${b.title} (${b.availableCount} available)`);
    setShowBookResults(false);
  }

  // Compute due date preview from selected member's policy (D-04)
  // useMemo prevents Date.now() being flagged as impure during render
  const dueDatePreview = useMemo(() => {
    if (!selectedMember) return null;
    const policy = policies.find((p) => p.memberType === selectedMember.memberType);
    if (!policy) return null;
    const nowMs = new Date().getTime();
    const dueDate = new Date(nowMs + policy.loanDays * 24 * 60 * 60 * 1000);
    return dueDate.toLocaleDateString();
  }, [selectedMember, policies]);

  async function handleConfirm() {
    if (!selectedMember || !selectedBook) return;
    setIsSubmitting(true);
    try {
      const result = await checkoutBook({
        memberId: selectedMember.id,
        bookId: selectedBook.id,
      });
      if (result.success) {
        toast.success("Book checked out successfully.");
        handleOpenChange(false);
      } else if (result.error === "NO_COPIES") {
        toast.error("No copies available for this title.");
      } else {
        toast.error("Couldn't complete checkout. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Check Out Book</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-5 px-1">
          {/* Member search */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Member</label>
            <div className="relative">
              <Input
                placeholder="Search by name, email, or member number..."
                value={memberQuery}
                onChange={handleMemberQueryChange}
                onFocus={() => setShowMemberResults(true)}
                autoComplete="off"
              />
              {showMemberResults && memberResults.length > 0 && (
                <ul className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
                  {memberResults.map((m) => (
                    <li
                      key={m.id}
                      className="cursor-pointer px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                      onMouseDown={() => handleSelectMember(m)}
                    >
                      <span className="font-medium">{m.name}</span>
                      <span className="ml-2 text-muted-foreground text-xs">
                        {m.memberNumber} · {m.memberType}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Book search */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Book</label>
            <div className="relative">
              <Input
                placeholder="Search by title or ISBN..."
                value={bookQuery}
                onChange={handleBookQueryChange}
                onFocus={() => setShowBookResults(true)}
                autoComplete="off"
              />
              {showBookResults && bookResults.length > 0 && (
                <ul className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
                  {bookResults.map((b) => (
                    <li
                      key={b.id}
                      onMouseDown={() => handleSelectBook(b)}
                      className={cn(
                        "px-3 py-2 text-sm",
                        b.availableCount === 0
                          ? "cursor-not-allowed opacity-50"
                          : "cursor-pointer hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <span className="font-medium">{b.title}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {b.availableCount === 0
                          ? "No copies available"
                          : `${b.availableCount} available`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Due date preview — read-only, computed client-side from policy prop (D-04) */}
          {dueDatePreview && (
            <div className="space-y-1">
              <label className="text-sm font-medium">Due Date</label>
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                {dueDatePreview}
              </div>
            </div>
          )}
        </div>

        <SheetFooter className="pt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedMember || !selectedBook || isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Confirm Checkout
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
