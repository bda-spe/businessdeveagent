import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, businessesTable, usersTable } from "@workspace/db";
import {
  GetMeResponse,
  CreateBusinessBody,
  CreateBusinessResponse,
  GetBusinessResponse,
  UpdateBusinessBody,
  UpdateBusinessResponse,
  ApproveBusinessProfileResponse,
} from "@workspace/api-zod";
import { requireBusiness } from "../lib/auth";
import {
  generateClientId,
  seedBusinessDefaults,
  logActivity,
} from "../lib/business";

const router: IRouter = Router();

router.get("/me", async (req, res): Promise<void> => {
  const user = req.appUser!;
  const business = req.business ?? null;
  res.json(
    GetMeResponse.parse({
      user: { id: user.id, email: user.email, ownerName: user.ownerName },
      business,
      onboardingComplete: !!business,
    }),
  );
});

router.post("/onboarding/business", async (req, res): Promise<void> => {
  const parsed = CreateBusinessBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (req.business) {
    res.status(400).json({ error: "Business already exists" });
    return;
  }
  const user = req.appUser!;

  await db
    .update(usersTable)
    .set({ ownerName: parsed.data.ownerName })
    .where(eq(usersTable.id, user.id));

  const [business] = await db
    .insert(businessesTable)
    .values({
      userId: user.id,
      clientId: generateClientId(),
      name: parsed.data.businessName,
      email: user.email || null,
    })
    .returning();

  await seedBusinessDefaults(business.id);
  await logActivity(
    business.id,
    "business_created",
    `Business "${business.name}" created`,
  );

  res.status(201).json(CreateBusinessResponse.parse(business));
});

router.get("/business", requireBusiness, async (req, res): Promise<void> => {
  res.json(GetBusinessResponse.parse(req.business));
});

router.patch("/business", requireBusiness, async (req, res): Promise<void> => {
  const parsed = UpdateBusinessBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [updated] = await db
    .update(businessesTable)
    .set(parsed.data)
    .where(eq(businessesTable.id, req.business!.id))
    .returning();
  await logActivity(req.business!.id, "business_updated", "Business info updated");
  res.json(UpdateBusinessResponse.parse(updated));
});

router.post(
  "/business/approve",
  requireBusiness,
  async (req, res): Promise<void> => {
    const [updated] = await db
      .update(businessesTable)
      .set({ profileApproved: true })
      .where(eq(businessesTable.id, req.business!.id))
      .returning();
    await logActivity(
      req.business!.id,
      "profile_approved",
      "Business profile approved and ready for training",
    );
    res.json(ApproveBusinessProfileResponse.parse(updated));
  },
);

export default router;
