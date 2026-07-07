import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import {
  db,
  requirementsTable,
  servicesTable,
  pricingRulesTable,
} from "@workspace/db";
import {
  ListRequirementsResponse,
  UpdateRequirementParams,
  UpdateRequirementBody,
  UpdateRequirementResponse,
} from "@workspace/api-zod";
import { requireBusiness } from "../lib/auth";
import { computeRequirementStatus } from "../lib/business";

const router: IRouter = Router();

router.get("/requirements", requireBusiness, async (req, res): Promise<void> => {
  const bid = req.business!.id;
  const [rows, services, pricingRows] = await Promise.all([
    db
      .select()
      .from(requirementsTable)
      .where(eq(requirementsTable.businessId, bid))
      .orderBy(requirementsTable.id),
    db.select().from(servicesTable).where(eq(servicesTable.businessId, bid)),
    db
      .select()
      .from(pricingRulesTable)
      .where(eq(pricingRulesTable.businessId, bid)),
  ]);
  const pricing = pricingRows[0] ?? null;
  const withStatus = rows.map((r) => ({
    ...r,
    status: computeRequirementStatus(r, {
      business: req.business!,
      servicesCount: services.length,
      pricing,
    }),
  }));
  res.json(ListRequirementsResponse.parse(withStatus));
});

router.patch(
  "/requirements/:id",
  requireBusiness,
  async (req, res): Promise<void> => {
    const params = UpdateRequirementParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateRequirementBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [row] = await db
      .update(requirementsTable)
      .set(parsed.data)
      .where(
        and(
          eq(requirementsTable.id, params.data.id),
          eq(requirementsTable.businessId, req.business!.id),
        ),
      )
      .returning();
    if (!row) {
      res.status(404).json({ error: "Requirement not found" });
      return;
    }
    res.json(UpdateRequirementResponse.parse(row));
  },
);

export default router;
