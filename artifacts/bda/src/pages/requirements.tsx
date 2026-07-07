import { useListRequirements, useUpdateRequirement, getListRequirementsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Clock, AlertCircle, PlayCircle, ExternalLink } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import type { Requirement } from "@workspace/api-client-react";

export default function RequirementsPage() {
  const { data: requirements, isLoading } = useListRequirements();
  const updateRequirement = useUpdateRequirement();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const completedCount = requirements?.filter(r => r.status === 'completed').length || 0;
  const totalCount = requirements?.length || 1;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  const handleSave = (req: Requirement) => {
    updateRequirement.mutate({ 
      id: req.id, 
      data: { value: editValue, status: 'completed' } 
    }, {
      onSuccess: () => {
        setEditingId(null);
        queryClient.invalidateQueries({ queryKey: getListRequirementsQueryKey() });
        toast({ title: "Requirement updated" });
      }
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case 'in_progress': return <Clock className="h-5 w-5 text-blue-500" />;
      default: return <AlertCircle className="h-5 w-5 text-amber-500" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Setup Requirements</h2>
          <p className="text-slate-500 mt-1">Information your agent needs to function effectively.</p>
        </div>
        <Link href="/knowledge">
          <Button variant="outline" className="bg-purple-50 text-purple-700 hover:bg-purple-100 hover:text-purple-800 border-purple-200">
            <PlayCircle className="mr-2 h-4 w-4" /> Auto-fill with AI Scanner
          </Button>
        </Link>
      </div>

      <Card className="border-slate-200 shadow-sm mb-8 overflow-hidden">
        <div className="bg-slate-900 p-6 text-white">
          <div className="flex justify-between items-end mb-4">
            <div>
              <h3 className="text-lg font-semibold">Onboarding Progress</h3>
              <p className="text-slate-400 text-sm">{completedCount} of {totalCount} items completed</p>
            </div>
            <div className="text-3xl font-bold">{progressPercent}%</div>
          </div>
          <Progress value={progressPercent} className="h-2 bg-slate-800" />
        </div>
      </Card>

      <div className="space-y-4">
        {requirements?.map((req) => (
          <Card key={req.id} className={`border-slate-200 shadow-sm transition-all ${req.status === 'completed' ? 'bg-slate-50/50' : 'bg-white border-l-4 border-l-amber-500'}`}>
            <CardContent className="p-5 flex flex-col md:flex-row gap-4 items-start md:items-center">
              <div className="shrink-0 mt-1 md:mt-0">
                {getStatusIcon(req.status)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-slate-900">{req.label}</h4>
                  {req.status === 'completed' && <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-none">Completed</Badge>}
                </div>
                
                {editingId === req.id ? (
                  <div className="flex gap-2 mt-3">
                    <Input 
                      value={editValue} 
                      onChange={(e) => setEditValue(e.target.value)} 
                      placeholder="Enter information..."
                      className="max-w-md"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleSave(req)}
                    />
                    <Button onClick={() => handleSave(req)} size="sm">Save</Button>
                    <Button variant="ghost" onClick={() => setEditingId(null)} size="sm">Cancel</Button>
                  </div>
                ) : (
                  <div className="text-sm text-slate-600 mt-1">
                    {req.value ? (
                      <span className="bg-white px-2 py-1 rounded border border-slate-200 font-mono text-xs">{req.value}</span>
                    ) : (
                      <span className="italic text-slate-400">Information missing</span>
                    )}
                  </div>
                )}
                
                {req.source && !editingId && (
                  <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
                    Source: <span className="text-purple-600 font-medium">{req.source}</span>
                  </div>
                )}
              </div>

              {!editingId && (
                <div className="shrink-0 flex items-center gap-2">
                  {/* Action button redirects based on requirement key if it corresponds to a specific page */}
                  {(req.key === 'business_name' || req.key === 'contact_info') ? (
                    <Link href="/business">
                      <Button variant="outline" size="sm">Go to Profile <ExternalLink className="ml-2 h-3 w-3" /></Button>
                    </Link>
                  ) : (req.key === 'services_defined') ? (
                    <Link href="/services">
                      <Button variant="outline" size="sm">Manage Services <ExternalLink className="ml-2 h-3 w-3" /></Button>
                    </Link>
                  ) : (req.key === 'pricing_rules') ? (
                    <Link href="/pricing">
                      <Button variant="outline" size="sm">Manage Pricing <ExternalLink className="ml-2 h-3 w-3" /></Button>
                    </Link>
                  ) : (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        setEditValue(req.value || "");
                        setEditingId(req.id);
                      }}
                    >
                      {req.value ? "Edit manually" : "Provide info"}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}