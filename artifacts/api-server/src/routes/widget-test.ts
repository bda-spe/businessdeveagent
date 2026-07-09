import { Router, type IRouter } from "express";
import { and, desc, eq, isNotNull, or } from "drizzle-orm";
import {
  db,
  servicesTable,
  pricingRulesTable,
  businessPoliciesTable,
  estimateRulesTable,
  agentPreferencesTable,
  sandboxTestsTable,
  widgetSettingsTable,
} from "@workspace/db";
import {
  GetWidgetTestConfigResponse,
  WidgetTestQuestionsBody,
  WidgetTestQuestionsResponse,
  WidgetTestInteractBody,
  WidgetTestInteractResponse,
} from "@workspace/api-zod";
import { requireBusiness } from "../lib/auth";
import { logActivity } from "../lib/business";
import {
  generateAgentResponse,
  generateWidgetQuestions,
  summarizeLead,
} from "../lib/aiService";
import { getOrCreateSettings } from "./invoiceSettings";
import { ALL_INVOICE_SECTIONS, PRELIMINARY_ESTIMATE_DISCLAIMER } from "../lib/defaults";
import { buildBudgetRanges } from "./widget";

// Authenticated widget endpoints that power the dashboard's "Live Preview"
// and "Test Agent" screens. They mirror the public widget endpoints exactly
// (same request/response shapes, same widget.js client) but are scoped to
// the logged-in business's own session instead of a public clientId, and
// NEVER create a real lead or send a real email — every interaction is
// logged to sandbox_tests instead, and recent feedback from that table is
// fed back into the next AI reply.
export const widgetTestRouter: IRouter = Router();

widgetTestRouter.get(
  "/widget-test/config",
  requireBusiness,
  async (req, res): Promise<void> => {
    const business = req.business!;
    const [pricingRow] = await db
      .select()
      .from(pricingRulesTable)
      .where(eq(pricingRulesTable.businessId, business.id));
    const { ranges: budgetRanges } = buildBudgetRanges(pricingRow ?? null);

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
      GetWidgetTestConfigResponse.parse({
        clientId: business.clientId,
        businessName: business.name,
        greeting: settings.greeting,
        primaryColor: settings.primaryColor,
        font: settings.font,
        position: settings.position,
        budgetRanges,
        // Test mode reflects the business's real saved widget branding, but
        // is always usable regardless of whether the widget has actually
        // gone live yet — that's the point of a safe preview/test surface.
        enabled: true,
      }),
    );
  },
);

widgetTestRouter.post(
  "/widget-test/questions",
  requireBusiness,
  async (req, res): Promise<void> => {
    const parsed = WidgetTestQuestionsBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const business = req.business!;
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
      services: services.map((s) => ({ name: s.name, description: s.description })),
      projectDescription: parsed.data.projectDescription,
    });
    res.json(WidgetTestQuestionsResponse.parse({ questions }));
  },
);

widgetTestRouter.post(
  "/widget-test/interact",
  requireBusiness,
  async (req, res): Promise<void> => {
    const parsed = WidgetTestInteractBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const business = req.business!;

    const street = parsed.data.serviceStreet.trim();
    const city = parsed.data.serviceCity.trim();
    const stateVal = parsed.data.serviceState.trim();
    const zip = parsed.data.serviceZip.trim();
    const serviceAddress = `${street}, ${city}, ${stateVal} ${zip}`;

    const [services, pricingRows, policyRows, estimateRuleRows, prefRows] =
      await Promise.all([
        db.select().from(servicesTable).where(eq(servicesTable.businessId, business.id)),
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

    const settings = await getOrCreateSettings(business.id);
    const includedSections = Array.isArray(settings.includedSections)
      ? (settings.includedSections as string[])
      : ALL_INVOICE_SECTIONS;

    // Recent business-owner feedback from prior test conversations, so a
    // submitted rating/note immediately shapes the very next reply.
    const feedbackRows = await db
      .select({
        rating: sandboxTestsTable.rating,
        feedbackNotes: sandboxTestsTable.feedbackNotes,
      })
      .from(sandboxTestsTable)
      .where(
        and(
          eq(sandboxTestsTable.businessId, business.id),
          or(
            isNotNull(sandboxTestsTable.feedbackNotes),
            isNotNull(sandboxTestsTable.rating),
          ),
        ),
      )
      .orderBy(desc(sandboxTestsTable.createdAt))
      .limit(5);
    const feedback = feedbackRows
      .filter((f) => f.feedbackNotes || f.rating != null)
      .map((f) => ({ rating: f.rating, notes: f.feedbackNotes ?? "" }));

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
          includedSections,
          showPolicies: settings.showPolicies,
          estimateDisclaimer: settings.estimateDisclaimer,
          acceptanceLanguage: settings.acceptanceLanguage,
          paymentTerms: settings.paymentTerms,
          cancellationPolicy: settings.cancellationPolicy,
          termsConditions: settings.termsConditions,
        },
        feedback,
      }),
      summarizeLead(parsed.data.projectDescription),
    ]);

    const [row] = await db
      .insert(sandboxTestsTable)
      .values({
        businessId: business.id,
        scenario: requestSummary,
        prompt: parsed.data.projectDescription,
        agentResponse,
        messages: [
          { role: "customer", content: parsed.data.projectDescription },
          { role: "agent", content: agentResponse },
        ],
        stage: "complete",
        estimate,
        customerEmail: parsed.data.email ?? null,
      })
      .returning();

    await logActivity(
      business.id,
      "sandbox_test",
      "Ran a live test conversation through the actual widget",
    );

    res.json(
      WidgetTestInteractResponse.parse({
        leadId: null,
        sandboxTestId: row.id,
        message: agentResponse,
        estimate,
        disclaimer: PRELIMINARY_ESTIMATE_DISCLAIMER,
      }),
    );
  },
);
