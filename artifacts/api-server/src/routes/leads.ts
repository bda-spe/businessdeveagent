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
} from "@workspace/api-zod";
import { requireBusiness } from "../lib/auth";
import { logActivity } from "../lib/business";

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

export default router;
