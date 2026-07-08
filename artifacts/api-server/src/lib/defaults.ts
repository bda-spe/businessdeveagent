export const DEFAULT_REQUIREMENTS: { key: string; label: string }[] = [
  { key: "business_info", label: "Business information" },
  { key: "services", label: "Services offered" },
  { key: "pricing", label: "Pricing rules" },
  { key: "service_area", label: "Service area" },
  { key: "availability", label: "Availability and hours" },
  { key: "policies", label: "Policies and guarantees" },
  { key: "brand_voice", label: "Brand voice and tone" },
  { key: "faqs", label: "Common customer questions" },
];

export const DEFAULT_INVOICE_LANGUAGE = {
  cancellationPolicy:
    "Appointments may be cancelled or rescheduled up to 24 hours in advance at no charge. Cancellations with less than 24 hours notice may incur a cancellation fee of up to 50% of the scheduled service cost.",
  paymentTerms:
    "Payment is due upon completion of service unless otherwise agreed in writing. We accept cash, check, and major credit cards. Invoices unpaid after 15 days may be subject to a late fee.",
  estimateDisclaimer:
    "This estimate is based on the information provided by the customer and is intended as preliminary pricing. Final pricing may change after inspection, measurement, material review, or changes to project scope.",
  termsConditions:
    "All work is performed by trained professionals in accordance with applicable local codes and standards. Workmanship is guaranteed for 90 days from the date of service. Materials are covered by their respective manufacturer warranties. Any additional work outside the agreed scope will be quoted separately before proceeding.",
  acceptanceLanguage:
    "By approving this estimate or scheduling service, the customer acknowledges and agrees to the payment terms, cancellation policy, service conditions, and terms and conditions stated herein.",
  depositRequirements:
    "Projects over $1,000 may require a deposit of up to 30% before work is scheduled. Deposits are applied to the final invoice.",
  footerNote: "Thank you for your business. We look forward to serving you.",
};

export const ALL_INVOICE_SECTIONS = [
  "labor",
  "materials",
  "travel_mobilization",
  "taxes_fees",
  "discounts",
  "emergency_fees",
  "estimated_duration",
  "assumptions",
  "follow_up_questions",
  "cancellation_policy",
  "payment_terms",
  "terms_conditions",
  "estimate_disclaimer",
  "acceptance_language",
];

// Preliminary-estimate disclaimer shown with every quote output (widget
// result, PDF, emails, Test Agent). Keep the user-facing term "Quote".
export const PRELIMINARY_ESTIMATE_DISCLAIMER =
  "This quote is a preliminary estimate based on the information provided. It is not a final service agreement. Final pricing may change after review, inspection, measurement, material confirmation, or changes to project scope.";

// Generic industry-default budget options used only when a business has no
// usable pricing profile (low/avg/high job costs). A server log records when
// this fallback is used.
export const FALLBACK_BUDGET_RANGES = [
  "Under $250",
  "$250-$500",
  "$500-$1,000",
  "$1,000-$2,500",
  "$2,500-$5,000",
  "$5,000+",
  "Not sure",
];

export const DEFAULT_EMAIL_SETTINGS = {
  emailSubject: "Your estimate from {business_name}",
  emailGreeting: "Hi {customer_name},",
  emailBodyText:
    "Thank you for reaching out. Based on the details you shared, we have prepared a preliminary estimate for your project. Please find it below, along with our standard terms. If anything looks off or you have questions, just reply to this email.",
  emailClosing: "Best regards,\nThe team at {business_name}",
  replyToEmail: null as string | null,
  ccOwner: true,
  attachPdf: true,
  brandColor: "#1e3a5f",
};

export const SETUP_FEE = 29;

export const BILLING_PLANS: {
  id: string;
  name: string;
  price: number;
  interval: string;
  description: string;
  setupFee: number;
}[] = [
  {
    id: "monthly",
    name: "Monthly",
    price: 99,
    interval: "month",
    description: "Full BDA access billed monthly.",
    setupFee: SETUP_FEE,
  },
  {
    id: "yearly",
    name: "Yearly",
    price: 799,
    interval: "year",
    description: "Full BDA access billed annually. Save over monthly.",
    setupFee: SETUP_FEE,
  },
];
