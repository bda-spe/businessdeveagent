import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, estimateRulesTable } from "@workspace/db";
import {
  GetEstimateRulesResponse,
  SaveEstimateRulesBody,
  SaveEstimateRulesResponse,
} from "@workspace/api-zod";
import { requireBusiness } from "../lib/auth";
import { logActivity } from "../lib/business";

const router: IRouter = Router();

async function getOrCreate(businessId: number) {
  let [row] = await db
    .select()
    .from(estimateRulesTable)
    .where(eq(estimateRulesTable.businessId, businessId));
  if (!row) {
    [row] = await db
      .insert(estimateRulesTable)
      .values({ businessId })
      .returning();
  }
  return row;
}

router.get(
  "/business/estimate-rules",
  requireBusiness,
  async (req, res): Promise<void> => {
    const row = await getOrCreate(req.business!.id);
    res.json(GetEstimateRulesResponse.parse(row));
  },
);

router.patch(
  "/business/estimate-rules",
  requireBusiness,
  async (req, res): Promise<void> => {
    const parsed = SaveEstimateRulesBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    await getOrCreate(req.business!.id);
    const [updated] = await db
      .update(estimateRulesTable)
      .set({ ...parsed.data, updatedAt: new Date().toISOString() })
      .where(eq(estimateRulesTable.businessId, req.business!.id))
      .returning();
    await logActivity(
      req.business!.id,
      "business_updated",
      "Estimate rules updated",
    );
    res.json(SaveEstimateRulesResponse.parse(updated));
  },
);

export default router;
