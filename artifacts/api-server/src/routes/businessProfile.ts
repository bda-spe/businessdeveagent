import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  businessesTable,
  businessProfileInterviewsTable,
  pricingRulesTable,
  invoiceSettingsTable,
} from "@workspace/db";
import {
  GetProfileInterviewResponse,
  SendProfileInterviewMessageBody,
  SendProfileInterviewMessageResponse,
  ConfirmProfileInterviewResponse,
  ResetProfileInterviewResponse,
} from "@workspace/api-zod";
import { requireBusiness } from "../lib/auth";
import { logActivity } from "../lib/business";
import {
  INITIAL_INTERVIEW_MESSAGE,
  PROFILE_FIELDS,
  emptyProfile,
  capturedFields,
  missingFields,
  requiredComplete,
  runInterviewTurn,
  type InterviewMessage,
  type ProfileData,
} from "../lib/profileInterview";

const router: IRouter = Router();

type InterviewRow = typeof businessProfileInterviewsTable.$inferSelect;

function rowProfile(row: InterviewRow): ProfileData {
  const base = emptyProfile();
  const stored = row.profileData;
  if (stored && typeof stored === "object") {
    for (const f of PROFILE_FIELDS) {
      const v = (stored as Record<string, unknown>)[f.key];
      if (typeof v === "string" && v.trim().length > 0) base[f.key] = v;
    }
  }
  return base;
}

function rowMessages(row: InterviewRow): InterviewMessage[] {
  if (Array.isArray(row.messages)) {
    return (row.messages as InterviewMessage[]).filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string",
    );
  }
  return [];
}

function serializeInterview(row: InterviewRow) {
  const profile = rowProfile(row);
  const captured = capturedFields(profile).map((f) => ({
    key: f.key,
    label: f.label,
    group: f.group,
    value: profile[f.key] as string,
  }));
  const stillMissing = missingFields(profile).map((f) => ({
    key: f.key,
    label: f.label,
    group: f.group,
    required: f.required,
  }));
  return {
    id: row.id,
    status: row.status,
    messages: rowMessages(row),
    captured,
    stillMissing,
    readyToConfirm: requiredComplete(profile),
  };
}

async function getOrCreateInterview(businessId: number): Promise<InterviewRow> {
  const [existing] = await db
    .select()
    .from(businessProfileInterviewsTable)
    .where(eq(businessProfileInterviewsTable.businessId, businessId));
  if (existing) return existing;
  const [created] = await db
    .insert(businessProfileInterviewsTable)
    .values({
      businessId,
      messages: [
        { role: "assistant", content: INITIAL_INTERVIEW_MESSAGE },
      ] satisfies InterviewMessage[],
      profileData: emptyProfile(),
    })
    .returning();
  return created;
}

function firstNumber(v: string | null): number | null {
  if (!v) return null;
  const match = v.replace(/,/g, "").match(/\d+(\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

// The interview is the key source of truth: extracted values are synced into
// the structured business, pricing, and invoice settings records so every
// other part of the app (estimates, PDFs, widget agent) uses them.
async function syncProfileToRecords(
  businessId: number,
  profile: ProfileData,
): Promise<void> {
  const businessUpdate: Record<string, string> = {};
  if (profile.businessName) businessUpdate.name = profile.businessName;
  if (profile.industry) businessUpdate.industry = profile.industry;
  if (profile.website) businessUpdate.website = profile.website;
  if (profile.phone) businessUpdate.phone = profile.phone;
  if (profile.email) businessUpdate.email = profile.email;
  if (profile.serviceArea) businessUpdate.serviceArea = profile.serviceArea;
  if (profile.customerType) businessUpdate.customerType = profile.customerType;
  if (profile.numberOfEmployees)
    businessUpdate.companySize = profile.numberOfEmployees;

  if (Object.keys(businessUpdate).length > 0) {
    await db
      .update(businessesTable)
      .set(businessUpdate)
      .where(eq(businessesTable.id, businessId));
  }

  const pricingUpdate: Record<string, number> = {};
  const laborRate = firstNumber(profile.laborRate);
  const minimumJobCost = firstNumber(profile.minimumJobCharge);
  const travelFee = firstNumber(profile.travelFees);
  const taxRate = firstNumber(profile.taxRate);
  const emergencyFee = firstNumber(profile.weekendEmergencyFees);
  if (laborRate != null) pricingUpdate.laborRate = laborRate;
  if (minimumJobCost != null) pricingUpdate.minimumJobCost = minimumJobCost;
  if (travelFee != null) pricingUpdate.travelFee = travelFee;
  if (taxRate != null) pricingUpdate.taxRate = taxRate;
  if (emergencyFee != null) pricingUpdate.emergencyFee = emergencyFee;

  const pricingNotes: string[] = [];
  if (profile.materialMarkup)
    pricingNotes.push(`Material markup: ${profile.materialMarkup}`);
  if (profile.cancellationFees)
    pricingNotes.push(`Cancellation fees: ${profile.cancellationFees}`);

  if (Object.keys(pricingUpdate).length > 0 || pricingNotes.length > 0) {
    let customNotesUpdate: { customNotes: string } | {} = {};
    if (pricingNotes.length > 0) {
      // Merge with any existing user-entered notes instead of overwriting:
      // replace only lines this sync previously wrote, keep everything else.
      const [existing] = await db
        .select({ customNotes: pricingRulesTable.customNotes })
        .from(pricingRulesTable)
        .where(eq(pricingRulesTable.businessId, businessId));
      const keptLines = (existing?.customNotes ?? "")
        .split("\n")
        .filter(
          (line) =>
            line.trim().length > 0 &&
            !/^\s*(Material markup|Cancellation fees):/i.test(line),
        );
      customNotesUpdate = {
        customNotes: [...keptLines, ...pricingNotes].join("\n"),
      };
    }
    await db
      .update(pricingRulesTable)
      .set({
        ...pricingUpdate,
        ...customNotesUpdate,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(pricingRulesTable.businessId, businessId));
  }

  const invoiceUpdate: Record<string, string> = {};
  if (profile.paymentTerms) invoiceUpdate.paymentTerms = profile.paymentTerms;
  if (profile.cancellationPolicy)
    invoiceUpdate.cancellationPolicy = profile.cancellationPolicy;
  if (profile.depositRequirements)
    invoiceUpdate.depositRequirements = profile.depositRequirements;
  if (profile.disclaimers)
    invoiceUpdate.estimateDisclaimer = profile.disclaimers;

  if (Object.keys(invoiceUpdate).length > 0) {
    await db
      .update(invoiceSettingsTable)
      .set({ ...invoiceUpdate, updatedAt: new Date().toISOString() })
      .where(eq(invoiceSettingsTable.businessId, businessId));
  }
}

router.get(
  "/business-profile-interview",
  requireBusiness,
  async (req, res): Promise<void> => {
    const row = await getOrCreateInterview(req.business!.id);
    res.json(GetProfileInterviewResponse.parse(serializeInterview(row)));
  },
);

router.post(
  "/business-profile-interview/message",
  requireBusiness,
  async (req, res): Promise<void> => {
    const parsed = SendProfileInterviewMessageBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const businessId = req.business!.id;
    const row = await getOrCreateInterview(businessId);
    const messages = rowMessages(row);
    const profile = rowProfile(row);

    const withUser: InterviewMessage[] = [
      ...messages,
      { role: "user", content: parsed.data.message },
    ];

    const turn = await runInterviewTurn({
      messages: withUser,
      profile,
    });

    const updatedMessages: InterviewMessage[] = [
      ...withUser,
      { role: "assistant", content: turn.reply },
    ];

    const [updated] = await db
      .update(businessProfileInterviewsTable)
      .set({
        messages: updatedMessages,
        profileData: turn.profile,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(businessProfileInterviewsTable.businessId, businessId))
      .returning();

    await syncProfileToRecords(businessId, turn.profile);

    res.json(
      SendProfileInterviewMessageResponse.parse(serializeInterview(updated)),
    );
  },
);

router.post(
  "/business-profile-interview/confirm",
  requireBusiness,
  async (req, res): Promise<void> => {
    const businessId = req.business!.id;
    const row = await getOrCreateInterview(businessId);
    const profile = rowProfile(row);
    if (!requiredComplete(profile)) {
      res.status(400).json({
        error:
          "The interview is still missing required fields. Keep answering the BDA's questions before confirming.",
      });
      return;
    }

    await syncProfileToRecords(businessId, profile);

    const [updated] = await db
      .update(businessProfileInterviewsTable)
      .set({ status: "confirmed", updatedAt: new Date().toISOString() })
      .where(eq(businessProfileInterviewsTable.businessId, businessId))
      .returning();

    await db
      .update(businessesTable)
      .set({ profileApproved: true })
      .where(eq(businessesTable.id, businessId));

    await logActivity(
      businessId,
      "business_updated",
      "Business profile interview completed and confirmed",
    );

    res.json(
      ConfirmProfileInterviewResponse.parse(serializeInterview(updated)),
    );
  },
);

router.post(
  "/business-profile-interview/reset",
  requireBusiness,
  async (req, res): Promise<void> => {
    const businessId = req.business!.id;
    await getOrCreateInterview(businessId);
    const [updated] = await db
      .update(businessProfileInterviewsTable)
      .set({
        messages: [
          { role: "assistant", content: INITIAL_INTERVIEW_MESSAGE },
        ] satisfies InterviewMessage[],
        profileData: emptyProfile(),
        status: "in_progress",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(businessProfileInterviewsTable.businessId, businessId))
      .returning();

    // Restarting the interview revokes the confirmed/approved state so the
    // Business Profile step is no longer marked complete. Previously synced
    // business data is intentionally preserved — it remains editable and will
    // be overwritten as the new interview captures fresh values.
    await db
      .update(businessesTable)
      .set({ profileApproved: false })
      .where(eq(businessesTable.id, businessId));

    await logActivity(
      businessId,
      "business_updated",
      "Business profile interview restarted",
    );

    res.json(ResetProfileInterviewResponse.parse(serializeInterview(updated)));
  },
);

export default router;
