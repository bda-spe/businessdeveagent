import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, billingSubscriptionsTable, businessesTable } from "@workspace/db";
import {
  ListBillingPlansResponse,
  GetSubscriptionResponse,
  CheckoutBody,
  CheckoutResponse,
  ConfirmCheckoutBody,
} from "@workspace/api-zod";
import { requireBusiness } from "../lib/auth";
import { BILLING_PLANS } from "../lib/defaults";
import {
  getStripe,
  getSetupFeePriceId,
  isStripeConfigured,
  priceIdForPlan,
} from "../lib/stripe";
import { activateFromCheckoutSession } from "../lib/subscription";

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

    let currentPeriodEnd: string | null = null;
    let cancelAtPeriodEnd: boolean | null = null;

    const stripeSubId = req.business!.stripeSubscriptionId;
    if (row.active && stripeSubId && isStripeConfigured()) {
      try {
        const stripeSub = await getStripe().subscriptions.retrieve(stripeSubId);
        const periodEnd = (stripeSub as unknown as { current_period_end?: number }).current_period_end;
        if (typeof periodEnd === "number") {
          currentPeriodEnd = new Date(periodEnd * 1000).toISOString();
        }
        cancelAtPeriodEnd = stripeSub.cancel_at_period_end ?? null;
      } catch (err) {
        console.warn(
          `[billing] Could not fetch Stripe subscription details for business ${req.business!.id}: ${err}`,
        );
      }
    }

    res.json(
      GetSubscriptionResponse.parse({
        ...row,
        currentPeriodEnd,
        cancelAtPeriodEnd,
      }),
    );
  },
);

/**
 * Creates a Stripe Embedded Checkout session for the selected plan. The
 * one-time setup fee is included only when the business has not paid it yet.
 * Activation happens via Stripe webhooks (source of truth), with
 * /billing/checkout/confirm as a client-driven fallback.
 */
router.post(
  "/billing/checkout",
  requireBusiness,
  async (req, res): Promise<void> => {
    const parsed = CheckoutBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    if (!isStripeConfigured()) {
      res.status(503).json({
        error: "Billing is not configured yet. Please try again later.",
      });
      return;
    }
    const plan = BILLING_PLANS.find((p) => p.id === parsed.data.planId);
    if (!plan) {
      res.status(400).json({ error: "Unknown plan" });
      return;
    }
    const priceId = priceIdForPlan(plan.id);
    if (!priceId) {
      res.status(500).json({ error: "Plan is not configured for billing" });
      return;
    }

    const business = req.business!;
    const stripe = getStripe();

    let customerId = business.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: business.name,
        email: business.email ?? req.appUser?.email ?? undefined,
        metadata: {
          businessId: String(business.id),
          clientId: business.clientId,
        },
      });
      customerId = customer.id;
      await db
        .update(businessesTable)
        .set({ stripeCustomerId: customerId })
        .where(eq(businessesTable.id, business.id));
      console.log(
        `[stripe] Created customer ${customerId} for business ${business.id} (${business.clientId})`,
      );
    }

    const lineItems: { price: string; quantity: number }[] = [
      { price: priceId, quantity: 1 },
    ];
    if (!business.buildFeePaid) {
      const setupFeePriceId = getSetupFeePriceId();
      if (setupFeePriceId) {
        lineItems.push({ price: setupFeePriceId, quantity: 1 });
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      ui_mode: "embedded_page",
      redirect_on_completion: "never",
      customer: customerId,
      line_items: lineItems,
      metadata: {
        businessId: String(business.id),
        planId: plan.id,
      },
      subscription_data: {
        metadata: {
          businessId: String(business.id),
          planId: plan.id,
        },
      },
    });

    console.log(
      `[stripe] Created embedded checkout session ${session.id} for business ${business.id} (plan=${plan.id}, setupFee=${!business.buildFeePaid})`,
    );

    res.json(
      CheckoutResponse.parse({
        clientSecret: session.client_secret,
        sessionId: session.id,
      }),
    );
  },
);

/**
 * Client-side fallback after the embedded checkout completes: verifies the
 * session server-side with Stripe and activates the business if the webhook
 * has not arrived yet. Idempotent with the webhook handler.
 */
router.post(
  "/billing/checkout/confirm",
  requireBusiness,
  async (req, res): Promise<void> => {
    const parsed = ConfirmCheckoutBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    if (!isStripeConfigured()) {
      res.status(503).json({ error: "Billing is not configured yet." });
      return;
    }

    const session = await getStripe().checkout.sessions.retrieve(
      parsed.data.sessionId,
    );
    if (Number(session.metadata?.businessId) !== req.business!.id) {
      res.status(403).json({ error: "Session does not belong to this business" });
      return;
    }
    if (session.status !== "complete") {
      res.status(400).json({
        error: `Checkout is not complete (status: ${session.status})`,
      });
      return;
    }

    const row = await activateFromCheckoutSession(session);
    if (!row) {
      res.status(500).json({ error: "Failed to activate subscription" });
      return;
    }
    res.json(GetSubscriptionResponse.parse(row));
  },
);

/**
 * Creates a Stripe Customer Portal session so the user can manage their
 * payment methods, download invoices, and update billing info.
 */
router.post(
  "/billing/portal",
  requireBusiness,
  async (req, res): Promise<void> => {
    if (!isStripeConfigured()) {
      res.status(503).json({ error: "Billing is not configured yet." });
      return;
    }
    const business = req.business!;
    if (!business.stripeCustomerId) {
      res.status(400).json({
        error: "This account does not have an active billing profile.",
      });
      return;
    }

    const returnUrl = "https://businessdevelopmentagent.replit.app/billing";

    try {
      const session = await getStripe().billingPortal.sessions.create({
        customer: business.stripeCustomerId,
        return_url: returnUrl,
      });
      res.json({ url: session.url });
    } catch (err) {
      console.error(
        `[billing] Customer portal session creation failed for business ${business.id}:`,
        err,
      );
      res.status(502).json({
        error:
          "Could not open billing portal. Ensure the Customer Portal is configured in your Stripe dashboard.",
      });
    }
  },
);

/**
 * Cancels the business's active Stripe subscription at the end of the current
 * billing period. Does not immediately deactivate — the webhook
 * (customer.subscription.deleted) is the source of truth.
 */
router.post(
  "/billing/cancel",
  requireBusiness,
  async (req, res): Promise<void> => {
    if (!isStripeConfigured()) {
      res.status(503).json({ error: "Billing is not configured yet." });
      return;
    }
    const business = req.business!;
    if (!business.stripeSubscriptionId) {
      res.status(400).json({ error: "No active subscription found." });
      return;
    }

    try {
      await getStripe().subscriptions.update(business.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
      console.log(
        `[billing] Subscription ${business.stripeSubscriptionId} for business ${business.id} set to cancel at period end`,
      );
      res.json({ success: true });
    } catch (err) {
      console.error(
        `[billing] Failed to cancel subscription ${business.stripeSubscriptionId} for business ${business.id}:`,
        err,
      );
      res.status(502).json({ error: "Failed to cancel subscription. Please try again." });
    }
  },
);

export default router;
