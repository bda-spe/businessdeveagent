import { Link } from "wouter";
import { cn } from "@/lib/utils";

/** Privacy/Terms links shown in every page footer, per our compliance checklist. */
export default function LegalFooterLinks({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs text-slate-500", className)}>
      <Link href="/privacy" className="underline hover:opacity-75">
        Privacy Policy
      </Link>
      <span className="mx-2">&middot;</span>
      <Link href="/terms" className="underline hover:opacity-75">
        Terms of Service
      </Link>
    </p>
  );
}
