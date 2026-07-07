import { useState, useRef, useEffect } from "react";
import {
  useGetProfileInterview,
  useSendProfileInterviewMessage,
  useConfirmProfileInterview,
  useResetProfileInterview,
  getGetProfileInterviewQueryKey,
  getGetMeQueryKey,
  getGetBusinessQueryKey,
} from "@workspace/api-client-react";
import type { ProfileInterview } from "@workspace/api-client-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  User,
  Send,
  CheckCircle2,
  Circle,
  RotateCcw,
  Sparkles,
} from "lucide-react";

function groupByGroup<T extends { group: string }>(items: T[]) {
  const groups: { group: string; items: T[] }[] = [];
  for (const item of items) {
    const existing = groups.find((g) => g.group === item.group);
    if (existing) existing.items.push(item);
    else groups.push({ group: item.group, items: [item] });
  }
  return groups;
}

export default function BusinessPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: interview, isLoading } = useGetProfileInterview();
  const sendMessage = useSendProfileInterviewMessage();
  const confirmInterview = useConfirmProfileInterview();
  const resetInterview = useResetProfileInterview();

  const [draft, setDraft] = useState("");
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages = interview?.messages ?? [];
  const captured = interview?.captured ?? [];
  const stillMissing = interview?.stillMissing ?? [];
  const isConfirmed = interview?.status === "confirmed";
  const totalFields = captured.length + stillMissing.length;

  const scrollToBottom = () => {
    setTimeout(() => {
      const viewport = scrollRef.current?.querySelector(
        "[data-radix-scroll-area-viewport]",
      );
      if (viewport) viewport.scrollTop = viewport.scrollHeight;
      else if (scrollRef.current)
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, pendingMessage]);

  const applyUpdate = (updated: ProfileInterview) => {
    queryClient.setQueryData(getGetProfileInterviewQueryKey(), updated);
    queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetBusinessQueryKey() });
  };

  const handleSend = () => {
    const message = draft.trim();
    if (!message || sendMessage.isPending) return;
    setDraft("");
    setPendingMessage(message);
    sendMessage.mutate(
      { data: { message } },
      {
        onSuccess: (updated) => {
          setPendingMessage(null);
          applyUpdate(updated);
          scrollToBottom();
        },
        onError: (err: any) => {
          setPendingMessage(null);
          setDraft(message);
          toast({
            title: "Message failed",
            description: err?.message || "Please try again.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleConfirm = () => {
    confirmInterview.mutate(
      undefined,
      {
        onSuccess: (updated) => {
          applyUpdate(updated);
          toast({
            title: "Business Profile complete",
            description:
              "Your profile is confirmed. The next onboarding step is unlocked.",
          });
        },
        onError: (err: any) => {
          toast({
            title: "Could not confirm yet",
            description: err?.message || "Keep answering the BDA's questions.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleReset = () => {
    resetInterview.mutate(
      undefined,
      {
        onSuccess: (updated) => {
          applyUpdate(updated);
          toast({
            title: "Interview restarted",
            description: "The captured profile has been cleared.",
          });
        },
        onError: (err: any) => {
          toast({
            title: "Could not restart",
            description: err?.message || "Please try again.",
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
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-[480px] lg:col-span-2" />
          <Skeleton className="h-[480px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in duration-500">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Business Profile
          </h2>
          <p className="text-slate-500 mt-1">
            Your BDA interviews you like an onboarding specialist and builds
            your structured business profile as you talk.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isConfirmed && (
            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 gap-1.5 px-3 py-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Profile Confirmed
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={resetInterview.isPending}
            data-testid="button-reset-interview"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Start Over
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 items-start">
        <Card className="lg:col-span-2 border-slate-200 shadow-sm flex flex-col">
          <CardHeader className="border-b border-slate-100 py-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-[#1e3a5f] flex items-center justify-center">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-base">
                  BDA Onboarding Interview
                </CardTitle>
                <CardDescription>
                  Answer naturally — all at once or a little at a time.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex flex-col">
            <ScrollArea className="h-[480px]" ref={scrollRef}>
              <div className="p-6 space-y-5">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}
                    data-testid={`message-${m.role}-${i}`}
                  >
                    {m.role === "assistant" && (
                      <div className="h-8 w-8 shrink-0 rounded-full bg-[#1e3a5f] flex items-center justify-center mt-0.5">
                        <Bot className="h-4 w-4 text-white" />
                      </div>
                    )}
                    <div
                      className={`rounded-2xl px-4 py-3 max-w-[85%] text-sm leading-relaxed whitespace-pre-wrap ${
                        m.role === "user"
                          ? "bg-[#1e3a5f] text-white rounded-br-sm"
                          : "bg-slate-100 text-slate-800 rounded-bl-sm"
                      }`}
                    >
                      {m.content}
                    </div>
                    {m.role === "user" && (
                      <div className="h-8 w-8 shrink-0 rounded-full bg-slate-200 flex items-center justify-center mt-0.5">
                        <User className="h-4 w-4 text-slate-600" />
                      </div>
                    )}
                  </div>
                ))}

                {pendingMessage && (
                  <>
                    <div className="flex gap-3 justify-end">
                      <div className="rounded-2xl rounded-br-sm px-4 py-3 max-w-[85%] text-sm leading-relaxed whitespace-pre-wrap bg-[#1e3a5f] text-white opacity-80">
                        {pendingMessage}
                      </div>
                      <div className="h-8 w-8 shrink-0 rounded-full bg-slate-200 flex items-center justify-center mt-0.5">
                        <User className="h-4 w-4 text-slate-600" />
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="h-8 w-8 shrink-0 rounded-full bg-[#1e3a5f] flex items-center justify-center mt-0.5">
                        <Bot className="h-4 w-4 text-white" />
                      </div>
                      <div className="rounded-2xl rounded-bl-sm px-4 py-3 bg-slate-100 text-slate-500 text-sm">
                        <span className="inline-flex gap-1 items-center">
                          <span className="animate-pulse">Reviewing your answer</span>
                          <span className="animate-bounce">…</span>
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>

            {interview?.readyToConfirm && !isConfirmed && (
              <div className="border-t border-slate-100 bg-emerald-50/60 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-emerald-900">
                  <Sparkles className="h-4 w-4 text-emerald-600" />
                  All required details captured. Confirm to complete this step,
                  or keep chatting to make updates.
                </div>
                <Button
                  onClick={handleConfirm}
                  disabled={confirmInterview.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700"
                  data-testid="button-confirm-profile"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {confirmInterview.isPending
                    ? "Confirming..."
                    : "Confirm Profile"}
                </Button>
              </div>
            )}

            <div className="border-t border-slate-100 p-4">
              <div className="flex gap-3 items-end">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Tell the BDA about your business..."
                  className="resize-none min-h-[44px] max-h-40"
                  rows={2}
                  data-testid="input-interview-message"
                />
                <Button
                  onClick={handleSend}
                  disabled={!draft.trim() || sendMessage.isPending}
                  className="h-[44px] px-4"
                  data-testid="button-send-interview-message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Press Enter to send, Shift+Enter for a new line.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="py-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Captured
                </CardTitle>
                <Badge variant="secondary" data-testid="badge-captured-count">
                  {captured.length}/{totalFields}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {captured.length === 0 ? (
                <p className="text-sm text-slate-400">
                  Nothing captured yet — start by telling the BDA about your
                  business.
                </p>
              ) : (
                <ScrollArea className="max-h-[300px] h-auto">
                  <div className="space-y-4 pr-3">
                    {groupByGroup(captured).map(({ group, items }) => (
                      <div key={group}>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
                          {group}
                        </p>
                        <div className="space-y-1.5">
                          {items.map((f) => (
                            <div
                              key={f.key}
                              className="text-sm"
                              data-testid={`captured-${f.key}`}
                            >
                              <span className="font-medium text-slate-700">
                                {f.label}:
                              </span>{" "}
                              <span className="text-slate-500 break-words">
                                {f.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="py-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Circle className="h-4 w-4 text-slate-400" />
                  Still Missing
                </CardTitle>
                <Badge variant="secondary" data-testid="badge-missing-count">
                  {stillMissing.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {stillMissing.length === 0 ? (
                <p className="text-sm text-emerald-700">
                  Everything is captured. Nice work!
                </p>
              ) : (
                <ScrollArea className="max-h-[300px] h-auto">
                  <div className="space-y-4 pr-3">
                    {groupByGroup(stillMissing).map(({ group, items }) => (
                      <div key={group}>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
                          {group}
                        </p>
                        <div className="space-y-1">
                          {items.map((f) => (
                            <div
                              key={f.key}
                              className="text-sm text-slate-500 flex items-center gap-2"
                              data-testid={`missing-${f.key}`}
                            >
                              <Circle className="h-2 w-2 text-slate-300 shrink-0" />
                              {f.label}
                              {f.required && (
                                <span className="text-[10px] font-semibold uppercase text-amber-600">
                                  Required
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
