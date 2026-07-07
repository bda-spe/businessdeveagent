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

export const BILLING_PLANS: {
  id: string;
  name: string;
  price: number;
  interval: string;
  description: string;
}[] = [
  {
    id: "monthly",
    name: "Monthly",
    price: 99,
    interval: "month",
    description: "Full BDA access billed monthly.",
  },
  {
    id: "yearly",
    name: "Yearly",
    price: 799,
    interval: "year",
    description: "Full BDA access billed annually. Save over monthly.",
  },
  {
    id: "build_fee",
    name: "One-time build fee",
    price: 129,
    interval: "one-time",
    description: "Initial agent build and setup.",
  },
];
