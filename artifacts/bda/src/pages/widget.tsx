import { useState, useEffect } from "react";
import {
  useGetWidgetSettings,
  useSaveWidgetSettings,
  getGetWidgetSettingsQueryKey,
  useGetBusiness,
  getGetBusinessQueryKey,
  useGetMe,
  getGetMeQueryKey,
  useGetAgentPreferences,
  getGetAgentPreferencesQueryKey,
  useGenerateAgentPreferences,
  useSaveAgentPreferences,
  useConfirmAgentPreferences,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { ColorPickerPopover } from "@/components/color-picker";
import {
  Code,
  LayoutTemplate,
  Palette,
  Copy,
  Check,
  MessageSquare,
  Sparkles,
  Save,
  ShieldCheck,
  Lock,
  CheckCircle2,
} from "lucide-react";

const widgetSchema = z.object({
  greeting: z.string().min(1, "Greeting is required"),
  primaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Must be a valid hex color"),
  position: z.enum(["bottom-right", "bottom-left"]),
  enabled: z.boolean(),
});

const PREF_SECTIONS = [
  {
    key: "customerTone",
    label: "Customer Tone",
    description: "How your agent speaks to customers — voice, formality, and warmth.",
  },
  {
    key: "requiredIntakeQuestions",
    label: "Required Intake Questions",
    description: "What the agent must ask before producing an estimate.",
  },
  {
    key: "estimatingStandards",
    label: "Estimating Standards",
    description: "How conservative or aggressive estimates should be, and when to defer to a site visit.",
  },
  {
    key: "invoicePolicyStandards",
    label: "Quote & Policy Standards",
    description: "Deposits, payment, cancellation, and warranty practices the agent should respect.",
  },
  {
    key: "lowConfidenceRules",
    label: "Low-Confidence Rules",
    description: "How the agent handles jobs it can't estimate confidently.",
  },
  {
    key: "servicesNotToQuote",
    label: "Services Not to Quote",
    description: "Job types your agent should never price, and what to say instead.",
  },
  {
    key: "finalCustomerDisclaimer",
    label: "Final Customer Disclaimer",
    description: "The closing disclaimer shown to customers with every estimate.",
  },
] as const;

type PrefKey = (typeof PREF_SECTIONS)[number]["key"];
type PrefValues = Record<PrefKey, string>;

const emptyPrefs: PrefValues = {
  customerTone: "",
  requiredIntakeQuestions: "",
  estimatingStandards: "",
  invoicePolicyStandards: "",
  lowConfidenceRules: "",
  servicesNotToQuote: "",
  finalCustomerDisclaimer: "",
};

// Decide whether white or navy text is readable on the given background color.
function headerTextColor(hex: string): string {
  const m = /^#?([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.exec(hex ?? "");
  if (!m) return "#ffffff";
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#1e3a5f" : "#ffffff";
}

export default function WidgetPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useGetWidgetSettings();
  const { data: business } = useGetBusiness();
  const { data: me } = useGetMe();
  const saveSettings = useSaveWidgetSettings();

  const { data: prefs, isLoading: prefsLoading } = useGetAgentPreferences();
  const generatePrefs = useGenerateAgentPreferences();
  const savePrefs = useSaveAgentPreferences();
  const confirmPrefs = useConfirmAgentPreferences();

  const [copied, setCopied] = useState(false);
  const [prefValues, setPrefValues] = useState<PrefValues>(emptyPrefs);
  const [prefsDirty, setPrefsDirty] = useState(false);

  const form = useForm<z.infer<typeof widgetSchema>>({
    resolver: zodResolver(widgetSchema),
    defaultValues: {
      greeting: "Hi! How can we help you today?",
      primaryColor: "#0f172a",
      position: "bottom-right",
      enabled: true,
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        greeting: settings.greeting,
        primaryColor: settings.primaryColor,
        position: settings.position as any,
        enabled: settings.enabled,
      });
    }
  }, [settings, form]);

  useEffect(() => {
    if (prefs && !prefsDirty) {
      setPrefValues({
        customerTone: prefs.customerTone ?? "",
        requiredIntakeQuestions: prefs.requiredIntakeQuestions ?? "",
        estimatingStandards: prefs.estimatingStandards ?? "",
        invoicePolicyStandards: prefs.invoicePolicyStandards ?? "",
        lowConfidenceRules: prefs.lowConfidenceRules ?? "",
        servicesNotToQuote: prefs.servicesNotToQuote ?? "",
        finalCustomerDisclaimer: prefs.finalCustomerDisclaimer ?? "",
      });
    }
  }, [prefs, prefsDirty]);

  const hasGenerated = PREF_SECTIONS.some((s) => prefValues[s.key].trim().length > 0);
  const isConfirmed = !!prefs?.confirmed;
  const widgetUnlocked = !!business?.widgetReady && !!business?.agentPreferencesConfirmed;
  const testAgentDone = !!me?.setupProgress?.testAgent;

  const onSubmit = (values: z.infer<typeof widgetSchema>) => {
    saveSettings.mutate({ data: values }, {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetWidgetSettingsQueryKey(), data);
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        toast({ title: "Widget settings saved" });
      }
    });
  };

  const handleGenerate = () => {
    generatePrefs.mutate(undefined, {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetAgentPreferencesQueryKey(), data);
        setPrefsDirty(false);
        toast({
          title: hasGenerated ? "Preferences regenerated" : "Preferences generated",
          description: "Review each section and edit anything you'd like to change.",
        });
      },
      onError: () => {
        toast({
          title: "Generation failed",
          description: "Could not generate preferences right now. Please try again.",
          variant: "destructive",
        });
      },
    });
  };

  const toNullable = (v: PrefValues) =>
    Object.fromEntries(
      PREF_SECTIONS.map((s) => [s.key, v[s.key].trim() ? v[s.key] : null]),
    );

  const handleSave = () => {
    savePrefs.mutate({ data: toNullable(prefValues) }, {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetAgentPreferencesQueryKey(), data);
        setPrefsDirty(false);
        toast({ title: "Agent preferences saved" });
      },
      onError: () => {
        toast({ title: "Save failed", description: "Please try again.", variant: "destructive" });
      },
    });
  };

  const handleConfirm = () => {
    // Persist any edits first, then confirm.
    savePrefs.mutate({ data: toNullable(prefValues) }, {
      onSuccess: () => {
        confirmPrefs.mutate(undefined, {
          onSuccess: (data) => {
            queryClient.setQueryData(getGetAgentPreferencesQueryKey(), data.preferences);
            queryClient.invalidateQueries({ queryKey: getGetBusinessQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
            setPrefsDirty(false);
            toast({
              title: "Agent confirmed",
              description: "Your widget is now ready to install on your website.",
            });
          },
          onError: () => {
            toast({ title: "Confirmation failed", description: "Please try again.", variant: "destructive" });
          },
        });
      },
      onError: () => {
        toast({ title: "Confirmation failed", description: "Could not save your edits.", variant: "destructive" });
      },
    });
  };

  const currentValues = form.watch();
  const previewTextColor = headerTextColor(currentValues.primaryColor);

  const scriptSrc = `${window.location.origin}${import.meta.env.BASE_URL}widget.js`;
  const embedCode = `<script src="${scriptSrc}" data-client-id="${business?.clientId ?? "YOUR_CLIENT_ID"}"></script>`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied to clipboard" });
  };

  if (isLoading || prefsLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[400px] rounded-xl" />
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="h-[500px] rounded-xl" />
          <Skeleton className="h-[500px] rounded-xl" />
        </div>
      </div>
    );
  }

  const generating = generatePrefs.isPending;
  const savingPrefs = savePrefs.isPending;
  const confirming = confirmPrefs.isPending || (savePrefs.isPending && confirmPrefs.isIdle);

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in duration-500">
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Website Widget</h2>
        <p className="text-slate-500 mt-1">
          Review your agent's standards, confirm it's ready, then install the BDA widget on your website.
        </p>
      </div>

      {/* Agent Preferences & Standards */}
      <Card className="border-slate-200 shadow-sm mb-8" data-testid="card-agent-preferences">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-500" /> Agent Preferences &amp; Standards
              </CardTitle>
              <CardDescription className="mt-1.5 max-w-2xl">
                Based on your setup and everything your agent learned during testing, these are the standards
                it will follow with real customers. Review each section, edit anything you'd like, then confirm.
              </CardDescription>
            </div>
            {isConfirmed && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold px-3 py-1.5" data-testid="badge-prefs-confirmed">
                <CheckCircle2 className="h-3.5 w-3.5" /> Confirmed
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!hasGenerated ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
              <Sparkles className="h-8 w-8 text-blue-500 mx-auto mb-3" />
              <h3 className="font-semibold text-slate-900 mb-1">Generate your agent's standards</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mb-5">
                {testAgentDone
                  ? "We'll analyze your business profile, services, pricing, quote settings, and your Test Agent feedback to draft the standards your agent will follow."
                  : "Tip: run a few tests in Test Agent first — your feedback there teaches the agent your preferences before we draft its standards."}
              </p>
              <Button
                onClick={handleGenerate}
                disabled={generating}
                data-testid="button-generate-preferences"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {generating ? "Generating..." : "Generate Agent Preferences"}
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid md:grid-cols-2 gap-5">
                {PREF_SECTIONS.map((section) => (
                  <div key={section.key} className={section.key === "finalCustomerDisclaimer" ? "md:col-span-2" : ""}>
                    <label className="text-sm font-semibold text-slate-900">{section.label}</label>
                    <p className="text-xs text-slate-500 mb-1.5">{section.description}</p>
                    <Textarea
                      value={prefValues[section.key]}
                      onChange={(e) => {
                        setPrefValues((prev) => ({ ...prev, [section.key]: e.target.value }));
                        setPrefsDirty(true);
                      }}
                      rows={5}
                      maxLength={4000}
                      className="resize-y bg-white"
                      data-testid={`textarea-pref-${section.key}`}
                    />
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 pt-5">
                <Button
                  variant="outline"
                  onClick={handleGenerate}
                  disabled={generating || savingPrefs || confirming}
                  data-testid="button-regenerate-preferences"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  {generating ? "Regenerating..." : "Regenerate"}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSave}
                  disabled={generating || savingPrefs || confirming}
                  data-testid="button-save-preferences"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {savingPrefs && !confirmPrefs.isPending ? "Saving..." : "Save Agent Preferences"}
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={generating || savingPrefs || confirmPrefs.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white ml-auto"
                  data-testid="button-confirm-preferences"
                >
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  {confirmPrefs.isPending
                    ? "Confirming..."
                    : isConfirmed
                      ? "Re-confirm Agent"
                      : "Confirm — Agent is Ready"}
                </Button>
              </div>
              {!isConfirmed && (
                <p className="text-xs text-slate-500">
                  Your widget installation code unlocks once you confirm your agent is ready.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Configuration Form */}
        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-blue-500" /> Appearance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="enabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border border-slate-200 p-4 bg-slate-50">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base font-semibold">Enable Widget</FormLabel>
                          <FormDescription>If disabled, the widget will hide from your site immediately.</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="greeting"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Greeting Message</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormDescription>The first message customers see when they open the chat.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="primaryColor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Brand Color</FormLabel>
                          <div>
                            <ColorPickerPopover
                              value={field.value}
                              onChange={field.onChange}
                              testId="button-widget-color"
                            />
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="position"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Position</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select position" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="bottom-right">Bottom Right</SelectItem>
                              <SelectItem value="bottom-left">Bottom Left</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button type="submit" disabled={saveSettings.isPending} className="w-full">
                    {saveSettings.isPending ? "Saving..." : "Save Configuration"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {widgetUnlocked ? (
            <Card className="border-slate-200 shadow-sm bg-slate-900 text-white" data-testid="card-embed-code">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Code className="h-5 w-5 text-blue-400" /> Installation Code
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Paste this snippet just before the closing &lt;/body&gt; tag on your website.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <pre className="p-4 bg-slate-950 rounded-lg text-sm font-mono text-emerald-400 overflow-x-auto border border-slate-800">
                    {embedCode}
                  </pre>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="absolute top-2 right-2 bg-slate-800 hover:bg-slate-700 text-white border-none"
                    onClick={copyToClipboard}
                    data-testid="button-copy-embed"
                  >
                    {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-slate-200 border-dashed shadow-none bg-slate-50" data-testid="card-embed-locked">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-500">
                  <Lock className="h-5 w-5" /> Installation Code
                </CardTitle>
                <CardDescription>
                  Your installation code will appear here once you confirm your agent preferences above.
                  This makes sure your agent goes live with the standards you approved.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>

        {/* Live Preview */}
        <Card className="border-slate-200 shadow-sm overflow-hidden flex flex-col bg-slate-50">
          <CardHeader className="bg-white border-b border-slate-100 z-10 relative">
            <CardTitle className="flex items-center gap-2">
              <LayoutTemplate className="h-5 w-5 text-purple-500" /> Live Preview
            </CardTitle>
          </CardHeader>
          <div className="flex-1 relative min-h-[400px]">
            {/* Fake Website Background */}
            <div className="absolute inset-0 p-8 opacity-20 pointer-events-none">
              <div className="w-full h-8 bg-slate-300 rounded mb-8"></div>
              <div className="w-2/3 h-12 bg-slate-300 rounded mb-4"></div>
              <div className="w-1/2 h-4 bg-slate-300 rounded mb-8"></div>
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="h-32 bg-slate-300 rounded"></div>
                <div className="h-32 bg-slate-300 rounded"></div>
                <div className="h-32 bg-slate-300 rounded"></div>
              </div>
            </div>

            {/* Widget Mockup */}
            {currentValues.enabled && (
              <div className={`absolute bottom-6 flex flex-col gap-4 w-[350px] transition-all duration-300 ${currentValues.position === 'bottom-left' ? 'left-6' : 'right-6'}`}>
                {/* Chat window */}
                <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col h-[400px] animate-in slide-in-from-bottom-8">
                  {/* Header */}
                  <div
                    className="p-4 flex items-center gap-3"
                    style={{ backgroundColor: currentValues.primaryColor, color: previewTextColor }}
                  >
                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                      <MessageSquare className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-semibold leading-tight truncate">{business?.name ?? "Your Business"}</h4>
                      <a
                        href="https://businessdevelopmentagent.replit.app"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs italic leading-tight no-underline"
                        style={{ opacity: 0.85 }}
                      >
                        Business Development Agent &copy;
                      </a>
                    </div>
                  </div>

                  {/* Messages area */}
                  <div className="flex-1 p-4 bg-slate-50 flex flex-col gap-4">
                    <div className="flex gap-2">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px]"
                        style={{ backgroundColor: currentValues.primaryColor, color: previewTextColor }}
                      >
                        {(business?.name ?? "BA").split(/\s+/).map((w) => w.charAt(0)).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="bg-white p-3 rounded-2xl rounded-tl-sm text-sm text-slate-700 shadow-sm border border-slate-100">
                        {currentValues.greeting}
                      </div>
                    </div>
                  </div>

                  {/* Input area */}
                  <div className="p-3 bg-white border-t border-slate-100">
                    <div className="bg-slate-100 rounded-full px-4 py-2 text-sm text-slate-400">
                      Type your message...
                    </div>
                  </div>
                </div>

                {/* Launcher button */}
                <div
                  className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center cursor-pointer ${currentValues.position === 'bottom-left' ? 'self-start' : 'self-end'}`}
                  style={{ backgroundColor: currentValues.primaryColor, color: previewTextColor }}
                >
                  <MessageSquare className="h-6 w-6" />
                </div>
              </div>
            )}

            {!currentValues.enabled && (
              <div className="absolute inset-0 flex items-center justify-center backdrop-blur-[2px]">
                <div className="bg-white/90 p-4 rounded-xl shadow-sm text-sm font-medium text-slate-500 border border-slate-200">
                  Widget is currently disabled
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
