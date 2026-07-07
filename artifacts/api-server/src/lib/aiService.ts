import OpenAI from "openai";
import { logger } from "./logger";

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  logger.warn("OPENAI_API_KEY is not set — AI features will use fallbacks");
}
const client = apiKey ? new OpenAI({ apiKey }) : null;
const MODEL = "gpt-4o";

export interface EstimateLineItem {
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  total: number;
}

export interface Estimate {
  customerSummary: string;
  assumptions: string[];
  recommendedPriceLow: number | null;
  recommendedPriceHigh: number | null;
  invoiceLineItems: EstimateLineItem[];
  subtotal: number;
  taxes: number;
  totalEstimate: number;
  confidenceScore: number;
  followUpQuestions: string[];
}

export interface BusinessContext {
  name: string;
  industry?: string | null;
  serviceArea?: string | null;
  customerType?: string | null;
}

export interface ServiceContext {
  name: string;
  description?: string | null;
  basePrice?: number | null;
  hourlyRate?: number | null;
  minimumPrice?: number | null;
}

export interface PricingContext {
  laborRate?: number | null;
  emergencyFee?: number | null;
  travelFee?: number | null;
  weekendMultiplier?: number | null;
  taxRate?: number | null;
  minimumJobCost?: number | null;
  customNotes?: string | null;
}

async function chatJSON(system: string, user: string): Promise<any | null> {
  if (!client) return null;
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
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    logger.error({ err }, "OpenAI request failed");
    return null;
  }
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function fallbackEstimate(
  projectDescription: string,
  services: ServiceContext[],
  pricing: PricingContext | null,
): Estimate {
  const labor = pricing?.laborRate ?? services[0]?.hourlyRate ?? 95;
  const hours = 4;
  const base = services[0]?.basePrice ?? labor * hours;
  const subtotal = Math.max(base, pricing?.minimumJobCost ?? 0);
  const taxRate = pricing?.taxRate ?? 0;
  const taxes = Math.round(subtotal * (taxRate / 100) * 100) / 100;
  const total = Math.round((subtotal + taxes) * 100) / 100;
  return {
    customerSummary: projectDescription
      ? `Estimate for: ${projectDescription.slice(0, 160)}`
      : "Preliminary project estimate.",
    assumptions: [
      "Standard access and working conditions.",
      "Estimate is preliminary and subject to an on-site assessment.",
    ],
    recommendedPriceLow: Math.round(total * 0.85 * 100) / 100,
    recommendedPriceHigh: Math.round(total * 1.2 * 100) / 100,
    invoiceLineItems: [
      {
        description: services[0]?.name ?? "Labor",
        quantity: hours,
        unitPrice: labor,
        total: subtotal,
      },
    ],
    subtotal,
    taxes,
    totalEstimate: total,
    confidenceScore: 60,
    followUpQuestions: [
      "What is the full scope of the work?",
      "When would you like the work completed?",
    ],
  };
}

function normalizeEstimate(data: any, fallback: Estimate): Estimate {
  if (!data || typeof data !== "object") return fallback;
  const lineItems = Array.isArray(data.invoiceLineItems)
    ? data.invoiceLineItems.map((li: any) => ({
        description: String(li?.description ?? "Item"),
        quantity: li?.quantity == null ? null : num(li.quantity, 1),
        unitPrice: li?.unitPrice == null ? null : num(li.unitPrice, 0),
        total: num(li?.total, 0),
      }))
    : fallback.invoiceLineItems;
  return {
    customerSummary: String(data.customerSummary ?? fallback.customerSummary),
    assumptions: Array.isArray(data.assumptions)
      ? data.assumptions.map(String)
      : fallback.assumptions,
    recommendedPriceLow:
      data.recommendedPriceLow == null ? null : num(data.recommendedPriceLow),
    recommendedPriceHigh:
      data.recommendedPriceHigh == null ? null : num(data.recommendedPriceHigh),
    invoiceLineItems: lineItems,
    subtotal: num(data.subtotal, fallback.subtotal),
    taxes: num(data.taxes, fallback.taxes),
    totalEstimate: num(data.totalEstimate, fallback.totalEstimate),
    confidenceScore: num(data.confidenceScore, fallback.confidenceScore),
    followUpQuestions: Array.isArray(data.followUpQuestions)
      ? data.followUpQuestions.map(String)
      : fallback.followUpQuestions,
  };
}

export async function generateAgentResponse(params: {
  business: BusinessContext;
  services: ServiceContext[];
  pricing: PricingContext | null;
  prompt: string;
  customerName?: string;
}): Promise<{ agentResponse: string; estimate: Estimate }> {
  const { business, services, pricing, prompt, customerName } = params;
  const fallback = fallbackEstimate(prompt, services, pricing);

  const system = `You are the AI business development agent for "${business.name}", a ${
    business.industry ?? "local service"
  } business${business.serviceArea ? ` serving ${business.serviceArea}` : ""}. You talk to prospective customers, answer their questions warmly and professionally, qualify the job, and produce a price estimate. Never use emojis. Respond ONLY with a JSON object of shape: {"message": string, "estimate": {"customerSummary": string, "assumptions": string[], "recommendedPriceLow": number, "recommendedPriceHigh": number, "invoiceLineItems": [{"description": string, "quantity": number, "unitPrice": number, "total": number}], "subtotal": number, "taxes": number, "totalEstimate": number, "confidenceScore": number, "followUpQuestions": string[]}. confidenceScore is 0-100.`;

  const user = `Business services and pricing:\nServices: ${JSON.stringify(
    services,
  )}\nPricing rules: ${JSON.stringify(pricing)}\n\n${
    customerName ? `Customer name: ${customerName}\n` : ""
  }Customer message: "${prompt}"\n\nWrite a helpful reply as "message" and a structured "estimate".`;

  const data = await chatJSON(system, user);
  if (!data) {
    return {
      agentResponse: `Thanks for reaching out to ${business.name}. Based on what you have described, we have put together a preliminary estimate below. To firm it up, we may need a few more details or a quick on-site look.`,
      estimate: fallback,
    };
  }
  return {
    agentResponse: String(data.message ?? "Thanks for reaching out."),
    estimate: normalizeEstimate(data.estimate, fallback),
  };
}

export interface ExtractedKnowledge {
  requirementKey: string;
  requirementLabel: string;
  extractedValue: string;
  sourceDocument: string;
  confidenceScore: number;
}

export async function extractBusinessKnowledge(params: {
  business: BusinessContext;
  requirements: { key: string; label: string }[];
  documents: { filename: string; textContent?: string | null }[];
}): Promise<ExtractedKnowledge[]> {
  const { business, requirements, documents } = params;

  const fallback: ExtractedKnowledge[] = requirements.map((r) => ({
    requirementKey: r.key,
    requirementLabel: r.label,
    extractedValue: "",
    sourceDocument: documents[0]?.filename ?? "uploaded documents",
    confidenceScore: 40,
  }));

  const system = `You extract structured business knowledge for an AI business development agent. Given uploaded documents and a list of requirements, infer a concise value for each requirement. Never use emojis. Respond ONLY with JSON: {"values": [{"requirementKey": string, "extractedValue": string, "confidenceScore": number, "sourceDocument": string}]}. confidenceScore is 0-100. If a requirement cannot be inferred, still include it with a best-guess value and a low confidenceScore.`;

  const user = `Business: ${JSON.stringify(business)}\nRequirements: ${JSON.stringify(
    requirements,
  )}\nDocuments (filename + extracted text): ${JSON.stringify(
    documents.map((d) => ({
      filename: d.filename,
      text: (d.textContent ?? "").slice(0, 4000),
    })),
  )}`;

  const data = await chatJSON(system, user);
  if (!data || !Array.isArray(data.values)) return fallback;

  const byKey = new Map<string, any>();
  for (const v of data.values) {
    if (v && typeof v.requirementKey === "string") byKey.set(v.requirementKey, v);
  }
  return requirements.map((r) => {
    const v = byKey.get(r.key);
    return {
      requirementKey: r.key,
      requirementLabel: r.label,
      extractedValue: v ? String(v.extractedValue ?? "") : "",
      sourceDocument: v
        ? String(v.sourceDocument ?? documents[0]?.filename ?? "uploaded documents")
        : documents[0]?.filename ?? "uploaded documents",
      confidenceScore: v ? num(v.confidenceScore, 40) : 40,
    };
  });
}

export type ConversationStage =
  | "gathering"
  | "confirming"
  | "awaiting_email"
  | "complete";

export interface ChatTurn {
  role: "customer" | "agent";
  content: string;
}

export interface TestAgentTurn {
  message: string;
  stage: ConversationStage;
  estimate: Estimate | null;
}

const STAGES: ConversationStage[] = [
  "gathering",
  "confirming",
  "awaiting_email",
  "complete",
];

function fallbackTurn(
  messages: ChatTurn[],
  services: ServiceContext[],
  pricing: PricingContext | null,
  currentStage: ConversationStage,
  emailProvided: boolean,
): TestAgentTurn {
  const customerTurns = messages.filter((m) => m.role === "customer").length;
  if (currentStage === "awaiting_email" && emailProvided) {
    const lastPrompt = messages.find((m) => m.role === "customer")?.content ?? "";
    return {
      message:
        "Thank you. We have prepared your preliminary estimate below and sent a copy to your email address. We will follow up shortly to schedule next steps.",
      stage: "complete",
      estimate: fallbackEstimate(lastPrompt, services, pricing),
    };
  }
  if (currentStage === "confirming") {
    return {
      message:
        "Great. Could you share the best email address to send your estimate to?",
      stage: "awaiting_email",
      estimate: null,
    };
  }
  if (currentStage === "awaiting_email") {
    return {
      message:
        "Could you share the best email address to send your estimate to?",
      stage: "awaiting_email",
      estimate: null,
    };
  }
  if (customerTurns >= 2) {
    return {
      message:
        "Thanks for those details. Is there any other information you'd like us to know before we prepare your estimate?",
      stage: "confirming",
      estimate: null,
    };
  }
  return {
    message:
      "Thanks for reaching out. To prepare an accurate estimate, could you tell me a bit more about the size and scope of the project, where it is located, and when you would like the work done?",
    stage: "gathering",
    estimate: null,
  };
}

export async function runTestAgentTurn(params: {
  business: BusinessContext;
  services: ServiceContext[];
  pricing: PricingContext | null;
  includedSections: string[];
  feedback: { rating: number | null; notes: string }[];
  messages: ChatTurn[];
  currentStage: ConversationStage;
  emailProvided: boolean;
}): Promise<TestAgentTurn> {
  const {
    business,
    services,
    pricing,
    includedSections,
    feedback,
    messages,
    currentStage,
    emailProvided,
  } = params;

  const fallback = fallbackTurn(
    messages,
    services,
    pricing,
    currentStage,
    emailProvided,
  );

  const system = `You are the AI business development agent for "${business.name}", a ${
    business.industry ?? "local service"
  } business${business.serviceArea ? ` serving ${business.serviceArea}` : ""}. You are chatting with a prospective customer through the website widget. Never use emojis. Be warm, concise, and professional.

CONVERSATION FLOW — follow it strictly:
1. stage "gathering": Do NOT produce an estimate yet. Ask 2-3 concise clarifying questions at a time (never more), adapted to this business's industry and services. Cover things like: project size or dimensions, scope of work, location/service area, timing or urgency, materials or preferences, access issues or special conditions, and photos/details if helpful. For example, an asphalt striping business would ask about parking lot size, number of spaces/lines, restriping vs new layout, ADA markings, arrows, and timing; an HVAC business would ask about system type, home size, and symptoms. Stay in "gathering" until you understand the scope.
2. stage "confirming": Once you have enough scope, ask exactly: "Is there any other information you'd like us to know before we prepare your estimate?" and set conversation_stage to "confirming".
3. stage "awaiting_email": After the customer confirms there is nothing else, ask for the best email address to send the estimate to, and set conversation_stage to "awaiting_email".
4. stage "complete": Once the customer has provided an email address, thank them, tell them their estimate is below and a copy is being emailed to them, set conversation_stage to "complete", and produce the full structured estimate.

Current stage: "${currentStage}".${emailProvided ? " The customer HAS provided an email address, so you must move to stage \"complete\" and produce the estimate now." : ""}

${feedback.length > 0 ? `BUSINESS OWNER FEEDBACK from previous test conversations — incorporate these corrections into your behavior:\n${feedback.map((f) => `- ${f.rating != null ? `(rated ${f.rating}/5) ` : ""}${f.notes || "(no written notes — treat the rating as a satisfaction signal: low ratings mean the previous style of response missed the mark)"}`).join("\n")}\n` : ""}
Only include invoice line items for these enabled invoice sections: ${includedSections.join(", ")}. For example, if "travel_mobilization" is not enabled, do not add a travel fee line item; if "emergency_fees" is not enabled, do not add emergency fee line items; if "taxes_fees" is not enabled, set taxes to 0. If "estimated_duration" is enabled, include one assumptions entry that starts with "Estimated duration:" describing how long the work will take; if it is not enabled, never mention duration.

Respond ONLY with a JSON object: {"message": string, "conversation_stage": "gathering"|"confirming"|"awaiting_email"|"complete", "estimate": null | {"customerSummary": string, "assumptions": string[], "recommendedPriceLow": number, "recommendedPriceHigh": number, "invoiceLineItems": [{"description": string, "quantity": number, "unitPrice": number, "total": number}], "subtotal": number, "taxes": number, "totalEstimate": number, "confidenceScore": number, "followUpQuestions": string[]}}. "estimate" must be null unless conversation_stage is "complete". confidenceScore is 0-100.`;

  const user = `Business services: ${JSON.stringify(services)}
Pricing rules: ${JSON.stringify(pricing)}

Conversation so far:
${messages.map((m) => `${m.role === "customer" ? "Customer" : "Agent"}: ${m.content}`).join("\n")}

Reply with the next agent message and stage.`;

  const data = await chatJSON(system, user);
  if (!data || typeof data.message !== "string") return fallback;

  let stage = STAGES.includes(data.conversation_stage)
    ? (data.conversation_stage as ConversationStage)
    : fallback.stage;

  // Enforce legal stage transitions server-side rather than trusting the model:
  // a turn may keep the current stage or advance exactly one step — never
  // regress and never skip stages.
  const currentIdx = STAGES.indexOf(currentStage);
  let proposedIdx = STAGES.indexOf(stage);
  if (proposedIdx < currentIdx) proposedIdx = currentIdx;
  if (proposedIdx > currentIdx + 1) proposedIdx = currentIdx + 1;
  stage = STAGES[proposedIdx];
  // An email address is required before completing; once the customer has
  // provided one while we are awaiting it, complete deterministically.
  if (stage === "complete" && !emailProvided) stage = "awaiting_email";
  if (currentStage === "awaiting_email" && emailProvided) stage = "complete";

  let estimate: Estimate | null = null;
  if (stage === "complete") {
    const lastPrompt = messages.find((m) => m.role === "customer")?.content ?? "";
    estimate = normalizeEstimate(
      data.estimate,
      fallbackEstimate(lastPrompt, services, pricing),
    );
    if (!includedSections.includes("estimated_duration")) {
      estimate.assumptions = estimate.assumptions.filter(
        (a) => !/^\s*estimated duration/i.test(a),
      );
    }
  }

  return { message: data.message, stage, estimate };
}

export async function summarizeLead(projectDescription: string): Promise<string> {
  const data = await chatJSON(
    `Summarize a customer service request in one concise sentence. No emojis. Respond ONLY with JSON: {"summary": string}.`,
    projectDescription,
  );
  if (data && typeof data.summary === "string") return data.summary;
  return projectDescription.slice(0, 140);
}
