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

export async function summarizeLead(projectDescription: string): Promise<string> {
  const data = await chatJSON(
    `Summarize a customer service request in one concise sentence. No emojis. Respond ONLY with JSON: {"summary": string}.`,
    projectDescription,
  );
  if (data && typeof data.summary === "string") return data.summary;
  return projectDescription.slice(0, 140);
}
