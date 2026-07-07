import OpenAI from "openai";
import { logger } from "./logger";

const apiKey = process.env.OPENAI_API_KEY;
const client = apiKey ? new OpenAI({ apiKey }) : null;
const MODEL = "gpt-4o";

export const INITIAL_BDA_HELPER_MESSAGE =
  "Great — start by filling out the simple business fields on the left. Once those are saved, I'll help you write the policy language and estimating rules your Business Development Agent needs to speak accurately for your company. We'll handle one section at a time so this stays simple.";

export interface ChatField {
  key: string;
  label: string;
  group: string;
  required: boolean;
}

// These are the fields the BDA chat helps write — policies & tone.
// Basic info / operations are captured in the left-side form.
export const CHAT_FIELDS: ChatField[] = [
  { key: "paymentTerms", label: "Payment Terms", group: "Policies", required: true },
  { key: "cancellationPolicy", label: "Cancellation Policy", group: "Policies", required: true },
  { key: "warrantyPolicy", label: "Warranty / Guarantee Policy", group: "Policies", required: false },
  { key: "refundPolicy", label: "Refund Policy", group: "Policies", required: false },
  { key: "weatherDelayPolicy", label: "Weather Delay Policy", group: "Policies", required: false },
  { key: "customerResponsibilities", label: "Customer Responsibilities Before Service", group: "Policies", required: false },
  { key: "estimateRules", label: "Estimate Rules", group: "Estimate Rules", required: false },
  { key: "requiredQuoteQuestions", label: "Required Customer Questions Before Quoting", group: "Estimate Rules", required: false },
  { key: "whenToGivePriceRange", label: "When to Give a Price Range", group: "Estimate Rules", required: false },
  { key: "whenToRecommendVisit", label: "When to Recommend an On-Site Visit", group: "Estimate Rules", required: false },
  { key: "disclaimers", label: "Estimate Disclaimers", group: "Estimate Rules", required: false },
  { key: "businessTone", label: "Business Tone / Voice", group: "Business Tone", required: false },
  { key: "phrasesToUseOrAvoid", label: "Phrases to Use or Avoid", group: "Business Tone", required: false },
];

// Extra form fields that live only in profileData (not a dedicated DB column)
export const EXTRA_FORM_KEYS = [
  "businessAddress",
  "businessHours",
  "emergencyAvailability",
  "seasonalAvailability",
  "yearsInBusiness",
  "typicalResponseTime",
] as const;

export type ExtraFormKey = (typeof EXTRA_FORM_KEYS)[number];

export type ProfileData = Record<string, string | null>;

export interface InterviewMessage {
  role: "user" | "assistant";
  content: string;
}

export interface PolicyDraft {
  key: string;
  label: string;
  wording: string;
}

export function emptyProfile(): ProfileData {
  const data: ProfileData = {};
  for (const f of CHAT_FIELDS) data[f.key] = null;
  for (const k of EXTRA_FORM_KEYS) data[k] = null;
  return data;
}

export function capturedChatFields(profile: ProfileData): ChatField[] {
  return CHAT_FIELDS.filter((f) => {
    const v = profile[f.key];
    return typeof v === "string" && v.trim().length > 0;
  });
}

export function missingChatFields(profile: ProfileData): ChatField[] {
  return CHAT_FIELDS.filter((f) => {
    const v = profile[f.key];
    return !(typeof v === "string" && v.trim().length > 0);
  });
}

export function policiesComplete(profile: ProfileData): boolean {
  return missingChatFields(profile).every((f) => !f.required);
}

export interface InterviewTurnResult {
  reply: string;
  profile: ProfileData;
  policyDraft: PolicyDraft | null;
  readyToConfirm: boolean;
}

function mergeProfile(raw: unknown, previous: ProfileData): ProfileData {
  const merged: ProfileData = { ...previous };
  if (raw && typeof raw === "object") {
    for (const f of CHAT_FIELDS) {
      const v = (raw as Record<string, unknown>)[f.key];
      if (typeof v === "string" && v.trim().length > 0) {
        merged[f.key] = v.trim();
      }
    }
  }
  return merged;
}

function normalizePolicyDraft(raw: unknown): PolicyDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (
    typeof r.key === "string" &&
    typeof r.label === "string" &&
    typeof r.wording === "string" &&
    r.wording.trim().length > 0 &&
    CHAT_FIELDS.some((f) => f.key === r.key)
  ) {
    return { key: r.key, label: r.label, wording: r.wording.trim() };
  }
  return null;
}

export async function runInterviewTurn(params: {
  businessName: string | null;
  messages: InterviewMessage[];
  profile: ProfileData;
}): Promise<InterviewTurnResult> {
  const { businessName, messages, profile } = params;

  const fallback: InterviewTurnResult = {
    reply:
      "Got it — thanks for sharing. Could you tell me a bit about how you handle payments and cancellations?",
    profile,
    policyDraft: null,
    readyToConfirm: false,
  };

  if (!client) {
    logger.warn("OPENAI_API_KEY not set — BDA helper using fallback");
    return fallback;
  }

  const captured = capturedChatFields(profile);
  const missing = missingChatFields(profile);
  const nextMissing = missing.filter((f) => f.group === (missing[0]?.group ?? "Policies"));

  const system = `You are the BDA Setup Helper, a friendly and efficient onboarding assistant for "${businessName ?? "this business"}". The business owner has already filled in their basic company info (name, industry, contact details, service area, hours, etc.) on a structured form. Your job is now to help them write the harder policy and tone language — one section at a time.

You handle these sections in order: Policies, Estimate Rules, Business Tone.

Policies to capture:
${CHAT_FIELDS.map((f) => `- ${f.key}: ${f.label}`).join("\n")}

Already captured:
${captured.length > 0 ? captured.map((f) => `- ${f.key}: ${profile[f.key]}`).join("\n") : "(nothing yet — start with Policies)"}

Still missing:
${missing.map((f) => `- ${f.key} (${f.label})${f.required ? " [REQUIRED]" : ""}`).join("\n")}

RULES:
1. Ask about ONE section at a time. Do NOT list all missing fields at once. Pick the next most important missing field and ask ONE focused, casual question about it.
2. When the owner gives a casual answer, extract what they said AND write a polished customer-facing version of that policy.
3. When you have a polished draft for a specific field, include it in the "policy_draft" object of your JSON response.
4. If the owner says their answer is fine as-is or to just save it, still write a polished version.
5. If all required fields are captured, set "ready_to_confirm" to true.
6. Never use emojis. Be warm and conversational, not formal.

Example: If owner says "If they cancel less than a day before, it's $75. Weather doesn't count." — write:
"Cancellations made less than 24 hours before the scheduled service may be subject to a $75 cancellation fee. Weather-related delays do not incur cancellation fees and will be rescheduled for the next available service window."

Respond ONLY with a JSON object:
{
  "reply": string,
  "profile": { <only the chat field keys you extracted or updated from this turn> },
  "policy_draft": { "key": string, "label": string, "wording": string } | null,
  "ready_to_confirm": boolean
}

"policy_draft" should only be set when you are proposing polished wording for a specific field. Set it to null otherwise.
The "profile" object should use the actual field key (e.g. "cancellationPolicy") and contain the CASUAL captured value — the polished wording goes only in "policy_draft.wording".`;

  const user = `Next missing section fields: ${nextMissing.map((f) => f.label).join(", ")}

Conversation so far:
${messages.map((m) => `${m.role === "user" ? "Owner" : "BDA Helper"}: ${m.content}`).join("\n\n")}

Respond with the next BDA Helper message.`;

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
    const mergedProfile = mergeProfile(data.profile, profile);
    const policyDraft = normalizePolicyDraft(data.policy_draft);
    const ready =
      Boolean(data.ready_to_confirm) && policiesComplete(mergedProfile);
    return {
      reply: data.reply,
      profile: mergedProfile,
      policyDraft,
      readyToConfirm: ready,
    };
  } catch (err) {
    logger.error({ err }, "BDA helper OpenAI request failed");
    return fallback;
  }
}
