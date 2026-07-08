import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  agentPreferencesTable,
  businessesTable,
  servicesTable,
  pricingRulesTable,
  invoiceSettingsTable,
  businessPoliciesTable,
  estimateRulesTable,
  businessToneTable,
  sandboxTestsTable,
} from "@workspace/db";
import {
  GetAgentPreferencesResponse,
  SaveAgentPreferencesBody,
  SaveAgentPreferencesResponse,
  GenerateAgentPreferencesResponse,
  ConfirmAgentPreferencesResponse,
} from "@workspace/api-zod";
import { requireBusiness } from "../lib/auth";
import { logActivity } from "../lib/business";
import { generateAgentPreferences } from "../lib/aiService";

const router: IRouter = Router();

// Per-business rate limit for the paid LLM generate endpoint.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 5;
const rateBuckets = new Map<number, number[]>();

function toApi(
  row: typeof agentPreferencesTable.$inferSelect | null,
  business: { id: number; clientId: string },
) {
  return {
    businessId: business.id,
    clientId: business.clientId,
    customerTone: row?.customerTone ?? null,
    requiredIntakeQuestions: row?.requiredIntakeQuestions ?? null,
    estimatingStandards: row?.estimatingStandards ?? null,
    invoicePolicyStandards: row?.invoicePolicyStandards ?? null,
    lowConfidenceRules: row?.lowConfidenceRules ?? null,
    servicesNotToQuote: row?.servicesNotToQuote ?? null,
    finalCustomerDisclaimer: row?.finalCustomerDisclaimer ?? null,
    confirmed: !!row?.confirmedAt,
    confirmedAt: row?.confirmedAt ?? null,
    updatedAt: row?.updatedAt ?? null,
  };
}

router.get(
  "/agent-preferences",
  requireBusiness,
  async (req, res): Promise<void> => {
    const business = req.business!;
    const [row] = await db
      .select()
      .from(agentPreferencesTable)
      .where(eq(agentPreferencesTable.businessId, business.id));
    res.json(GetAgentPreferencesResponse.parse(toApi(row ?? null, business)));
  },
);

router.put(
  "/agent-preferences",
  requireBusiness,
  async (req, res): Promise<void> => {
    const parsed = SaveAgentPreferencesBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const business = req.business!;
    const values = {
      ...parsed.data,
      updatedAt: new Date().toISOString(),
    };
    // Race-safe upsert keyed on the unique business_id constraint.
    const [row] = await db
      .insert(agentPreferencesTable)
      .values({
        businessId: business.id,
        clientId: business.clientId,
        ...values,
      })
      .onConflictDoUpdate({
        target: agentPreferencesTable.businessId,
        set: values,
      })
      .returning();
    res.json(SaveAgentPreferencesResponse.parse(toApi(row, business)));
  },
);

router.post(
  "/agent-preferences/generate",
  requireBusiness,
  async (req, res): Promise<void> => {
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

    const [
      services,
      pricingRows,
      invoiceRows,
      policyRows,
      estimateRuleRows,
      toneRows,
      sandboxTests,
    ] = await Promise.all([
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
        .from(invoiceSettingsTable)
        .where(eq(invoiceSettingsTable.businessId, business.id)),
      db
        .select()
        .from(businessPoliciesTable)
        .where(eq(businessPoliciesTable.businessId, business.id)),
      db
        .select()
        .from(estimateRulesTable)
        .where(eq(estimateRulesTable.businessId, business.id)),
      db
        .select()
        .from(businessToneTable)
        .where(eq(businessToneTable.businessId, business.id)),
      db
        .select()
        .from(sandboxTestsTable)
        .where(eq(sandboxTestsTable.businessId, business.id)),
    ]);

    const sections = await generateAgentPreferences({
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
      invoiceSettings: invoiceRows[0] ?? null,
      policies: policyRows[0] ?? null,
      estimateRules: estimateRuleRows[0] ?? null,
      tone: toneRows[0] ?? null,
      sandboxTests: sandboxTests.map((t) => ({
        prompt: t.prompt,
        agentResponse: t.agentResponse,
        messages: t.messages,
        rating: t.rating,
        feedbackNotes: t.feedbackNotes,
      })),
    });

    if (!sections) {
      res.status(502).json({
        error:
          "Could not generate agent preferences right now. Please try again in a moment.",
      });
      return;
    }

    const feedbackSource = sandboxTests
      .filter((t) => t.rating != null || t.feedbackNotes)
      .map((t) => ({
        sandboxTestId: t.id,
        rating: t.rating,
        feedbackNotes: t.feedbackNotes,
      }));

    const values = {
      ...sections,
      sourceTestAgentFeedback: feedbackSource,
      updatedAt: new Date().toISOString(),
    };
    // Race-safe upsert keyed on the unique business_id constraint.
    const [row] = await db
      .insert(agentPreferencesTable)
      .values({
        businessId: business.id,
        clientId: business.clientId,
        ...values,
      })
      .onConflictDoUpdate({
        target: agentPreferencesTable.businessId,
        set: values,
      })
      .returning();
    await logActivity(
      business.id,
      "agent_preferences_generated",
      "Agent preferences generated from testing",
    );
    res.json(GenerateAgentPreferencesResponse.parse(toApi(row, business)));
  },
);

router.post(
  "/agent-preferences/confirm",
  requireBusiness,
  async (req, res): Promise<void> => {
    const business = req.business!;
    const [existing] = await db
      .select()
      .from(agentPreferencesTable)
      .where(eq(agentPreferencesTable.businessId, business.id));
    const hasContent =
      existing &&
      [
        existing.customerTone,
        existing.requiredIntakeQuestions,
        existing.estimatingStandards,
        existing.invoicePolicyStandards,
        existing.lowConfidenceRules,
        existing.servicesNotToQuote,
        existing.finalCustomerDisclaimer,
      ].some((s) => s && s.trim().length > 0);
    if (!hasContent) {
      res.status(400).json({
        error:
          "Generate or fill in the agent preferences before confirming.",
      });
      return;
    }

    const nowIso = new Date().toISOString();
    const [row] = await db
      .update(agentPreferencesTable)
      .set({ confirmedAt: nowIso, updatedAt: nowIso })
      .where(eq(agentPreferencesTable.businessId, business.id))
      .returning();
    await db
      .update(businessesTable)
      .set({ agentPreferencesConfirmed: true, widgetReady: true })
      .where(eq(businessesTable.id, business.id));
    await logActivity(
      business.id,
      "agent_preferences_confirmed",
      "Agent confirmed — widget is ready",
    );
    res.json(
      ConfirmAgentPreferencesResponse.parse({
        preferences: toApi(row, business),
        agentPreferencesConfirmed: true,
        widgetReady: true,
      }),
    );
  },
);

export default router;
