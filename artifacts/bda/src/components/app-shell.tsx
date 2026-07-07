import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useClerk } from "@clerk/react";
import { useGetMe } from "@workspace/api-client-react";
import { HardHat, LayoutDashboard, Building2, Wrench, DollarSign, ListChecks, FileText, BrainCircuit, Users, Puzzle, CreditCard, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppShell({ children }: { children?: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { signOut } = useClerk();
  
  // Only query once the user is signed in (which is guaranteed by the ProtectedApp router component)
  const { data: me, isLoading } = useGetMe();

  useEffect(() => {
    if (!isLoading && me) {
      if (!me.business || !me.onboardingComplete) {
        setLocation("/onboarding");
      }
    }
  }, [me, isLoading, setLocation]);

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

  const navItems: { href: string; label: string; icon: typeof LayoutDashboard }[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/leads", label: "Leads Inbox", icon: Users },
    { href: "/training", label: "Sandbox Test", icon: BrainCircuit },
    { href: "/business", label: "Business Profile", icon: Building2 },
    { href: "/services", label: "Services", icon: Wrench },
    { href: "/pricing", label: "Pricing Rules", icon: DollarSign },
    { href: "/requirements", label: "Requirements", icon: ListChecks },
    { href: "/knowledge", label: "Knowledge Base", icon: FileText },
    { href: "/widget", label: "Widget Settings", icon: Puzzle },
    { href: "/billing", label: "Billing", icon: CreditCard },
  ];

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col fixed inset-y-0 left-0 z-10">
        <div className="h-16 flex items-center px-6 border-b border-slate-800 bg-slate-950 text-white">
          <div className="flex items-center gap-2">
            <HardHat className="h-5 w-5 text-blue-400" />
            <span className="font-bold text-lg tracking-tight">BDA</span>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto py-6 px-3">
          <div className="mb-6 px-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Agent Management</p>
            <div className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.href;
                return (
                  <Link key={item.href} href={item.href}>
                    <span
                      data-active={isActive}
                      className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-slate-800 hover:text-white data-[active=true]:bg-blue-600 data-[active=true]:text-white cursor-pointer"
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
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
            {navItems.find((item) => item.href === location)?.label ?? "Dashboard"}
          </h1>
        </header>
        <div className="p-8">
          {children || <div className="text-slate-500">Select a page from the sidebar.</div>}
        </div>
      </main>
    </div>
  );
}