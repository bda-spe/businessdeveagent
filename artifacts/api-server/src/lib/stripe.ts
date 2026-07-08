import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add it to Replit Secrets to enable billing.",
    );
  }
  if (!stripeClient) {
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

export function priceIdForPlan(planId: string): string | null {
  if (planId === "monthly") return process.env.MONTHLY_PRICE_ID ?? null;
  if (planId === "yearly") return process.env.YEARLY_PRICE_ID ?? null;
  return null;
}

export function getSetupFeePriceId(): string | null {
  return process.env.SETUP_FEE_PRICE_ID ?? null;
}

export function planForPriceId(priceId: string): string | null {
  if (priceId === process.env.MONTHLY_PRICE_ID) return "monthly";
  if (priceId === process.env.YEARLY_PRICE_ID) return "yearly";
  return null;
}

// ---------------------------------------------------------------------------
// Webhook endpoint provisioning
//
// The webhook signing secret is only returned by Stripe when the endpoint is
// created. If STRIPE_WEBHOOK_SECRET is set (recommended for production), it is
// used directly. Otherwise, on startup we delete any stale endpoint for our
// URL and create a fresh one, keeping the signing secret in memory.
// ---------------------------------------------------------------------------

const WEBHOOK_EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  "checkout.session.completed",
  "invoice.paid",
  "invoice.payment_failed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
];

let webhookSecret: string | null = process.env.STRIPE_WEBHOOK_SECRET ?? null;

export function getWebhookSecret(): string | null {
  return webhookSecret;
}

export function getPublicWebhookUrl(): string | null {
  const domain = process.env.REPLIT_DEPLOYMENT
    ? process.env.REPLIT_DOMAINS?.split(",")[0]?.trim()
    : process.env.REPLIT_DEV_DOMAIN;
  if (!domain) return null;
  return `https://${domain}/api/stripe/webhook`;
}

export async function initStripeWebhookEndpoint(): Promise<void> {
  if (process.env.STRIPE_WEBHOOK_SECRET) {
    console.log("[stripe] Using STRIPE_WEBHOOK_SECRET from environment");
    return;
  }
  if (!isStripeConfigured()) {
    console.warn(
      "[stripe] STRIPE_SECRET_KEY not set; skipping webhook endpoint registration",
    );
    return;
  }
  const url = getPublicWebhookUrl();
  if (!url) {
    console.warn(
      "[stripe] No public domain available; skipping webhook endpoint registration",
    );
    return;
  }

  const stripe = getStripe();
  const existing = await stripe.webhookEndpoints.list({ limit: 100 });
  for (const endpoint of existing.data) {
    if (endpoint.url === url) {
      await stripe.webhookEndpoints.del(endpoint.id);
      console.log(
        `[stripe] Removed stale webhook endpoint ${endpoint.id} for ${url}`,
      );
    }
  }

  const created = await stripe.webhookEndpoints.create({
    url,
    enabled_events: WEBHOOK_EVENTS,
    description: "BDA subscription webhooks (auto-provisioned)",
  });
  webhookSecret = created.secret ?? null;
  console.log(
    `[stripe] Webhook endpoint ${created.id} registered at ${url} (events: ${WEBHOOK_EVENTS.join(", ")})`,
  );
}
