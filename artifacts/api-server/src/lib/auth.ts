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
