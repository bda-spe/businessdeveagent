import { Router, type IRouter } from "express";
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  businessesTable,
  usersTable,
  servicesTable,
  sandboxTestsTable,
  activityEventsTable,
} from "@workspace/db";
import {
  GetMeResponse,
  CreateBusinessBody,
  CreateBusinessResponse,
  GetBusinessResponse,
  UpdateBusinessBody,
  UpdateBusinessResponse,
  ApproveBusinessProfileResponse,
} from "@workspace/api-zod";
import { requireBusiness, requireActiveSubscription } from "../lib/auth";
import {
  generateClientId,
  seedBusinessDefaults,
  logActivity,
} from "../lib/business";
import { computeSetupProgress } from "../lib/setupProgress";

const router: IRouter = Router();

router.get("/me", async (req, res): Promise<void> => {
  const user = req.appUser!;
  const business = req.business ?? null;

  let setupProgress = {
    businessProfile: false,
    services: false,
    pricing: false,
    invoiceFormatting: false,
    widget: false,
    testAgent: false,
  };

  if (business) {
    setupProgress = await computeSetupProgress(business);
  }

  res.json(
    GetMeResponse.parse({
      user: { id: user.id, email: user.email, ownerName: user.ownerName },
      business,
      onboardingComplete: !!business,
      setupProgress,
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

  const now = new Date();
  const trialEnds = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const [business] = await db
    .insert(businessesTable)
    .values({
      userId: user.id,
      clientId: generateClientId(),
      name: parsed.data.businessName,
      email: user.email || null,
      active: true,
      subscriptionStatus: "trialing",
      trialStartedAt: now.toISOString(),
      trialEndsAt: trialEnds.toISOString(),
      planType: "none",
      buildFeePaid: false,
      widgetReady: false,
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

// Business profile mutations are Agent Management actions: locked once the
// trial has expired without an active subscription.
router.patch(
  "/business",
  requireBusiness,
  requireActiveSubscription,
  async (req, res): Promise<void> => {
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
    await logActivity(
      req.business!.id,
      "business_updated",
      "Business info updated",
    );
    res.json(UpdateBusinessResponse.parse(updated));
  },
);

router.post(
  "/business/approve",
  requireBusiness,
  requireActiveSubscription,
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

router.post(
  "/business/profile/confirm",
  requireBusiness,
  requireActiveSubscription,
  async (req, res): Promise<void> => {
    const [updated] = await db
      .update(businessesTable)
      .set({ profileApproved: true })
      .where(eq(businessesTable.id, req.business!.id))
      .returning();
    await logActivity(
      req.business!.id,
      "profile_approved",
      "Business profile confirmed via setup wizard",
    );
    res.json(ApproveBusinessProfileResponse.parse(updated));
  },
);

export default router;
