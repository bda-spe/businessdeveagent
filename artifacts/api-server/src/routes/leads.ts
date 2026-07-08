import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, leadsTable } from "@workspace/db";
import {
  ListLeadsResponse,
  GetLeadParams,
  GetLeadResponse,
  UpdateLeadParams,
  UpdateLeadBody,
  UpdateLeadResponse,
  SendLeadEmailParams,
  SendLeadEmailResponse,
} from "@workspace/api-zod";
import type { Estimate } from "../lib/aiService";
import { requireBusiness } from "../lib/auth";
import { logActivity } from "../lib/business";
import {
  composeEstimateEmail,
  sendEstimateEmail,
  isEmailConfigured,
} from "../lib/email";
import { buildInvoicePdf } from "../lib/pdf";
import { getOrCreateSettings } from "./invoiceSettings";
import { ALL_INVOICE_SECTIONS } from "../lib/defaults";

const router: IRouter = Router();

router.get("/leads", requireBusiness, async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(leadsTable)
    .where(eq(leadsTable.businessId, req.business!.id))
    .orderBy(desc(leadsTable.createdAt));
  res.json(ListLeadsResponse.parse(rows));
});

router.get("/leads/:id", requireBusiness, async (req, res): Promise<void> => {
  const params = GetLeadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select()
    .from(leadsTable)
    .where(
      and(
        eq(leadsTable.id, params.data.id),
        eq(leadsTable.businessId, req.business!.id),
      ),
    );
  if (!row) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  res.json(GetLeadResponse.parse(row));
});

router.patch("/leads/:id", requireBusiness, async (req, res): Promise<void> => {
  const params = UpdateLeadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateLeadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .update(leadsTable)
    .set({ status: parsed.data.status })
    .where(
      and(
        eq(leadsTable.id, params.data.id),
        eq(leadsTable.businessId, req.business!.id),
      ),
    )
    .returning();
  if (!row) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  await logActivity(
    req.business!.id,
    "lead_updated",
    `Lead "${row.customerName}" marked ${row.status}`,
  );
  res.json(UpdateLeadResponse.parse(row));
});

router.post("/leads/:id/send-email", requireBusiness, async (req, res): Promise<void> => {
  const params = SendLeadEmailParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const bid = req.business!.id;
  const [lead] = await db
    .select()
    .from(leadsTable)
    .where(
      and(
        eq(leadsTable.id, params.data.id),
        eq(leadsTable.businessId, bid),
      ),
    );
  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }
  if (!lead.email || !lead.emailSubject || !lead.emailBody) {
    res.status(400).json({
      error: "This lead has no email address or estimate email to send.",
    });
    return;
  }
  const settings = await getOrCreateSettings(bid);
  const includedSections = Array.isArray(settings.includedSections)
    ? (settings.includedSections as string[])
    : ALL_INVOICE_SECTIONS;

  let pdfBuffer: Buffer | null = null;
  if (settings.attachPdf && lead.estimate) {
    pdfBuffer = await buildInvoicePdf({
      businessName: req.business!.name,
      customerEmail: lead.email,
      projectDescription: lead.projectDescription || "",
      date: new Date(lead.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      estimate: lead.estimate as Estimate,
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
    to: lead.email,
    cc: settings.ccOwner ? req.business!.email : null,
    replyTo: settings.replyToEmail,
    subject: lead.emailSubject,
    text: lead.emailBody,
    attachment: pdfBuffer
      ? { filename: "estimate.pdf", content: pdfBuffer }
      : null,
  });
  if (result.sent) {
    await db
      .update(leadsTable)
      .set({ emailSent: true })
      .where(eq(leadsTable.id, lead.id));
    await logActivity(
      bid,
      "lead_email_sent",
      `Re-sent estimate email to ${lead.customerName}`,
    );
  }
  res.json(SendLeadEmailResponse.parse(result));
});

export default router;
