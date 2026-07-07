import { useListBillingPlans, useGetSubscription, useCheckout } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Check, ShieldCheck, Zap, HardHat } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function BillingPage() {
  const { toast } = useToast();
  const { data: plans, isLoading: isLoadingPlans } = useListBillingPlans();
  const { data: subscription, isLoading: isLoadingSub } = useGetSubscription();
  const checkout = useCheckout();

  const handleCheckout = (planId: string) => {
    checkout.mutate({ data: { planId } }, {
      onSuccess: () => {
        toast({
          title: "Simulation Successful",
          description: "In a real app, this would open a Stripe checkout session."
        });
      }
    });
  };

  if (isLoadingPlans || isLoadingSub) {
    return (
      <div className="max-w-5xl mx-auto space-y-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <div className="grid md:grid-cols-3 gap-6">
          <Skeleton className="h-[400px] rounded-xl" />
          <Skeleton className="h-[400px] rounded-xl" />
          <Skeleton className="h-[400px] rounded-xl" />
        </div>
      </div>
    );
  }

  const isSubscribed = subscription?.active;

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in duration-500">
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Billing & Plans</h2>
        <p className="text-slate-500 mt-1">Manage your subscription and billing details.</p>
      </div>

      <Card className="mb-10 border-slate-200 shadow-sm bg-slate-900 text-white">
        <CardContent className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
              {isSubscribed ? <ShieldCheck className="h-6 w-6 text-emerald-400" /> : <HardHat className="h-6 w-6 text-slate-400" />}
            </div>
            <div>
              <h3 className="font-semibold text-lg flex items-center gap-2">
                Current Status
                {isSubscribed ? (
                  <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-none">Active</Badge>
                ) : (
                  <Badge variant="secondary" className="bg-slate-700 text-slate-300 hover:bg-slate-700 border-none">Trial / Free</Badge>
                )}
              </h3>
              <p className="text-slate-400 text-sm mt-1">
                {isSubscribed 
                  ? `You are subscribed to the ${subscription.planName} plan.`
                  : "Upgrade to deploy your agent and start qualifying leads."}
              </p>
            </div>
          </div>
          {isSubscribed && (
            <Button variant="outline" className="bg-slate-800 text-white border-slate-700 hover:bg-slate-700 hover:text-white">
              Manage Billing
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Placeholder cards if API doesn't return anything */}
        {(!plans || plans.length === 0) && (
          <div className="col-span-3 text-center py-12 text-slate-500">
            No billing plans configured in the backend yet.
          </div>
        )}

        {plans?.map((plan) => {
          const isCurrent = subscription?.planId === plan.id && subscription?.active;
          const isAnnual = plan.interval === 'year';
          
          return (
            <Card key={plan.id} className={`flex flex-col border-slate-200 shadow-sm relative ${isCurrent ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}>
              {isAnnual && (
                <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2">
                  <span className="bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider py-1 px-3 rounded-full">
                    Best Value
                  </span>
                </div>
              )}
              
              <CardHeader className="text-center pt-8">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription className="mt-2 h-10">{plan.description}</CardDescription>
                <div className="mt-4 flex items-end justify-center gap-1">
                  <span className="text-4xl font-extrabold text-slate-900">${plan.price}</span>
                  {plan.interval !== 'one-time' && (
                    <span className="text-slate-500 font-medium pb-1">/{plan.interval === 'year' ? 'yr' : 'mo'}</span>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="flex-1">
                <ul className="space-y-3 text-sm text-slate-600 mt-4">
                  <li className="flex items-center gap-3">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Unlimited agent conversations</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Lead qualification & inbox</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Automated estimates/invoices</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Website embed widget</span>
                  </li>
                  {plan.interval === 'one-time' ? (
                    <li className="flex items-center gap-3">
                      <Zap className="h-4 w-4 text-blue-500 shrink-0" />
                      <span className="font-medium text-slate-900">White-glove setup service</span>
                    </li>
                  ) : (
                    <li className="flex items-center gap-3">
                      <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span>Self-serve training sandbox</span>
                    </li>
                  )}
                </ul>
              </CardContent>
              
              <CardFooter>
                <Button 
                  className="w-full" 
                  variant={isCurrent ? "outline" : (isAnnual ? "default" : "secondary")}
                  disabled={isCurrent || checkout.isPending}
                  onClick={() => handleCheckout(plan.id)}
                >
                  {isCurrent ? "Current Plan" : "Select Plan"}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}