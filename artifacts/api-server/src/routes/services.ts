import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, servicesTable } from "@workspace/db";
import {
  ListServicesResponse,
  CreateServiceBody,
  CreateServiceResponse,
  UpdateServiceParams,
  UpdateServiceBody,
  UpdateServiceResponse,
  DeleteServiceParams,
} from "@workspace/api-zod";
import { requireBusiness } from "../lib/auth";
import { logActivity } from "../lib/business";

const router: IRouter = Router();

router.get("/services", requireBusiness, async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(servicesTable)
    .where(eq(servicesTable.businessId, req.business!.id))
    .orderBy(servicesTable.createdAt);
  res.json(ListServicesResponse.parse(rows));
});

router.post("/services", requireBusiness, async (req, res): Promise<void> => {
  const parsed = CreateServiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .insert(servicesTable)
    .values({ businessId: req.business!.id, ...parsed.data })
    .returning();
  await logActivity(
    req.business!.id,
    "service_created",
    `Service "${row.name}" added`,
  );
  res.status(201).json(CreateServiceResponse.parse(row));
});

router.patch(
  "/services/:id",
  requireBusiness,
  async (req, res): Promise<void> => {
    const params = UpdateServiceParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateServiceBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [row] = await db
      .update(servicesTable)
      .set(parsed.data)
      .where(
        and(
          eq(servicesTable.id, params.data.id),
          eq(servicesTable.businessId, req.business!.id),
        ),
      )
      .returning();
    if (!row) {
      res.status(404).json({ error: "Service not found" });
      return;
    }
    res.json(UpdateServiceResponse.parse(row));
  },
);

router.delete(
  "/services/:id",
  requireBusiness,
  async (req, res): Promise<void> => {
    const params = DeleteServiceParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [row] = await db
      .delete(servicesTable)
      .where(
        and(
          eq(servicesTable.id, params.data.id),
          eq(servicesTable.businessId, req.business!.id),
        ),
      )
      .returning();
    if (!row) {
      res.status(404).json({ error: "Service not found" });
      return;
    }
    res.sendStatus(204);
  },
);

export default router;
