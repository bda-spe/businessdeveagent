import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useGetBusiness,
  useUpdateBusiness,
  useGetProfileInterview,
  useSendProfileInterviewMessage,
  useConfirmProfileInterview,
  useResetProfileInterview,
  useSaveStructuredProfileData,
  useAcceptPolicyDraft,
  getGetProfileInterviewQueryKey,
  getGetMeQueryKey,
  getGetBusinessQueryKey,
} from "@workspace/api-client-react";
import type { ProfileInterview, Business } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bot,
  User,
  Send,
  CheckCircle2,
  Circle,
  RotateCcw,
  Save,
  Pencil,
  RefreshCw,
} from "lucide-react";

// ── Progress checklist ──────────────────────────────────────────────────────
const CHECKLIST = [
  { key: "basicInfo", label: "Basic Info" },
  { key: "operations", label: "Operations" },
  { key: "policies", label: "Policies" },
  { key: "estimateRules", label: "Estimate Rules" },
  { key: "businessTone", label: "Business Tone" },
];

function computeProgress(
  biz: Business | undefined,
  interview: ProfileInterview | undefined,
) {
  const captured = new Set((interview?.captured ?? []).map((c) => c.key));
  const fd = interview?.formData ?? {};
  return {
    basicInfo: !!(biz?.name && biz?.industry && biz?.phone && biz?.serviceArea),
    operations: !!(
      biz?.customerType &&
      fd.businessHours
    ),
    policies: captured.has("paymentTerms") && captured.has("cancellationPolicy"),
    estimateRules: captured.has("estimateRules") || captured.has("whenToGivePriceRange"),
    businessTone: captured.has("businessTone"),
  } as Record<string, boolean>;
}

// ── Business form ───────────────────────────────────────────────────────────
const bizSchema = z.object({
  name: z.string().min(1, "Required"),
  industry: z.string().optional(),
  website: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  serviceArea: z.string().optional(),
  customerType: z.string().optional(),
  companySize: z.string().optional(),
});

const extraSchema = z.object({
  businessAddress: z.string().optional(),
  yearsInBusiness: z.string().optional(),
  businessHours: z.string().optional(),
  emergencyAvailability: z.string().optional(),
  seasonalAvailability: z.string().optional(),
  typicalResponseTime: z.string().optional(),
});

// ── PolicyDraftCard ─────────────────────────────────────────────────────────
function PolicyDraftCard({
  draft,
  onAccept,
  onRegenerate,
  accepting,
}: {
  draft: { key: string; label: string; wording: string };
  onAccept: (wording: string) => void;
  onRegenerate: () => void;
  accepting: boolean;
}) {
  const [edited, setEdited] = useState(draft.wording);
  useEffect(() => setEdited(draft.wording), [draft.wording]);

  return (
    <div className="mt-3 rounded-xl border border-[#1e3a5f]/20 bg-blue-50/60 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#1e3a5f]">
          Suggested — {draft.label}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-slate-500"
          onClick={onRegenerate}
          disabled={accepting}
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1" />
          Regenerate
        </Button>
      </div>
      <Textarea
        value={edited}
        onChange={(e) => setEdited(e.target.value)}
        className="resize-none text-sm bg-white min-h-[80px]"
        rows={4}
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          className="bg-[#1e3a5f] hover:bg-[#162d4d]"
          onClick={() => onAccept(edited)}
          disabled={accepting || !edited.trim()}
        >
          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
          {accepting ? "Saving…" : "Accept"}
        </Button>
        <p className="text-xs text-slate-400 self-center">
          Edit the wording above, then accept.
        </p>
      </div>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function BusinessPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: biz, isLoading: bizLoading } = useGetBusiness();
  const { data: interview, isLoading: interviewLoading } =
    useGetProfileInterview();

  const updateBusiness = useUpdateBusiness();
  const saveStructured = useSaveStructuredProfileData();
  const sendMessage = useSendProfileInterviewMessage();
  const acceptPolicy = useAcceptPolicyDraft();
  const confirmInterview = useConfirmProfileInterview();
  const resetInterview = useResetProfileInterview();

  const [chatDraft, setChatDraft] = useState("");
  const [pendingMsg, setPendingMsg] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const bizForm = useForm<z.infer<typeof bizSchema>>({
    resolver: zodResolver(bizSchema),
    defaultValues: {
      name: "",
      industry: "",
      website: "",
      phone: "",
      email: "",
      serviceArea: "",
      customerType: "",
      companySize: "",
    },
  });

  const extraForm = useForm<z.infer<typeof extraSchema>>({
    resolver: zodResolver(extraSchema),
    defaultValues: {
      businessAddress: "",
      yearsInBusiness: "",
      businessHours: "",
      emergencyAvailability: "",
      seasonalAvailability: "",
      typicalResponseTime: "",
    },
  });

  useEffect(() => {
    if (biz) {
      bizForm.reset({
        name: biz.name ?? "",
        industry: biz.industry ?? "",
        website: biz.website ?? "",
        phone: biz.phone ?? "",
        email: biz.email ?? "",
        serviceArea: biz.serviceArea ?? "",
        customerType: biz.customerType ?? "",
        companySize: biz.companySize ?? "",
      });
    }
  }, [biz]);

  useEffect(() => {
    if (interview?.formData) {
      const fd = interview.formData;
      extraForm.reset({
        businessAddress: fd.businessAddress ?? "",
        yearsInBusiness: fd.yearsInBusiness ?? "",
        businessHours: fd.businessHours ?? "",
        emergencyAvailability: fd.emergencyAvailability ?? "",
        seasonalAvailability: fd.seasonalAvailability ?? "",
        typicalResponseTime: fd.typicalResponseTime ?? "",
      });
    }
  }, [interview?.formData]);

  const scrollToBottom = () => {
    setTimeout(() => {
      const vp = scrollRef.current?.querySelector(
        "[data-radix-scroll-area-viewport]",
      );
      if (vp) vp.scrollTop = vp.scrollHeight;
    }, 80);
  };

  useEffect(() => {
    scrollToBottom();
  }, [interview?.messages?.length, pendingMsg]);

  const applyInterviewUpdate = (updated: ProfileInterview) => {
    queryClient.setQueryData(getGetProfileInterviewQueryKey(), updated);
    queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
  };

  const onSaveBasicInfo = async (vals: z.infer<typeof bizSchema>) => {
    const extra = extraForm.getValues();
    await Promise.all([
      updateBusiness.mutateAsync({ data: vals }),
      saveStructured.mutateAsync({
        data: {
          businessAddress: extra.businessAddress || undefined,
          yearsInBusiness: extra.yearsInBusiness || undefined,
          businessHours: extra.businessHours || undefined,
          emergencyAvailability: extra.emergencyAvailability || undefined,
          seasonalAvailability: extra.seasonalAvailability || undefined,
          typicalResponseTime: extra.typicalResponseTime || undefined,
        },
      }),
    ])
      .then(([, interviewResult]) => {
        applyInterviewUpdate(interviewResult);
        queryClient.invalidateQueries({ queryKey: getGetBusinessQueryKey() });
        toast({
          title: "Basic info saved",
          description: "The BDA helper will guide you through policies next.",
        });
      })
      .catch((err: any) => {
        toast({
          title: "Save failed",
          description: err?.message ?? "Please try again.",
          variant: "destructive",
        });
      });
  };

  const handleSendChat = () => {
    const message = chatDraft.trim();
    if (!message || sendMessage.isPending) return;
    setChatDraft("");
    setPendingMsg(message);
    sendMessage.mutate(
      { data: { message } },
      {
        onSuccess: (updated) => {
          setPendingMsg(null);
          applyInterviewUpdate(updated);
          scrollToBottom();
        },
        onError: (err: any) => {
          setPendingMsg(null);
          setChatDraft(message);
          toast({
            title: "Message failed",
            description: err?.message ?? "Please try again.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleAcceptPolicy = (key: string, wording: string) => {
    acceptPolicy.mutate(
      { data: { key, wording } },
      {
        onSuccess: (updated) => {
          applyInterviewUpdate(updated);
          toast({
            title: "Policy saved",
            description: "The BDA helper will move to the next section.",
          });
        },
        onError: (err: any) => {
          toast({
            title: "Could not save policy",
            description: err?.message ?? "Please try again.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleRegenerate = () => {
    sendMessage.mutate(
      {
        data: {
          message:
            "Please regenerate the policy wording with a slightly different approach.",
        },
      },
      {
        onSuccess: (updated) => applyInterviewUpdate(updated),
        onError: () => {},
      },
    );
  };

  const handleConfirm = () => {
    confirmInterview.mutate(undefined, {
      onSuccess: (updated) => {
        applyInterviewUpdate(updated);
        toast({
          title: "Business Profile complete",
          description: "All sections confirmed — next onboarding step unlocked.",
        });
      },
      onError: (err: any) => {
        toast({
          title: "Not ready yet",
          description: err?.message ?? "Complete the required policy sections first.",
          variant: "destructive",
        });
      },
    });
  };

  const handleReset = () => {
    resetInterview.mutate(undefined, {
      onSuccess: (updated) => {
        applyInterviewUpdate(updated);
        toast({ title: "Chat restarted", description: "Policy chat has been reset." });
      },
      onError: () => {},
    });
  };

  const isLoading = bizLoading || interviewLoading;

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid lg:grid-cols-2 gap-6">
          <Skeleton className="h-[700px]" />
          <Skeleton className="h-[700px]" />
        </div>
      </div>
    );
  }

  const messages = interview?.messages ?? [];
  const policyDraft = interview?.policyDraft ?? null;
  const isConfirmed = interview?.status === "confirmed";
  const readyToConfirm = interview?.readyToConfirm ?? false;
  const capturedPolicies = interview?.captured ?? [];
  const missingPolicies = interview?.stillMissing ?? [];
  const progress = computeProgress(biz, interview);

  return (
    <div className="max-w-7xl mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Business Profile
          </h2>
          <p className="text-slate-500 mt-1">
            Fill in your details on the left, then let the BDA helper write your
            policy language on the right.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isConfirmed && (
            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 gap-1.5 px-3 py-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Profile Confirmed
            </Badge>
          )}
        </div>
      </div>

      {/* Progress checklist */}
      <div className="mb-6 flex flex-wrap gap-3">
        {CHECKLIST.map((item) => {
          const done = progress[item.key];
          return (
            <div
              key={item.key}
              className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${
                done
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-white border-slate-200 text-slate-500"
              }`}
              data-testid={`progress-${item.key}`}
            >
              {done ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Circle className="h-3.5 w-3.5 text-slate-300" />
              )}
              {item.label}
            </div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        {/* ── LEFT: Structured form ──────────────────────────────────────── */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 py-4">
            <CardTitle className="text-base">Business Info</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <Form {...bizForm}>
              <form
                onSubmit={bizForm.handleSubmit(onSaveBasicInfo)}
                className="space-y-5"
              >
                {/* Basic identity */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={bizForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business Name *</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-business-name" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={bizForm.control}
                    name="industry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Industry / Trade</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. Plumbing, HVAC, Landscaping"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={bizForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="(555) 123-4567" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={bizForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="hello@yourbusiness.com"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={bizForm.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="https://yourbusiness.com"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={bizForm.control}
                    name="customerType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer Type</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value ?? ""}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select…" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="residential">
                              Residential
                            </SelectItem>
                            <SelectItem value="commercial">
                              Commercial
                            </SelectItem>
                            <SelectItem value="both">Both</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={bizForm.control}
                  name="serviceArea"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service Area (cities / counties / ZIPs)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g. Greater Denver area, Douglas County, 80202–80239"
                          className="resize-none h-20"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* Operations fields from extraForm */}
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
                    Company Operations
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Form {...extraForm}>
                      <FormField
                        control={extraForm.control}
                        name="businessAddress"
                        render={({ field }) => (
                          <FormItem className="sm:col-span-2">
                            <FormLabel>Business Address</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="123 Main St, Denver, CO 80202"
                                {...field}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={extraForm.control}
                        name="yearsInBusiness"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Years in Business</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. 12" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={bizForm.control}
                        name="companySize"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Number of Employees</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. 5" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={extraForm.control}
                        name="businessHours"
                        render={({ field }) => (
                          <FormItem className="sm:col-span-2">
                            <FormLabel>Business Hours</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g. Mon–Fri 7am–6pm, Sat 8am–2pm"
                                {...field}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={extraForm.control}
                        name="emergencyAvailability"
                        render={({ field }) => (
                          <FormItem className="sm:col-span-2">
                            <FormLabel>
                              Emergency / After-Hours Availability
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g. 24/7 emergency service available, $150 call-out fee"
                                {...field}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={extraForm.control}
                        name="seasonalAvailability"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Seasonal Availability</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g. Year-round"
                                {...field}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={extraForm.control}
                        name="typicalResponseTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Typical Response Time</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g. Within 2 hours"
                                {...field}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </Form>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <Button
                    type="submit"
                    disabled={
                      updateBusiness.isPending || saveStructured.isPending
                    }
                    className="w-full sm:w-auto"
                    data-testid="button-save-basic-info"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {updateBusiness.isPending || saveStructured.isPending
                      ? "Saving…"
                      : "Save Basic Info"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* ── RIGHT: BDA helper chat ─────────────────────────────────────── */}
        <div className="space-y-4">
          <Card className="border-slate-200 shadow-sm flex flex-col">
            <CardHeader className="border-b border-slate-100 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-[#1e3a5f] flex items-center justify-center">
                    <Bot className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-base">BDA Setup Helper</CardTitle>
                    <p className="text-xs text-slate-500">
                      Policies, estimate rules &amp; business tone
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  disabled={resetInterview.isPending}
                  className="text-slate-400 hover:text-slate-700"
                  data-testid="button-reset-chat"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex flex-col">
              <ScrollArea className="h-[440px]" ref={scrollRef}>
                <div className="p-5 space-y-4">
                  {messages.map((m, i) => (
                    <div
                      key={i}
                      className={`flex gap-2.5 ${m.role === "user" ? "justify-end" : ""}`}
                    >
                      {m.role === "assistant" && (
                        <div className="h-7 w-7 shrink-0 rounded-full bg-[#1e3a5f] flex items-center justify-center mt-0.5">
                          <Bot className="h-3.5 w-3.5 text-white" />
                        </div>
                      )}
                      <div
                        className={`rounded-2xl px-4 py-2.5 max-w-[85%] text-sm leading-relaxed whitespace-pre-wrap ${
                          m.role === "user"
                            ? "bg-[#1e3a5f] text-white rounded-br-sm"
                            : "bg-slate-100 text-slate-800 rounded-bl-sm"
                        }`}
                        data-testid={`chat-msg-${m.role}-${i}`}
                      >
                        {m.content}
                      </div>
                      {m.role === "user" && (
                        <div className="h-7 w-7 shrink-0 rounded-full bg-slate-200 flex items-center justify-center mt-0.5">
                          <User className="h-3.5 w-3.5 text-slate-600" />
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Pending user message + typing indicator */}
                  {pendingMsg && (
                    <>
                      <div className="flex gap-2.5 justify-end">
                        <div className="rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[85%] text-sm bg-[#1e3a5f] text-white opacity-75 whitespace-pre-wrap">
                          {pendingMsg}
                        </div>
                        <div className="h-7 w-7 shrink-0 rounded-full bg-slate-200 flex items-center justify-center mt-0.5">
                          <User className="h-3.5 w-3.5 text-slate-600" />
                        </div>
                      </div>
                      <div className="flex gap-2.5">
                        <div className="h-7 w-7 shrink-0 rounded-full bg-[#1e3a5f] flex items-center justify-center mt-0.5">
                          <Bot className="h-3.5 w-3.5 text-white" />
                        </div>
                        <div className="rounded-2xl rounded-bl-sm px-4 py-2.5 bg-slate-100 text-slate-500 text-sm">
                          <span className="animate-pulse">Writing…</span>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Policy draft card attached to last message */}
                  {!pendingMsg && policyDraft && (
                    <div className="ml-9">
                      <PolicyDraftCard
                        draft={policyDraft}
                        onAccept={(wording) =>
                          handleAcceptPolicy(policyDraft.key, wording)
                        }
                        onRegenerate={handleRegenerate}
                        accepting={acceptPolicy.isPending}
                      />
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Confirm banner */}
              {readyToConfirm && !isConfirmed && (
                <div className="border-t border-slate-100 bg-emerald-50/60 px-5 py-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-emerald-800 font-medium">
                    All required sections captured — confirm to complete.
                  </p>
                  <Button
                    size="sm"
                    onClick={handleConfirm}
                    disabled={confirmInterview.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700"
                    data-testid="button-confirm-profile"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1.5" />
                    {confirmInterview.isPending ? "Confirming…" : "Confirm Profile"}
                  </Button>
                </div>
              )}

              {/* Input */}
              <div className="border-t border-slate-100 p-4">
                <div className="flex gap-2 items-end">
                  <Textarea
                    value={chatDraft}
                    onChange={(e) => setChatDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendChat();
                      }
                    }}
                    placeholder="Answer the BDA helper's question…"
                    className="resize-none min-h-[40px] max-h-32 text-sm"
                    rows={2}
                    data-testid="input-chat-message"
                  />
                  <Button
                    onClick={handleSendChat}
                    disabled={!chatDraft.trim() || sendMessage.isPending}
                    className="h-[40px] px-3"
                    data-testid="button-send-chat"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-slate-400 mt-1.5">
                  Enter to send · Shift+Enter for new line
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Policies sidebar */}
          {(capturedPolicies.length > 0 || missingPolicies.length > 0) && (
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-slate-700">
                    Policy Sections
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    {capturedPolicies.length}/
                    {capturedPolicies.length + missingPolicies.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0 pb-4 px-5">
                <div className="space-y-1">
                  {capturedPolicies.map((f) => (
                    <div
                      key={f.key}
                      className="flex items-start gap-2 text-sm py-1"
                      data-testid={`policy-captured-${f.key}`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="font-medium text-slate-700">
                        {f.label}
                      </span>
                    </div>
                  ))}
                  {missingPolicies.map((f) => (
                    <div
                      key={f.key}
                      className="flex items-center gap-2 text-sm py-1 text-slate-400"
                      data-testid={`policy-missing-${f.key}`}
                    >
                      <Circle className="h-3.5 w-3.5 shrink-0" />
                      <span>{f.label}</span>
                      {f.required && (
                        <span className="text-[10px] font-semibold text-amber-600 uppercase">
                          Required
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
