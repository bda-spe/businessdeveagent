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
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
import { ColorPickerPopover } from "@/components/color-picker";
import {
  FileText,
  ScrollText,
  Mail,
} from "lucide-react";
import {
  InvoiceTemplatePreview,
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
  emailSubject: z.string().optional(),
  emailGreeting: z.string().optional(),
  emailBodyText: z.string().optional(),
  emailClosing: z.string().optional(),
  replyToEmail: z
    .string()
    .email("Enter a valid email address")
    .optional()
    .or(z.literal("")),
  ccOwner: z.boolean(),
  attachPdf: z.boolean(),
  showPolicies: z.boolean(),
  showLogo: z.boolean(),
  brandColor: z
    .string()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Enter a valid hex color")
    .optional()
    .or(z.literal("")),
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
    label: "Estimate Footer Note",
    description: "A short closing line at the bottom of every estimate.",
  },
];

function fillPlaceholders(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (m, key) => vars[key] ?? m);
}

export default function InvoiceFormattingPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: me } = useGetMe();
  const { data: settings, isLoading } = useGetInvoiceSettings();
  const { data: services } = useListServices();
  const { data: pricing } = useGetPricing();
  const saveSettings = useSaveInvoiceSettings();

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
      emailSubject: "",
      emailGreeting: "",
      emailBodyText: "",
      emailClosing: "",
      replyToEmail: "",
      ccOwner: true,
      attachPdf: true,
      showPolicies: false,
      showLogo: true,
      brandColor: "#1e3a5f",
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        cancellationPolicy: settings.cancellationPolicy ?? "",
        paymentTerms: settings.paymentTerms ?? "",
        estimateDisclaimer: settings.estimateDisclaimer ?? "",
        termsConditions: settings.termsConditions ?? "",
        acceptanceLanguage: settings.acceptanceLanguage ?? "",
        depositRequirements: settings.depositRequirements ?? "",
        footerNote: settings.footerNote ?? "",
        emailSubject: settings.emailSubject ?? "",
        emailGreeting: settings.emailGreeting ?? "",
        emailBodyText: settings.emailBodyText ?? "",
        emailClosing: settings.emailClosing ?? "",
        replyToEmail: settings.replyToEmail ?? "",
        ccOwner: settings.ccOwner ?? true,
        attachPdf: settings.attachPdf ?? true,
        showPolicies: settings.showPolicies ?? false,
        showLogo: settings.showLogo ?? true,
        brandColor: settings.brandColor ?? "#1e3a5f",
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
        "Estimated duration: 1-2 days on site.",
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
      showPolicies: watched.showPolicies,
    },
    brandColor: watched.brandColor,
    logoUrl: me?.business?.logoUrl ?? null,
    showLogo: watched.showLogo,
  };

  // Live email preview
  const emailVars = {
    business_name: businessName,
    customer_name: "Jordan Avery",
  };
  const previewSubject = fillPlaceholders(
    watched.emailSubject || "Your estimate from {business_name}",
    emailVars,
  );
  const previewGreeting = fillPlaceholders(
    watched.emailGreeting || "Hi {customer_name},",
    emailVars,
  );
  const previewBody = fillPlaceholders(watched.emailBodyText || "", emailVars);
  const previewClosing = fillPlaceholders(
    watched.emailClosing || "Best regards,\n" + businessName,
    emailVars,
  );

  const onSubmit = (values: SettingsValues) => {
    saveSettings.mutate(
      {
        data: {
          selectedTemplate: "modern_estimate_card",
          cancellationPolicy: values.cancellationPolicy,
          paymentTerms: values.paymentTerms,
          estimateDisclaimer: values.estimateDisclaimer,
          termsConditions: values.termsConditions,
          acceptanceLanguage: values.acceptanceLanguage,
          depositRequirements: values.depositRequirements,
          footerNote: values.footerNote,
          emailSubject: values.emailSubject,
          emailGreeting: values.emailGreeting,
          emailBodyText: values.emailBodyText,
          emailClosing: values.emailClosing,
          replyToEmail: values.replyToEmail || null,
          ccOwner: values.ccOwner,
          attachPdf: values.attachPdf,
          showPolicies: values.showPolicies,
          showLogo: values.showLogo,
          brandColor: values.brandColor || "#1e3a5f",
        },
      },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(getGetInvoiceSettingsQueryKey(), data);
          toast({ title: "Estimate format saved." });
          setLocation("/agent-settings");
        },
        onError: () => {
          toast({
            title: "Error saving estimate format.",
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
    <div className="max-w-6xl mx-auto animate-in fade-in duration-500 pb-16">
      <div className="mb-10">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">
          Estimate Formatting
        </h2>
        <p className="text-slate-500 mt-2 max-w-2xl">
          Choose how your agent presents estimates to customers.
          Previews use your real business name, services, and pricing.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-12">
          {/* Estimate preview */}
          <section>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Estimate Preview
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  This is how every estimate will look to your customers.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <FormField
                  control={form.control}
                  name="showLogo"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <FormLabel className="text-sm font-medium text-slate-700 cursor-pointer whitespace-nowrap">
                        Show logo
                      </FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={!me?.business?.logoUrl}
                          data-testid="switch-show-logo"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="showPolicies"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <FormLabel className="text-sm font-medium text-slate-700 cursor-pointer whitespace-nowrap">
                        Show policies
                      </FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-show-policies"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <ColorPickerPopover
                  value={watched.brandColor ?? "#1e3a5f"}
                  onChange={(c) =>
                    form.setValue("brandColor", c, { shouldDirty: true })
                  }
                  testId="button-brand-color"
                />
              </div>
            </div>
            <div
              className="max-w-md rounded-xl border-2 border-slate-200 shadow-sm overflow-hidden bg-white"
              data-testid="quote-preview-card"
            >
              <div className="h-96 overflow-y-auto bg-slate-100 p-3">
                <div className="rounded-lg shadow-sm overflow-hidden border border-slate-200">
                  <InvoiceTemplatePreview data={previewData} />
                </div>
              </div>
            </div>
          </section>

          {/* Policy fields */}
          <section>
            <div className="mb-5">
              <h3 className="text-lg font-semibold text-slate-900">
                Policies &amp; Terms
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                The wording below is always available to your agent. Use the
                "Show policies" switch next to the estimate preview to choose
                whether the full policy text appears on customer estimates.
              </p>
            </div>
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
                <CardTitle className="flex items-center text-lg">
                  <ScrollText className="w-5 h-5 mr-2 text-blue-600" />
                  Policy Wording
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                {POLICY_FIELDS.map((f) => (
                  <FormField
                    key={f.name}
                    control={form.control}
                    name={f.name}
                    render={({ field }) => (
                      <FormItem
                        className={
                          f.name === "termsConditions" ? "md:col-span-2" : ""
                        }
                      >
                        <FormLabel>{f.label}</FormLabel>
                        <FormControl>
                          <Textarea
                            className="h-24"
                            {...field}
                            value={(field.value as string) ?? ""}
                          />
                        </FormControl>
                        <FormDescription>{f.description}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Email settings */}
          <section>
            <div className="mb-5">
              <h3 className="text-lg font-semibold text-slate-900">
                Estimate Email
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                How the estimate email reads when your agent sends it to a
                customer. Use {"{business_name}"} and {"{customer_name}"} as
                placeholders.
              </p>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
                  <CardTitle className="flex items-center text-lg">
                    <Mail className="w-5 h-5 mr-2 text-blue-600" />
                    Email Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-5">
                  <FormField
                    control={form.control}
                    name="emailSubject"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subject Line</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value ?? ""}
                            data-testid="input-email-subject"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="emailGreeting"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Greeting</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value ?? ""}
                            data-testid="input-email-greeting"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="emailBodyText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Body Text</FormLabel>
                        <FormControl>
                          <Textarea
                            className="h-28"
                            {...field}
                            value={field.value ?? ""}
                            data-testid="input-email-body"
                          />
                        </FormControl>
                        <FormDescription>
                          The estimate summary is added automatically after
                          this text.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="emailClosing"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Closing</FormLabel>
                        <FormControl>
                          <Textarea
                            className="h-20"
                            {...field}
                            value={field.value ?? ""}
                            data-testid="input-email-closing"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="replyToEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reply-To Address (optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="owner@yourbusiness.com"
                            {...field}
                            value={field.value ?? ""}
                            data-testid="input-reply-to"
                          />
                        </FormControl>
                        <FormDescription>
                          Customer replies go to this address.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="space-y-4 pt-2 border-t border-slate-100">
                    <FormField
                      control={form.control}
                      name="ccOwner"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between gap-4">
                          <div>
                            <FormLabel>Copy me on estimate emails</FormLabel>
                            <FormDescription>
                              Receive a copy of every estimate email sent.
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-cc-owner"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="attachPdf"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between gap-4">
                          <div>
                            <FormLabel>Attach PDF estimate</FormLabel>
                            <FormDescription>
                              Include the formatted estimate as a PDF
                              attachment.
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-attach-pdf"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Email preview */}
              <Card className="border-slate-200 shadow-sm h-fit lg:sticky lg:top-6">
                <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
                  <CardTitle className="text-lg">Email Preview</CardTitle>
                  <CardDescription>
                    What your customer receives, using sample data.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6" data-testid="email-preview">
                  <div className="rounded-lg border border-slate-200 overflow-hidden text-sm">
                    <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 space-y-1">
                      <p className="text-xs text-slate-500">
                        To: jordan.avery@example.com
                        {watched.ccOwner && (
                          <span className="ml-2 text-slate-400">
                            Cc: you
                          </span>
                        )}
                      </p>
                      <p className="font-semibold text-slate-900">
                        {previewSubject}
                      </p>
                    </div>
                    <div className="bg-white px-4 py-4 space-y-3 text-slate-700 whitespace-pre-wrap">
                      <p>{previewGreeting}</p>
                      {previewBody && <p>{previewBody}</p>}
                      <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-xs space-y-1">
                        <p className="font-semibold text-slate-800">
                          Estimate summary:
                        </p>
                        {lineItems.map((li) => (
                          <p key={li.description} className="flex justify-between">
                            <span>{li.description}</span>
                            <span>${li.total.toFixed(2)}</span>
                          </p>
                        ))}
                        {taxes > 0 && (
                          <p className="flex justify-between">
                            <span>Taxes &amp; fees</span>
                            <span>${taxes.toFixed(2)}</span>
                          </p>
                        )}
                        <p className="flex justify-between font-semibold text-slate-900 border-t border-slate-200 pt-1 mt-1">
                          <span>Estimated total</span>
                          <span>${total.toFixed(2)}</span>
                        </p>
                      </div>
                      <p className="whitespace-pre-wrap">{previewClosing}</p>
                      {watched.attachPdf && (
                        <p className="inline-flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
                          <FileText className="h-3.5 w-3.5" />
                          estimate.pdf attached
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              size="lg"
              disabled={saveSettings.isPending}
              data-testid="button-save-invoice-format"
            >
              {saveSettings.isPending
                ? "Saving..."
                : "Save Estimate Format & Continue"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
