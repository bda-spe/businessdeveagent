import type { Request, Response, NextFunction } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, usersTable, businessesTable } from "@workspace/db";

type AppUser = typeof usersTable.$inferSelect;
type AppBusiness = typeof businessesTable.$inferSelect;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      clerkUserId?: string;
      appUser?: AppUser;
      business?: AppBusiness | null;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.clerkUserId = userId;
  next();
}

export async function getOrCreateUser(clerkUserId: string): Promise<AppUser> {
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkUserId, clerkUserId));
  if (existing) return existing;

  let ownerName = "Owner";
  let email = "";
  try {
    const cu = await clerkClient.users.getUser(clerkUserId);
    email =
      cu.primaryEmailAddress?.emailAddress ??
      cu.emailAddresses[0]?.emailAddress ??
      "";
    ownerName =
      [cu.firstName, cu.lastName].filter(Boolean).join(" ") ||
      cu.username ||
      email ||
      "Owner";
  } catch {
    // Clerk user lookup failed; fall back to defaults.
  }

  const [created] = await db
    .insert(usersTable)
    .values({ clerkUserId, ownerName, email })
    .returning();
  return created;
}

/**
 * Postgres `timestamp` columns store UTC wall-clock values without timezone
 * info (e.g. "2026-08-07 13:25:48.169807"). Parse them explicitly as UTC so
 * the comparison is correct regardless of the server's local timezone.
 */
function parseDbTimestampAsUtc(value: string): Date {
  const iso = value.includes("T") ? value : value.replace(" ", "T");
  const hasZone = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(iso);
  return new Date(hasZone ? iso : `${iso}Z`);
}

export function isTrialExpired(business: AppBusiness): boolean {
  // Only businesses still in their trial can lazily expire. States managed by
  // Stripe webhooks (active, past_due, canceled) must never be overwritten.
  if (business.subscriptionStatus !== "trialing") return false;
  if (!business.trialEndsAt) return false;
  return new Date() > parseDbTimestampAsUtc(business.trialEndsAt);
}

export async function loadContext(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const user = await getOrCreateUser(req.clerkUserId as string);
  req.appUser = user;
  const [business] = await db
    .select()
    .from(businessesTable)
    .where(eq(businessesTable.userId, user.id));

  // Lazily expire the trial: if the trial window has passed and the business
  // never activated a subscription, mark it expired. Data is preserved.
  if (
    business &&
    isTrialExpired(business) &&
    (business.active || business.subscriptionStatus !== "expired")
  ) {
    const [updated] = await db
      .update(businessesTable)
      .set({ active: false, subscriptionStatus: "expired" })
      .where(eq(businessesTable.id, business.id))
      .returning();
    console.log(
      `[subscription] Trial expired for business ${business.id} (${business.clientId}); access disabled, data preserved`,
    );
    req.business = updated;
    next();
    return;
  }

  req.business = business ?? null;
  next();
}

export function requireBusiness(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.business) {
    res
      .status(400)
      .json({ error: "No business found. Complete onboarding first." });
    return;
  }
  next();
}

/**
 * Blocks access to Agent Management routes when the trial has expired and no
 * subscription is active. Billing, account settings, and support remain
 * reachable because their routers are mounted before this gate.
 */
export function requireActiveSubscription(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const business = req.business;
  if (business && (!business.active || business.subscriptionStatus === "expired")) {
    res.status(403).json({
      error:
        "Your free trial has ended. Keep access to your Business Development Agent by selecting a subscription plan.",
      code: "subscription_expired",
    });
    return;
  }
  next();
}
