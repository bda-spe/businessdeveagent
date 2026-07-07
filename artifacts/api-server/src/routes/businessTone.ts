import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, businessToneTable } from "@workspace/db";
import {
  GetBusinessToneResponse,
  SaveBusinessToneBody,
  SaveBusinessToneResponse,
} from "@workspace/api-zod";
import { requireBusiness } from "../lib/auth";
import { logActivity } from "../lib/business";

const router: IRouter = Router();

async function getOrCreate(businessId: number) {
  let [row] = await db
    .select()
    .from(businessToneTable)
    .where(eq(businessToneTable.businessId, businessId));
  if (!row) {
    [row] = await db
      .insert(businessToneTable)
      .values({ businessId })
      .returning();
  }
  return row;
}

router.get(
  "/business/tone",
  requireBusiness,
  async (req, res): Promise<void> => {
    const row = await getOrCreate(req.business!.id);
    res.json(GetBusinessToneResponse.parse(row));
  },
);

router.patch(
  "/business/tone",
  requireBusiness,
  async (req, res): Promise<void> => {
    const parsed = SaveBusinessToneBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    await getOrCreate(req.business!.id);
    const [updated] = await db
      .update(businessToneTable)
      .set({ ...parsed.data, updatedAt: new Date().toISOString() })
      .where(eq(businessToneTable.businessId, req.business!.id))
      .returning();
    await logActivity(
      req.business!.id,
      "business_updated",
      "Business tone updated",
    );
    res.json(SaveBusinessToneResponse.parse(updated));
  },
);

export default router;
