import type { Request, Response } from "express";
import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, businessesTable } from "@workspace/db";
import {
  getStripe,
  getWebhookSecret,
  planForPriceId,
} from "../lib/stripe";
import {
  activateFromCheckoutSession,
  findBusinessByStripeCustomerId,
  markSubscriptionActive,
  markSubscriptionCanceled,
  markSubscriptionPastDue,
} from "../lib/subscription";

function customerIdFrom(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
): string | null {
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
}

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const sub = invoice.parent?.subscription_details?.subscription;
  if (!sub) return null;
  return typeof sub === "string" ? sub : sub.id;
}

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  if (session.status !== "complete") {
    console.log(
      `[stripe:webhook] checkout.session.completed for ${session.id} but status is "${session.status}"; ignoring`,
    );
    return;
  }
  await activateFromCheckoutSession(session);
}

async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const customerId = customerIdFrom(invoice.customer);
  if (!customerId) {
    console.log("[stripe:webhook] invoice.paid without customer; ignoring");
    return;
  }
  const business = await findBusinessByStripeCustomerId(customerId);
  if (!business) {
    console.log(
      `[stripe:webhook] invoice.paid for unknown customer ${customerId}; ignoring`,
    );
    return;
  }
  if (!business.stripeSubscriptionId) {
    // Initial checkout invoice — activation is handled by
    // checkout.session.completed, which also stores the subscription id.
    console.log(
      `[stripe:webhook] invoice.paid for business ${business.id} before subscription is linked; deferring to checkout.session.completed`,
    );
    return;
  }
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!subscriptionId || subscriptionId !== business.stripeSubscriptionId) {
    console.log(
      `[stripe:webhook] invoice.paid for subscription ${subscriptionId ?? "none"} but business ${business.id} is linked to ${business.stripeSubscriptionId}; ignoring`,
    );
    return;
  }
  if (business.subscriptionStatus === "canceled") {
    console.log(
      `[stripe:webhook] invoice.paid for canceled business ${business.id}; not reactivating automatically`,
    );
    return;
  }
  await markSubscriptionActive(business);
}

async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
): Promise<void> {
  const customerId = customerIdFrom(invoice.customer);
  if (!customerId) {
    console.log(
      "[stripe:webhook] invoice.payment_failed without customer; ignoring",
    );
    return;
  }
  const business = await findBusinessByStripeCustomerId(customerId);
  if (!business) {
    console.log(
      `[stripe:webhook] invoice.payment_failed for unknown customer ${customerId}; ignoring`,
    );
    return;
  }
  if (!business.stripeSubscriptionId) {
    // A failed payment during initial checkout must not lock out a business
    // that is still in its trial — no subscription was ever activated.
    console.log(
      `[stripe:webhook] invoice.payment_failed for business ${business.id} with no linked subscription; ignoring`,
    );
    return;
  }
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!subscriptionId || subscriptionId !== business.stripeSubscriptionId) {
    console.log(
      `[stripe:webhook] invoice.payment_failed for subscription ${subscriptionId ?? "none"} but business ${business.id} is linked to ${business.stripeSubscriptionId}; ignoring`,
    );
    return;
  }
  await markSubscriptionPastDue(business);
}

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
): Promise<void> {
  const customerId = customerIdFrom(subscription.customer);
  if (!customerId) return;
  const business = await findBusinessByStripeCustomerId(customerId);
  if (!business) {
    console.log(
      `[stripe:webhook] subscription.updated for unknown customer ${customerId}; ignoring`,
    );
    return;
  }
  if (
    business.stripeSubscriptionId &&
    business.stripeSubscriptionId !== subscription.id
  ) {
    console.log(
      `[stripe:webhook] subscription.updated for ${subscription.id} but business ${business.id} is linked to ${business.stripeSubscriptionId}; ignoring`,
    );
    return;
  }
  if (!business.stripeSubscriptionId) {
    console.log(
      `[stripe:webhook] subscription.updated for business ${business.id} before checkout completed; ignoring`,
    );
    return;
  }

  const priceId = subscription.items.data[0]?.price?.id;
  const planId = priceId ? planForPriceId(priceId) : null;
  if (planId && planId !== business.planType) {
    await db
      .update(businessesTable)
      .set({ planType: planId })
      .where(eq(businessesTable.id, business.id));
    console.log(
      `[stripe:webhook] Business ${business.id} plan changed to "${planId}"`,
    );
  }

  switch (subscription.status) {
    case "active":
      await markSubscriptionActive(business);
      break;
    case "past_due":
    case "unpaid":
      await markSubscriptionPastDue(business);
      break;
    case "canceled":
      await markSubscriptionCanceled(business);
      break;
    default:
      console.log(
        `[stripe:webhook] subscription.updated status "${subscription.status}" for business ${business.id}; no action taken`,
      );
  }
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
): Promise<void> {
  const customerId = customerIdFrom(subscription.customer);
  if (!customerId) return;
  const business = await findBusinessByStripeCustomerId(customerId);
  if (!business) {
    console.log(
      `[stripe:webhook] subscription.deleted for unknown customer ${customerId}; ignoring`,
    );
    return;
  }
  if (
    business.stripeSubscriptionId &&
    business.stripeSubscriptionId !== subscription.id
  ) {
    console.log(
      `[stripe:webhook] subscription.deleted for ${subscription.id} but business ${business.id} is linked to ${business.stripeSubscriptionId}; ignoring`,
    );
    return;
  }
  await markSubscriptionCanceled(business);
}

/**
 * Stripe webhook handler. Mounted in app.ts with express.raw() BEFORE the
 * global JSON body parser so the signature can be verified against the raw
 * payload. Webhooks are the source of truth for subscription state.
 */
export async function stripeWebhookHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const signature = req.headers["stripe-signature"];
  const secret = getWebhookSecret();

  if (!secret) {
    console.error(
      "[stripe:webhook] Received webhook but no signing secret is configured; rejecting",
    );
    res.status(400).json({ error: "Webhook not configured" });
    return;
  }
  if (typeof signature !== "string") {
    console.error("[stripe:webhook] Missing stripe-signature header");
    res.status(400).json({ error: "Missing signature" });
    return;
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, signature, secret);
  } catch (err) {
    console.error(
      `[stripe:webhook] Signature verification failed: ${err instanceof Error ? err.message : err}`,
    );
    res.status(400).json({ error: "Invalid signature" });
    return;
  }

  console.log(`[stripe:webhook] Received ${event.type} (${event.id})`);

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object);
        break;
      case "invoice.paid":
        await handleInvoicePaid(event.data.object);
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object);
        break;
      default:
        console.log(`[stripe:webhook] Unhandled event type ${event.type}`);
    }
    res.json({ received: true });
  } catch (err) {
    console.error(
      `[stripe:webhook] Error handling ${event.type} (${event.id}):`,
      err,
    );
    res.status(500).json({ error: "Webhook handler failed" });
  }
}
