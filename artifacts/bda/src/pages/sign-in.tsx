import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { LoginBody } from "@workspace/api-zod";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

type LoginValues = z.infer<typeof LoginBody>;

export default function SignInPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const login = useLogin();

  const form = useForm<LoginValues>({
    resolver: zodResolver(LoginBody),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (values: LoginValues) => {
    login.mutate(
      { data: values },
      {
        onSuccess: () => setLocation("/dashboard"),
        onError: () => {
          toast({ title: "Invalid email or password.", variant: "destructive" });
        },
      },
    );
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4 py-12">
      <Card className="w-full max-w-md border-slate-200 shadow-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-slate-900">Welcome back</CardTitle>
          <CardDescription>Sign in to access your business agent</CardDescription>
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
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Password</FormLabel>
                      <Link href="/forgot-password" className="text-xs font-medium text-slate-500 hover:text-slate-900">
                        Forgot password?
                      </Link>
                    </div>
                    <FormControl>
                      <Input type="password" autoComplete="current-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={login.isPending} data-testid="button-sign-in">
                {login.isPending ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </Form>
          <p className="mt-6 text-center text-sm text-slate-500">
            Don&apos;t have an account?{" "}
            <Link href="/sign-up" className="font-bold text-slate-900 hover:underline">
              Create one
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
