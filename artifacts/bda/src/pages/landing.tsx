import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ShieldCheck, MessageSquare, Calculator, Zap, ArrowRight } from "lucide-react";
import logoUrl from "@assets/8028a6ee-e049-488f-91c3-bb2de873b6cf.png";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900">
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <img
            src={logoUrl}
            alt="BDA — Business Development Agent"
            className="h-11 w-auto rounded"
          />
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
            <h1 className="text-5xl md:text-7xl tracking-tight text-slate-900 mb-8 max-w-4xl mx-auto leading-tight font-extrabold">
              Hire a digital employee that works <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">24/7</span>
            </h1>
            <p className="text-xl md:text-2xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
              Business Development Agent (BDA) talks to prospects, qualifies leads, and generates accurate price estimates while you're on the job.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/sign-up">
                <Button size="lg" className="h-14 px-8 text-lg w-full sm:w-auto shadow-xl shadow-blue-900/10">
                  Build Your Agent For Free →
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
                Every visitor to your website is your next job. Your agent greets them instantly, estimates the work, and wins the business — even while you're out on a job site.
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-slate-50 p-8 rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-md">
                <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-xl flex items-center justify-center mb-6">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">1. Train on Your Business</h3>
                <p className="text-slate-600 leading-relaxed">BDA asks about your. businesses service areas, and job details. The agent learns exactly how you operate to provide accurate estimates to secure more clients.</p>
              </div>
              <div className="bg-slate-50 p-8 rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-md">
                <div className="w-12 h-12 bg-indigo-100 text-indigo-700 rounded-xl flex items-center justify-center mb-6">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">2. Qualify Prospects</h3>
                <p className="text-slate-600 leading-relaxed">The agent chats with visitors on your site, asks the right questions, and generates accurate estimates for their needs.</p>
              </div>
              <div className="bg-slate-50 p-8 rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-md">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center mb-6">
                  <Calculator className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">3. Generate More Business</h3>
                <p className="text-slate-600 leading-relaxed">
                  Accurate estimates given in real-time help business win more work without ever having to chase down a lead. Get started today!
                </p>
              </div>
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
        <p className="text-center text-xs text-slate-400 mt-4 max-w-2xl mx-auto leading-relaxed">
          Information regarding our Acceptable Use Policy, AI Disclosure, Legal Notices, Cookie Policy, Copyright & Intellectual Property, Data Processing & Security, Privacy Policy, and Terms of Service can be found{" "}
          <a
            href="https://spelillo.github.io/seanpelilloenterprises/bda.html"
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-blue-400 hover:text-blue-300 cursor-pointer"
          >
            here
          </a>
          .
        </p>
      </footer>
    </div>
  );
}