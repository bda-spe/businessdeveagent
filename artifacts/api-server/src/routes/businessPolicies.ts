import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  businessPoliciesTable,
  businessesTable,
  pricingRulesTable,
  businessOperationsTable,
  servicesTable,
} from "@workspace/db";
import {
  GetBusinessPoliciesResponse,
  SaveBusinessPoliciesBody,
  SaveBusinessPoliciesResponse,
  AiDraftPolicyBody,
  AiDraftPolicyResponse,
} from "@workspace/api-zod";
import { requireBusiness } from "../lib/auth";
import { logActivity } from "../lib/business";
import OpenAI from "openai";

const router: IRouter = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function getOrCreate(businessId: number) {
  let [row] = await db
    .select()
    .from(businessPoliciesTable)
    .where(eq(businessPoliciesTable.businessId, businessId));
  if (!row) {
    [row] = await db
      .insert(businessPoliciesTable)
      .values({ businessId })
      .returning();
  }
  return row;
}

router.get(
  "/business/policies",
  requireBusiness,
  async (req, res): Promise<void> => {
    const row = await getOrCreate(req.business!.id);
    res.json(GetBusinessPoliciesResponse.parse(row));
  },
);

router.patch(
  "/business/policies",
  requireBusiness,
  async (req, res): Promise<void> => {
    const parsed = SaveBusinessPoliciesBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    await getOrCreate(req.business!.id);
    const [updated] = await db
      .update(businessPoliciesTable)
      .set({ ...parsed.data, updatedAt: new Date().toISOString() })
      .where(eq(businessPoliciesTable.businessId, req.business!.id))
      .returning();
    await logActivity(
      req.business!.id,
      "business_updated",
      "Business policies updated",
    );
    res.json(SaveBusinessPoliciesResponse.parse(updated));
  },
);

const POLICY_LABELS: Record<string, string> = {
  paymentTerms: "Payment Terms",
  cancellationPolicy: "Cancellation Policy",
  warrantyPolicy: "Warranty / Guarantee Policy",
  refundPolicy: "Refund Policy",
  weatherDelayPolicy: "Weather Delay Policy",
  customerResponsibilities: "Customer Responsibilities Before Service",
};

router.post(
  "/business/policies/ai-draft",
  requireBusiness,
  async (req, res): Promise<void> => {
    const parsed = AiDraftPolicyBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { field, currentValue } = parsed.data;
    const label = POLICY_LABELS[field];
    if (!label) {
      res.status(400).json({ error: "Unknown policy field" });
      return;
    }

    const businessId = req.business!.id;
    const [biz, pricing, ops, services] = await Promise.all([
      db
        .select()
        .from(businessesTable)
        .where(eq(businessesTable.id, businessId))
        .then((r) => r[0]),
      db
        .select()
        .from(pricingRulesTable)
        .where(eq(pricingRulesTable.businessId, businessId))
        .then((r) => r[0] ?? null),
      db
        .select()
        .from(businessOperationsTable)
        .where(eq(businessOperationsTable.businessId, businessId))
        .then((r) => r[0] ?? null),
      db
        .select({ name: servicesTable.name })
        .from(servicesTable)
        .where(eq(servicesTable.businessId, businessId))
        .limit(5),
    ]);

    const context = [
      `Business: ${biz.name}`,
      biz.industry ? `Industry: ${biz.industry}` : null,
      ops?.customerType ? `Customer type: ${ops.customerType}` : null,
      services.length > 0
        ? `Services: ${services.map((s) => s.name).join(", ")}`
        : null,
      pricing?.cancellationFee
        ? `Cancellation fee: $${pricing.cancellationFee}`
        : null,
      pricing?.depositRequired ? "Deposit is required" : null,
      pricing?.depositType && pricing?.depositValue
        ? `Deposit: ${pricing.depositValue}${pricing.depositType === "Percentage" ? "%" : " flat"}`
        : null,
      pricing?.taxRate ? `Tax rate: ${pricing.taxRate}%` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const systemPrompt = `You are a business writing assistant helping a service business write professional, customer-facing policy language. Write concise, clear, friendly-yet-professional text. Do not use markdown. Output only the policy text itself — no headings, no labels, no explanations.`;

    const userPrompt = `Write the "${label}" for this business:\n\n${context}${currentValue ? `\n\nExisting draft to improve:\n${currentValue}` : ""}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 400,
      temperature: 0.7,
    });

    const wording = completion.choices[0]?.message?.content?.trim() ?? "";
    res.json(AiDraftPolicyResponse.parse({ wording }));
  },
);

export default router;
