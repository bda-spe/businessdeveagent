import { useGetDashboardSummary, useListActivity } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, Users, DollarSign, MessageSquare, Clock, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function DashboardPage() {
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: activities, isLoading: isLoadingActivity } = useListActivity();

  if (isLoadingSummary || isLoadingActivity) {
    return (
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Agent Overview</h2>
          <p className="text-slate-500 mt-1">Here's how your business development agent is performing.</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex flex-col">
            <span className="text-xs font-medium text-slate-500 uppercase">Agent Status</span>
            <div className="flex items-center gap-2 mt-0.5">
              <div className={`w-2 h-2 rounded-full ${summary.bdaStatus === 'live' ? 'bg-emerald-500' : summary.bdaStatus === 'training' ? 'bg-blue-500' : 'bg-amber-500'}`}></div>
              <span className="text-sm font-bold capitalize text-slate-900">{summary.bdaStatus}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-500">Leads Generated</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900" data-testid="text-leads-generated">{summary.leadsGenerated}</div>
            <p className="text-xs text-slate-500 mt-1">This month</p>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-500">Revenue Influenced</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900" data-testid="text-revenue-influenced">${summary.revenueInfluenced.toLocaleString()}</div>
            <p className="text-xs text-slate-500 mt-1">Estimated value</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-500">Conversations</CardTitle>
            <MessageSquare className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900" data-testid="text-conversations">{summary.conversationsThisMonth}</div>
            <p className="text-xs text-slate-500 mt-1">Active chats</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-slate-200 flex flex-col">
        <CardHeader>
          <CardTitle className="text-lg">Recent Activity</CardTitle>
          <CardDescription>Latest actions and lead generation.</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto max-h-[300px]">
          {activities && activities.length > 0 ? (
            <div className="space-y-6">
              {activities.map((activity, index) => (
                <div key={activity.id} className="flex gap-4 relative">
                  {index !== activities.length - 1 && (
                    <div className="absolute left-[11px] top-6 bottom-[-24px] w-[2px] bg-slate-100"></div>
                  )}
                  <div className="w-6 h-6 rounded-full bg-blue-50 border-2 border-white flex items-center justify-center shrink-0 z-10">
                    {activity.type === 'lead_generated' ? <Users className="h-3 w-3 text-blue-600" /> : 
                     activity.type === 'document_scanned' ? <FileText className="h-3 w-3 text-purple-600" /> :
                     <Activity className="h-3 w-3 text-slate-600" />}
                  </div>
                  <div className="flex flex-col flex-1 pb-1">
                    <span className="text-sm text-slate-900">{activity.description}</span>
                    <span className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <Activity className="h-10 w-10 text-slate-200 mb-3" />
              <p className="text-sm font-medium text-slate-900">No activity yet</p>
              <p className="text-xs text-slate-500 mt-1">Activities will appear here once your agent starts working.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
