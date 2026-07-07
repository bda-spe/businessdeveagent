import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useGetPricing, useSavePricing, getGetPricingQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Clock, MapPin, Calculator, Info } from "lucide-react";

const pricingSchema = z.object({
  laborRate: z.coerce.number().optional().nullable(),
  emergencyFee: z.coerce.number().optional().nullable(),
  travelFee: z.coerce.number().optional().nullable(),
  weekendMultiplier: z.coerce.number().optional().nullable(),
  taxRate: z.coerce.number().optional().nullable(),
  minimumJobCost: z.coerce.number().optional().nullable(),
  discounts: z.string().optional(),
  customNotes: z.string().optional(),
});

export default function PricingPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: pricing, isLoading } = useGetPricing();
  const savePricing = useSavePricing();

  const form = useForm<z.infer<typeof pricingSchema>>({
    resolver: zodResolver(pricingSchema),
    defaultValues: {
      laborRate: null,
      emergencyFee: null,
      travelFee: null,
      weekendMultiplier: null,
      taxRate: null,
      minimumJobCost: null,
      discounts: "",
      customNotes: "",
    },
  });

  useEffect(() => {
    if (pricing) {
      form.reset({
        laborRate: pricing.laborRate,
        emergencyFee: pricing.emergencyFee,
        travelFee: pricing.travelFee,
        weekendMultiplier: pricing.weekendMultiplier,
        taxRate: pricing.taxRate,
        minimumJobCost: pricing.minimumJobCost,
        discounts: pricing.discounts || "",
        customNotes: pricing.customNotes || "",
      });
    }
  }, [pricing, form]);

  const onSubmit = (values: z.infer<typeof pricingSchema>) => {
    savePricing.mutate({ data: values }, {
      onSuccess: (data) => {
        // Optimistic update of local cache
        queryClient.setQueryData(getGetPricingQueryKey(), data);
        toast({ title: "Pricing rules saved successfully." });
      },
      onError: () => {
        toast({ title: "Error saving pricing rules.", variant: "destructive" });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in duration-500">
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Global Pricing Rules</h2>
        <p className="text-slate-500 mt-1">Configure baseline fees and multipliers. The agent applies these on top of specific service costs.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            
            {/* Standard Rates Card */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
                <CardTitle className="flex items-center text-lg">
                  <Calculator className="w-5 h-5 mr-2 text-blue-600" /> Standard Rates
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <FormField
                  control={form.control}
                  name="laborRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Labor Rate ($/hr)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : null)} />
                      </FormControl>
                      <FormDescription>Used when a service lacks a specific rate.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="minimumJobCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Minimum Job Cost ($)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : null)} />
                      </FormControl>
                      <FormDescription>The absolute minimum you charge to show up.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="taxRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Standard Tax Rate (%)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : null)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Fees & Multipliers Card */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
                <CardTitle className="flex items-center text-lg">
                  <Clock className="w-5 h-5 mr-2 text-amber-600" /> Fees & Multipliers
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <FormField
                  control={form.control}
                  name="emergencyFee"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Emergency Callout Fee ($)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : null)} />
                      </FormControl>
                      <FormDescription>Added to after-hours or urgent requests.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="weekendMultiplier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Weekend Rate Multiplier (e.g. 1.5)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.1" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : null)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="travelFee"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Standard Travel Fee ($)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : null)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
              <CardTitle className="flex items-center text-lg">
                <Info className="w-5 h-5 mr-2 text-purple-600" /> Complex Rules
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <FormField
                control={form.control}
                name="discounts"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discounts Policy</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="e.g. 10% senior discount, 5% military discount. Free estimates for jobs over $1000." 
                        className="h-24"
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>Explain discounts in plain English for the AI to apply.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="customNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custom Pricing Notes</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="e.g. Always warn customers that exact pricing requires an on-site inspection. Permits are usually an extra $50-150 depending on the city." 
                        className="h-24"
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>Any other pricing behavior the agent should know about.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end pt-4">
            <Button type="submit" size="lg" disabled={savePricing.isPending} data-testid="button-save-pricing">
              {savePricing.isPending ? "Saving..." : "Save Pricing Rules"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}