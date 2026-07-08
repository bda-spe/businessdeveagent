import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  widgetSettingsTable,
  businessesTable,
  leadsTable,
  servicesTable,
  pricingRulesTable,
  businessPoliciesTable,
  estimateRulesTable,
} from "@workspace/db";
import {
  GetWidgetSettingsResponse,
  SaveWidgetSettingsBody,
  SaveWidgetSettingsResponse,
  GetWidgetConfigQueryParams,
  GetWidgetConfigResponse,
  WidgetQuestionsBody,
  WidgetQuestionsResponse,
  WidgetInteractBody,
  WidgetInteractResponse,
} from "@workspace/api-zod";
import { requireBusiness } from "../lib/auth";
import { logActivity } from "../lib/business";
import {
  generateAgentResponse,
  generateWidgetQuestions,
  summarizeLead,
} from "../lib/aiService";

// Authenticated widget settings management.
export const widgetSettingsRouter: IRouter = Router();

widgetSettingsRouter.get(
  "/widget-settings",
  requireBusiness,
  async (req, res): Promise<void> => {
    let [row] = await db
      .select()
      .from(widgetSettingsTable)
      .where(eq(widgetSettingsTable.businessId, req.business!.id));
    if (!row) {
      [row] = await db
        .insert(widgetSettingsTable)
        .values({ businessId: req.business!.id })
        .returning();
    }
    res.json(GetWidgetSettingsResponse.parse(row));
  },
);

widgetSettingsRouter.put(
  "/widget-settings",
  requireBusiness,
  async (req, res): Promise<void> => {
    const parsed = SaveWidgetSettingsBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    let [row] = await db
      .update(widgetSettingsTable)
      .set({ ...parsed.data, updatedAt: new Date().toISOString() })
      .where(eq(widgetSettingsTable.businessId, req.business!.id))
      .returning();
    if (!row) {
      [row] = await db
        .insert(widgetSettingsTable)
        .values({ businessId: req.business!.id, ...parsed.data })
        .returning();
    }
    await logActivity(req.business!.id, "widget_updated", "Widget settings saved");
    res.json(SaveWidgetSettingsResponse.parse(row));
  },
);

// Public, unauthenticated widget endpoints keyed by clientId.
export const widgetPublicRouter: IRouter = Router();

// Simple in-memory rate limiter for the public, AI-backed widget endpoints.
// Keyed by client IP; sliding window. Protects against cost amplification
// (LLM calls) and lead spam from the open internet.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 20;
const rateBuckets = new Map<string, number[]>();

function widgetRateLimit(
  req: Parameters<Parameters<IRouter["post"]>[1]>[0],
  res: Parameters<Parameters<IRouter["post"]>[1]>[1],
  next: () => void,
): void {
  const ip = req.ip ?? "unknown";
  const now = Date.now();
  const hits = (rateBuckets.get(ip) ?? []).filter(
    (t) => now - t < RATE_WINDOW_MS,
  );
  if (hits.length >= RATE_MAX_REQUESTS) {
    res.status(429).json({ error: "Too many requests. Please try again shortly." });
    return;
  }
  hits.push(now);
  rateBuckets.set(ip, hits);
  // Opportunistic cleanup to keep the map bounded.
  if (rateBuckets.size > 10_000) {
    for (const [key, times] of rateBuckets) {
      if (times.every((t) => now - t >= RATE_WINDOW_MS)) rateBuckets.delete(key);
    }
  }
  next();
}

widgetPublicRouter.get("/widget/config", async (req, res): Promise<void> => {
  const query = GetWidgetConfigQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const [business] = await db
    .select()
    .from(businessesTable)
    .where(eq(businessesTable.clientId, query.data.clientId));
  if (!business) {
    res.status(404).json({ error: "Widget not found" });
    return;
  }
  let [settings] = await db
    .select()
    .from(widgetSettingsTable)
    .where(eq(widgetSettingsTable.businessId, business.id));
  if (!settings) {
    [settings] = await db
      .insert(widgetSettingsTable)
      .values({ businessId: business.id })
      .returning();
  }
  res.json(
    GetWidgetConfigResponse.parse({
      clientId: business.clientId,
      businessName: business.name,
      greeting: settings.greeting,
      primaryColor: settings.primaryColor,
      position: settings.position,
      enabled: settings.enabled,
    }),
  );
});

widgetPublicRouter.post("/widget/questions", widgetRateLimit, async (req, res): Promise<void> => {
  const parsed = WidgetQuestionsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [business] = await db
    .select()
    .from(businessesTable)
    .where(eq(businessesTable.clientId, parsed.data.clientId));
  if (!business) {
    res.status(404).json({ error: "Widget not found" });
    return;
  }
  const services = await db
    .select()
    .from(servicesTable)
    .where(eq(servicesTable.businessId, business.id));
  const questions = await generateWidgetQuestions({
    business: {
      name: business.name,
      industry: business.industry,
      serviceArea: business.serviceArea,
      customerType: business.customerType,
    },
    services: services.map((s) => ({
      name: s.name,
      description: s.description,
    })),
    projectDescription: parsed.data.projectDescription,
  });
  res.json(WidgetQuestionsResponse.parse({ questions }));
});

widgetPublicRouter.post("/widget/interact", widgetRateLimit, async (req, res): Promise<void> => {
  const parsed = WidgetInteractBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [business] = await db
    .select()
    .from(businessesTable)
    .where(eq(businessesTable.clientId, parsed.data.clientId));
  if (!business) {
    res.status(404).json({ error: "Widget not found" });
    return;
  }

  const [services, pricingRows, policyRows, estimateRuleRows] =
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
    ]);

  const [{ agentResponse, estimate }, requestSummary] = await Promise.all([
    generateAgentResponse({
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
      prompt: parsed.data.projectDescription,
      customerName: parsed.data.name,
      answers: parsed.data.answers ?? [],
      budget: parsed.data.budget ?? null,
      laborAssumption: parsed.data.laborAssumption ?? null,
      policies: policyRows[0] ?? null,
      estimateRules: estimateRuleRows[0] ?? null,
    }),
    summarizeLead(parsed.data.projectDescription),
  ]);

  // Persist the full guided intake (answers, budget, labor) with the lead so
  // the business sees everything the customer provided.
  const intakeParts = [parsed.data.projectDescription];
  if (parsed.data.answers && parsed.data.answers.length > 0) {
    intakeParts.push(
      "",
      "Follow-up answers:",
      ...parsed.data.answers.map((a) => `- ${a.question} ${a.answer}`),
    );
  }
  if (parsed.data.budget) intakeParts.push("", `Budget: ${parsed.data.budget}`);
  if (parsed.data.laborAssumption)
    intakeParts.push(`Labor/scope guess: ${parsed.data.laborAssumption}`);

  const [lead] = await db
    .insert(leadsTable)
    .values({
      businessId: business.id,
      customerName: parsed.data.name,
      email: parsed.data.email ?? null,
      phone: parsed.data.phone ?? null,
      requestSummary,
      projectDescription: intakeParts.join("\n"),
      aiResponse: agentResponse,
      estimate,
      estimatedLow: estimate.recommendedPriceLow,
      estimatedHigh: estimate.recommendedPriceHigh,
      confidenceScore: estimate.confidenceScore,
      status: "new",
    })
    .returning();

  await logActivity(
    business.id,
    "lead_created",
    `New lead from ${parsed.data.name}`,
  );

  res.json(
    WidgetInteractResponse.parse({
      leadId: lead.id,
      message: agentResponse,
      estimate,
    }),
  );
});
