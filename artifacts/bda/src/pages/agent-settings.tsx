import { useState, useRef, useEffect, useCallback } from "react";
import {
  useListSandboxTests,
  useSendSandboxTestEmail,
  useSaveSandboxFeedback,
  useGetInvoiceSettings,
  useGetMe,
  getListSandboxTestsQueryKey,
  useGetWidgetSettings,
  useSaveWidgetSettings,
  getGetWidgetSettingsQueryKey,
  useGetBusiness,
  getGetBusinessQueryKey,
  getGetMeQueryKey,
  useGetAgentPreferences,
  getGetAgentPreferencesQueryKey,
  useGenerateAgentPreferences,
  useSaveAgentPreferences,
  useConfirmAgentPreferences,
} from "@workspace/api-client-react";
import { InvoiceTemplatePreview } from "@/components/invoice-templates";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ColorPickerPopover } from "@/components/color-picker";
import {
  Bot,
  Star,
  Calculator,
  Mail,
  ChevronRight,
  Plus,
  Download,
  CheckCircle2,
  RotateCcw,
  Code,
  Palette,
  Copy,
  Check,
  MessageSquare,
  Sparkles,
  Save,
  ShieldCheck,
  Lock,
} from "lucide-react";
import type { SandboxTest } from "@workspace/api-client-react";

const STAGE_LABELS: Record<string, string> = {
  gathering: "Gathering details",
  confirming: "Confirming scope",
  awaiting_email: "Awaiting email",
  complete: "Estimate sent",
};

const FONT_OPTIONS = [
  {
    value: "inter",
    label: "Inter (Modern Sans)",
    stack: "'Inter', -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  },
  {
    value: "system",
    label: "System Default",
    stack: "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  },
  {
    value: "serif",
    label: "Georgia (Classic Serif)",
    stack: "Georgia, 'Times New Roman', Times, serif",
  },
  {
    value: "rounded",
    label: "Trebuchet (Friendly)",
    stack: "'Trebuchet MS', 'Segoe UI', Verdana, Helvetica, Arial, sans-serif",
  },
  {
    value: "mono",
    label: "Courier (Monospace)",
    stack: "'Courier New', Courier, monospace",
  },
] as const;

const widgetSchema = z.object({
  greeting: z.string().min(1, "Greeting is required"),
  primaryColor: z
    .string()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Must be a valid hex color"),
  font: z.enum(["inter", "system", "serif", "rounded", "mono"]),
  position: z.enum(["bottom-right", "bottom-left"]),
  enabled: z.boolean(),
});

const PREF_SECTIONS = [
  {
    key: "customerTone",
    label: "Customer Tone",
    description:
      "How your agent speaks to customers — voice, formality, and warmth.",
  },
  {
    key: "requiredIntakeQuestions",
    label: "Required Intake Questions",
    description: "What the agent must ask before producing an estimate.",
  },
  {
    key: "estimatingStandards",
    label: "Estimating Standards",
    description:
      "How conservative or aggressive estimates should be, and when to defer to a site visit.",
  },
  {
    key: "invoicePolicyStandards",
    label: "Quote & Policy Standards",
    description:
      "Deposits, payment, cancellation, and warranty practices the agent should respect.",
  },
  {
    key: "lowConfidenceRules",
    label: "Low-Confidence Rules",
    description: "How the agent handles jobs it can't estimate confidently.",
  },
  {
    key: "servicesNotToQuote",
    label: "Services Not to Quote",
    description:
      "Job types your agent should never price, and what to say instead.",
  },
  {
    key: "finalCustomerDisclaimer",
    label: "Final Customer Disclaimer",
    description:
      "The closing disclaimer shown to customers with every estimate.",
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

export default function AgentSettingsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // --- Test & feedback state (from Test Agent) ---
  const { data: history, isLoading: isLoadingHistory } = useListSandboxTests();
  const { data: invoiceSettings } = useGetInvoiceSettings();
  const { data: me } = useGetMe();
  const sendEmail = useSendSandboxTestEmail();
  const saveFeedback = useSaveSandboxFeedback();

  const [activeTestId, setActiveTestId] = useState<number | null>(null);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedbackNotes, setFeedbackNotes] = useState("");
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [sessionKey, setSessionKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const styleIframeRef = useRef<HTMLIFrameElement>(null);
  const hasAutoSelected = useRef(false);

  const activeTest = history?.find((t) => t.id === activeTestId) ?? null;

  // --- Widget settings + agent preferences state (from Widget Settings) ---
  const { data: settings, isLoading: settingsLoading } = useGetWidgetSettings();
  const { data: business } = useGetBusiness();
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
      font: "inter",
      position: "bottom-right",
      enabled: true,
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        greeting: settings.greeting,
        primaryColor: settings.primaryColor,
        font: (FONT_OPTIONS.some((f) => f.value === settings.font)
          ? settings.font
          : "inter") as z.infer<typeof widgetSchema>["font"],
        position: settings.position as z.infer<typeof widgetSchema>["position"],
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

  // Auto-select the most recent test on first load only.
  useEffect(() => {
    if (hasAutoSelected.current) return;
    if (history && history.length > 0 && activeTestId == null) {
      hasAutoSelected.current = true;
      selectTest(history[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, activeTestId]);

  // The embedded widget (running in test mode) posts a message here as
  // soon as it completes a live conversation, so we can immediately show
  // the resulting estimate and feedback controls without polling.
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (!e.data || e.data.source !== "bda-widget-test") return;
      if (e.data.type === "result" && e.data.detail?.sandboxTestId) {
        queryClient
          .invalidateQueries({ queryKey: getListSandboxTestsQueryKey() })
          .then(() => selectTest(e.data.detail.sandboxTestId, true));
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectTest = (testOrId: SandboxTest | number, byId = false) => {
    const id = byId ? (testOrId as number) : (testOrId as SandboxTest).id;
    setActiveTestId(id);
    if (!byId) {
      const test = testOrId as SandboxTest;
      setFeedbackRating(test.rating ?? 0);
      setFeedbackNotes(test.feedbackNotes ?? "");
    } else {
      setFeedbackRating(0);
      setFeedbackNotes("");
    }
    setEmailStatus(null);
  };

  const startNew = () => {
    hasAutoSelected.current = true;
    setActiveTestId(null);
    setFeedbackRating(0);
    setFeedbackNotes("");
    setEmailStatus(null);
    setSessionKey((k) => k + 1);
  };

  const handleTryAgain = useCallback(() => {
    // Resets the conversation inside the same embedded widget so the very
    // next reply reflects the feedback just saved, without a full reload.
    iframeRef.current?.contentWindow?.postMessage(
      { type: "bda-widget-test-reset" },
      "*",
    );
    setActiveTestId(null);
    setFeedbackRating(0);
    setFeedbackNotes("");
    setEmailStatus(null);
  }, []);

  const handleSendEmail = () => {
    if (!activeTest) return;
    sendEmail.mutate(
      { id: activeTest.id },
      {
        onSuccess: (result) => {
          setEmailStatus(result.message);
          if (result.sent) {
            queryClient.invalidateQueries({
              queryKey: getListSandboxTestsQueryKey(),
            });
          }
        },
        onError: () => setEmailStatus("Email sending failed. Try again."),
      },
    );
  };

  const handleDownloadPdf = async () => {
    if (!activeTest) return;
    try {
      const res = await fetch(
        `/api/sandbox-tests/${activeTest.id}/invoice.pdf`,
      );
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `estimate-${activeTest.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast({
        title: "Could not download the PDF quote.",
        variant: "destructive",
      });
    }
  };

  const handleSaveFeedback = () => {
    if (!activeTest || feedbackRating < 1) return;
    saveFeedback.mutate(
      {
        id: activeTest.id,
        data: {
          rating: feedbackRating,
          feedbackNotes: feedbackNotes || undefined,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListSandboxTestsQueryKey(),
          });
          toast({
            title: "Feedback saved.",
            description:
              "Your agent will use this feedback in future responses.",
          });
        },
        onError: () =>
          toast({ title: "Could not save feedback.", variant: "destructive" }),
      },
    );
  };

  const showEstimate =
    activeTest?.stage === "complete" && activeTest.estimate != null;

  // --- Agent preferences handlers ---
  const hasGenerated = PREF_SECTIONS.some(
    (s) => prefValues[s.key].trim().length > 0,
  );
  const isConfirmed = !!prefs?.confirmed;
  const widgetUnlocked =
    !!business?.widgetReady && !!business?.agentPreferencesConfirmed;
  const stylingSaved = !!me?.setupProgress?.widget;
  const embedUnlocked = widgetUnlocked && stylingSaved;
  const testAgentDone = !!me?.setupProgress?.testAgent;

  const handleGenerate = () => {
    generatePrefs.mutate(undefined, {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetAgentPreferencesQueryKey(), data);
        setPrefsDirty(false);
        toast({
          title: hasGenerated
            ? "Preferences regenerated"
            : "Preferences generated",
          description:
            "Review each section and edit anything you'd like to change.",
        });
      },
      onError: () => {
        toast({
          title: "Generation failed",
          description:
            "Could not generate preferences right now. Please try again.",
          variant: "destructive",
        });
      },
    });
  };

  const toNullable = (v: PrefValues) =>
    Object.fromEntries(
      PREF_SECTIONS.map((s) => [s.key, v[s.key].trim() ? v[s.key] : null]),
    );

  const handleSavePrefs = () => {
    savePrefs.mutate(
      { data: toNullable(prefValues) },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(getGetAgentPreferencesQueryKey(), data);
          setPrefsDirty(false);
          toast({ title: "Agent preferences saved" });
        },
        onError: () => {
          toast({
            title: "Save failed",
            description: "Please try again.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleConfirm = () => {
    // Persist any edits first, then confirm.
    savePrefs.mutate(
      { data: toNullable(prefValues) },
      {
        onSuccess: () => {
          confirmPrefs.mutate(undefined, {
            onSuccess: (data) => {
              queryClient.setQueryData(
                getGetAgentPreferencesQueryKey(),
                data.preferences,
              );
              queryClient.invalidateQueries({
                queryKey: getGetBusinessQueryKey(),
              });
              queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
              setPrefsDirty(false);
              toast({
                title: "Agent confirmed",
                description:
                  "Now style your widget below, save it, and your installation code will unlock.",
              });
            },
            onError: () => {
              toast({
                title: "Confirmation failed",
                description: "Please try again.",
                variant: "destructive",
              });
            },
          });
        },
        onError: () => {
          toast({
            title: "Confirmation failed",
            description: "Could not save your edits.",
            variant: "destructive",
          });
        },
      },
    );
  };

  // --- Styling handlers ---
  const onSubmitStyling = (values: z.infer<typeof widgetSchema>) => {
    saveSettings.mutate(
      { data: values },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(getGetWidgetSettingsQueryKey(), data);
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          toast({ title: "Widget styling saved" });
        },
      },
    );
  };

  const currentValues = form.watch();

  // Push draft styling into the preview widget so color/font/greeting/position
  // changes render instantly, before saving.
  useEffect(() => {
    styleIframeRef.current?.contentWindow?.postMessage(
      {
        type: "bda-widget-test-style",
        detail: {
          primaryColor: currentValues.primaryColor,
          font: currentValues.font,
          greeting: currentValues.greeting,
          position: currentValues.position,
        },
      },
      "*",
    );
  }, [
    currentValues.primaryColor,
    currentValues.font,
    currentValues.greeting,
    currentValues.position,
  ]);

  // When the styling preview iframe (re)mounts — including after toggling
  // "enabled" off and back on — the widget announces readiness and we replay
  // the current draft so the preview never reverts to the saved config.
  useEffect(() => {
    const onReady = (e: MessageEvent) => {
      if (e.data?.type !== "bda-widget-test-ready") return;
      const target = styleIframeRef.current?.contentWindow;
      if (!target || e.source !== target) return;
      const v = form.getValues();
      target.postMessage(
        {
          type: "bda-widget-test-style",
          detail: {
            primaryColor: v.primaryColor,
            font: v.font,
            greeting: v.greeting,
            position: v.position,
          },
        },
        "*",
      );
    };
    window.addEventListener("message", onReady);
    return () => window.removeEventListener("message", onReady);
  }, [form]);

  const scriptSrc = `${window.location.origin}${import.meta.env.BASE_URL}widget.js`;
  const embedCode = `<script src="${scriptSrc}" data-client-id="${business?.clientId ?? "YOUR_CLIENT_ID"}"></script>`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied to clipboard" });
  };

  if (settingsLoading || prefsLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid lg:grid-cols-2 gap-6">
          <Skeleton className="h-[500px] rounded-xl" />
          <Skeleton className="h-[500px] rounded-xl" />
        </div>
        <Skeleton className="h-[400px] rounded-xl" />
      </div>
    );
  }

  const generating = generatePrefs.isPending;
  const savingPrefs = savePrefs.isPending;

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in duration-500 space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">
          Agent Settings
        </h2>
        <p className="text-slate-500 mt-1">
          Test your agent, review its standards, style your widget, then
          install it on your website.
        </p>
      </div>

      {/* ---- Section 1: Live Preview + Feedback ---- */}
      <div className="grid lg:grid-cols-5 gap-6 items-stretch">
        {/* Live Preview */}
        <Card className="lg:col-span-3 flex flex-col border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="border-b border-slate-100 bg-slate-50 py-4 shrink-0">
            <CardTitle className="text-lg flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-blue-600" /> Live Preview
              </span>
              <span className="flex items-center gap-2">
                {activeTest && (
                  <span
                    className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      activeTest.stage === "complete"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-blue-50 text-blue-700"
                    }`}
                    data-testid="badge-stage"
                  >
                    {STAGE_LABELS[activeTest.stage] ?? activeTest.stage}
                  </span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={startNew}
                  data-testid="button-new-conversation"
                >
                  <Plus className="h-4 w-4 mr-1.5" /> New Conversation
                </Button>
              </span>
            </CardTitle>
          </CardHeader>
          <div className="flex-1 min-h-[520px] bg-slate-50 relative">
            <iframe
              key={sessionKey}
              ref={iframeRef}
              src={`${import.meta.env.BASE_URL}widget-test.html`}
              title="Agent test conversation"
              className="w-full h-full absolute inset-0 border-0"
              data-testid="iframe-widget-test"
            />
          </div>
        </Card>

        {/* Feedback Panel */}
        <Card className="lg:col-span-2 flex flex-col border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="border-b border-slate-100 bg-slate-50 py-4 shrink-0">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-amber-500" /> Feedback
            </CardTitle>
          </CardHeader>
          <div className="flex-1 flex flex-col min-h-0">
            <div className="p-5 space-y-4 shrink-0">
              <p className="text-sm text-slate-600">
                Pretend to be a customer and make a realistic service request
                in the live preview. Once your agent delivers an estimate,
                rate it here — your feedback teaches the agent how you want it
                to respond.
              </p>

              {showEstimate && activeTest ? (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-medium text-slate-700">
                    How did your BDA do?
                  </p>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFeedbackRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        data-testid={`star-${star}`}
                        className="p-0.5"
                      >
                        <Star
                          className={`h-6 w-6 transition-colors ${
                            star <= (hoverRating || feedbackRating)
                              ? "fill-amber-400 text-amber-400"
                              : "text-slate-300"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  <Textarea
                    placeholder="What should your BDA change about this response?"
                    value={feedbackNotes}
                    onChange={(e) => setFeedbackNotes(e.target.value)}
                    className="bg-white h-20 text-sm"
                    data-testid="input-feedback-notes"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      onClick={handleSaveFeedback}
                      disabled={feedbackRating < 1 || saveFeedback.isPending}
                      size="sm"
                      data-testid="button-save-feedback"
                    >
                      {saveFeedback.isPending
                        ? "Saving..."
                        : "Save Feedback & Improve Agent"}
                    </Button>
                    {activeTest.rating != null && activeTest.rating > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleTryAgain}
                        disabled={saveFeedback.isPending}
                        data-testid="button-try-again"
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                        Try Again with Updated Feedback
                      </Button>
                    )}
                  </div>
                  {activeTest.rating != null && activeTest.rating > 0 && (
                    <p className="text-xs text-slate-500">
                      Your feedback is saved. Try the same scenario again to
                      see how your agent improved.
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
                  <Star className="h-6 w-6 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">
                    Complete a test conversation to unlock feedback for it.
                  </p>
                </div>
              )}
            </div>

            {/* Test history */}
            <div className="border-t border-slate-100 flex-1 min-h-0 flex flex-col">
              <p className="px-5 pt-4 pb-2 text-xs font-medium text-slate-500 uppercase tracking-wider shrink-0">
                Test History
              </p>
              <ScrollArea className="flex-1 max-h-56">
                {isLoadingHistory ? (
                  <div className="px-5 pb-4 space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-12 w-full rounded-lg" />
                    ))}
                  </div>
                ) : history?.length === 0 ? (
                  <p className="px-5 pb-4 text-sm text-slate-500">
                    No tests run yet.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {history?.map((test) => (
                      <button
                        key={test.id}
                        className={`w-full text-left px-5 py-3 hover:bg-slate-50 transition-colors flex items-center justify-between group ${
                          activeTest?.id === test.id ? "bg-blue-50/50" : ""
                        }`}
                        onClick={() => selectTest(test)}
                        data-testid={`history-item-${test.id}`}
                      >
                        <div className="min-w-0 pr-3">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {test.prompt}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                test.stage === "complete"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {STAGE_LABELS[test.stage] ?? test.stage}
                            </span>
                            {test.rating != null && test.rating > 0 && (
                              <span className="flex items-center gap-0.5 text-[10px] text-amber-600 font-medium">
                                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                {test.rating}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight
                          className={`h-4 w-4 shrink-0 transition-opacity ${
                            activeTest?.id === test.id
                              ? "text-blue-500 opacity-100"
                              : "text-slate-300 opacity-0 group-hover:opacity-100"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        </Card>
      </div>

      {/* ---- Generated estimate + email preview (below the test row) ---- */}
      {showEstimate && activeTest?.estimate && (
        <div className="grid lg:grid-cols-2 gap-6 items-start">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 font-medium text-slate-700">
                <Calculator className="h-4 w-4 text-emerald-600" />
                Generated Estimate
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadPdf}
                data-testid="button-download-pdf"
              >
                <Download className="h-3.5 w-3.5 mr-1.5" /> PDF Quote
              </Button>
            </div>
            <InvoiceTemplatePreview
              data={{
                businessName: me?.business?.name ?? "Your Business",
                customerEmail: activeTest.customerEmail ?? undefined,
                projectDescription: activeTest.prompt,
                date: new Date(activeTest.createdAt).toLocaleDateString(
                  "en-US",
                  {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  },
                ),
                estimate: activeTest.estimate,
                policies: invoiceSettings ?? {},
                brandColor: invoiceSettings?.brandColor ?? undefined,
              }}
            />
          </div>

          {activeTest.emailSubject && activeTest.emailBody && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-medium text-slate-700">
                  <Mail className="h-4 w-4 text-blue-600" />
                  Estimate Email Preview
                </span>
                {activeTest.emailSent ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Sent
                  </span>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSendEmail}
                    disabled={sendEmail.isPending}
                    data-testid="button-send-email"
                  >
                    {sendEmail.isPending ? "Sending..." : "Send Test Email"}
                  </Button>
                )}
              </div>
              <div className="p-4 text-sm space-y-2">
                <p className="text-xs text-slate-500">
                  To: {activeTest.customerEmail}
                </p>
                <p className="font-semibold text-slate-900">
                  {activeTest.emailSubject}
                </p>
                <p className="text-slate-600 whitespace-pre-wrap text-xs leading-relaxed">
                  {activeTest.emailBody}
                </p>
                {emailStatus && (
                  <p
                    className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-md px-3 py-2"
                    data-testid="text-email-status"
                  >
                    {emailStatus}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---- Section 2: Agent Preferences & Standards ---- */}
      <Card
        className="border-slate-200 shadow-sm"
        data-testid="card-agent-preferences"
      >
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-500" /> Agent
                Preferences &amp; Standards
              </CardTitle>
              <CardDescription className="mt-1.5 max-w-2xl">
                Based on your setup and everything your agent learned during
                testing, these are the standards it will follow with real
                customers. Review each section, edit anything you'd like, then
                confirm.
              </CardDescription>
            </div>
            {isConfirmed && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold px-3 py-1.5"
                data-testid="badge-prefs-confirmed"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Confirmed
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!hasGenerated ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
              <Sparkles className="h-8 w-8 text-blue-500 mx-auto mb-3" />
              <h3 className="font-semibold text-slate-900 mb-1">
                Generate your agent's standards
              </h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mb-5">
                {testAgentDone
                  ? "We'll analyze your business profile, services, pricing, quote settings, and your test feedback to draft the standards your agent will follow."
                  : "Tip: run a few tests above first — your feedback there teaches the agent your preferences before we draft its standards."}
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
                  <div
                    key={section.key}
                    className={
                      section.key === "finalCustomerDisclaimer"
                        ? "md:col-span-2"
                        : ""
                    }
                  >
                    <label className="text-sm font-semibold text-slate-900">
                      {section.label}
                    </label>
                    <p className="text-xs text-slate-500 mb-1.5">
                      {section.description}
                    </p>
                    <Textarea
                      value={prefValues[section.key]}
                      onChange={(e) => {
                        setPrefValues((prev) => ({
                          ...prev,
                          [section.key]: e.target.value,
                        }));
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

              <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5">
                <Button
                  variant="outline"
                  onClick={handleGenerate}
                  disabled={generating || savingPrefs || confirmPrefs.isPending}
                  data-testid="button-regenerate-preferences"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  {generating ? "Regenerating..." : "Regenerate"}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSavePrefs}
                  disabled={generating || savingPrefs || confirmPrefs.isPending}
                  data-testid="button-save-preferences"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {savingPrefs && !confirmPrefs.isPending
                    ? "Saving..."
                    : "Save Agent Preferences"}
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
                  The styling section and your widget installation code unlock
                  once you confirm your agent is ready.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---- Section 3: Styling ---- */}
      {isConfirmed ? (
        <Card className="border-slate-200 shadow-sm" data-testid="card-styling">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-blue-500" /> Styling
            </CardTitle>
            <CardDescription>
              Style your widget to match your brand. Changes preview instantly
              on the right — save to apply them to your live widget.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-8">
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmitStyling)}
                  className="space-y-6"
                >
                  <FormField
                    control={form.control}
                    name="enabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border border-slate-200 p-4 bg-slate-50">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base font-semibold">
                            Enable Widget
                          </FormLabel>
                          <FormDescription>
                            If disabled, the widget will hide from your site
                            immediately.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
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
                        <FormDescription>
                          The first message customers see when they open the
                          chat.
                        </FormDescription>
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
                          <FormLabel>Banner Color</FormLabel>
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
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-position">
                                <SelectValue placeholder="Select position" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="bottom-right">
                                Bottom Right
                              </SelectItem>
                              <SelectItem value="bottom-left">
                                Bottom Left
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="font"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Font</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-font">
                              <SelectValue placeholder="Select font" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {FONT_OPTIONS.map((f) => (
                              <SelectItem
                                key={f.value}
                                value={f.value}
                                style={{ fontFamily: f.stack }}
                              >
                                {f.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Applied to all text inside your widget.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    disabled={saveSettings.isPending}
                    className="w-full"
                    data-testid="button-save-styling"
                  >
                    {saveSettings.isPending ? "Saving..." : "Save Styling"}
                  </Button>
                </form>
              </Form>

              {/* Widget rendering preview */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden relative min-h-[520px]">
                {currentValues.enabled ? (
                  <iframe
                    ref={styleIframeRef}
                    src={`${import.meta.env.BASE_URL}widget-test.html`}
                    title="Widget styling preview"
                    className="absolute inset-0 w-full h-full border-0"
                    data-testid="iframe-widget-preview"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center backdrop-blur-[2px]">
                    <div className="bg-white/90 p-4 rounded-xl shadow-sm text-sm font-medium text-slate-500 border border-slate-200">
                      Widget is currently disabled
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card
          className="border-slate-200 border-dashed shadow-none bg-slate-50"
          data-testid="card-styling-locked"
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-500">
              <Lock className="h-5 w-5" /> Styling
            </CardTitle>
            <CardDescription>
              Confirm your agent preferences above to unlock widget styling —
              banner color, font, greeting, and position.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* ---- Section 4: Installation Code ---- */}
      {embedUnlocked ? (
        <Card
          className="border-slate-200 shadow-sm bg-slate-900 text-white"
          data-testid="card-embed-code"
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Code className="h-5 w-5 text-blue-400" /> Installation Code
            </CardTitle>
            <CardDescription className="text-slate-400">
              Paste this snippet just before the closing &lt;/body&gt; tag on
              your website.
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
                {copied ? (
                  <Check className="h-4 w-4 mr-1" />
                ) : (
                  <Copy className="h-4 w-4 mr-1" />
                )}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card
          className="border-slate-200 border-dashed shadow-none bg-slate-50"
          data-testid="card-embed-locked"
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-500">
              <Lock className="h-5 w-5" /> Installation Code
            </CardTitle>
            <CardDescription>
              Your installation code will appear here once you confirm your
              agent preferences and save your widget styling above. This makes
              sure your agent goes live with the standards and look you
              approved.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
