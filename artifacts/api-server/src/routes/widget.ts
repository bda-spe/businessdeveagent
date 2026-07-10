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
import { requireBusiness, isBusinessSuspended } from "../lib/auth";
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
import {
  PRELIMINARY_ESTIMATE_DISCLAIMER,
  FALLBACK_BUDGET_RANGES,
} from "../lib/defaults";
import { logger } from "../lib/logger";

// Round a dollar amount to a "nice" boundary based on its magnitude so the
// generated budget ranges read naturally (e.g. $50, $75, $250, $1,000).
function niceRound(value: number): number {
  const unit =
    value < 200 ? 25 : value < 1000 ? 50 : value < 5000 ? 250 : value < 20000 ? 1000 : 2500;
  return Math.max(unit, Math.round(value / unit) * unit);
}

function fmtMoney(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

// Build dynamic budget range options from the business's saved pricing
// profile (low/avg/high job cost + minimum job charge). Falls back to
// industry defaults (and logs) when the profile is missing or unusable.
export function buildBudgetRanges(pricing: {
  lowJobCost?: number | null;
  avgJobCost?: number | null;
  highJobCost?: number | null;
  minimumJobCost?: number | null;
} | null): { ranges: string[]; usedFallback: boolean } {
  const low = pricing?.lowJobCost ?? null;
  const high = pricing?.highJobCost ?? null;
  const avg = pricing?.avgJobCost ?? null;
  const min = pricing?.minimumJobCost ?? null;

  let effLow = low;
  let effHigh = high;
  // Derive missing ends from the average when possible.
  if (effLow == null && avg != null && avg > 0) effLow = avg * 0.5;
  if (effHigh == null && avg != null && avg > 0) effHigh = avg * 1.75;
  if (effLow != null && min != null && min > effLow) effLow = min;

  if (
    effLow == null ||
    effHigh == null ||
    !(effLow > 0) ||
    !(effHigh > effLow)
  ) {
    return { ranges: FALLBACK_BUDGET_RANGES, usedFallback: true };
  }

  const step = (effHigh - effLow) / 3;
  const boundaries: number[] = [];
  const first = niceRound(effLow + step * 0.5);
  for (const b of [
    first,
    niceRound(effLow + step),
    niceRound(effLow + step * 2),
    niceRound(effHigh),
  ]) {
    if (boundaries.length === 0 || b > boundaries[boundaries.length - 1]) {
      boundaries.push(b);
    }
  }

  const ranges: string[] = [`Under ${fmtMoney(boundaries[0])}`];
  for (let i = 0; i < boundaries.length - 1; i++) {
    ranges.push(`${fmtMoney(boundaries[i])}-${fmtMoney(boundaries[i + 1])}`);
  }
  ranges.push(`${fmtMoney(boundaries[boundaries.length - 1])}+`, "Not sure");
  return { ranges, usedFallback: false };
}

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

  // Dynamic budget ranges from the business's saved pricing profile.
  const [pricingRow] = await db
    .select()
    .from(pricingRulesTable)
    .where(eq(pricingRulesTable.businessId, business.id));
  logger.info(
    {
      clientId: business.clientId,
      lowJobCost: pricingRow?.lowJobCost ?? null,
      avgJobCost: pricingRow?.avgJobCost ?? null,
      highJobCost: pricingRow?.highJobCost ?? null,
      minimumJobCost: pricingRow?.minimumJobCost ?? null,
    },
    "[widget/config] business pricing range loaded",
  );
  const { ranges: budgetRanges, usedFallback } = buildBudgetRanges(
    pricingRow ?? null,
  );
  if (usedFallback) {
    logger.warn(
      { clientId: business.clientId },
      "[widget/config] pricing profile missing or unusable — using industry-default budget ranges",
    );
  }
  logger.info(
    { clientId: business.clientId, budgetRanges },
    "[widget/config] dynamic budget ranges generated",
  );

  res.json(
    GetWidgetConfigResponse.parse({
      clientId: business.clientId,
      businessName: business.name,
      greeting: settings.greeting,
      primaryColor: settings.primaryColor,
      font: settings.font,
      position: settings.position,
      budgetRanges,
      // The widget only goes live after the business confirms its agent
      // preferences, and it is hidden completely while the business is
      // suspended (trial expired, payment past due, canceled, or deactivated).
      // Settings, colors, greeting, and the client_id are preserved — paying
      // reactivates the existing widget as-is.
      enabled:
        settings.enabled &&
        !isBusinessSuspended(business) &&
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
  if (isBusinessSuspended(business)) {
    res.status(403).json({ error: "This widget is currently unavailable." });
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
    logger.warn(
      { error: parsed.error.message },
      "[widget/interact] rejected: invalid request body",
    );
    const addressPaths = [
      "serviceStreet",
      "serviceCity",
      "serviceState",
      "serviceZip",
    ];
    const missingAddress = parsed.error.issues.some((issue) =>
      addressPaths.includes(String(issue.path[0])),
    );
    res.status(400).json({
      error: missingAddress
        ? "A complete service address (street, city, state, and ZIP code) is required before an estimate can be generated."
        : "Some required information is missing or invalid. Please review your answers and try again.",
    });
    return;
  }
  logger.info(
    { clientId: parsed.data.clientId },
    "[widget/interact] clientId received",
  );

  // Required service address — a quote cannot be generated without it.
  const street = parsed.data.serviceStreet.trim();
  const city = parsed.data.serviceCity.trim();
  const stateVal = parsed.data.serviceState.trim();
  const zip = parsed.data.serviceZip.trim();
  if (!street || !city || !stateVal || !zip) {
    logger.warn(
      { clientId: parsed.data.clientId },
      "[widget/interact] rejected: service address incomplete",
    );
    res.status(400).json({
      error:
        "A complete service address (street, city, state, and ZIP code) is required before an estimate can be generated.",
    });
    return;
  }
  const serviceAddress = `${street}, ${city}, ${stateVal} ${zip}`;
  logger.info(
    { clientId: parsed.data.clientId, serviceAddress },
    "[widget/interact] service address received",
  );

  // Required customer contact info (email or phone) beyond the name.
  const customerEmail = parsed.data.email?.trim() ?? "";
  const customerPhone = parsed.data.phone?.trim() ?? "";
  if (!customerEmail && !customerPhone) {
    logger.warn(
      { clientId: parsed.data.clientId },
      "[widget/interact] rejected: missing customer contact info",
    );
    res.status(400).json({
      error: "An email address or phone number is required so we can follow up on your estimate.",
    });
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
  if (isBusinessSuspended(business)) {
    res.status(403).json({ error: "This widget is currently unavailable." });
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

  const pricingRow = pricingRows[0] ?? null;
  logger.info(
    {
      clientId: business.clientId,
      lowJobCost: pricingRow?.lowJobCost ?? null,
      avgJobCost: pricingRow?.avgJobCost ?? null,
      highJobCost: pricingRow?.highJobCost ?? null,
      minimumJobCost: pricingRow?.minimumJobCost ?? null,
    },
    "[widget/interact] business pricing range loaded",
  );
  if (!pricingRow) {
    logger.warn(
      { clientId: business.clientId },
      "[widget/interact] rejected: no business pricing context — quote cannot be generated",
    );
    res.status(400).json({
      error:
        "This business hasn't finished setting up its pricing yet, so an estimate can't be generated. Please try again later or contact the business directly.",
    });
    return;
  }

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

  // Load the business's quote formatting settings BEFORE generating the quote
  // so the selected template shapes the AI output too.
  const settings = await getOrCreateSettings(business.id);
  logger.info(
    {
      clientId: business.clientId,
      selectedTemplate: settings.selectedTemplate,
    },
    "[widget/interact] selected quote template loaded",
  );

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
      pricing: pricingRow,
      prompt: parsed.data.projectDescription,
      customerName: parsed.data.name,
      serviceAddress,
      answers: parsed.data.answers ?? [],
      budget: parsed.data.budget ?? null,
      laborAssumption: parsed.data.laborAssumption ?? null,
      policies: policyRows[0] ?? null,
      estimateRules: estimateRuleRows[0] ?? null,
      agentPreferences: confirmedPreferences,
      quoteFormat: {
        selectedTemplate: settings.selectedTemplate,
        showPolicies: settings.showPolicies,
        estimateDisclaimer: settings.estimateDisclaimer,
        acceptanceLanguage: settings.acceptanceLanguage,
        paymentTerms: settings.paymentTerms,
        cancellationPolicy: settings.cancellationPolicy,
        termsConditions: settings.termsConditions,
      },
    }),
    summarizeLead(parsed.data.projectDescription),
  ]);

  // Persist the full guided intake (answers, budget, labor) with the lead so
  // the business sees everything the customer provided.
  const intakeParts = [parsed.data.projectDescription];
  intakeParts.push("", `Service address: ${serviceAddress}`);
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

  // Compose the quote email up front (cheap, synchronous), but the actual
  // sending (SMTP + optional PDF generation) happens AFTER the response is
  // sent to the customer — those steps can be slow or hang, and must never
  // block the widget from showing the estimate it already has.
  const composed =
    customerEmail.length > 0
      ? composeEstimateEmail({
          businessName: business.name,
          customerName: parsed.data.name,
          serviceAddress,
          estimate,
          emailSubject: settings.emailSubject,
          emailGreeting: settings.emailGreeting,
          emailBodyText: settings.emailBodyText,
          emailClosing: settings.emailClosing,
          showPolicies: settings.showPolicies,
          cancellationPolicy: settings.cancellationPolicy,
          paymentTerms: settings.paymentTerms,
          termsConditions: settings.termsConditions,
          estimateDisclaimer: settings.estimateDisclaimer,
          acceptanceLanguage: settings.acceptanceLanguage,
        })
      : null;
  const willSendEmail = Boolean(composed && isEmailConfigured());

  const [lead] = await db
    .insert(leadsTable)
    .values({
      businessId: business.id,
      customerName: parsed.data.name,
      email: customerEmail || null,
      phone: customerPhone || null,
      serviceAddress,
      requestSummary,
      projectDescription: intakeParts.join("\n"),
      aiResponse: agentResponse,
      estimate,
      estimatedLow: estimate.recommendedPriceLow,
      estimatedHigh: estimate.recommendedPriceHigh,
      confidenceScore: estimate.confidenceScore,
      status: "new",
      emailSent: false,
      emailSubject: composed?.subject ?? null,
      emailBody: composed?.body ?? null,
    })
    .returning();

  await logActivity(
    business.id,
    "lead_created",
    `New lead from ${parsed.data.name}`,
  );

  logger.info(
    { clientId: business.clientId, leadId: lead.id },
    "[widget/interact] quote disclaimer applied to quote output",
  );

  // Respond to the customer immediately — the estimate is ready. Everything
  // below (PDF + email) runs in the background and can never re-open or
  // block this response.
  res.json(
    WidgetInteractResponse.parse({
      leadId: lead.id,
      message: agentResponse,
      estimate,
      disclaimer: PRELIMINARY_ESTIMATE_DISCLAIMER,
    }),
  );

  if (willSendEmail && composed) {
    void (async () => {
      try {
        let pdfBuffer: Buffer | null = null;
        if (settings.attachPdf) {
          pdfBuffer = await buildInvoicePdf({
            businessName: business.name,
            businessPhone: business.phone,
            businessEmail: business.email,
            businessWebsite: business.website,
            logoUrl: business.logoUrl,
            customerName: parsed.data.name,
            customerEmail,
            customerPhone,
            serviceAddress,
            projectDescription: parsed.data.projectDescription,
            date: new Date().toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            }),
            estimate,
            settings: {
              selectedTemplate: settings.selectedTemplate,
              showPolicies: settings.showPolicies,
              showLogo: settings.showLogo,
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
            ? { filename: "Service-Estimate.pdf", content: pdfBuffer }
            : null,
        });
        logger.info(
          {
            clientId: business.clientId,
            leadId: lead.id,
            to: customerEmail,
            cc: business.email ?? null,
            sent: result.sent,
          },
          "[widget/interact] quote email sent",
        );
        if (result.sent) {
          await db
            .update(leadsTable)
            .set({ emailSent: true })
            .where(eq(leadsTable.id, lead.id));
        }
      } catch (err) {
        logger.error(
          { err, clientId: business.clientId, leadId: lead.id },
          "[widget/interact] background quote email failed",
        );
      }
    })();
  }
});
