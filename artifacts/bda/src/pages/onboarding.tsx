import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { useGetMe, useCreateBusiness } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logoUrl from "@assets/bda-split_1783453365816.png";
import { useToast } from "@/hooks/use-toast";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const formSchema = z.object({
  ownerName: z.string().min(1, "Name is required"),
  businessName: z.string().min(1, "Business name is required"),
});

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const { data: me, isLoading: isLoadingMe } = useGetMe();
  const createBusiness = useCreateBusiness();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ownerName: me?.user?.ownerName || "",
      businessName: "",
    },
  });

  const alreadyOnboarded = !!(me?.business && me?.onboardingComplete);

  useEffect(() => {
    if (alreadyOnboarded) {
      setLocation("/dashboard");
    }
  }, [alreadyOnboarded, setLocation]);

  if (isLoadingMe) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Loading...</div>;
  }

  // If they already finished onboarding, don't flash the form while redirecting.
  if (alreadyOnboarded) {
    return null;
  }

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createBusiness.mutate(
      { data: values },
      {
        onSuccess: () => {
          toast({
            title: "Business Created",
            description: "Welcome to BDA! Let's set up your agent.",
          });
          setLocation("/business");
        },
        onError: (err: any) => {
          toast({
            title: "Failed to create business",
            description: err.message || "An unexpected error occurred.",
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="p-8 pb-6 border-b border-slate-100 text-center">
          <img
            src={logoUrl}
            alt="BDA — Business Development Agent"
            className="h-12 w-auto rounded mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-slate-900">Welcome to BDA</h1>
          <p className="text-slate-500 mt-2">Let's get your digital employee set up.</p>
        </div>
        
        <div className="p-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="ownerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Your Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Jane Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="businessName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Acme Plumbing & Heating" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                className="w-full h-12 text-base font-medium"
                disabled={createBusiness.isPending}
              >
                {createBusiness.isPending ? "Setting up..." : "Create Workspace"}
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}