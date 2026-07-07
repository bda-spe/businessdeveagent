import OpenAI from "openai";
import { logger } from "./logger";

const apiKey = process.env.OPENAI_API_KEY;
const client = apiKey ? new OpenAI({ apiKey }) : null;
const MODEL = "gpt-4o";

export const INITIAL_INTERVIEW_MESSAGE = `Hi — I'll help build your Business Development Agent by learning how your business operates. To make your BDA useful on your website, I need to capture the details a real front-office employee would need before answering customers, qualifying leads, or preparing estimates.

Please tell me what you can about:

1. Basic Business Info
- Business name
- Industry
- Website
- Phone number
- Email
- Business address
- Service area / cities / zip codes

2. Company Operations
- Residential, commercial, or both
- Number of employees
- Years in business
- Normal business hours
- Emergency / after-hours availability
- Seasonal availability
- Typical response time

3. Services Offered
- Main services
- Add-on services
- Services you do not offer
- Most common customer requests
- Jobs that require inspection before pricing

4. Pricing & Rates
- Labor rate
- Minimum job charge
- Travel or mobilization fees
- Material markup
- Weekend / emergency fees
- Cancellation fees
- Deposit requirements
- Tax rate, if applicable

5. Policies
- Payment terms
- Cancellation policy
- Warranty / guarantee policy
- Refund policy
- Weather delay policy
- Customer responsibilities before service

6. Estimate Rules
- What information you need before quoting
- What questions your BDA should ask customers
- When it should give a price range
- When it should recommend an on-site visit
- Any wording or disclaimers you want included

7. Business Tone
- Professional, friendly, casual, premium, technical, etc.
- Any phrases you like or dislike
- How your company should sound to customers

You can answer all at once, or just start with what you know. After each message, I'll summarize what I captured and show what's still missing.`;

export interface ProfileField {
  key: string;
  label: string;
  group: string;
  required: boolean;
}

export const PROFILE_FIELDS: ProfileField[] = [
  { key: "businessName", label: "Business Name", group: "Basic Business Info", required: true },
  { key: "industry", label: "Industry", group: "Basic Business Info", required: true },
  { key: "website", label: "Website", group: "Basic Business Info", required: false },
  { key: "phone", label: "Phone", group: "Basic Business Info", required: true },
  { key: "email", label: "Email", group: "Basic Business Info", required: true },
  { key: "businessAddress", label: "Business Address", group: "Basic Business Info", required: false },
  { key: "serviceArea", label: "Service Area", group: "Basic Business Info", required: true },
  { key: "customerType", label: "Customer Type", group: "Company Operations", required: true },
  { key: "numberOfEmployees", label: "Number of Employees", group: "Company Operations", required: false },
  { key: "yearsInBusiness", label: "Years in Business", group: "Company Operations", required: false },
  { key: "businessHours", label: "Business Hours", group: "Company Operations", required: true },
  { key: "emergencyAvailability", label: "Emergency / After-Hours Availability", group: "Company Operations", required: false },
  { key: "seasonalAvailability", label: "Seasonal Availability", group: "Company Operations", required: false },
  { key: "typicalResponseTime", label: "Typical Response Time", group: "Company Operations", required: false },
  { key: "mainServices", label: "Main Services", group: "Services Offered", required: true },
  { key: "addOnServices", label: "Add-On Services", group: "Services Offered", required: false },
  { key: "servicesNotOffered", label: "Services Not Offered", group: "Services Offered", required: false },
  { key: "commonCustomerRequests", label: "Common Customer Requests", group: "Services Offered", required: false },
  { key: "jobsRequiringInspection", label: "Jobs Requiring Inspection", group: "Services Offered", required: false },
  { key: "laborRate", label: "Labor Rate", group: "Pricing & Rates", required: true },
  { key: "minimumJobCharge", label: "Minimum Job Charge", group: "Pricing & Rates", required: false },
  { key: "travelFees", label: "Travel / Mobilization Fees", group: "Pricing & Rates", required: false },
  { key: "materialMarkup", label: "Material Markup", group: "Pricing & Rates", required: false },
  { key: "weekendEmergencyFees", label: "Weekend / Emergency Fees", group: "Pricing & Rates", required: false },
  { key: "cancellationFees", label: "Cancellation Fees", group: "Pricing & Rates", required: false },
  { key: "depositRequirements", label: "Deposit Requirements", group: "Pricing & Rates", required: false },
  { key: "taxRate", label: "Tax Rate", group: "Pricing & Rates", required: false },
  { key: "paymentTerms", label: "Payment Terms", group: "Policies", required: true },
  { key: "cancellationPolicy", label: "Cancellation Policy", group: "Policies", required: false },
  { key: "warrantyPolicy", label: "Warranty / Guarantee Policy", group: "Policies", required: false },
  { key: "refundPolicy", label: "Refund Policy", group: "Policies", required: false },
  { key: "weatherDelayPolicy", label: "Weather Delay Policy", group: "Policies", required: false },
  { key: "customerResponsibilities", label: "Customer Responsibilities", group: "Policies", required: false },
  { key: "estimateRules", label: "Estimate Rules", group: "Estimate Rules", required: false },
  { key: "requiredQuoteQuestions", label: "Required Quote Questions", group: "Estimate Rules", required: false },
  { key: "whenToGivePriceRange", label: "When to Give a Price Range", group: "Estimate Rules", required: false },
  { key: "whenToRecommendVisit", label: "When to Recommend an On-Site Visit", group: "Estimate Rules", required: false },
  { key: "disclaimers", label: "Disclaimers", group: "Estimate Rules", required: false },
  { key: "businessTone", label: "Business Tone", group: "Business Tone", required: false },
  { key: "phrasesToUseOrAvoid", label: "Phrases to Use or Avoid", group: "Business Tone", required: false },
];

export type ProfileData = Record<string, string | null>;

export interface InterviewMessage {
  role: "user" | "assistant";
  content: string;
}

export function emptyProfile(): ProfileData {
  const data: ProfileData = {};
  for (const f of PROFILE_FIELDS) data[f.key] = null;
  return data;
}

export function capturedFields(profile: ProfileData): ProfileField[] {
  return PROFILE_FIELDS.filter((f) => {
    const v = profile[f.key];
    return typeof v === "string" && v.trim().length > 0;
  });
}

export function missingFields(profile: ProfileData): ProfileField[] {
  return PROFILE_FIELDS.filter((f) => {
    const v = profile[f.key];
    return !(typeof v === "string" && v.trim().length > 0);
  });
}

export function requiredComplete(profile: ProfileData): boolean {
  return missingFields(profile).every((f) => !f.required);
}

export interface InterviewTurnResult {
  reply: string;
  profile: ProfileData;
  readyToConfirm: boolean;
}

function normalizeProfile(raw: unknown, previous: ProfileData): ProfileData {
  const merged: ProfileData = { ...previous };
  if (raw && typeof raw === "object") {
    for (const f of PROFILE_FIELDS) {
      const v = (raw as Record<string, unknown>)[f.key];
      if (typeof v === "string" && v.trim().length > 0) {
        merged[f.key] = v.trim();
      }
    }
  }
  return merged;
}

export async function runInterviewTurn(params: {
  messages: InterviewMessage[];
  profile: ProfileData;
}): Promise<InterviewTurnResult> {
  const { messages, profile } = params;

  const fallback: InterviewTurnResult = {
    reply:
      "Thanks — I've noted that. Could you tell me more about your services, pricing, and policies so I can complete your business profile?",
    profile,
    readyToConfirm: false,
  };

  if (!client) {
    logger.warn("OPENAI_API_KEY not set — profile interview using fallback");
    return fallback;
  }

  const missing = missingFields(profile);
  const captured = capturedFields(profile);

  const system = `You are a Business Development Agent (BDA) acting as an onboarding specialist. You are interviewing a business owner to learn everything a front-office employee would need to know before answering customers, qualifying leads, preparing estimates, and creating invoices. Never use emojis. Be warm, concise, and professional.

After every owner response you must:
1. Extract any useful business information from their message into the structured fields below.
2. Reply with a message that has EXACTLY this structure:
   - A one-line acknowledgment.
   - A "Captured:" section listing ONLY the fields captured or updated so far, as "- Label: value" bullet lines (keep values short).
   - A "Still Missing:" section listing the most important fields not yet captured, as "- Label" bullet lines (list at most 8, prioritizing required ones).
   - End with the single next most useful follow-up question (or 2-3 related short questions from the same group).
3. If ALL required fields are captured and you have asked about the remaining groups, set "ready_to_confirm" to true and instead of a follow-up question, present a final confirmation summary of the full profile and ask the owner to confirm or request changes.

Structured fields (JSON keys with labels):
${PROFILE_FIELDS.map((f) => `- ${f.key} (${f.label}${f.required ? ", REQUIRED" : ""}) [${f.group}]`).join("\n")}

Already captured (do not lose these values; only update them if the owner corrects them):
${captured.length > 0 ? captured.map((f) => `- ${f.key}: ${profile[f.key]}`).join("\n") : "(nothing yet)"}

Still missing:
${missing.map((f) => `- ${f.key}${f.required ? " (REQUIRED)" : ""}`).join("\n")}

Respond ONLY with a JSON object:
{"reply": string, "profile": {<field key>: string | null, ...only include fields you extracted or updated from the latest message>}, "ready_to_confirm": boolean}`;

  const user = `Conversation so far:
${messages.map((m) => `${m.role === "user" ? "Owner" : "BDA"}: ${m.content}`).join("\n\n")}

Extract fields from the owner's latest message and produce the next BDA reply.`;

  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const raw = completion.choices[0]?.message?.content;
    if (!raw) return fallback;
    const data = JSON.parse(raw);
    if (typeof data.reply !== "string" || data.reply.trim().length === 0) {
      return fallback;
    }
    const mergedProfile = normalizeProfile(data.profile, profile);
    const ready =
      Boolean(data.ready_to_confirm) && requiredComplete(mergedProfile);
    return { reply: data.reply, profile: mergedProfile, readyToConfirm: ready };
  } catch (err) {
    logger.error({ err }, "Profile interview OpenAI request failed");
    return fallback;
  }
}
