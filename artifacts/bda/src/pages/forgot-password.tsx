import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation } from "wouter";
import { useForgotPassword } from "@workspace/api-client-react";
import { ForgotPasswordBody } from "@workspace/api-zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { MailCheck } from "lucide-react";
import LegalFooterLinks from "@/components/legal-footer-links";

type ForgotPasswordValues = z.infer<typeof ForgotPasswordBody>;

export default function ForgotPasswordPage() {
  const [, setLocation] = useLocation();
  const forgotPassword = useForgotPassword();
  const [sentTo, setSentTo] = useState<string | null>(null);

  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(ForgotPasswordBody),
    defaultValues: { email: "" },
  });

  const onSubmit = (values: ForgotPasswordValues) => {
    forgotPassword.mutate({ data: values }, { onSuccess: () => setSentTo(values.email) });
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4 py-12">
      <Card className="w-full max-w-md border-slate-200 shadow-sm">
        {sentTo ? (
          <CardContent className="pt-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <MailCheck className="h-6 w-6 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Check your email</h2>
            <p className="mt-2 text-sm text-slate-600">
              If an account exists for <strong>{sentTo}</strong>, a reset code is on its way. It expires in 30 minutes.
            </p>
            <Button
              className="mt-6 w-full"
              onClick={() => setLocation(`/reset-password?email=${encodeURIComponent(sentTo)}`)}
            >
              I have my code
            </Button>
          </CardContent>
        ) : (
          <>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold text-slate-900">Reset your password</CardTitle>
              <CardDescription>We&apos;ll email you a code to reset it.</CardDescription>
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
                  <Button type="submit" className="w-full" disabled={forgotPassword.isPending}>
                    {forgotPassword.isPending ? "Sending..." : "Send Reset Code"}
                  </Button>
                </form>
              </Form>
              <p className="mt-6 text-center text-sm text-slate-500">
                <Link href="/sign-in" className="font-bold text-slate-900 hover:underline">
                  Back to sign in
                </Link>
              </p>
            </CardContent>
          </>
        )}
      </Card>
      <div className="fixed bottom-6 left-0 right-0 flex justify-center">
        <LegalFooterLinks className="text-slate-400" />
      </div>
    </div>
  );
}
