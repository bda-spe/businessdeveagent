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
  agentPreferencesTable,
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
import {
  composeEstimateEmail,
  sendEstimateEmail,
  isEmailConfigured,
} from "../lib/email";
import { buildInvoicePdf } from "../lib/pdf";
import { getOrCreateSettings } from "./invoiceSettings";
import { ALL_INVOICE_SECTIONS } from "../lib/defaults";

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
      // The widget only goes live after the business confirms its agent
      // preferences. Until then it stays hidden on host sites.
      enabled:
        settings.enabled &&
        business.widgetReady &&
        business.agentPreferencesConfirmed,
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
  if (!business.widgetReady || !business.agentPreferencesConfirmed) {
    res.status(403).json({
      error: "This widget is not live yet. The business must confirm its agent before the widget can take requests.",
    });
    return;
  }

  const [services, pricingRows, policyRows, estimateRuleRows, prefRows] =
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
      db
        .select()
        .from(agentPreferencesTable)
        .where(eq(agentPreferencesTable.businessId, business.id)),
    ]);

  const prefRow = prefRows[0];
  const confirmedPreferences =
    prefRow && prefRow.confirmedAt
      ? {
          customerTone: prefRow.customerTone,
          requiredIntakeQuestions: prefRow.requiredIntakeQuestions,
          estimatingStandards: prefRow.estimatingStandards,
          invoicePolicyStandards: prefRow.invoicePolicyStandards,
          lowConfidenceRules: prefRow.lowConfidenceRules,
          servicesNotToQuote: prefRow.servicesNotToQuote,
          finalCustomerDisclaimer: prefRow.finalCustomerDisclaimer,
        }
      : null;

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
      agentPreferences: confirmedPreferences,
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

  // Compose and send the estimate email to the customer if email is provided.
  const settings = await getOrCreateSettings(business.id);
  const includedSections = Array.isArray(settings.includedSections)
    ? (settings.includedSections as string[])
    : ALL_INVOICE_SECTIONS;

  const customerEmail = parsed.data.email?.trim() ?? "";
  const composed =
    customerEmail.length > 0
      ? composeEstimateEmail({
          businessName: business.name,
          customerName: parsed.data.name,
          estimate,
          includedSections,
          emailSubject: settings.emailSubject,
          emailGreeting: settings.emailGreeting,
          emailBodyText: settings.emailBodyText,
          emailClosing: settings.emailClosing,
        })
      : null;

  let emailSent = false;
  let pdfBuffer: Buffer | null = null;
  if (composed && isEmailConfigured()) {
    if (settings.attachPdf) {
      pdfBuffer = await buildInvoicePdf({
        businessName: business.name,
        customerEmail,
        projectDescription: parsed.data.projectDescription,
        date: new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        estimate,
        settings: {
          selectedTemplate: settings.selectedTemplate,
          includedSections,
          brandColor: settings.brandColor,
          cancellationPolicy: settings.cancellationPolicy,
          paymentTerms: settings.paymentTerms,
          estimateDisclaimer: settings.estimateDisclaimer,
          termsConditions: settings.termsConditions,
          acceptanceLanguage: settings.acceptanceLanguage,
          depositRequirements: settings.depositRequirements,
          footerNote: settings.footerNote,
        },
      });
    }
    const result = await sendEstimateEmail({
      to: customerEmail,
      cc: business.email ?? null,
      replyTo: settings.replyToEmail,
      subject: composed.subject,
      text: composed.body,
      attachment: pdfBuffer
        ? { filename: "quote.pdf", content: pdfBuffer }
        : null,
    });
    emailSent = result.sent;
  }

  const [lead] = await db
    .insert(leadsTable)
    .values({
      businessId: business.id,
      customerName: parsed.data.name,
      email: customerEmail || null,
      phone: parsed.data.phone ?? null,
      requestSummary,
      projectDescription: intakeParts.join("\n"),
      aiResponse: agentResponse,
      estimate,
      estimatedLow: estimate.recommendedPriceLow,
      estimatedHigh: estimate.recommendedPriceHigh,
      confidenceScore: estimate.confidenceScore,
      status: "new",
      emailSent,
      emailSubject: composed?.subject ?? null,
      emailBody: composed?.body ?? null,
    })
    .returning();

  await logActivity(
    business.id,
    "lead_created",
    `New lead from ${parsed.data.name}${emailSent ? " (estimate emailed)" : ""}`,
  );

  res.json(
    WidgetInteractResponse.parse({
      leadId: lead.id,
      message: agentResponse,
      estimate,
    }),
  );
});
