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
  SaveStructuredProfileDataBody,
  SaveStructuredProfileDataResponse,
  AcceptPolicyDraftBody,
  AcceptPolicyDraftResponse,
} from "@workspace/api-zod";
import { requireBusiness } from "../lib/auth";
import { logActivity } from "../lib/business";
import {
  INITIAL_BDA_HELPER_MESSAGE,
  CHAT_FIELDS,
  EXTRA_FORM_KEYS,
  emptyProfile,
  capturedChatFields,
  missingChatFields,
  policiesComplete,
  runInterviewTurn,
  type InterviewMessage,
  type ProfileData,
  type PolicyDraft,
} from "../lib/profileInterview";

const router: IRouter = Router();

type InterviewRow = typeof businessProfileInterviewsTable.$inferSelect;

function rowProfile(row: InterviewRow): ProfileData {
  const base = emptyProfile();
  const stored = row.profileData;
  if (stored && typeof stored === "object") {
    for (const f of CHAT_FIELDS) {
      const v = (stored as Record<string, unknown>)[f.key];
      if (typeof v === "string" && v.trim().length > 0) base[f.key] = v;
    }
    for (const k of EXTRA_FORM_KEYS) {
      const v = (stored as Record<string, unknown>)[k];
      if (typeof v === "string" && v.trim().length > 0) base[k] = v;
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

function rowPolicyDraft(row: InterviewRow): PolicyDraft | null {
  const stored = row.profileData;
  if (!stored || typeof stored !== "object") return null;
  const raw = (stored as Record<string, unknown>)["_pendingDraft"];
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (
    typeof r.key === "string" &&
    typeof r.label === "string" &&
    typeof r.wording === "string" &&
    CHAT_FIELDS.some((f) => f.key === r.key)
  ) {
    return { key: r.key, label: r.label, wording: r.wording };
  }
  return null;
}

function serializeInterview(row: InterviewRow) {
  const profile = rowProfile(row);
  const captured = capturedChatFields(profile).map((f) => ({
    key: f.key,
    label: f.label,
    group: f.group,
    value: profile[f.key] as string,
  }));
  const stillMissing = missingChatFields(profile).map((f) => ({
    key: f.key,
    label: f.label,
    group: f.group,
    required: f.required,
  }));
  const formData = {
    businessAddress: profile["businessAddress"] ?? null,
    businessHours: profile["businessHours"] ?? null,
    emergencyAvailability: profile["emergencyAvailability"] ?? null,
    seasonalAvailability: profile["seasonalAvailability"] ?? null,
    yearsInBusiness: profile["yearsInBusiness"] ?? null,
    typicalResponseTime: profile["typicalResponseTime"] ?? null,
  };
  return {
    id: row.id,
    status: row.status,
    messages: rowMessages(row),
    captured,
    stillMissing,
    readyToConfirm: policiesComplete(profile),
    policyDraft: rowPolicyDraft(row) ?? null,
    formData,
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
        { role: "assistant", content: INITIAL_BDA_HELPER_MESSAGE },
      ] satisfies InterviewMessage[],
      profileData: emptyProfile(),
    })
    .returning();
  return created;
}

// Sync accepted policy wording into invoice_settings for downstream use.
async function syncPolicyToInvoiceSettings(
  businessId: number,
  key: string,
  wording: string,
): Promise<void> {
  const colMap: Record<string, string> = {
    paymentTerms: "paymentTerms",
    cancellationPolicy: "cancellationPolicy",
    depositRequirements: "depositRequirements",
    disclaimers: "estimateDisclaimer",
  };
  const col = colMap[key];
  if (!col) return;
  await db
    .update(invoiceSettingsTable)
    .set({ [col]: wording, updatedAt: new Date().toISOString() })
    .where(eq(invoiceSettingsTable.businessId, businessId));
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
      businessName: req.business!.name ?? null,
      messages: withUser,
      profile,
    });

    const updatedMessages: InterviewMessage[] = [
      ...withUser,
      { role: "assistant", content: turn.reply },
    ];

    // Store casual captured value; pending draft wording goes in _pendingDraft.
    const updatedProfileData: Record<string, unknown> = {
      ...turn.profile,
      _pendingDraft: turn.policyDraft ?? null,
    };

    const [updated] = await db
      .update(businessProfileInterviewsTable)
      .set({
        messages: updatedMessages,
        profileData: updatedProfileData,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(businessProfileInterviewsTable.businessId, businessId))
      .returning();

    res.json(
      SendProfileInterviewMessageResponse.parse(serializeInterview(updated)),
    );
  },
);

router.patch(
  "/business-profile-interview/structured",
  requireBusiness,
  async (req, res): Promise<void> => {
    const parsed = SaveStructuredProfileDataBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const businessId = req.business!.id;
    const row = await getOrCreateInterview(businessId);
    const profile = rowProfile(row);

    // Merge extra form fields into profileData
    const updatedProfileData: Record<string, unknown> = {
      ...((row.profileData as Record<string, unknown>) ?? {}),
    };
    const data = parsed.data;
    if (data.businessAddress != null)
      updatedProfileData["businessAddress"] = data.businessAddress;
    if (data.businessHours != null)
      updatedProfileData["businessHours"] = data.businessHours;
    if (data.emergencyAvailability != null)
      updatedProfileData["emergencyAvailability"] = data.emergencyAvailability;
    if (data.seasonalAvailability != null)
      updatedProfileData["seasonalAvailability"] = data.seasonalAvailability;
    if (data.yearsInBusiness != null)
      updatedProfileData["yearsInBusiness"] = data.yearsInBusiness;
    if (data.typicalResponseTime != null)
      updatedProfileData["typicalResponseTime"] = data.typicalResponseTime;

    const [updated] = await db
      .update(businessProfileInterviewsTable)
      .set({
        profileData: updatedProfileData,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(businessProfileInterviewsTable.businessId, businessId))
      .returning();

    // Keep policy draft from existing row since this is just form data
    void profile; // used above via spread
    res.json(
      SaveStructuredProfileDataResponse.parse(serializeInterview(updated)),
    );
  },
);

router.post(
  "/business-profile-interview/accept-policy",
  requireBusiness,
  async (req, res): Promise<void> => {
    const parsed = AcceptPolicyDraftBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const businessId = req.business!.id;
    const row = await getOrCreateInterview(businessId);

    const { key, wording } = parsed.data;

    // Validate key is a real chat field
    if (!CHAT_FIELDS.some((f) => f.key === key)) {
      res.status(400).json({ error: "Unknown policy key" });
      return;
    }

    // Save accepted wording into profileData and clear pending draft
    const updatedProfileData: Record<string, unknown> = {
      ...((row.profileData as Record<string, unknown>) ?? {}),
      [key]: wording,
      _pendingDraft: null,
    };

    const [updated] = await db
      .update(businessProfileInterviewsTable)
      .set({
        profileData: updatedProfileData,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(businessProfileInterviewsTable.businessId, businessId))
      .returning();

    // Sync into invoice_settings for fields that map there
    await syncPolicyToInvoiceSettings(businessId, key, wording);

    res.json(AcceptPolicyDraftResponse.parse(serializeInterview(updated)));
  },
);

router.post(
  "/business-profile-interview/confirm",
  requireBusiness,
  async (req, res): Promise<void> => {
    const businessId = req.business!.id;
    const row = await getOrCreateInterview(businessId);
    const profile = rowProfile(row);

    if (!policiesComplete(profile)) {
      res.status(400).json({
        error:
          "Still missing required policy fields. Keep chatting with the BDA helper to complete them.",
      });
      return;
    }

    // Sync accepted policy fields into invoice settings
    const policyToCol: Record<string, string> = {
      paymentTerms: "paymentTerms",
      cancellationPolicy: "cancellationPolicy",
      disclaimers: "estimateDisclaimer",
    };
    const invoiceUpdate: Record<string, string> = {};
    for (const [k, col] of Object.entries(policyToCol)) {
      const v = profile[k];
      if (typeof v === "string" && v.trim().length > 0) {
        invoiceUpdate[col] = v;
      }
    }
    if (Object.keys(invoiceUpdate).length > 0) {
      await db
        .update(invoiceSettingsTable)
        .set({ ...invoiceUpdate, updatedAt: new Date().toISOString() })
        .where(eq(invoiceSettingsTable.businessId, businessId));
    }

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
      "Business profile completed and confirmed",
    );

    res.json(ConfirmProfileInterviewResponse.parse(serializeInterview(updated)));
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
          { role: "assistant", content: INITIAL_BDA_HELPER_MESSAGE },
        ] satisfies InterviewMessage[],
        profileData: emptyProfile(),
        status: "in_progress",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(businessProfileInterviewsTable.businessId, businessId))
      .returning();

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
