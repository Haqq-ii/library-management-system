"use client";

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
import { createMember, updateMember } from "./actions";

const CreateMemberFormSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  memberType: z.enum(["STUDENT", "FACULTY"]),
});

const UpdateMemberFormSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  memberType: z.enum(["STUDENT", "FACULTY"]),
});

type CreateFormValues = z.infer<typeof CreateMemberFormSchema>;
type UpdateFormValues = z.infer<typeof UpdateMemberFormSchema>;

type EditMember = {
  id: string;
  name: string;
  email: string;
  member: { memberType: string } | null;
};

interface MemberFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member?: EditMember | null;
}

export function MemberFormSheet({ open, onOpenChange, member }: MemberFormSheetProps) {
  const isEditing = !!member;

  const createForm = useForm<CreateFormValues>({
    resolver: zodResolver(CreateMemberFormSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      memberType: "STUDENT",
    },
  });

  const updateForm = useForm<UpdateFormValues>({
    resolver: zodResolver(UpdateMemberFormSchema),
    defaultValues: {
      name: member?.name ?? "",
      email: member?.email ?? "",
      memberType: (member?.member?.memberType as "STUDENT" | "FACULTY") ?? "STUDENT",
    },
  });

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      if (isEditing && member) {
        updateForm.reset({
          name: member.name,
          email: member.email,
          memberType: (member.member?.memberType as "STUDENT" | "FACULTY") ?? "STUDENT",
        });
      } else {
        createForm.reset({ name: "", email: "", password: "", memberType: "STUDENT" });
      }
    }
    onOpenChange(nextOpen);
  }

  async function onCreateSubmit(values: CreateFormValues) {
    const result = await createMember(values);
    if (result.success) {
      toast.success("Member registered successfully.");
      onOpenChange(false);
    } else if (result.error === "EMAIL_EXISTS") {
      toast.error("A member with this email already exists.");
    } else {
      toast.error("Couldn't save the member. Please check your input and try again.");
    }
  }

  async function onUpdateSubmit(values: UpdateFormValues) {
    if (!member) return;
    const result = await updateMember(member.id, values);
    if (result.success) {
      toast.success("Member updated successfully.");
      onOpenChange(false);
    } else if (result.error === "EMAIL_EXISTS") {
      toast.error("A member with this email already exists.");
    } else {
      toast.error("Couldn't save the member. Please check your input and try again.");
    }
  }

  const MemberTypeField = ({ control }: { control: any }) => (
    <FormField
      control={control}
      name="memberType"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Member Type</FormLabel>
          <FormControl>
            <div className="flex gap-6 pt-1">
              {(["STUDENT", "FACULTY"] as const).map((type) => (
                <label key={type} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value={type}
                    checked={field.value === type}
                    onChange={() => field.onChange(type)}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="text-sm">
                    {type === "STUDENT" ? "Student" : "Faculty"}
                  </span>
                </label>
              ))}
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  if (isEditing) {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent className="w-full sm:max-w-[480px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Member</SheetTitle>
          </SheetHeader>
          <Form {...updateForm}>
            <form
              onSubmit={updateForm.handleSubmit(onUpdateSubmit)}
              className="mt-6 space-y-4 px-1"
            >
              <FormField
                control={updateForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Full name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={updateForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="email@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <MemberTypeField control={updateForm.control} />
              <SheetFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateForm.formState.isSubmitting}>
                  {updateForm.formState.isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Save Member
                </Button>
              </SheetFooter>
            </form>
          </Form>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Add Member</SheetTitle>
        </SheetHeader>
        <Form {...createForm}>
          <form
            onSubmit={createForm.handleSubmit(onCreateSubmit)}
            className="mt-6 space-y-4 px-1"
          >
            <FormField
              control={createForm.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Full name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={createForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="email@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={createForm.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Min. 8 characters" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <MemberTypeField control={createForm.control} />
            <SheetFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createForm.formState.isSubmitting}>
                {createForm.formState.isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Save Member
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
