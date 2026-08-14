import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation } from "wouter";
import { useSignup } from "@workspace/api-client-react";
import { SignupBody } from "@workspace/api-zod";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormDescription, FormMessage } from "@/components/ui/form";

type SignupValues = z.infer<typeof SignupBody>;

export default function SignUpPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const signup = useSignup();

  const form = useForm<SignupValues>({
    resolver: zodResolver(SignupBody),
    defaultValues: { email: "", password: "", ownerName: "" },
  });

  const onSubmit = (values: SignupValues) => {
    signup.mutate(
      { data: values },
      {
        onSuccess: () => setLocation("/onboarding"),
        onError: (err: unknown) => {
          const message =
            err instanceof Error ? err.message : "Could not create your account.";
          toast({ title: message, variant: "destructive" });
        },
      },
    );
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4 py-12">
      <Card className="w-full max-w-md border-slate-200 shadow-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-slate-900">Create your account</CardTitle>
          <CardDescription>Start building your business agent</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="ownerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Your name</FormLabel>
                    <FormControl>
                      <Input autoComplete="name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormDescription>At least 8 characters.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={signup.isPending} data-testid="button-sign-up">
                {signup.isPending ? "Creating account..." : "Create Account"}
              </Button>
            </form>
          </Form>
          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link href="/sign-in" className="font-bold text-slate-900 hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
