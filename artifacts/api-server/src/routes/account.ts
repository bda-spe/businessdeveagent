import { Router, type IRouter } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
import {
  db,
  businessesTable,
  usersTable,
  servicesTable,
  sandboxTestsTable,
  activityEventsTable,
  businessIndustriesTable,
} from "@workspace/db";
import {
  GetMeResponse,
  CreateBusinessBody,
  CreateBusinessResponse,
  GetBusinessResponse,
  UpdateBusinessBody,
  UpdateBusinessResponse,
  UpdateBusinessEmailBody,
  UpdateBusinessEmailResponse,
  DeleteAccountResponse,
  ApproveBusinessProfileResponse,
  SetBusinessIndustriesBody,
  ListBusinessIndustriesResponse,
  SetBusinessIndustriesResponse,
} from "@workspace/api-zod";
import { requireBusiness, requireActiveSubscription } from "../lib/auth";
import {
  generateClientId,
  seedBusinessDefaults,
  logActivity,
} from "../lib/business";
import { computeSetupProgress } from "../lib/setupProgress";
import { isStripeConfigured, getStripe } from "../lib/stripe";

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
    widgetStyled: false,
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

  // Fire-and-forget — never block account creation on email delivery
  import("../lib/subscription").then(({ sendWelcomeEmailForBusiness }) => {
    sendWelcomeEmailForBusiness(business).catch(() => {});
  });

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

router.patch(
  "/business/email",
  requireBusiness,
  async (req, res): Promise<void> => {
    const parsed = UpdateBusinessEmailBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const email = parsed.data.email.trim().toLowerCase();

    const [updated] = await db
      .update(businessesTable)
      .set({ email })
      .where(eq(businessesTable.id, req.business!.id))
      .returning();
    await logActivity(
      req.business!.id,
      "business_updated",
      "Account email updated",
    );
    res.json(UpdateBusinessEmailResponse.parse(updated));
  },
);

router.delete("/account", requireBusiness, async (req, res): Promise<void> => {
  const business = req.business!;
  const user = req.appUser!;

  try {
    if (
      business.stripeSubscriptionId &&
      isStripeConfigured()
    ) {
      try {
        await getStripe().subscriptions.update(business.stripeSubscriptionId, {
          cancel_at_period_end: true,
        });
        console.log(
          `[account] Subscription ${business.stripeSubscriptionId} for business ${business.id} scheduled to cancel at period end (account deletion)`,
        );
      } catch (err) {
        console.error(
          `[account] Failed to schedule subscription cancellation for business ${business.id} during account deletion:`,
          err,
        );
      }
    }

    // Deleting the user row cascades to the business row and every
    // business-scoped table (services, leads, files, etc.) via FK ON DELETE
    // CASCADE, wiping all product data immediately.
    await db.delete(usersTable).where(eq(usersTable.id, user.id));

    try {
      await clerkClient.users.deleteUser(user.clerkUserId);
    } catch (err) {
      console.error(
        `[account] Failed to delete Clerk user ${user.clerkUserId} during account deletion:`,
        err,
      );
    }

    res.json(DeleteAccountResponse.parse({ success: true }));
  } catch (err) {
    console.error(
      `[account] Failed to delete account for business ${business.id}:`,
      err,
    );
    res.status(500).json({ error: "Failed to delete account. Please try again." });
  }
});

router.get(
  "/business/industries",
  requireBusiness,
  async (req, res): Promise<void> => {
    const rows = await db
      .select()
      .from(businessIndustriesTable)
      .where(eq(businessIndustriesTable.businessId, req.business!.id));
    res.json(ListBusinessIndustriesResponse.parse(rows));
  },
);

router.put(
  "/business/industries",
  requireBusiness,
  requireActiveSubscription,
  async (req, res): Promise<void> => {
    const parsed = SetBusinessIndustriesBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { industries, customIndustry } = parsed.data;

    const sanitize = (s: string) =>
      s.replace(/<[^>]*>/g, "").trim().slice(0, 200);

    const primary = industries.find((i) => i.isPrimary) ?? industries[0];

    await db.transaction(async (tx) => {
      await tx
        .delete(businessIndustriesTable)
        .where(eq(businessIndustriesTable.businessId, req.business!.id));

      await tx.insert(businessIndustriesTable).values(
        industries.map((i) => ({
          businessId: req.business!.id,
          industryCategory: sanitize(i.industryCategory),
          industryName: sanitize(i.industryName),
          isPrimary: i.isPrimary,
        })),
      );

      await tx
        .update(businessesTable)
        .set({
          primaryIndustryCategory: sanitize(primary.industryCategory),
          primaryIndustry: sanitize(primary.industryName),
          customIndustry: customIndustry ? sanitize(customIndustry) : null,
          industry: sanitize(primary.industryName),
        })
        .where(eq(businessesTable.id, req.business!.id));
    });

    const rows = await db
      .select()
      .from(businessIndustriesTable)
      .where(eq(businessIndustriesTable.businessId, req.business!.id));

    await logActivity(
      req.business!.id,
      "business_updated",
      `Industry selections updated (${industries.length} selected, primary: ${primary.industryName})`,
    );

    res.json(SetBusinessIndustriesResponse.parse(rows));
  },
);

export default router;
