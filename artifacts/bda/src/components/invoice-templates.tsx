import { Check } from "lucide-react";

export type InvoiceTemplateId =
  | "simple_summary"
  | "modern_estimate_card"
  | "detailed_agreement"
  | "professional_proposal";

export const TEMPLATE_OPTIONS: {
  id: InvoiceTemplateId;
  name: string;
  tagline: string;
  detailed: boolean;
}[] = [
  {
    id: "simple_summary",
    name: "Simple Summary Invoice",
    tagline: "Short, clean itemized pricing with a brief policy note.",
    detailed: false,
  },
  {
    id: "modern_estimate_card",
    name: "Modern Estimate Card",
    tagline: "Visual card-style estimate that is easy for customers to read.",
    detailed: false,
  },
  {
    id: "detailed_agreement",
    name: "Detailed Service Agreement Invoice",
    tagline: "Full terms, cancellation policy, and acceptance language.",
    detailed: true,
  },
  {
    id: "professional_proposal",
    name: "Detailed Professional Proposal",
    tagline: "Polished proposal layout with complete written terms.",
    detailed: true,
  },
];

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

function SimpleSummary({ data }: { data: InvoiceRenderData }) {
  const { estimate, policies } = data;
  return (
    <div className="bg-white text-xs text-slate-700 p-5 space-y-4">
      <div className="border-b border-slate-200 pb-3">
        <p className="text-base font-bold text-slate-900">{data.businessName}</p>
        <p className="text-slate-500">Estimate / Invoice Preview</p>
      </div>
      <div className="space-y-0.5">
        {data.customerName && (
          <p>
            <span className="text-slate-500">Customer:</span> {data.customerName}
          </p>
        )}
        {data.projectDescription && (
          <p>
            <span className="text-slate-500">Project:</span> {data.projectDescription}
          </p>
        )}
        <p>
          <span className="text-slate-500">Date:</span> {data.date}
        </p>
      </div>
      <div>
        <p className="font-semibold text-slate-900 mb-1">Services Provided:</p>
        <div className="space-y-1">
          {estimate.invoiceLineItems.map((li, i) => (
            <div key={i} className="flex justify-between gap-2">
              <span>
                {i + 1}. {li.description}
              </span>
              <span className="font-medium text-slate-900">{money(li.total)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-slate-200 pt-2 space-y-1">
        <div className="flex justify-between">
          <span className="text-slate-500">Subtotal</span>
          <span>{money(estimate.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Tax</span>
          <span>{money(estimate.taxes)}</span>
        </div>
        <div className="flex justify-between font-bold text-slate-900 text-sm">
          <span>Estimated Total</span>
          <span>{money(estimate.totalEstimate)}</span>
        </div>
        {estimate.recommendedPriceLow != null && (
          <div className="flex justify-between text-slate-500">
            <span>Estimated Range</span>
            <Range estimate={estimate} />
          </div>
        )}
      </div>
      {policies.estimateDisclaimer && (
        <p className="text-slate-500 text-[11px]">{policies.estimateDisclaimer}</p>
      )}
      <p className="text-slate-500 text-[11px]">
        By accepting service, the customer agrees to {data.businessName}&apos;s
        cancellation policy, payment terms, and standard terms and conditions.
      </p>
      <FooterNote note={policies.footerNote} />
    </div>
  );
}

function ModernEstimateCard({ data }: { data: InvoiceRenderData }) {
  const { estimate, policies } = data;
  return (
    <div className="bg-white text-xs text-slate-700">
      <div className="bg-slate-900 text-white p-5">
        <p className="text-base font-bold">{data.businessName}</p>
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
        <p className="text-slate-500 text-[11px]">
          Final pricing may vary based on site conditions, customer changes, or
          additional work requested. Proceeding with service confirms agreement to{" "}
          {data.businessName}&apos;s cancellation policy, payment terms, and service
          conditions.
        </p>
        <FooterNote note={policies.footerNote} />
      </div>
    </div>
  );
}

function DetailedAgreement({ data }: { data: InvoiceRenderData }) {
  const { estimate, policies } = data;
  return (
    <div className="bg-white text-xs text-slate-700 p-5 space-y-4">
      <div className="border-b-2 border-slate-900 pb-3">
        <p className="text-base font-bold text-slate-900">{data.businessName}</p>
        <p className="text-slate-500">Detailed Service Estimate &amp; Agreement</p>
      </div>
      <div>
        <p className="font-semibold text-slate-900 mb-1">Customer Information</p>
        <div className="space-y-0.5 text-slate-600">
          {data.customerName && <p>Customer Name: {data.customerName}</p>}
          {data.customerEmail && <p>Email: {data.customerEmail}</p>}
          {data.customerPhone && <p>Phone: {data.customerPhone}</p>}
          <p>Date: {data.date}</p>
        </div>
      </div>
      {data.projectDescription && (
        <PolicySection title="Project Description" body={data.projectDescription} />
      )}
      <div>
        <p className="font-semibold text-slate-900 mb-1">Services Provided</p>
        <div className="space-y-2">
          {estimate.invoiceLineItems.map((li, i) => (
            <div key={i} className="border border-slate-100 rounded p-2">
              <div className="flex justify-between font-medium text-slate-900">
                <span>
                  {i + 1}. {li.description}
                </span>
                <span>{money(li.total)}</span>
              </div>
              <div className="text-slate-500 mt-0.5">
                {li.quantity != null && <span>Qty / Hours: {li.quantity} </span>}
                {li.unitPrice != null && <span>Rate: {money(li.unitPrice)}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-slate-200 pt-2 space-y-1">
        <div className="flex justify-between">
          <span className="text-slate-500">Subtotal</span>
          <span>{money(estimate.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Tax</span>
          <span>{money(estimate.taxes)}</span>
        </div>
        <div className="flex justify-between font-bold text-slate-900 text-sm">
          <span>Estimated Total</span>
          <span>{money(estimate.totalEstimate)}</span>
        </div>
        {estimate.recommendedPriceLow != null && (
          <div className="flex justify-between text-slate-500">
            <span>Estimated Range</span>
            <Range estimate={estimate} />
          </div>
        )}
      </div>
      <PolicySection title="Payment Terms" body={policies.paymentTerms} />
      {policies.depositRequirements && (
        <PolicySection title="Deposit Requirements" body={policies.depositRequirements} />
      )}
      <PolicySection title="Cancellation Policy" body={policies.cancellationPolicy} />
      <PolicySection title="Terms and Conditions" body={policies.termsConditions} />
      <PolicySection title="Estimate Disclaimer" body={policies.estimateDisclaimer} />
      <PolicySection title="Customer Acceptance" body={policies.acceptanceLanguage} />
      <FooterNote note={policies.footerNote} />
    </div>
  );
}

function ProfessionalProposal({ data }: { data: InvoiceRenderData }) {
  const { estimate, policies } = data;
  return (
    <div className="bg-white text-xs text-slate-700">
      <div className="bg-gradient-to-r from-slate-900 to-slate-700 text-white p-5">
        <p className="text-base font-bold">{data.businessName}</p>
        <p className="text-slate-300">Professional Service Proposal</p>
      </div>
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-slate-400 text-[11px] uppercase tracking-wide">
              Prepared For
            </p>
            <p className="font-medium text-slate-900">
              {data.customerName ?? "Prospective Customer"}
            </p>
            {data.customerEmail && <p className="text-slate-500">{data.customerEmail}</p>}
            {data.customerPhone && <p className="text-slate-500">{data.customerPhone}</p>}
          </div>
          <div>
            <p className="text-slate-400 text-[11px] uppercase tracking-wide">
              Prepared On
            </p>
            <p className="font-medium text-slate-900">{data.date}</p>
          </div>
        </div>
        {estimate.customerSummary && (
          <PolicySection title="Project Overview" body={estimate.customerSummary} />
        )}
        <div>
          <p className="font-semibold text-slate-900 mb-1">Scope of Work</p>
          <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
            {estimate.invoiceLineItems.map((li, i) => (
              <li key={i}>{li.description}</li>
            ))}
          </ul>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
          <p className="font-semibold text-slate-900">Investment Summary</p>
          {estimate.invoiceLineItems.map((li, i) => (
            <div key={i} className="flex justify-between">
              <span className="text-slate-500">{li.description}</span>
              <span>{money(li.total)}</span>
            </div>
          ))}
          <div className="flex justify-between">
            <span className="text-slate-500">Tax</span>
            <span>{money(estimate.taxes)}</span>
          </div>
          <div className="flex justify-between font-bold text-slate-900 text-sm border-t border-slate-200 pt-1 mt-1">
            <span>Estimated Investment</span>
            <span>{money(estimate.totalEstimate)}</span>
          </div>
          {estimate.recommendedPriceLow != null && (
            <div className="flex justify-between text-slate-500">
              <span>Expected Price Range</span>
              <Range estimate={estimate} />
            </div>
          )}
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
        <PolicySection title="Payment Terms" body={policies.paymentTerms} />
        {policies.depositRequirements && (
          <PolicySection
            title="Deposit Requirements"
            body={policies.depositRequirements}
          />
        )}
        <PolicySection
          title="Cancellation &amp; Rescheduling"
          body={policies.cancellationPolicy}
        />
        <PolicySection title="Terms and Conditions" body={policies.termsConditions} />
        <PolicySection title="Final Review Notice" body={policies.estimateDisclaimer} />
        <PolicySection title="Acceptance" body={policies.acceptanceLanguage} />
        <FooterNote note={policies.footerNote} />
      </div>
    </div>
  );
}

export function InvoiceTemplatePreview({
  templateId,
  data,
}: {
  templateId: string;
  data: InvoiceRenderData;
}) {
  switch (templateId) {
    case "simple_summary":
      return <SimpleSummary data={data} />;
    case "detailed_agreement":
      return <DetailedAgreement data={data} />;
    case "professional_proposal":
      return <ProfessionalProposal data={data} />;
    case "modern_estimate_card":
    default:
      return <ModernEstimateCard data={data} />;
  }
}
