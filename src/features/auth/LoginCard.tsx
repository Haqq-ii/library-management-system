"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

// ── Zod schema ────────────────────────────────────────────────────────────────
const LoginSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters." }),
});

type LoginData = z.infer<typeof LoginSchema>;

// ── Error copy (UI-SPEC Copywriting Contract) ─────────────────────────────────
const ERROR_WRONG_CREDENTIALS =
  "Incorrect email or password. Please try again.";
const ERROR_ACCOUNT_INACTIVE =
  "Your account has been deactivated. Contact the library.";

export function LoginCard() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<LoginData>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(data: LoginData) {
    setIsPending(true);
    setFormError(null);

    try {
      const result = await authClient.signIn.email({
        email: data.email,
        password: data.password,
        fetchOptions: {
          onError: (ctx) => {
            // Handle errors returned from Better Auth
            const errorCode =
              ctx.error?.code ?? ctx.error?.message ?? "UNKNOWN";

            if (
              errorCode.includes("banned") ||
              errorCode.includes("deactivated") ||
              errorCode.includes("inactive")
            ) {
              setFormError(ERROR_ACCOUNT_INACTIVE);
            } else {
              setFormError(ERROR_WRONG_CREDENTIALS);
            }
            setIsPending(false);
          },
          onSuccess: (ctx) => {
            // Determine redirect target based on role from session
            // Better Auth admin plugin stores role on user object
            const role =
              (ctx.data as { user?: { role?: string } })?.user?.role;
            if (role === "LIBRARIAN") {
              router.push("/dashboard");
            } else {
              router.push("/catalog");
            }
          },
        },
      });

      // If result is returned (non-callback path) and has an error
      if (result?.error) {
        setFormError(ERROR_WRONG_CREDENTIALS);
        setIsPending(false);
      }
    } catch (err) {
      toast.error(ERROR_WRONG_CREDENTIALS);
      setFormError(ERROR_WRONG_CREDENTIALS);
      setIsPending(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-2xl font-semibold text-center">
          Library Management System
        </CardTitle>
        <CardDescription className="text-center">
          Sign in to your account to continue
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      autoComplete="current-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Inline form-level error (UI-SPEC error states, T-04-03 — generic copy) */}
            {formError && (
              <p
                role="alert"
                className="text-sm font-medium text-destructive"
                data-slot="error"
              >
                {formError}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isPending}
              aria-disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
