import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, billingSubscriptionsTable, businessesTable } from "@workspace/db";
import {
  ListBillingPlansResponse,
  GetSubscriptionResponse,
  CheckoutBody,
  CheckoutResponse,
} from "@workspace/api-zod";
import { requireBusiness } from "../lib/auth";
import { logActivity } from "../lib/business";
import { BILLING_PLANS } from "../lib/defaults";

const router: IRouter = Router();

router.get("/billing/plans", requireBusiness, async (_req, res): Promise<void> => {
  res.json(ListBillingPlansResponse.parse(BILLING_PLANS));
});

router.get(
  "/billing/subscription",
  requireBusiness,
  async (req, res): Promise<void> => {
    const [row] = await db
      .select()
      .from(billingSubscriptionsTable)
      .where(eq(billingSubscriptionsTable.businessId, req.business!.id))
      .orderBy(desc(billingSubscriptionsTable.id));
    if (!row) {
      res.json(
        GetSubscriptionResponse.parse({ status: "inactive", active: false }),
      );
      return;
    }
    res.json(GetSubscriptionResponse.parse(row));
  },
);

router.post(
  "/billing/checkout",
  requireBusiness,
  async (req, res): Promise<void> => {
    const parsed = CheckoutBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const plan = BILLING_PLANS.find((p) => p.id === parsed.data.planId);
    if (!plan) {
      res.status(400).json({ error: "Unknown plan" });
      return;
    }

    // TODO: Integrate real Stripe checkout. For now this is a placeholder
    // that activates the business immediately upon "checkout".
    const bid = req.business!.id;
    let [row] = await db
      .update(billingSubscriptionsTable)
      .set({
        planId: plan.id,
        planName: plan.name,
        status: "active",
        active: true,
      })
      .where(eq(billingSubscriptionsTable.businessId, bid))
      .returning();
    if (!row) {
      [row] = await db
        .insert(billingSubscriptionsTable)
        .values({
          businessId: bid,
          planId: plan.id,
          planName: plan.name,
          status: "active",
          active: true,
        })
        .returning();
    }

    await db
      .update(businessesTable)
      .set({ status: "active" })
      .where(eq(businessesTable.id, bid));

    await logActivity(bid, "subscription_activated", `Activated ${plan.name} plan`);
    res.json(CheckoutResponse.parse(row));
  },
);

export default router;
