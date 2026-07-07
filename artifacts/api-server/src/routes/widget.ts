import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  widgetSettingsTable,
  businessesTable,
  leadsTable,
  servicesTable,
  pricingRulesTable,
} from "@workspace/db";
import {
  GetWidgetSettingsResponse,
  SaveWidgetSettingsBody,
  SaveWidgetSettingsResponse,
  GetWidgetConfigQueryParams,
  GetWidgetConfigResponse,
  WidgetInteractBody,
  WidgetInteractResponse,
} from "@workspace/api-zod";
import { requireBusiness } from "../lib/auth";
import { logActivity } from "../lib/business";
import { generateAgentResponse, summarizeLead } from "../lib/aiService";

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

widgetPublicRouter.post("/widget/interact", async (req, res): Promise<void> => {
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

  const [services, pricingRows] = await Promise.all([
    db.select().from(servicesTable).where(eq(servicesTable.businessId, business.id)),
    db
      .select()
      .from(pricingRulesTable)
      .where(eq(pricingRulesTable.businessId, business.id)),
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
    }),
    summarizeLead(parsed.data.projectDescription),
  ]);

  const [lead] = await db
    .insert(leadsTable)
    .values({
      businessId: business.id,
      customerName: parsed.data.name,
      email: parsed.data.email ?? null,
      phone: parsed.data.phone ?? null,
      requestSummary,
      projectDescription: parsed.data.projectDescription,
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
