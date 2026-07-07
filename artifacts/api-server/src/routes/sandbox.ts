import { Router, type IRouter } from "express";
import { and, desc, eq, isNotNull, or } from "drizzle-orm";
import {
  db,
  sandboxTestsTable,
  servicesTable,
  pricingRulesTable,
} from "@workspace/db";
import {
  ListSandboxTestsResponse,
  RunSandboxTestBody,
  RunSandboxTestResponse,
  SendSandboxMessageParams,
  SendSandboxMessageBody,
  SendSandboxMessageResponse,
  SendSandboxTestEmailParams,
  SendSandboxTestEmailResponse,
  SaveSandboxFeedbackParams,
  SaveSandboxFeedbackBody,
  SaveSandboxFeedbackResponse,
} from "@workspace/api-zod";
import { requireBusiness } from "../lib/auth";
import { logActivity } from "../lib/business";
import {
  runTestAgentTurn,
  type ChatTurn,
  type ConversationStage,
  type Estimate,
  type ServiceContext,
} from "../lib/aiService";
import { buildInvoicePdf, filterLineItems } from "../lib/pdf";
import {
  isEmailConfigured,
  replacePlaceholders,
  sendEstimateEmail,
} from "../lib/email";
import { getOrCreateSettings } from "./invoiceSettings";
import { ALL_INVOICE_SECTIONS } from "../lib/defaults";

const router: IRouter = Router();

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

function toServiceContext(
  rows: (typeof servicesTable.$inferSelect)[],
): ServiceContext[] {
  return rows.map((s) => ({
    name: s.name,
    description: s.description,
    basePrice: s.basePrice,
    hourlyRate: s.hourlyRate,
    minimumPrice: s.minimumPrice,
  }));
}

async function loadAgentContext(bid: number) {
  const [services, pricingRows, settings, feedbackRows] = await Promise.all([
    db.select().from(servicesTable).where(eq(servicesTable.businessId, bid)),
    db
      .select()
      .from(pricingRulesTable)
      .where(eq(pricingRulesTable.businessId, bid)),
    getOrCreateSettings(bid),
    db
      .select({
        rating: sandboxTestsTable.rating,
        feedbackNotes: sandboxTestsTable.feedbackNotes,
      })
      .from(sandboxTestsTable)
      .where(
        and(
          eq(sandboxTestsTable.businessId, bid),
          or(
            isNotNull(sandboxTestsTable.feedbackNotes),
            isNotNull(sandboxTestsTable.rating),
          ),
        ),
      )
      .orderBy(desc(sandboxTestsTable.createdAt))
      .limit(5),
  ]);
  const includedSections = Array.isArray(settings.includedSections)
    ? (settings.includedSections as string[])
    : ALL_INVOICE_SECTIONS;
  return {
    services: toServiceContext(services),
    pricing: pricingRows[0] ?? null,
    settings,
    includedSections,
    feedback: feedbackRows
      .filter((f) => f.feedbackNotes || f.rating != null)
      .map((f) => ({ rating: f.rating, notes: f.feedbackNotes ?? "" })),
  };
}

function businessContext(req: { business?: any }) {
  return {
    name: req.business!.name,
    industry: req.business!.industry,
    serviceArea: req.business!.serviceArea,
    customerType: req.business!.customerType,
  };
}

function composeEmail(opts: {
  settings: Awaited<ReturnType<typeof getOrCreateSettings>>;
  businessName: string;
  estimate: Estimate;
  includedSections: string[];
}): { subject: string; body: string } {
  const { settings, businessName, estimate, includedSections } = opts;
  const vars = {
    business_name: businessName,
    customer_name: "there",
  };
  const subject = replacePlaceholders(
    settings.emailSubject || "Your estimate from {business_name}",
    vars,
  );
  const items = filterLineItems(estimate.invoiceLineItems, includedSections);
  const subtotal = items.reduce((s, li) => s + li.total, 0);
  const taxes = includedSections.includes("taxes_fees") ? estimate.taxes : 0;
  const total = subtotal + taxes;
  const lines = [
    replacePlaceholders(settings.emailGreeting || "Hi there,", vars),
    "",
    replacePlaceholders(settings.emailBodyText || "", vars),
    "",
    "Estimate summary:",
    ...items.map((li) => `- ${li.description}: $${li.total.toFixed(2)}`),
  ];
  if (taxes > 0) lines.push(`- Taxes & fees: $${taxes.toFixed(2)}`);
  lines.push(`Estimated total: $${total.toFixed(2)}`);
  if (
    estimate.recommendedPriceLow != null &&
    estimate.recommendedPriceHigh != null
  ) {
    lines.push(
      `Expected range: $${estimate.recommendedPriceLow.toFixed(2)} - $${estimate.recommendedPriceHigh.toFixed(2)}`,
    );
  }
  lines.push(
    "",
    replacePlaceholders(
      settings.emailClosing || `Best regards,\n${businessName}`,
      vars,
    ),
  );
  return { subject, body: lines.filter((l) => l !== null).join("\n") };
}

async function buildPdfForTest(
  test: typeof sandboxTestsTable.$inferSelect,
  settings: Awaited<ReturnType<typeof getOrCreateSettings>>,
  businessName: string,
  includedSections: string[],
): Promise<Buffer | null> {
  if (!test.estimate) return null;
  return buildInvoicePdf({
    businessName,
    customerEmail: test.customerEmail,
    projectDescription: test.prompt,
    date: new Date(test.createdAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    estimate: test.estimate as Estimate,
    settings: {
      selectedTemplate: settings.selectedTemplate,
      includedSections,
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

router.get(
  "/sandbox-tests",
  requireBusiness,
  async (req, res): Promise<void> => {
    const rows = await db
      .select()
      .from(sandboxTestsTable)
      .where(eq(sandboxTestsTable.businessId, req.business!.id))
      .orderBy(desc(sandboxTestsTable.createdAt));
    res.json(ListSandboxTestsResponse.parse(rows));
  },
);

router.post(
  "/sandbox-tests",
  requireBusiness,
  async (req, res): Promise<void> => {
    const parsed = RunSandboxTestBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const bid = req.business!.id;
    const ctx = await loadAgentContext(bid);

    const messages: ChatTurn[] = [
      { role: "customer", content: parsed.data.prompt },
    ];
    const turn = await runTestAgentTurn({
      business: businessContext(req),
      services: ctx.services,
      pricing: ctx.pricing,
      includedSections: ctx.includedSections,
      feedback: ctx.feedback,
      messages,
      currentStage: "gathering",
      emailProvided: false,
    });
    messages.push({ role: "agent", content: turn.message });

    const [row] = await db
      .insert(sandboxTestsTable)
      .values({
        businessId: bid,
        scenario: parsed.data.scenario ?? null,
        prompt: parsed.data.prompt,
        agentResponse: turn.message,
        messages,
        stage: turn.stage,
        estimate: turn.estimate,
      })
      .returning();

    await logActivity(bid, "sandbox_test", "Started a Test Agent conversation");
    res.status(201).json(RunSandboxTestResponse.parse(row));
  },
);

router.post(
  "/sandbox-tests/:id/messages",
  requireBusiness,
  async (req, res): Promise<void> => {
    const params = SendSandboxMessageParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = SendSandboxMessageBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const bid = req.business!.id;
    const [existing] = await db
      .select()
      .from(sandboxTestsTable)
      .where(
        and(
          eq(sandboxTestsTable.id, params.data.id),
          eq(sandboxTestsTable.businessId, bid),
        ),
      );
    if (!existing) {
      res.status(404).json({ error: "Sandbox test not found" });
      return;
    }
    if (existing.stage === "complete") {
      res.status(400).json({ error: "This conversation is already complete" });
      return;
    }

    const ctx = await loadAgentContext(bid);
    const messages: ChatTurn[] = Array.isArray(existing.messages)
      ? [...(existing.messages as ChatTurn[])]
      : [
          { role: "customer", content: existing.prompt },
          { role: "agent", content: existing.agentResponse },
        ];
    messages.push({ role: "customer", content: parsed.data.message });

    const emailMatch = parsed.data.message.match(EMAIL_RE);
    const customerEmail = emailMatch?.[0] ?? existing.customerEmail ?? null;
    const currentStage = (existing.stage ?? "gathering") as ConversationStage;
    const emailProvided =
      !!customerEmail &&
      (currentStage === "awaiting_email" || !!emailMatch);

    const turn = await runTestAgentTurn({
      business: businessContext(req),
      services: ctx.services,
      pricing: ctx.pricing,
      includedSections: ctx.includedSections,
      feedback: ctx.feedback,
      messages,
      currentStage,
      emailProvided,
    });
    messages.push({ role: "agent", content: turn.message });

    let emailSubject = existing.emailSubject;
    let emailBody = existing.emailBody;
    let emailSent = existing.emailSent ?? false;

    if (turn.stage === "complete" && turn.estimate) {
      const composed = composeEmail({
        settings: ctx.settings,
        businessName: req.business!.name,
        estimate: turn.estimate,
        includedSections: ctx.includedSections,
      });
      emailSubject = composed.subject;
      emailBody = composed.body;

      if (customerEmail && isEmailConfigured()) {
        const pdf = ctx.settings.attachPdf
          ? await buildPdfForTest(
              {
                ...existing,
                customerEmail,
                estimate: turn.estimate,
              },
              ctx.settings,
              req.business!.name,
              ctx.includedSections,
            )
          : null;
        const result = await sendEstimateEmail({
          to: customerEmail,
          cc: ctx.settings.ccOwner ? req.business!.email : null,
          replyTo: ctx.settings.replyToEmail,
          subject: emailSubject,
          text: emailBody,
          attachment: pdf ? { filename: "estimate.pdf", content: pdf } : null,
        });
        emailSent = result.sent;
      }
    }

    const [row] = await db
      .update(sandboxTestsTable)
      .set({
        messages,
        stage: turn.stage,
        agentResponse: turn.message,
        estimate: turn.estimate ?? existing.estimate,
        customerEmail,
        emailSubject,
        emailBody,
        emailSent,
      })
      .where(eq(sandboxTestsTable.id, existing.id))
      .returning();

    res.json(SendSandboxMessageResponse.parse(row));
  },
);

router.post(
  "/sandbox-tests/:id/send-email",
  requireBusiness,
  async (req, res): Promise<void> => {
    const params = SendSandboxTestEmailParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const bid = req.business!.id;
    const [existing] = await db
      .select()
      .from(sandboxTestsTable)
      .where(
        and(
          eq(sandboxTestsTable.id, params.data.id),
          eq(sandboxTestsTable.businessId, bid),
        ),
      );
    if (!existing) {
      res.status(404).json({ error: "Sandbox test not found" });
      return;
    }
    if (!existing.customerEmail || !existing.emailSubject || !existing.emailBody) {
      res.status(400).json({
        error: "This conversation has no estimate email to send yet",
      });
      return;
    }
    const ctx = await loadAgentContext(bid);
    const pdf = ctx.settings.attachPdf
      ? await buildPdfForTest(
          existing,
          ctx.settings,
          req.business!.name,
          ctx.includedSections,
        )
      : null;
    const result = await sendEstimateEmail({
      to: existing.customerEmail,
      cc: ctx.settings.ccOwner ? req.business!.email : null,
      replyTo: ctx.settings.replyToEmail,
      subject: existing.emailSubject,
      text: existing.emailBody,
      attachment: pdf ? { filename: "estimate.pdf", content: pdf } : null,
    });
    if (result.sent) {
      await db
        .update(sandboxTestsTable)
        .set({ emailSent: true })
        .where(eq(sandboxTestsTable.id, existing.id));
      await logActivity(bid, "sandbox_email", "Sent a test estimate email");
    }
    res.json(SendSandboxTestEmailResponse.parse(result));
  },
);

router.get(
  "/sandbox-tests/:id/invoice.pdf",
  requireBusiness,
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const bid = req.business!.id;
    const [existing] = await db
      .select()
      .from(sandboxTestsTable)
      .where(
        and(
          eq(sandboxTestsTable.id, id),
          eq(sandboxTestsTable.businessId, bid),
        ),
      );
    if (!existing || !existing.estimate) {
      res.status(404).json({ error: "No invoice available for this test" });
      return;
    }
    const ctx = await loadAgentContext(bid);
    const pdf = await buildPdfForTest(
      existing,
      ctx.settings,
      req.business!.name,
      ctx.includedSections,
    );
    if (!pdf) {
      res.status(404).json({ error: "No invoice available for this test" });
      return;
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="estimate-${existing.id}.pdf"`,
    );
    res.send(pdf);
  },
);

router.post(
  "/sandbox-tests/:id/feedback",
  requireBusiness,
  async (req, res): Promise<void> => {
    const params = SaveSandboxFeedbackParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = SaveSandboxFeedbackBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const bid = req.business!.id;
    const [existing] = await db
      .select()
      .from(sandboxTestsTable)
      .where(
        and(
          eq(sandboxTestsTable.id, params.data.id),
          eq(sandboxTestsTable.businessId, bid),
        ),
      );
    if (!existing) {
      res.status(404).json({ error: "Sandbox test not found" });
      return;
    }

    const [row] = await db
      .update(sandboxTestsTable)
      .set({
        rating: parsed.data.rating,
        feedbackNotes: parsed.data.feedbackNotes ?? null,
      })
      .where(eq(sandboxTestsTable.id, existing.id))
      .returning();

    await logActivity(
      bid,
      "sandbox_feedback",
      "Saved Test Agent feedback to improve future responses",
    );
    res.json(SaveSandboxFeedbackResponse.parse(row));
  },
);

export default router;
