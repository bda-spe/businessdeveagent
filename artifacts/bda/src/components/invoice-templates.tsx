import { Check } from "lucide-react";

// There is only one quote template. It always renders the same layout;
// the only thing that changes is whether the full written policies are
// shown (see InvoicePolicyData.showPolicies below).
export type InvoiceTemplateId = "modern_estimate_card";

export interface InvoiceLineItemData {
  description: string;
  quantity?: number | null;
  unitPrice?: number | null;
  total: number;
}

export interface InvoiceEstimateData {
  customerSummary: string;
  assumptions: string[];
  invoiceLineItems: InvoiceLineItemData[];
  subtotal: number;
  taxes: number;
  totalEstimate: number;
  recommendedPriceLow?: number | null;
  recommendedPriceHigh?: number | null;
}

export interface InvoicePolicyData {
  cancellationPolicy?: string | null;
  paymentTerms?: string | null;
  estimateDisclaimer?: string | null;
  termsConditions?: string | null;
  acceptanceLanguage?: string | null;
  depositRequirements?: string | null;
  footerNote?: string | null;
  showPolicies?: boolean;
}

export interface InvoiceRenderData {
  businessName: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  projectDescription?: string;
  date: string;
  estimate: InvoiceEstimateData;
  policies: InvoicePolicyData;
  brandColor?: string;
  logoUrl?: string | null;
  showLogo?: boolean;
}

function logoSrc(objectPath: string): string {
  return `/api/storage${objectPath}`;
}

function money(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "$0.00";
  return `$${n.toFixed(2)}`;
}

function Range({ estimate }: { estimate: InvoiceEstimateData }) {
  if (estimate.recommendedPriceLow == null || estimate.recommendedPriceHigh == null)
    return null;
  return (
    <span>
      {money(estimate.recommendedPriceLow)} – {money(estimate.recommendedPriceHigh)}
    </span>
  );
}

function PolicySection({ title, body }: { title: string; body?: string | null }) {
  if (!body) return null;
  return (
    <div>
      <p className="font-semibold text-slate-900 mb-1">{title}</p>
      <p className="text-slate-600 whitespace-pre-wrap">{body}</p>
    </div>
  );
}

function FooterNote({ note }: { note?: string | null }) {
  if (!note) return null;
  return (
    <p className="text-center text-slate-400 text-[11px] pt-3 border-t border-slate-100">
      {note}
    </p>
  );
}

function ModernEstimateCard({ data }: { data: InvoiceRenderData }) {
  const { estimate, policies } = data;
  const brand = data.brandColor || "#1e3a5f";
  const showLogo = data.showLogo !== false && !!data.logoUrl;
  return (
    <div className="bg-white text-xs text-slate-700">
      <div className="text-white p-5 relative" style={{ backgroundColor: brand }}>
        {showLogo && (
          <div className="absolute top-3 right-3 h-12 w-12 rounded-md bg-white flex items-center justify-center overflow-hidden shrink-0">
            <img
              src={logoSrc(data.logoUrl as string)}
              alt="Company logo"
              className="h-full w-full object-contain"
            />
          </div>
        )}
        <p className="text-base font-bold pr-14">{data.businessName}</p>
        <p className="text-slate-300">Service Estimate</p>
        <div className="mt-3">
          <p className="text-slate-400 text-[11px] uppercase tracking-wide">
            Estimated Total
          </p>
          <p className="text-2xl font-bold">{money(estimate.totalEstimate)}</p>
          {estimate.recommendedPriceLow != null && (
            <p className="text-slate-300">
              Range: <Range estimate={estimate} />
            </p>
          )}
        </div>
      </div>
      <div className="p-5 space-y-4">
        {estimate.customerSummary && (
          <div>
            <p className="font-semibold text-slate-900 mb-1">Project Summary</p>
            <p className="text-slate-600">{estimate.customerSummary}</p>
          </div>
        )}
        <div>
          <p className="font-semibold text-slate-900 mb-1">Included Services</p>
          <div className="space-y-1.5">
            {estimate.invoiceLineItems.map((li, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  {li.description}
                </span>
                <span className="font-medium text-slate-900">{money(li.total)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                Taxes &amp; Fees
              </span>
              <span className="font-medium text-slate-900">{money(estimate.taxes)}</span>
            </div>
          </div>
        </div>
        {estimate.assumptions.length > 0 && (
          <div>
            <p className="font-semibold text-slate-900 mb-1">Assumptions</p>
            <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
              {estimate.assumptions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        )}
        {policies.showPolicies ? (
          <div className="space-y-3">
            <PolicySection title="Payment Terms" body={policies.paymentTerms} />
            {policies.depositRequirements && (
              <PolicySection
                title="Deposit Requirements"
                body={policies.depositRequirements}
              />
            )}
            <PolicySection
              title="Cancellation Policy"
              body={policies.cancellationPolicy}
            />
            <PolicySection
              title="Terms and Conditions"
              body={policies.termsConditions}
            />
            <PolicySection
              title="Estimate Disclaimer"
              body={policies.estimateDisclaimer}
            />
            <PolicySection
              title="Customer Acceptance"
              body={policies.acceptanceLanguage}
            />
          </div>
        ) : (
          <p className="text-slate-500 text-[11px]">
            Final pricing may vary based on site conditions, customer changes,
            or additional work requested. Proceeding with service confirms
            agreement to {data.businessName}&apos;s cancellation policy,
            payment terms, and service conditions.
          </p>
        )}
        <FooterNote note={policies.footerNote} />
      </div>
    </div>
  );
}

export function InvoiceTemplatePreview({ data }: { data: InvoiceRenderData }) {
  return <ModernEstimateCard data={data} />;
}
