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
import { DEFAULT_INVOICE_LANGUAGE } from "../lib/defaults";

const router: IRouter = Router();

async function getOrCreateSettings(businessId: number) {
  let [row] = await db
    .select()
    .from(invoiceSettingsTable)
    .where(eq(invoiceSettingsTable.businessId, businessId));
  if (!row) {
    [row] = await db
      .insert(invoiceSettingsTable)
      .values({ businessId, ...DEFAULT_INVOICE_LANGUAGE })
      .returning();
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
    const [row] = await db
      .update(invoiceSettingsTable)
      .set({ ...parsed.data, updatedAt: new Date().toISOString() })
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
