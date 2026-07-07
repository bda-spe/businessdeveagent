import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useGetMe,
  useGetInvoiceSettings,
  useSaveInvoiceSettings,
  useListServices,
  useGetPricing,
  getGetInvoiceSettingsQueryKey,
  type InvoiceSettingsInputSelectedTemplate,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, CheckCircle2, ScrollText } from "lucide-react";
import {
  InvoiceTemplatePreview,
  TEMPLATE_OPTIONS,
  type InvoiceRenderData,
} from "@/components/invoice-templates";

const settingsSchema = z.object({
  cancellationPolicy: z.string().optional(),
  paymentTerms: z.string().optional(),
  estimateDisclaimer: z.string().optional(),
  termsConditions: z.string().optional(),
  acceptanceLanguage: z.string().optional(),
  depositRequirements: z.string().optional(),
  footerNote: z.string().optional(),
});

type SettingsValues = z.infer<typeof settingsSchema>;

const POLICY_FIELDS: {
  name: keyof SettingsValues;
  label: string;
  description: string;
}[] = [
  {
    name: "paymentTerms",
    label: "Payment Terms",
    description: "When and how customers pay you.",
  },
  {
    name: "cancellationPolicy",
    label: "Cancellation Policy",
    description: "Rules for cancelling or rescheduling.",
  },
  {
    name: "depositRequirements",
    label: "Deposit Requirements",
    description: "When a deposit is required and how much.",
  },
  {
    name: "estimateDisclaimer",
    label: "Estimate Disclaimer",
    description: "Reminds customers that estimates are preliminary.",
  },
  {
    name: "termsConditions",
    label: "Terms and Conditions",
    description: "Your standard service terms.",
  },
  {
    name: "acceptanceLanguage",
    label: "Acceptance Language",
    description: "What the customer agrees to by moving forward.",
  },
  {
    name: "footerNote",
    label: "Invoice Footer Note",
    description: "A short closing line at the bottom of every invoice.",
  },
];

export default function InvoiceFormattingPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: me } = useGetMe();
  const { data: settings, isLoading } = useGetInvoiceSettings();
  const { data: services } = useListServices();
  const { data: pricing } = useGetPricing();
  const saveSettings = useSaveInvoiceSettings();

  const [selectedTemplate, setSelectedTemplate] =
    useState<InvoiceSettingsInputSelectedTemplate>("modern_estimate_card");

  const form = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      cancellationPolicy: "",
      paymentTerms: "",
      estimateDisclaimer: "",
      termsConditions: "",
      acceptanceLanguage: "",
      depositRequirements: "",
      footerNote: "",
    },
  });

  useEffect(() => {
    if (settings) {
      setSelectedTemplate(settings.selectedTemplate);
      form.reset({
        cancellationPolicy: settings.cancellationPolicy ?? "",
        paymentTerms: settings.paymentTerms ?? "",
        estimateDisclaimer: settings.estimateDisclaimer ?? "",
        termsConditions: settings.termsConditions ?? "",
        acceptanceLanguage: settings.acceptanceLanguage ?? "",
        depositRequirements: settings.depositRequirements ?? "",
        footerNote: settings.footerNote ?? "",
      });
    }
  }, [settings, form]);

  const watched = form.watch();

  // Build a realistic sample estimate from the business's actual data
  const businessName = me?.business?.name || "ABC Services";
  const activeServices = (services ?? []).filter((s) => s.active).slice(0, 2);
  const taxRate = pricing?.taxRate ?? 0;
  const travelFee = pricing?.travelFee ?? null;

  const lineItems =
    activeServices.length > 0
      ? activeServices.map((s) => {
          const price =
            s.basePrice ?? (s.hourlyRate != null ? s.hourlyRate * 3 : 250);
          return {
            description: s.name,
            quantity: s.basePrice != null ? 1 : 3,
            unitPrice: s.basePrice ?? s.hourlyRate ?? price,
            total: price,
          };
        })
      : [
          {
            description: "Standard Service Call",
            quantity: 1,
            unitPrice: pricing?.laborRate ?? 150,
            total: pricing?.laborRate ?? 150,
          },
        ];

  if (travelFee != null && travelFee > 0) {
    lineItems.push({
      description: "Travel / Mobilization Fee",
      quantity: 1,
      unitPrice: travelFee,
      total: travelFee,
    });
  }

  const subtotal = lineItems.reduce((sum, li) => sum + li.total, 0);
  const taxes = Math.round(subtotal * (taxRate / 100) * 100) / 100;
  const total = Math.round((subtotal + taxes) * 100) / 100;

  const previewData: InvoiceRenderData = {
    businessName,
    customerName: "Jordan Avery",
    customerEmail: "jordan.avery@example.com",
    customerPhone: "(555) 201-4433",
    projectDescription: activeServices[0]
      ? `${activeServices[0].name} request from a new customer`
      : "Service request from a new customer",
    date: new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    estimate: {
      customerSummary: activeServices[0]
        ? `Customer requested ${activeServices[0].name.toLowerCase()} and would like an estimate before scheduling.`
        : "Customer requested a service estimate before scheduling.",
      assumptions: [
        "Standard access and working conditions.",
        "Estimate is preliminary and subject to on-site verification.",
      ],
      invoiceLineItems: lineItems,
      subtotal,
      taxes,
      totalEstimate: total,
      recommendedPriceLow: Math.round(total * 0.9 * 100) / 100,
      recommendedPriceHigh: Math.round(total * 1.15 * 100) / 100,
    },
    policies: {
      cancellationPolicy: watched.cancellationPolicy,
      paymentTerms: watched.paymentTerms,
      estimateDisclaimer: watched.estimateDisclaimer,
      termsConditions: watched.termsConditions,
      acceptanceLanguage: watched.acceptanceLanguage,
      depositRequirements: watched.depositRequirements,
      footerNote: watched.footerNote,
    },
  };

  const onSubmit = (values: SettingsValues) => {
    saveSettings.mutate(
      { data: { selectedTemplate, ...values } },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(getGetInvoiceSettingsQueryKey(), data);
          toast({ title: "Invoice format saved." });
          setLocation("/widget");
        },
        onError: () => {
          toast({
            title: "Error saving invoice format.",
            variant: "destructive",
          });
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in duration-500">
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">
          Invoice Formatting
        </h2>
        <p className="text-slate-500 mt-1">
          Choose how your agent presents estimates and invoices to customers.
          Previews use your real business name, services, and pricing.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* Template selection */}
          <div className="grid gap-6 md:grid-cols-2">
            {TEMPLATE_OPTIONS.map((tpl) => {
              const isSelected = selectedTemplate === tpl.id;
              return (
                <div
                  key={tpl.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedTemplate(tpl.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedTemplate(tpl.id);
                    }
                  }}
                  data-testid={`template-card-${tpl.id}`}
                  className={`text-left rounded-xl border-2 transition-all cursor-pointer overflow-hidden bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    isSelected
                      ? "border-blue-600 shadow-md"
                      : "border-slate-200 hover:border-slate-300 shadow-sm"
                  }`}
                >
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                        {tpl.detailed ? (
                          <ScrollText className="h-4 w-4 text-slate-500" />
                        ) : (
                          <FileText className="h-4 w-4 text-slate-500" />
                        )}
                        {tpl.name}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">{tpl.tagline}</p>
                    </div>
                    {isSelected && (
                      <span className="flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5 shrink-0">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Default
                      </span>
                    )}
                  </div>
                  <div className="h-80 overflow-y-auto bg-slate-100 p-3">
                    <div className="rounded-lg shadow-sm overflow-hidden border border-slate-200">
                      <InvoiceTemplatePreview templateId={tpl.id} data={previewData} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Policy fields */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
              <CardTitle className="flex items-center text-lg">
                <ScrollText className="w-5 h-5 mr-2 text-blue-600" />
                Policies &amp; Terms
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 grid gap-6 md:grid-cols-2">
              {POLICY_FIELDS.map((f) => (
                <FormField
                  key={f.name}
                  control={form.control}
                  name={f.name}
                  render={({ field }) => (
                    <FormItem className={f.name === "termsConditions" ? "md:col-span-2" : ""}>
                      <FormLabel>{f.label}</FormLabel>
                      <FormControl>
                        <Textarea className="h-24" {...field} />
                      </FormControl>
                      <FormDescription>{f.description}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </CardContent>
          </Card>

          <div className="flex justify-end pt-2 pb-8">
            <Button
              type="submit"
              size="lg"
              disabled={saveSettings.isPending}
              data-testid="button-save-invoice-format"
            >
              {saveSettings.isPending
                ? "Saving..."
                : "Save Invoice Format & Continue"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
