import { useState } from "react";
import {
  useListRequirements,
  useUpdateRequirement,
  getListRequirementsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Circle, ChevronDown, ChevronRight, ListChecks } from "lucide-react";
import type { Requirement } from "@workspace/api-client-react";

const REQUIREMENT_HINTS: Record<string, string> = {
  business_info:
    "Legal business name, years in business, licenses or certifications, and contact details.",
  services:
    "Each service you offer, what is included, and any jobs you do not take on.",
  pricing:
    "Labor rates, minimum job costs, trip or emergency fees, and how you quote typical jobs.",
  service_area:
    "Cities, counties, or zip codes you cover, and any travel limits or fees.",
  availability:
    "Business hours, after-hours or emergency availability, and typical scheduling lead time.",
  policies:
    "Warranties, guarantees, payment terms, deposits, and cancellation policies.",
  brand_voice:
    "How the agent should sound: friendly, professional, direct — plus phrases to use or avoid.",
  faqs: "Questions customers ask most, with the answers you want the agent to give.",
};

export default function RequirementsPane() {
  const { data: requirements, isLoading } = useListRequirements();
  const updateRequirement = useUpdateRequirement();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  const completedCount =
    requirements?.filter((r) => r.status === "completed").length || 0;
  const totalCount = requirements?.length || 0;
  const progressPercent = totalCount
    ? Math.round((completedCount / totalCount) * 100)
    : 0;

  const toggleExpand = (req: Requirement) => {
    if (expandedId === req.id) {
      setExpandedId(null);
    } else {
      setExpandedId(req.id);
      setEditValue(req.value || "");
    }
  };

  const handleSave = (req: Requirement) => {
    updateRequirement.mutate(
      { id: req.id, data: { value: editValue, status: "completed" } },
      {
        onSuccess: () => {
          setExpandedId(null);
          queryClient.invalidateQueries({ queryKey: getListRequirementsQueryKey() });
          toast({ title: "Requirement updated" });
        },
        onError: () => {
          toast({ title: "Failed to save requirement", variant: "destructive" });
        },
      },
    );
  };

  return (
    <Card className="border-slate-200 shadow-sm" data-testid="requirements-pane">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-blue-600" />
          Agent Requirements
        </CardTitle>
        <div className="flex items-center gap-2 pt-1">
          <Progress value={progressPercent} className="h-1.5 flex-1" />
          <span className="text-xs font-medium text-slate-500 shrink-0">
            {completedCount}/{totalCount}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {isLoading ? (
          <p className="text-xs text-slate-400 py-2">Loading requirements...</p>
        ) : (
          requirements?.map((req) => {
            const isExpanded = expandedId === req.id;
            const isCompleted = req.status === "completed";
            return (
              <div
                key={req.id}
                className="rounded-md border border-transparent data-[expanded=true]:border-slate-200 data-[expanded=true]:bg-slate-50"
                data-expanded={isExpanded}
              >
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-1.5 py-1.5 text-left rounded-md hover:bg-slate-50"
                  onClick={() => toggleExpand(req)}
                  data-testid={`requirement-row-${req.key}`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <Circle className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                  )}
                  <span
                    className={`text-xs flex-1 truncate ${isCompleted ? "text-slate-500" : "text-slate-800 font-medium"}`}
                  >
                    {req.label}
                  </span>
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  )}
                </button>

                {isExpanded && (
                  <div className="px-2 pb-2 space-y-2">
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      {REQUIREMENT_HINTS[req.key] ||
                        "Provide this information so your agent can use it."}
                    </p>
                    <Textarea
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      placeholder="Enter this information..."
                      className="text-xs min-h-[70px] bg-white"
                      data-testid={`requirement-input-${req.key}`}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setExpandedId(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        disabled={updateRequirement.isPending || !editValue.trim()}
                        onClick={() => handleSave(req)}
                        data-testid={`requirement-save-${req.key}`}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
