import { Link } from "wouter";
import logoUrl from "@assets/8028a6ee-e049-488f-91c3-bb2de873b6cf.png";

export default function LegalPageLayout({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900">
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/">
            <img
              src={logoUrl}
              alt="BDA — Business Development Agent"
              className="h-11 w-auto rounded cursor-pointer"
            />
          </Link>
          <Link href="/" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
            Back to home
          </Link>
        </div>
      </header>
      <main className="flex-1">
        <div className="container mx-auto max-w-3xl px-4 py-16">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 mb-2">
            {title}
          </h1>
          <p className="text-sm text-slate-500 mb-10">Last updated: {lastUpdated}</p>
          <div className="space-y-10 text-slate-700 leading-relaxed [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-slate-900 [&_h2]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_p]:mb-3">
            {children}
          </div>
        </div>
      </main>
      <footer className="py-8 bg-slate-950 text-slate-500 text-sm border-t border-slate-800">
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <span className="font-bold text-slate-300">BDA</span> — Business Development Agent
          </div>
          <div>&copy; {new Date().getFullYear()} Sean Pelillo Enterprises. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
