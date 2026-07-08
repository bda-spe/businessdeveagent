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
  Puzzle,
  CreditCard,
  LogOut,
  LayoutDashboard,
  Lock,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import AssistantChat from "@/components/assistant-chat";
import logoUrl from "@assets/header-dashboard.png";

export default function AppShell({ children }: { children?: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { signOut } = useClerk();

  // Only query once the user is signed in (which is guaranteed by the ProtectedApp router component)
  const { data: me, isLoading } = useGetMe();

  const sp = me?.setupProgress;

  const setupSteps = [
    { href: "/business", label: "Business Profile", icon: Building2, done: !!sp?.businessProfile },
    { href: "/services", label: "Services", icon: Wrench, done: !!sp?.services },
    { href: "/pricing", label: "Pricing Rules", icon: DollarSign, done: !!sp?.pricing },
    { href: "/invoice-formatting", label: "Quote Formatting", icon: FileText, done: !!sp?.invoiceFormatting },
    { href: "/training", label: "Test Agent", icon: BrainCircuit, done: !!sp?.testAgent },
    { href: "/widget", label: "Widget Settings", icon: Puzzle, done: !!sp?.widget },
  ];

  const firstIncompleteIndex = setupSteps.findIndex((s) => !s.done);
  const allSetupDone = firstIncompleteIndex === -1;

  const setupItems = setupSteps.map((step, index) => ({
    ...step,
    locked: firstIncompleteIndex !== -1 && index > firstIncompleteIndex,
  }));

  const operateItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, locked: !allSetupDone },
    { href: "/leads", label: "Leads Inbox", icon: Users, locked: !allSetupDone },
    { href: "/billing", label: "Billing", icon: CreditCard, locked: !allSetupDone },
  ];

  const allItems = [...setupItems, ...operateItems];

  useEffect(() => {
    if (!isLoading && me) {
      if (!me.business || !me.onboardingComplete) {
        setLocation("/onboarding");
      }
    }
  }, [me, isLoading, setLocation]);

  // If the current route is locked, send the user to the next step in the setup flow.
  const currentItem = allItems.find((item) => item.href === location);
  const nextStepHref =
    firstIncompleteIndex === -1 ? "/dashboard" : setupSteps[firstIncompleteIndex].href;
  const shouldRedirectToNextStep = !isLoading && !!me?.business && !!currentItem?.locked;

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

  // If we're redirecting to onboarding, don't flash the shell
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
    done?: boolean;
  }) => {
    const Icon = item.icon;
    if (item.locked) {
      return (
        <span
          key={item.href}
          aria-disabled="true"
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-slate-600 opacity-50 cursor-not-allowed select-none"
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
          {item.done && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
        </span>
      </Link>
    );
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col fixed inset-y-0 left-0 z-10">
        <div className="h-16 flex items-center px-4 border-b border-slate-800 bg-slate-950">
          <Link href="/">
            <img
              src={logoUrl}
              alt="BDA — Business Development Agent"
              className="h-10 w-auto rounded opacity-[1] rounded-tl-[4px] rounded-tr-[4px] rounded-br-[4px] rounded-bl-[4px] mt-[0px] mb-[0px] ml-[-1px] mr-[-1px] cursor-pointer"
            />
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-3">
          <div className="px-3">
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
