import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, invoiceSettingsTable } from "@workspace/db";
import {
  GetInvoiceSettingsResponse,
  SaveInvoiceSettingsBody,
  SaveInvoiceSettingsResponse,
} from "@workspace/api-zod";
import { requireBusiness } from "../lib/auth";
import { logActivity } from "../lib/business";
import {
  DEFAULT_INVOICE_LANGUAGE,
  DEFAULT_EMAIL_SETTINGS,
} from "../lib/defaults";

const router: IRouter = Router();

// The five section keys that used to gate policy/legal text individually,
// before they were collapsed into the single `showPolicies` toggle.
const LEGACY_POLICY_SECTION_KEYS = [
  "cancellation_policy",
  "payment_terms",
  "terms_conditions",
  "estimate_disclaimer",
  "acceptance_language",
];

export async function getOrCreateSettings(businessId: number) {
  let [row] = await db
    .select()
    .from(invoiceSettingsTable)
    .where(eq(invoiceSettingsTable.businessId, businessId));
  if (!row) {
    [row] = await db
      .insert(invoiceSettingsTable)
      .values({
        businessId,
        ...DEFAULT_INVOICE_LANGUAGE,
        ...DEFAULT_EMAIL_SETTINGS,
      })
      .returning();
  }
  if (row.emailSubject == null) {
    row = {
      ...row,
      emailSubject: DEFAULT_EMAIL_SETTINGS.emailSubject,
      emailGreeting: row.emailGreeting ?? DEFAULT_EMAIL_SETTINGS.emailGreeting,
      emailBodyText: row.emailBodyText ?? DEFAULT_EMAIL_SETTINGS.emailBodyText,
      emailClosing: row.emailClosing ?? DEFAULT_EMAIL_SETTINGS.emailClosing,
    };
  }
  if (row.brandColor == null) {
    row = { ...row, brandColor: DEFAULT_EMAIL_SETTINGS.brandColor };
  }
  // One-time normalization for businesses created before quote formatting was
  // simplified to a single template + one "Show policies on estimate"
  // toggle. Legacy rows may have `showPolicies` left at its default (false)
  // even though the business had previously enabled one or more of the five
  // policy sections individually — infer intent from that legacy data so
  // existing quotes don't silently lose their policy text.
  if (!row.showPolicies) {
    const legacySections = Array.isArray(row.includedSections)
      ? (row.includedSections as string[])
      : [];
    const hadAnyPolicySection = LEGACY_POLICY_SECTION_KEYS.some((key) =>
      legacySections.includes(key),
    );
    if (hadAnyPolicySection) {
      const [updated] = await db
        .update(invoiceSettingsTable)
        .set({ showPolicies: true, updatedAt: new Date().toISOString() })
        .where(eq(invoiceSettingsTable.businessId, businessId))
        .returning();
      row = updated ?? { ...row, showPolicies: true };
    }
  }
  return row;
}

router.get(
  "/invoice-settings",
  requireBusiness,
  async (req, res): Promise<void> => {
    const row = await getOrCreateSettings(req.business!.id);
    res.json(GetInvoiceSettingsResponse.parse(row));
  },
);

router.put(
  "/invoice-settings",
  requireBusiness,
  async (req, res): Promise<void> => {
    const parsed = SaveInvoiceSettingsBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    await getOrCreateSettings(req.business!.id);
    const updateData: Record<string, unknown> = {
      ...parsed.data,
      updatedAt: new Date().toISOString(),
    };
    if (updateData.brandColor == null) delete updateData.brandColor;
    const [row] = await db
      .update(invoiceSettingsTable)
      .set(updateData)
      .where(eq(invoiceSettingsTable.businessId, req.business!.id))
      .returning();
    await logActivity(
      req.business!.id,
      "invoice_settings_updated",
      "Invoice formatting saved",
    );
    res.json(SaveInvoiceSettingsResponse.parse(row));
  },
);

export default router;
