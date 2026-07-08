import { useState } from "react";
import { useListLeads, useGetLead, useUpdateLead, useSendLeadEmail, getListLeadsQueryKey, getGetLeadQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Mail, Phone, Clock, FileText, ChevronRight, MessageSquare, Calculator, Search, Send, CheckCircle } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

export default function LeadsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: leads, isLoading: isLoadingLeads } = useListLeads();
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);

  const { data: leadDetail, isLoading: isLoadingDetail } = useGetLead(selectedLeadId || 0, {
    query: {
      enabled: !!selectedLeadId,
      queryKey: getGetLeadQueryKey(selectedLeadId || 0)
    }
  });

  const updateLead = useUpdateLead();
  const sendLeadEmail = useSendLeadEmail();

  const handleResendEmail = () => {
    if (!selectedLeadId || !leadDetail?.email) return;
    sendLeadEmail.mutate({ id: selectedLeadId }, {
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetLeadQueryKey(selectedLeadId) });
        toast({ title: result.sent ? "Email sent" : "Email failed", description: result.message });
      },
      onError: (err: any) => {
        toast({ title: "Failed to send email", description: err?.message || "Unknown error", variant: "destructive" });
      }
    });
  };

  const handleStatusChange = (status: string) => {
    if (!selectedLeadId) return;
    updateLead.mutate({ id: selectedLeadId, data: { status } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetLeadQueryKey(selectedLeadId) });
        toast({ title: "Status updated" });
      }
    });
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'new': return 'bg-blue-100 text-blue-800';
      case 'contacted': return 'bg-amber-100 text-amber-800';
      case 'won': return 'bg-emerald-100 text-emerald-800';
      case 'lost': return 'bg-slate-100 text-slate-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-8rem)] flex flex-col animate-in fade-in duration-500">
      <div className="mb-6 shrink-0">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Leads Inbox</h2>
        <p className="text-slate-500 mt-1">Review opportunities captured and qualified by your agent.</p>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        {/* Leads List */}
        <Card className="w-1/3 shrink-0 flex flex-col overflow-hidden border-slate-200 shadow-sm">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search leads..." 
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {isLoadingLeads ? (
              <div className="p-4 space-y-4">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
              </div>
            ) : leads?.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Users className="h-10 w-10 mx-auto text-slate-200 mb-3" />
                <p>No leads yet.</p>
              </div>
            ) : (
              leads?.map(lead => (
                <button
                  key={lead.id}
                  onClick={() => setSelectedLeadId(lead.id)}
                  className={`w-full text-left p-4 hover:bg-slate-50 transition-colors flex flex-col gap-2 relative ${selectedLeadId === lead.id ? 'bg-blue-50/50' : ''}`}
                >
                  {selectedLeadId === lead.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div>}
                  <div className="flex justify-between items-start">
                    <span className="font-semibold text-slate-900 truncate pr-2">{lead.customerName}</span>
                    <div className="flex items-center gap-1.5">
                      {lead.emailSent && (
                        <span title="Estimate emailed">
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                        </span>
                      )}
                      <Badge variant="secondary" className={`${getStatusColor(lead.status)} border-none shadow-none font-medium px-2 py-0 h-5`}>
                        {lead.status}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 line-clamp-1">{lead.requestSummary || lead.projectDescription}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs font-medium text-slate-900">
                      {lead.estimatedLow ? `$${lead.estimatedLow} - $${lead.estimatedHigh}` : 'Need info'}
                    </span>
                    <span className="text-xs text-slate-400">
                      {formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>

        {/* Lead Detail */}
        <Card className="flex-1 flex flex-col overflow-hidden border-slate-200 shadow-sm">
          {!selectedLeadId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
              <Users className="h-16 w-16 mb-4 text-slate-200" />
              <p className="text-lg font-medium text-slate-500">Select a lead to view details</p>
            </div>
          ) : isLoadingDetail ? (
            <div className="p-8 space-y-6">
              <Skeleton className="h-10 w-1/2" />
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-24" /><Skeleton className="h-24" />
              </div>
              <Skeleton className="h-64" />
            </div>
          ) : leadDetail ? (
            <>
              {/* Header */}
              <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-white shrink-0">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">{leadDetail.customerName}</h3>
                  <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                    {leadDetail.email && (
                      <span className="flex items-center gap-1.5"><Mail className="h-4 w-4" /> <a href={`mailto:${leadDetail.email}`} className="hover:text-blue-600 hover:underline">{leadDetail.email}</a></span>
                    )}
                    {leadDetail.phone && (
                      <span className="flex items-center gap-1.5"><Phone className="h-4 w-4" /> <a href={`tel:${leadDetail.phone}`} className="hover:text-blue-600 hover:underline">{leadDetail.phone}</a></span>
                    )}
                    <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {format(new Date(leadDetail.createdAt), 'MMM d, h:mm a')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {leadDetail.email && leadDetail.emailSubject && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      disabled={sendLeadEmail.isPending}
                      onClick={handleResendEmail}
                    >
                      <Send className="h-3.5 w-3.5" />
                      {leadDetail.emailSent ? "Re-send email" : "Send estimate email"}
                    </Button>
                  )}
                  <div className="w-40">
                    <Select value={leadDetail.status} onValueChange={handleStatusChange}>
                      <SelectTrigger className="font-semibold h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New Lead</SelectItem>
                        <SelectItem value="contacted">Contacted</SelectItem>
                        <SelectItem value="won">Job Won</SelectItem>
                        <SelectItem value="lost">Lost / Passed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                <div className="space-y-6">
                  
                  {/* Summary Box */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <h4 className="flex items-center gap-2 font-semibold text-slate-900 mb-3">
                      <FileText className="h-4 w-4 text-blue-500" /> Project Summary
                    </h4>
                    <p className="text-slate-700 leading-relaxed">{leadDetail.requestSummary || leadDetail.projectDescription}</p>
                    
                    {leadDetail.confidenceScore && (
                      <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-sm text-slate-500">Agent Confidence</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500" style={{ width: `${leadDetail.confidenceScore}%` }}></div>
                          </div>
                          <span className="text-sm font-medium text-slate-900">{leadDetail.confidenceScore}%</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* AI Estimate */}
                  {leadDetail.estimate && (
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                      <h4 className="flex items-center gap-2 font-semibold text-slate-900 mb-4">
                        <Calculator className="h-4 w-4 text-emerald-500" /> Agent Estimate Provided
                      </h4>
                      
                      <div className="bg-slate-900 text-white p-4 rounded-lg flex items-center justify-between mb-6">
                        <div>
                          <div className="text-slate-400 text-sm mb-1">Estimated Range</div>
                          <div className="text-2xl font-bold">
                            ${leadDetail.estimatedLow?.toFixed(2)} — ${leadDetail.estimatedHigh?.toFixed(2)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-slate-400 text-sm mb-1">Total w/ Tax</div>
                          <div className="text-xl font-medium text-emerald-400">
                            ${leadDetail.estimate.totalEstimate.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <h5 className="text-sm font-medium text-slate-500 mb-2 uppercase tracking-wider">Line Items</h5>
                          <div className="border border-slate-100 rounded-lg overflow-hidden">
                            <table className="w-full text-sm text-left">
                              <tbody className="divide-y divide-slate-100">
                                {leadDetail.estimate.invoiceLineItems.map((item, i) => (
                                  <tr key={i} className="bg-white">
                                    <td className="px-4 py-3 text-slate-700">{item.description}</td>
                                    <td className="px-4 py-3 text-right font-medium text-slate-900 w-24">${item.total.toFixed(2)}</td>
                                  </tr>
                                ))}
                                <tr className="bg-slate-50">
                                  <td className="px-4 py-3 text-slate-500 text-right">Subtotal</td>
                                  <td className="px-4 py-3 text-right font-medium text-slate-900">${leadDetail.estimate.subtotal.toFixed(2)}</td>
                                </tr>
                                <tr className="bg-slate-50">
                                  <td className="px-4 py-2 text-slate-500 text-right">Taxes</td>
                                  <td className="px-4 py-2 text-right font-medium text-slate-900">${leadDetail.estimate.taxes.toFixed(2)}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                        
                        {leadDetail.estimate.assumptions?.length > 0 && (
                          <div>
                            <h5 className="text-sm font-medium text-slate-500 mb-2 uppercase tracking-wider">Assumptions Made</h5>
                            <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
                              {leadDetail.estimate.assumptions.map((a, i) => <li key={i}>{a}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* AI Conversation snippet */}
                  {leadDetail.aiResponse && (
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                      <h4 className="flex items-center gap-2 font-semibold text-slate-900 mb-3">
                        <MessageSquare className="h-4 w-4 text-purple-500" /> Final Message to Customer
                      </h4>
                      <div className="bg-purple-50 p-4 rounded-lg text-purple-900 text-sm whitespace-pre-wrap">
                        {leadDetail.aiResponse}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </>
          ) : null}
        </Card>
      </div>
    </div>
  );
}