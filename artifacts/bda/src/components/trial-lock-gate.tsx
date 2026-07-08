import { useGetMe } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export function isSubscriptionLocked(business?: {
  active?: boolean;
  subscriptionStatus?: string;
} | null): boolean {
  if (!business) return false;
  return business.active === false || business.subscriptionStatus === "expired";
}

export default function TrialLockGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: me, isLoading } = useGetMe();
  const [, setLocation] = useLocation();

  if (!isLoading && isSubscriptionLocked(me?.business)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <Lock className="h-6 w-6 text-slate-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            Your free trial has ended.
          </h2>
          <p className="mt-2 text-slate-600">
            Keep access to your Business Development Agent by selecting a
            subscription plan.
          </p>
          <Button className="mt-6" onClick={() => setLocation("/billing")}>
            View Plans
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
