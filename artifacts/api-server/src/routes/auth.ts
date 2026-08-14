import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, sessionsTable, businessesTable } from "@workspace/db";
import { computeSetupProgress } from "../lib/setupProgress";
import {
  SignupBody,
  SignupResponse,
  LoginBody,
  LoginResponse,
  LogoutResponse,
  ForgotPasswordBody,
  ForgotPasswordResponse,
  ResetPasswordBody,
  ResetPasswordResponse,
} from "@workspace/api-zod";
import {
  hashPassword,
  verifyPassword,
  sha256Hex,
  generateSessionToken,
  generateResetCode,
  sessionCookieOptions,
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  RESET_CODE_TTL_MS,
} from "../lib/passwordAuth";
import { sendPasswordResetEmail } from "../lib/system-emails";

const router: IRouter = Router();

async function createSession(userId: number): Promise<string> {
  const token = generateSessionToken();
  await db.insert(sessionsTable).values({
    userId,
    tokenHash: sha256Hex(token),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  });
  return token;
}

router.post("/auth/signup", async (req, res): Promise<void> => {
  const parsed = SignupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();

  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email));
  if (existing) {
    res.status(409).json({ error: "An account with this email already exists." });
    return;
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const [user] = await db
    .insert(usersTable)
    .values({ email, passwordHash, ownerName: parsed.data.ownerName })
    .returning();

  const token = await createSession(user.id);
  res.cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions());

  res.status(201).json(
    SignupResponse.parse({
      user: { id: user.id, email: user.email, ownerName: user.ownerName },
      business: null,
      onboardingComplete: false,
      setupProgress: {
        businessProfile: false,
        services: false,
        pricing: false,
        invoiceFormatting: false,
        widget: false,
        widgetStyled: false,
        testAgent: false,
      },
    }),
  );
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  // Same generic error whether the email doesn't exist or the password is
  // wrong — don't tell an attacker which one it was.
  const invalid = () => res.status(401).json({ error: "Invalid email or password." });

  if (!user) {
    invalid();
    return;
  }
  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) {
    invalid();
    return;
  }

  const token = await createSession(user.id);
  res.cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions());

  const [business] = await db
    .select()
    .from(businessesTable)
    .where(eq(businessesTable.userId, user.id));

  res.json(
    LoginResponse.parse({
      user: { id: user.id, email: user.email, ownerName: user.ownerName },
      business: business ?? null,
      onboardingComplete: !!business,
      setupProgress: business
        ? await computeSetupProgress(business)
        : {
            businessProfile: false,
            services: false,
            pricing: false,
            invoiceFormatting: false,
            widget: false,
            widgetStyled: false,
            testAgent: false,
          },
    }),
  );
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const token = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
  if (token) {
    await db.delete(sessionsTable).where(eq(sessionsTable.tokenHash, sha256Hex(token)));
  }
  res.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions());
  res.json(LogoutResponse.parse({ success: true }));
});

router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const parsed = ForgotPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();
  const genericResponse = ForgotPasswordResponse.parse({
    message: "If that email is registered, a reset code has been sent.",
  });

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user) {
    // Same response either way — don't leak whether the email is registered.
    res.json(genericResponse);
    return;
  }

  // Fresh code every request, hashed at rest, short-lived. Never re-send a
  // previously issued code — a code's validity window starts now, not at
  // account creation, so a stale email sitting in an inbox can't be used to
  // take over the account later.
  const code = generateResetCode();
  await db
    .update(usersTable)
    .set({
      resetCodeHash: sha256Hex(code),
      resetCodeExpiresAt: new Date(Date.now() + RESET_CODE_TTL_MS).toISOString(),
    })
    .where(eq(usersTable.id, user.id));

  await sendPasswordResetEmail({ to: user.email, ownerName: user.ownerName, code });

  res.json(genericResponse);
});

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const parsed = ResetPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  const invalid = () =>
    res.status(400).json({ error: "That code is invalid or has expired." });

  if (!user || !user.resetCodeHash || !user.resetCodeExpiresAt) {
    invalid();
    return;
  }
  if (new Date(user.resetCodeExpiresAt) < new Date()) {
    invalid();
    return;
  }
  if (sha256Hex(parsed.data.code.trim().toUpperCase()) !== user.resetCodeHash) {
    invalid();
    return;
  }

  const newPasswordHash = await hashPassword(parsed.data.newPassword);
  await db
    .update(usersTable)
    .set({
      passwordHash: newPasswordHash,
      // Rotate: the code that was just used stops being valid, and no code
      // is valid at all until another reset is explicitly requested.
      resetCodeHash: null,
      resetCodeExpiresAt: null,
    })
    .where(eq(usersTable.id, user.id));

  // Password changed — every existing session (this device and any other)
  // is revoked, so a stolen session cookie doesn't survive a reset.
  await db.delete(sessionsTable).where(eq(sessionsTable.userId, user.id));
  res.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions());

  res.json(ResetPasswordResponse.parse({ success: true }));
});

export default router;
