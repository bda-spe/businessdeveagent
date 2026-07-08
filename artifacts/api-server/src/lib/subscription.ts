import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, billingSubscriptionsTable, businessesTable } from "@workspace/db";
import { logActivity } from "./business";
import { BILLING_PLANS } from "./defaults";

type AppBusiness = typeof businessesTable.$inferSelect;

async function upsertBillingSubscription(
  businessId: number,
  values: {
    planId?: string;
    planName?: string;
    status: string;
    active: boolean;
  },
): Promise<typeof billingSubscriptionsTable.$inferSelect> {
  let [row] = await db
    .update(billingSubscriptionsTable)
    .set(values)
    .where(eq(billingSubscriptionsTable.businessId, businessId))
    .returning();
  if (!row) {
    [row] = await db
      .insert(billingSubscriptionsTable)
      .values({ businessId, ...values })
      .returning();
  }
  return row;
}

export async function findBusinessByStripeCustomerId(
  customerId: string,
): Promise<AppBusiness | null> {
  const [business] = await db
    .select()
    .from(businessesTable)
    .where(eq(businessesTable.stripeCustomerId, customerId));
  return business ?? null;
}

/**
 * Activate a business from a completed Stripe Checkout session. Idempotent:
 * safe to run from both the webhook and the client-side confirm fallback.
 * Never deletes data and never touches client_id.
 */
export async function activateFromCheckoutSession(
  session: Stripe.Checkout.Session,
): Promise<typeof billingSubscriptionsTable.$inferSelect | null> {
  const businessId = Number(session.metadata?.businessId);
  const planId = session.metadata?.planId ?? "";
  if (!Number.isInteger(businessId) || businessId <= 0) {
    console.error(
      `[stripe] checkout session ${session.id} has no valid businessId metadata; ignoring`,
    );
    return null;
  }
  const plan = BILLING_PLANS.find((p) => p.id === planId);
  if (!plan) {
    console.error(
      `[stripe] checkout session ${session.id} has unknown planId "${planId}"; ignoring`,
    );
    return null;
  }
  const [business] = await db
    .select()
    .from(businessesTable)
    .where(eq(businessesTable.id, businessId));
  if (!business) {
    console.error(
      `[stripe] checkout session ${session.id} references missing business ${businessId}; ignoring`,
    );
    return null;
  }

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;

  await db
    .update(businessesTable)
    .set({
      status: "active",
      active: true,
      subscriptionStatus: "active",
      planType: plan.id,
      buildFeePaid: true,
      stripeCustomerId: customerId ?? business.stripeCustomerId,
      stripeSubscriptionId: subscriptionId ?? business.stripeSubscriptionId,
    })
    .where(eq(businessesTable.id, businessId));

  const row = await upsertBillingSubscription(businessId, {
    planId: plan.id,
    planName: plan.name,
    status: "active",
    active: true,
  });

  console.log(
    `[stripe] Business ${businessId} (${business.clientId}) activated on "${plan.id}" plan (customer=${customerId}, subscription=${subscriptionId})`,
  );
  await logActivity(
    businessId,
    "subscription_activated",
    `Subscribed to the ${plan.name} plan`,
  );
  return row;
}

export async function markSubscriptionActive(
  business: AppBusiness,
): Promise<void> {
  await db
    .update(businessesTable)
    .set({ active: true, subscriptionStatus: "active", status: "active" })
    .where(eq(businessesTable.id, business.id));
  await upsertBillingSubscription(business.id, {
    status: "active",
    active: true,
  });
  console.log(
    `[stripe] Business ${business.id} (${business.clientId}) subscription marked active`,
  );
}

export async function markSubscriptionPastDue(
  business: AppBusiness,
): Promise<void> {
  await db
    .update(businessesTable)
    .set({ active: false, subscriptionStatus: "past_due" })
    .where(eq(businessesTable.id, business.id));
  await upsertBillingSubscription(business.id, {
    status: "past_due",
    active: false,
  });
  console.log(
    `[stripe] Business ${business.id} (${business.clientId}) marked past_due; access disabled, data preserved`,
  );
  await logActivity(
    business.id,
    "subscription_past_due",
    "Subscription payment failed",
  );
}

export async function markSubscriptionCanceled(
  business: AppBusiness,
): Promise<void> {
  await db
    .update(businessesTable)
    .set({ active: false, subscriptionStatus: "canceled" })
    .where(eq(businessesTable.id, business.id));
  await upsertBillingSubscription(business.id, {
    status: "canceled",
    active: false,
  });
  console.log(
    `[stripe] Business ${business.id} (${business.clientId}) subscription canceled; access disabled, data preserved`,
  );
  await logActivity(
    business.id,
    "subscription_canceled",
    "Subscription canceled",
  );
}
