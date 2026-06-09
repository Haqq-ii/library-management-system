"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Users, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { softDeleteMember } from "./actions";
import { MemberFormSheet } from "./MemberFormSheet";

type MemberRow = {
  id: string;
  name: string;
  email: string;
  role: string | null;
  deletedAt: Date | string | null;
  createdAt: Date | string;
  member: {
    memberNumber: string;
    memberType: string;
    joinedAt: Date | string;
  } | null;
};

export function MemberTable({
  members,
  showInactive,
}: {
  members: MemberRow[];
  showInactive: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<MemberRow | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<MemberRow | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleToggleInactive(checked: boolean) {
    router.push(checked ? "/members?inactive=1" : "/members");
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.member?.memberNumber ?? "").toLowerCase().includes(q)
    );
  }, [members, search]);

  function handleEdit(member: MemberRow) {
    setEditingMember(member);
    setIsSheetOpen(true);
  }

  function handleAdd() {
    setEditingMember(null);
    setIsSheetOpen(true);
  }

  function handleDeactivate() {
    if (!deactivateTarget) return;
    const id = deactivateTarget.id;
    setDeactivateTarget(null);
    startTransition(async () => {
      const result = await softDeleteMember(id);
      if (result.success) {
        toast.success("Member deactivated");
      } else {
        toast.error("Couldn't deactivate the member. Please try again.");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-4">
          <Input
            placeholder="Search by name, email, or member #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          <div className="flex items-center gap-2">
            <Switch
              id="show-inactive-members"
              checked={showInactive}
              onCheckedChange={handleToggleInactive}
            />
            <Label htmlFor="show-inactive-members" className="cursor-pointer">
              Show inactive
            </Label>
          </div>
        </div>
        <Button onClick={handleAdd}>Add Member</Button>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && !search ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No members yet</h3>
          <p className="text-muted-foreground mt-1 mb-4">
            Register the first member to get started.
          </p>
          <Button onClick={handleAdd}>Add Member</Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Member #</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No members match your search.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((m) => {
                const isInactive = !!m.deletedAt;
                return (
                  <TableRow key={m.id} className={isInactive ? "opacity-60" : undefined}>
                    <TableCell className="font-medium">
                      {m.name}
                      {isInactive && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{m.email}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {m.member?.memberNumber ?? "—"}
                    </TableCell>
                    <TableCell>
                      {m.member?.memberType ? (
                        <Badge variant="outline">
                          {m.member.memberType === "STUDENT" ? "Student" : "Faculty"}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          isInactive
                            ? "bg-red-50 text-red-700 hover:bg-red-50"
                            : "bg-green-100 text-green-800 hover:bg-green-100"
                        }
                      >
                        {isInactive ? "Inactive" : "Active"}
                      </Badge>
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
                          <DropdownMenuItem onClick={() => handleEdit(m)}>
                            Edit
                          </DropdownMenuItem>
                          {!isInactive && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeactivateTarget(m)}
                            >
                              Deactivate
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      )}

      {/* Add / Edit sheet */}
      <MemberFormSheet
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        member={editingMember}
      />

      {/* Deactivate confirmation dialog */}
      <Dialog
        open={!!deactivateTarget}
        onOpenChange={(open) => { if (!open) setDeactivateTarget(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate member?</DialogTitle>
            <DialogDescription>
              This member&apos;s account will be deactivated. Their loan history and records are preserved.
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
