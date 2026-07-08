import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  servicesTable,
  pricingRulesTable,
  businessPoliciesTable,
  estimateRulesTable,
} from "@workspace/db";
import { AssistantChatBody, AssistantChatResponse } from "@workspace/api-zod";
import { requireBusiness } from "../lib/auth";
import { generateAssistantReply } from "../lib/aiService";
import { computeSetupProgress } from "../lib/setupProgress";

const router: IRouter = Router();

// Per-business sliding-window rate limit for the paid LLM endpoint.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 15;
const rateBuckets = new Map<number, number[]>();

router.post(
  "/assistant/chat",
  requireBusiness,
  async (req, res): Promise<void> => {
    const parsed = AssistantChatBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const business = req.business!;

    const now = Date.now();
    const hits = (rateBuckets.get(business.id) ?? []).filter(
      (t) => now - t < RATE_WINDOW_MS,
    );
    if (hits.length >= RATE_MAX_REQUESTS) {
      res
        .status(429)
        .json({ error: "Too many requests. Please try again shortly." });
      return;
    }
    hits.push(now);
    rateBuckets.set(business.id, hits);

    const [services, pricingRows, policyRows, estimateRuleRows, setupProgress] =
      await Promise.all([
        db
          .select()
          .from(servicesTable)
          .where(eq(servicesTable.businessId, business.id)),
        db
          .select()
          .from(pricingRulesTable)
          .where(eq(pricingRulesTable.businessId, business.id)),
        db
          .select()
          .from(businessPoliciesTable)
          .where(eq(businessPoliciesTable.businessId, business.id)),
        db
          .select()
          .from(estimateRulesTable)
          .where(eq(estimateRulesTable.businessId, business.id)),
        computeSetupProgress(business),
      ]);

    const reply = await generateAssistantReply({
      business: {
        name: business.name,
        industry: business.industry,
        serviceArea: business.serviceArea,
        customerType: business.customerType,
      },
      services: services.map((s) => ({
        name: s.name,
        description: s.description,
        basePrice: s.basePrice,
        hourlyRate: s.hourlyRate,
        minimumPrice: s.minimumPrice,
      })),
      pricing: pricingRows[0] ?? null,
      policies: policyRows[0] ?? null,
      estimateRules: estimateRuleRows[0] ?? null,
      setupProgress: { ...setupProgress },
      messages: parsed.data.messages,
    });

    res.json(AssistantChatResponse.parse({ reply }));
  },
);

export default router;
