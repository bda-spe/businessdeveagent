import { useState, useRef, useEffect, useCallback } from "react";
import {
  useListSandboxTests,
  useSendSandboxTestEmail,
  useSaveSandboxFeedback,
  useGetInvoiceSettings,
  useGetMe,
  getListSandboxTestsQueryKey,
} from "@workspace/api-client-react";
import { InvoiceTemplatePreview } from "@/components/invoice-templates";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "lucide-react";
import type { SandboxTest } from "@workspace/api-client-react";

const STAGE_LABELS: Record<string, string> = {
  gathering: "Gathering details",
  confirming: "Confirming scope",
  awaiting_email: "Awaiting email",
  complete: "Estimate sent",
};

export default function TrainingPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
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
  const hasAutoSelected = useRef(false);

  const activeTest = history?.find((t) => t.id === activeTestId) ?? null;

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
      const res = await fetch(`/api/sandbox-tests/${activeTest.id}/invoice.pdf`);
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

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-8rem)] flex flex-col animate-in fade-in duration-500">
      <div className="mb-6 shrink-0 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Test Agent
          </h2>
          <p className="text-slate-500 mt-1">
            Chat with your agent like a customer would. It will ask clarifying
            questions, confirm the scope, and deliver an estimate.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={startNew}
          data-testid="button-new-conversation"
          className="shrink-0"
        >
          <Plus className="h-4 w-4 mr-2" /> New Conversation
        </Button>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        {/* Main Chat Area */}
        <Card className="flex-1 flex flex-col border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="border-b border-slate-100 bg-slate-50 py-4 shrink-0">
            <CardTitle className="text-lg flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-blue-600" /> Live Simulation
              </span>
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
            </CardTitle>
          </CardHeader>

          <div className="flex-1 min-h-[420px] bg-slate-50 relative">
            <iframe
              key={sessionKey}
              ref={iframeRef}
              src={`${import.meta.env.BASE_URL}widget-test.html`}
              title="Agent test conversation"
              className="w-full h-full border-0"
              data-testid="iframe-widget-test"
            />
          </div>

          <ScrollArea className="max-h-[45%] shrink-0 border-t border-slate-100">
            <div className="p-6 space-y-4">
              {!activeTest && (
                <p className="text-sm text-slate-500">
                  Chat with the widget above like a customer would. Once it
                  produces an estimate, you'll be able to review it and leave
                  feedback here.
                </p>
              )}

              {showEstimate && activeTest?.estimate && (
                <div className="flex flex-col gap-4 w-full">
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
                          <Download className="h-3.5 w-3.5 mr-1.5" /> PDF
                          Quote
                        </Button>
                      </div>
                      <InvoiceTemplatePreview
                        data={{
                          businessName: me?.business?.name ?? "Your Business",
                          customerEmail: activeTest.customerEmail ?? undefined,
                          projectDescription: activeTest.prompt,
                          date: new Date(
                            activeTest.createdAt,
                          ).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          }),
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
                              {sendEmail.isPending
                                ? "Sending..."
                                : "Send Test Email"}
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

                    {/* Feedback */}
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
                          disabled={
                            feedbackRating < 1 || saveFeedback.isPending
                          }
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
                          Your feedback is saved. Try the same scenario again
                          to see how your agent improved.
                        </p>
                      )}
                    </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </Card>

        {/* History Sidebar */}
        <Card className="w-80 shrink-0 border-slate-200 shadow-sm hidden md:flex flex-col">
          <CardHeader className="py-4 border-b border-slate-100 bg-slate-50">
            <CardTitle className="text-sm font-medium text-slate-700 uppercase tracking-wider">
              Test History
            </CardTitle>
          </CardHeader>
          <ScrollArea className="flex-1">
            {isLoadingHistory ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : history?.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">
                No tests run yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {history?.map((test) => (
                  <button
                    key={test.id}
                    className={`w-full text-left p-4 hover:bg-slate-50 transition-colors flex items-center justify-between group ${
                      activeTest?.id === test.id ? "bg-blue-50/50" : ""
                    }`}
                    onClick={() => selectTest(test)}
                    data-testid={`history-item-${test.id}`}
                  >
                    <div className="min-w-0 pr-4">
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
        </Card>
      </div>
    </div>
  );
}
