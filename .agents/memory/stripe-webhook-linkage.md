---
name: Stripe webhook subscription linkage
description: Why invoice webhooks must verify the invoice's subscription id against the business's linked subscription
---

Rule: In Stripe webhook handlers, never change a business's subscription state based on `invoice.paid` / `invoice.payment_failed` resolved by customer id alone — always require the invoice's subscription id to match the business's stored `stripeSubscriptionId`.

**Why:** A Stripe customer can accumulate multiple subscriptions (repeated checkout attempts, dashboard ops). An unrelated invoice would otherwise flip a business to active or past_due, breaking access gating.

**How to apply:** In stripe v18+ (this project uses v22), the invoice's subscription lives at `invoice.parent?.subscription_details?.subscription` (string | Subscription), not the removed `invoice.subscription` field.
