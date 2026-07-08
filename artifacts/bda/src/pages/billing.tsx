import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import {
  useListBillingPlans,
  useGetSubscription,
  useCheckout,
  useConfirmCheckout,
  useGetMe,
  getGetSubscriptionQueryKey,
} from "@workspace/api-client-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Check, ShieldCheck, HardHat, Loader2, Clock, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function trialDaysRemaining(trialEndsAt?: string | null): number | null {
  if (!trialEndsAt) return null;
  const iso = trialEndsAt.includes("T")
    ? trialEndsAt
    : trialEndsAt.replace(" ", "T");
  const hasZone = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(iso);
  const end = new Date(hasZone ? iso : `${iso}Z`).getTime();
  if (Number.isNaN(end)) return null;
  return Math.max(0, Math.ceil((end - Date.now()) / 86_400_000));
}

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as
  | string
  | undefined;
const stripePromise = stripePublishableKey
  ? loadStripe(stripePublishableKey)
  : null;

type CheckoutState = {
  clientSecret: string;
  sessionId: string;
  planName: string;
};

export default function BillingPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: plans, isLoading: isLoadingPlans } = useListBillingPlans();
  const { data: subscription, isLoading: isLoadingSub } = useGetSubscription();
  const { data: me } = useGetMe();
  const checkout = useCheckout();
  const confirmCheckout = useConfirmCheckout();

  const [checkoutState, setCheckoutState] = useState<CheckoutState | null>(
    null,
  );
  const [paymentComplete, setPaymentComplete] = useState(false);

  const handleCheckout = (planId: string, planName: string) => {
    if (!stripePromise) {
      toast({
        title: "Billing unavailable",
        description:
          "Payment configuration is missing. Please contact support.",
        variant: "destructive",
      });
      return;
    }
    checkout.mutate(
      { data: { planId } },
      {
        onSuccess: (data) => {
          setPaymentComplete(false);
          setCheckoutState({
            clientSecret: data.clientSecret,
            sessionId: data.sessionId,
            planName,
          });
        },
        onError: () => {
          toast({
            title: "Could not start checkout",
            description: "Something went wrong. Please try again.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleCheckoutComplete = (sessionId: string) => {
    setPaymentComplete(true);
    confirmCheckout.mutate(
      { data: { sessionId } },
      {
        onSettled: () => {
          queryClient.invalidateQueries({
            queryKey: getGetSubscriptionQueryKey(),
          });
          queryClient.invalidateQueries();
        },
        onSuccess: () => {
          toast({
            title: "Subscription active",
            description: "Your payment was successful. Welcome aboard!",
          });
        },
      },
    );
  };

  const closeCheckout = () => {
    setCheckoutState(null);
    setPaymentComplete(false);
  };

  if (isLoadingPlans || isLoadingSub) {
    return (
      <div className="max-w-5xl mx-auto space-y-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="h-[400px] rounded-xl" />
          <Skeleton className="h-[400px] rounded-xl" />
        </div>
      </div>
    );
  }

  const isSubscribed = subscription?.active;
  const business = me?.business;
  const subStatus = business?.subscriptionStatus;
  const isTrialing = !isSubscribed && subStatus === "trialing";
  const daysRemaining = isTrialing
    ? trialDaysRemaining(business?.trialEndsAt)
    : null;
  const isTrialOver =
    !isSubscribed &&
    (subStatus === "expired" ||
      subStatus === "canceled" ||
      subStatus === "past_due" ||
      (isTrialing && daysRemaining === 0));

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in duration-500">
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">
          Billing & Plans
        </h2>
        <p className="text-slate-500 mt-1">
          Manage your subscription and billing details.
        </p>
      </div>

      <Card className="mb-10 border-slate-200 shadow-sm bg-slate-900 text-white">
        <CardContent className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
              {isSubscribed ? (
                <ShieldCheck className="h-6 w-6 text-emerald-400" />
              ) : isTrialOver ? (
                <AlertTriangle className="h-6 w-6 text-amber-400" />
              ) : isTrialing ? (
                <Clock className="h-6 w-6 text-blue-400" />
              ) : (
                <HardHat className="h-6 w-6 text-slate-400" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-lg flex items-center gap-2">
                {isSubscribed
                  ? "Current Status"
                  : isTrialOver
                    ? "Your free trial has ended."
                    : isTrialing
                      ? "Free Trial"
                      : "Current Status"}
                {isSubscribed ? (
                  <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-none">
                    Active
                  </Badge>
                ) : isTrialOver ? (
                  <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-none">
                    Expired
                  </Badge>
                ) : isTrialing && daysRemaining != null ? (
                  <Badge className="bg-blue-500 hover:bg-blue-600 text-white border-none">
                    {daysRemaining} {daysRemaining === 1 ? "day" : "days"}{" "}
                    remaining
                  </Badge>
                ) : (
                  <Badge
                    variant="secondary"
                    className="bg-slate-700 text-slate-300 hover:bg-slate-700 border-none"
                  >
                    Trial / Free
                  </Badge>
                )}
              </h3>
              <p className="text-slate-400 text-sm mt-1">
                {isSubscribed
                  ? `You are subscribed to the ${subscription.planName} plan.`
                  : isTrialOver
                    ? "Purchase a subscription below to reactivate your Business Development Agent. Your widget, settings, and leads are all saved."
                    : isTrialing
                      ? "You're on a free trial. Pick a plan below to keep your agent running after it ends."
                      : "Upgrade to deploy your agent and start qualifying leads."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {(!plans || plans.length === 0) && (
          <div className="col-span-2 text-center py-12 text-slate-500">
            No billing plans configured in the backend yet.
          </div>
        )}

        {plans?.map((plan) => {
          const isCurrent =
            subscription?.planId === plan.id && subscription?.active;
          const isAnnual = plan.interval === "year";

          return (
            <Card
              key={plan.id}
              className={`flex flex-col border-slate-200 shadow-sm relative ${isCurrent ? "ring-2 ring-blue-500 border-blue-500" : ""}`}
            >
              {isAnnual && (
                <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2">
                  <span className="bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider py-1 px-3 rounded-full">
                    Best Value
                  </span>
                </div>
              )}

              <CardHeader className="text-center pt-8">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription className="mt-2 h-10">
                  {plan.description}
                </CardDescription>
                <div className="mt-4 flex items-end justify-center gap-1">
                  <span className="text-4xl font-extrabold text-slate-900">
                    ${plan.price}
                  </span>
                  <span className="text-slate-500 font-medium pb-1">
                    /{isAnnual ? "yr" : "mo"}
                  </span>
                </div>
                {plan.setupFee != null && plan.setupFee > 0 && (
                  <p className="text-xs text-slate-500 mt-2">
                    + ${plan.setupFee} one-time setup fee (first purchase only)
                  </p>
                )}
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
                    <span>Automated estimates/quotes</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Website embed widget</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Self-serve training sandbox</span>
                  </li>
                </ul>
              </CardContent>

              <CardFooter>
                <Button
                  className="w-full"
                  variant={
                    isCurrent ? "outline" : isAnnual ? "default" : "secondary"
                  }
                  disabled={isCurrent || checkout.isPending}
                  onClick={() => handleCheckout(plan.id, plan.name)}
                >
                  {checkout.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {isCurrent ? "Current Plan" : "Select Plan"}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <Dialog
        open={checkoutState !== null}
        onOpenChange={(open) => {
          if (!open) closeCheckout();
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {paymentComplete
                ? "Payment successful"
                : `Subscribe to ${checkoutState?.planName ?? ""}`}
            </DialogTitle>
            <DialogDescription>
              {paymentComplete
                ? "Your subscription is now active."
                : "Complete your payment securely below. You will not leave this page."}
            </DialogDescription>
          </DialogHeader>

          {paymentComplete ? (
            <div className="py-8 flex flex-col items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                <ShieldCheck className="h-7 w-7 text-emerald-600" />
              </div>
              {confirmCheckout.isPending ? (
                <p className="text-slate-500 text-sm flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Finalizing your subscription…
                </p>
              ) : (
                <p className="text-slate-600 text-sm">
                  You're all set. Your agent is now live.
                </p>
              )}
              <Button onClick={closeCheckout} className="mt-2">
                Done
              </Button>
            </div>
          ) : (
            checkoutState &&
            stripePromise && (
              <EmbeddedCheckoutProvider
                stripe={stripePromise}
                options={{
                  clientSecret: checkoutState.clientSecret,
                  onComplete: () =>
                    handleCheckoutComplete(checkoutState.sessionId),
                }}
              >
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            )
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
