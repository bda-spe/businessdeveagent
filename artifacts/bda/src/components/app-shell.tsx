import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useClerk } from "@clerk/react";
import { useGetMe } from "@workspace/api-client-react";
import {
  Building2,
  Wrench,
  DollarSign,
  FileText,
  BrainCircuit,
  Users,
  CreditCard,
  LogOut,
  LayoutDashboard,
  Lock,
  CheckCircle2,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import AssistantChat from "@/components/assistant-chat";
import logoUrl from "@assets/header-dashboard.png";
import { isSubscriptionLocked } from "@/components/trial-lock-gate";

export default function AppShell({ children }: { children?: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { signOut } = useClerk();

  const { data: me, isLoading } = useGetMe();

  const sp = me?.setupProgress;
  const subLocked = isSubscriptionLocked(me?.business);

  const setupSteps = [
    { href: "/business", label: "Business Profile", icon: Building2, done: !!sp?.businessProfile },
    { href: "/services", label: "Services", icon: Wrench, done: !!sp?.services },
    { href: "/pricing", label: "Pricing Rules", icon: DollarSign, done: !!sp?.pricing },
    { href: "/invoice-formatting", label: "Estimate Formatting", icon: FileText, done: !!sp?.invoiceFormatting },
    { href: "/agent-settings", label: "Agent Settings", icon: BrainCircuit, done: !!sp?.testAgent && !!sp?.widget },
  ];

  const firstIncompleteIndex = setupSteps.findIndex((s) => !s.done);
  const allSetupDone = firstIncompleteIndex === -1;

  // Setup-step locking (incomplete prereqs) is suppressed when the subscription
  // is locked — the gate card explains the situation better than redirecting.
  const setupItems = setupSteps.map((step, index) => ({
    ...step,
    locked: !subLocked && firstIncompleteIndex !== -1 && index > firstIncompleteIndex,
    subLocked: subLocked,
  }));

  const operateItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, locked: !subLocked && !allSetupDone, subLocked },
    { href: "/leads", label: "Leads Inbox", icon: Users, locked: !subLocked && !allSetupDone, subLocked },
    { href: "/billing", label: "Billing", icon: CreditCard, locked: false, subLocked: false },
  ];

  const allItems = [...setupItems, ...operateItems];

  useEffect(() => {
    if (!isLoading && me) {
      if (!me.business || !me.onboardingComplete) {
        setLocation("/onboarding");
      }
    }
  }, [me, isLoading, setLocation]);

  // Only redirect for setup-step locks (not subscription locks — TrialLockGate handles those)
  const currentItem = allItems.find((item) => item.href === location);
  const nextStepHref =
    firstIncompleteIndex === -1 ? "/dashboard" : setupSteps[firstIncompleteIndex].href;
  const shouldRedirectToNextStep = !isLoading && !!me?.business && !!currentItem?.locked && !subLocked;

  useEffect(() => {
    if (shouldRedirectToNextStep) {
      setLocation(nextStepHref);
    }
  }, [shouldRedirectToNextStep, nextStepHref, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-900 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!me?.business || !me?.onboardingComplete) {
    return null;
  }

  if (shouldRedirectToNextStep) {
    return null;
  }

  const renderNavItem = (item: {
    href: string;
    label: string;
    icon: typeof Building2;
    locked: boolean;
    subLocked?: boolean;
    done?: boolean;
  }) => {
    const Icon = item.icon;
    const isSubLocked = item.subLocked && item.href !== "/billing";

    if (item.locked || isSubLocked) {
      return (
        <span
          key={item.href}
          aria-disabled="true"
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-slate-600 opacity-40 cursor-not-allowed select-none"
          data-testid={`nav-locked-${item.href.slice(1)}`}
        >
          <Icon className="h-4 w-4" />
          <span className="flex-1">{item.label}</span>
          <Lock className="h-3.5 w-3.5" />
        </span>
      );
    }
    const isActive = location === item.href;
    return (
      <Link key={item.href} href={item.href}>
        <span
          data-active={isActive}
          data-testid={`nav-${item.href.slice(1)}`}
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-slate-800 hover:text-white data-[active=true]:bg-blue-600 data-[active=true]:text-white cursor-pointer"
        >
          <Icon className="h-4 w-4" />
          <span className="flex-1">{item.label}</span>
          {item.done && !subLocked && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
        </span>
      </Link>
    );
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col fixed inset-y-0 left-0 z-10">
        <div className="h-16 flex items-center px-4 border-b border-slate-800 bg-slate-950">
          <a href="/landing" target="_blank" rel="noopener noreferrer">
            <img
              src={logoUrl}
              alt="BDA — Business Development Agent"
              className="h-10 w-auto rounded opacity-[1] rounded-tl-[4px] rounded-tr-[4px] rounded-br-[4px] rounded-bl-[4px] mt-[0px] mb-[0px] ml-[-1px] mr-[-1px] cursor-pointer"
            />
          </a>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-3">
          <div className="px-3">
            {subLocked && (
              <div className="mb-4 px-3 py-2 rounded-md bg-amber-900/40 border border-amber-700/50">
                <p className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                  <Lock className="h-3 w-3" /> Account Inactive
                </p>
                <p className="text-xs text-amber-300/80 mt-0.5">Visit Billing to reactivate.</p>
              </div>
            )}
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Agent Management
            </p>
            <div className="space-y-1">{setupItems.map(renderNavItem)}</div>

            <hr className="my-4 border-slate-800" />

            <div className="space-y-1">{operateItems.map(renderNavItem)}</div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-950">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-medium text-sm">
              {me.user.ownerName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{me.business?.name}</p>
              <p className="text-xs text-slate-500 truncate">{me.user.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-slate-400 hover:text-white hover:bg-slate-800"
            onClick={() => signOut({ redirectUrl: "/" })}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>
      {/* Main Content */}
      <main className="flex-1 ml-64 min-h-screen">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-8 sticky top-0 z-10">
          <h1 className="text-lg font-semibold text-slate-900">
            {allItems.find((item) => item.href === location)?.label ?? "BDA"}
          </h1>
        </header>
        <div className="p-8">
          <div className="flex flex-col xl:flex-row gap-8 items-start">
            <div className="flex-1 min-w-0 w-full">{children}</div>
            <div className="w-full xl:w-80 shrink-0 space-y-6 xl:sticky xl:top-24">
              <AssistantChat />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
