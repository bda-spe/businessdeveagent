import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, businessOperationsTable } from "@workspace/db";
import {
  GetBusinessOperationsResponse,
  SaveBusinessOperationsBody,
  SaveBusinessOperationsResponse,
} from "@workspace/api-zod";
import { requireBusiness } from "../lib/auth";
import { logActivity } from "../lib/business";

const router: IRouter = Router();

async function getOrCreate(businessId: number) {
  let [row] = await db
    .select()
    .from(businessOperationsTable)
    .where(eq(businessOperationsTable.businessId, businessId));
  if (!row) {
    [row] = await db
      .insert(businessOperationsTable)
      .values({ businessId })
      .returning();
  }
  return row;
}

router.get(
  "/business/operations",
  requireBusiness,
  async (req, res): Promise<void> => {
    const row = await getOrCreate(req.business!.id);
    res.json(GetBusinessOperationsResponse.parse(row));
  },
);

router.patch(
  "/business/operations",
  requireBusiness,
  async (req, res): Promise<void> => {
    const parsed = SaveBusinessOperationsBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    await getOrCreate(req.business!.id);
    const [updated] = await db
      .update(businessOperationsTable)
      .set({ ...parsed.data, updatedAt: new Date().toISOString() })
      .where(eq(businessOperationsTable.businessId, req.business!.id))
      .returning();
    await logActivity(
      req.business!.id,
      "business_updated",
      "Company operations updated",
    );
    res.json(SaveBusinessOperationsResponse.parse(updated));
  },
);

export default router;
