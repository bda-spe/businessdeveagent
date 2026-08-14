import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation } from "wouter";
import { useResetPassword } from "@workspace/api-client-react";
import { ResetPasswordBody } from "@workspace/api-zod";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormDescription, FormMessage } from "@/components/ui/form";

type ResetPasswordValues = z.infer<typeof ResetPasswordBody>;

function emailFromQuery(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("email") ?? "";
}

export default function ResetPasswordPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const resetPassword = useResetPassword();

  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(ResetPasswordBody),
    defaultValues: { email: emailFromQuery(), code: "", newPassword: "" },
  });

  const onSubmit = (values: ResetPasswordValues) => {
    resetPassword.mutate(
      { data: { ...values, code: values.code.trim().toUpperCase() } },
      {
        onSuccess: () => {
          toast({ title: "Password reset. Sign in with your new password." });
          setLocation("/sign-in");
        },
        onError: () => {
          toast({ title: "That code is invalid or has expired.", variant: "destructive" });
        },
      },
    );
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4 py-12">
      <Card className="w-full max-w-md border-slate-200 shadow-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-slate-900">Enter your reset code</CardTitle>
          <CardDescription>Check your email for the code we just sent.</CardDescription>
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
                      <Input type="email" autoComplete="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reset code</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="one-time-code"
                        className="font-mono tracking-widest uppercase"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>Expires 30 minutes after you request it.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New password</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormDescription>At least 8 characters.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={resetPassword.isPending}>
                {resetPassword.isPending ? "Resetting..." : "Reset Password"}
              </Button>
            </form>
          </Form>
          <p className="mt-6 text-center text-sm text-slate-500">
            <Link href="/forgot-password" className="font-bold text-slate-900 hover:underline">
              Request a new code
            </Link>
            {" · "}
            <Link href="/sign-in" className="font-bold text-slate-900 hover:underline">
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
