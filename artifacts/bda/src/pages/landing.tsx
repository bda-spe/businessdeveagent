import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ShieldCheck, MessageSquare, Calculator, Zap, ArrowRight, Activity, HardHat } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900">
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-slate-900 text-white rounded p-1.5">
              <HardHat className="h-5 w-5" />
            </div>
            <span className="font-bold text-xl tracking-tight">BDA</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/sign-in" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
              Sign In
            </Link>
            <Link href="/sign-up">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="pt-24 pb-32 px-4 relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none mix-blend-overlay"></div>
          
          <div className="container mx-auto max-w-5xl text-center relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-medium mb-6">
              <Zap className="h-4 w-4" />
              <span>For service businesses & trades</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 mb-8 max-w-4xl mx-auto leading-tight">
              Hire a digital employee that works <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">24/7</span>
            </h1>
            <p className="text-xl md:text-2xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
              Business Development Agent (BDA) talks to prospects, qualifies leads, and generates accurate price estimates while you're on the job.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/sign-up">
                <Button size="lg" className="h-14 px-8 text-lg w-full sm:w-auto shadow-xl shadow-blue-900/10">
                  Build Your Agent <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/sign-in">
                <Button variant="outline" size="lg" className="h-14 px-8 text-lg w-full sm:w-auto bg-white">
                  See Demo
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-24 bg-white border-y border-slate-200">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tight mb-4">How BDA works for your business</h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                Stop losing jobs because you couldn't answer the phone. Your agent handles the busywork so you can focus on the actual work.
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-slate-50 p-8 rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-md">
                <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-xl flex items-center justify-center mb-6">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">1. Train on Your Business</h3>
                <p className="text-slate-600 leading-relaxed">
                  Upload your pricing rules, service areas, and business details. The agent learns exactly how you operate.
                </p>
              </div>
              <div className="bg-slate-50 p-8 rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-md">
                <div className="w-12 h-12 bg-indigo-100 text-indigo-700 rounded-xl flex items-center justify-center mb-6">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">2. Qualify Prospects</h3>
                <p className="text-slate-600 leading-relaxed">
                  The agent chats with visitors on your site, asks the right questions, and filters out bad leads automatically.
                </p>
              </div>
              <div className="bg-slate-50 p-8 rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-md">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center mb-6">
                  <Calculator className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">3. Generate Estimates</h3>
                <p className="text-slate-600 leading-relaxed">
                  Provides highly accurate price ranges and detailed invoice line items based on your custom pricing rules.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Teaser */}
        <section className="py-24 bg-slate-900 text-white">
          <div className="container mx-auto px-4 max-w-4xl text-center">
            <h2 className="text-3xl font-bold mb-6">Professional tools, simple pricing.</h2>
            <p className="text-slate-400 text-lg mb-10 max-w-xl mx-auto">
              Start generating more revenue with an AI employee that costs less than a single bad lead.
            </p>
            <div className="inline-block bg-slate-800 p-8 rounded-3xl border border-slate-700 text-left">
              <div className="flex items-center gap-4 mb-6">
                <Activity className="h-8 w-8 text-blue-400" />
                <div>
                  <div className="text-sm font-medium text-slate-400 uppercase tracking-wider">Pro Agent</div>
                  <div className="text-3xl font-bold">$99<span className="text-lg text-slate-500 font-normal">/mo</span></div>
                </div>
              </div>
              <ul className="space-y-3 mb-8 text-slate-300">
                <li className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-emerald-400" /> Unlimited conversations</li>
                <li className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-emerald-400" /> Custom pricing rules</li>
                <li className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-emerald-400" /> Embeddable website widget</li>
              </ul>
              <Link href="/sign-up">
                <Button className="w-full bg-white text-slate-900 hover:bg-slate-100 h-12 text-base">
                  Start Your Build
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-8 bg-slate-950 text-slate-500 text-sm border-t border-slate-800">
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <span className="font-bold text-slate-300">BDA</span> — Business Development Agent
          </div>
          <div>
            &copy; {new Date().getFullYear()} Sean Pelillo Enterprises. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}