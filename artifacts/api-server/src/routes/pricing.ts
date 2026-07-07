import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, pricingRulesTable } from "@workspace/db";
import { GetPricingResponse, SavePricingBody, SavePricingResponse } from "@workspace/api-zod";
import { requireBusiness } from "../lib/auth";
import { logActivity } from "../lib/business";

const router: IRouter = Router();

router.get("/pricing", requireBusiness, async (req, res): Promise<void> => {
  let [row] = await db
    .select()
    .from(pricingRulesTable)
    .where(eq(pricingRulesTable.businessId, req.business!.id));
  if (!row) {
    [row] = await db
      .insert(pricingRulesTable)
      .values({ businessId: req.business!.id })
      .returning();
  }
  res.json(GetPricingResponse.parse(row));
});

router.put("/pricing", requireBusiness, async (req, res): Promise<void> => {
  const parsed = SavePricingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  let [row] = await db
    .update(pricingRulesTable)
    .set({ ...parsed.data, updatedAt: new Date().toISOString() })
    .where(eq(pricingRulesTable.businessId, req.business!.id))
    .returning();
  if (!row) {
    [row] = await db
      .insert(pricingRulesTable)
      .values({ businessId: req.business!.id, ...parsed.data })
      .returning();
  }
  await logActivity(req.business!.id, "pricing_updated", "Pricing rules updated");
  res.json(SavePricingResponse.parse(row));
});

export default router;
