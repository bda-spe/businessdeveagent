import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { stripeWebhookHandler } from "./routes/stripe-webhook";
import { logger } from "./lib/logger";
import { SESSION_COOKIE_NAME } from "./lib/passwordAuth";

const app: Express = express();

// Security headers (CSP, X-Frame-Options, X-Content-Type-Options, HSTS, etc).
// The API serves JSON only — no inline scripts/styles to allow — so the
// default restrictive CSP is fine as-is.
app.use(
  helmet({
    // This is a pure JSON API with no browser-rendered pages of its own, so
    // cross-origin embedding restrictions that assume an HTML document
    // (COEP) would only break the widget's third-party embed for no benefit.
    crossOriginEmbedderPolicy: false,
  }),
);

// Build an allowlist of trusted first-party origins for credentialed (cookie)
// requests. In the Replit path-based routing setup the frontend and API are
// served from the same origin, so the app itself is same-origin; the allowlist
// exists so that credentialed CORS is never reflected to arbitrary origins.
const allowedOrigins = new Set<string>();
for (const domain of [
  process.env.REPLIT_DEV_DOMAIN,
  ...(process.env.REPLIT_DOMAINS?.split(",") ?? []),
]) {
  const trimmed = domain?.trim();
  if (trimmed) {
    allowedOrigins.add(`https://${trimmed}`);
  }
}
for (const origin of process.env.ALLOWED_ORIGINS?.split(",") ?? []) {
  const trimmed = origin.trim();
  if (trimmed) {
    allowedOrigins.add(trimmed);
  }
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cookieParser());

// Public widget endpoints are embedded on third-party customer sites. They are
// keyed by clientId and never use cookie auth, so they may be called from any
// origin — but WITHOUT credentials. This must run before the credentialed CORS
// below so that third-party preflight requests are handled correctly.
app.use(
  ["/api/widget/config", "/api/widget/questions", "/api/widget/interact"],
  cors({ origin: "*", credentials: false }),
);

app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      // Non-browser / same-origin requests have no Origin header.
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      // Unknown origin: do not reflect it for credentialed requests.
      callback(null, false);
    },
  }),
);
// Stripe webhook needs the raw request body for signature verification, so it
// is mounted before the global JSON body parser.
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhookHandler,
);

// CSRF defense-in-depth: the session cookie is SameSite=None in production
// (required because the frontend and API are on different registrable
// domains), which disables the browser-level CSRF protection SameSite
// normally provides. For any state-changing request that carries the session
// cookie, require a matching Origin — the same allowlist credentialed CORS
// already trusts. Requests with no Origin header (non-browser clients, same
// some legacy same-origin cases) are left to the CORS layer above.
app.use((req: Request, res: Response, next: NextFunction) => {
  const isStateChanging = !["GET", "HEAD", "OPTIONS"].includes(req.method);
  const hasSessionCookie = Boolean(req.cookies?.[SESSION_COOKIE_NAME]);
  if (isStateChanging && hasSessionCookie) {
    const origin = req.headers.origin;
    if (origin && !allowedOrigins.has(origin)) {
      res.status(403).json({ error: "Cross-site request rejected." });
      return;
    }
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Catch-all error handler. Without this, Express's default handler dumps the
// raw error stack (file paths, SQL, driver internals) as an HTML page
// straight to the client — an information-disclosure bug, not just an ugly
// error page. Log the full error (including drizzle's wrapped `.cause`,
// which carries the actual Postgres error) server-side, and return a generic
// message to the client.
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const cause = err instanceof Error ? (err.cause as Error | undefined) : undefined;
  req.log?.error(
    {
      err,
      causeMessage: cause?.message,
      causeCode: (cause as { code?: string } | undefined)?.code,
    },
    "Unhandled error",
  );
  if (res.headersSent) return;
  res.status(500).json({ error: "Internal server error." });
});

// Trial ending reminder: runs every hour, sends an email exactly once per
// business in the 24-25 hour window before trial_ends_at.
(function scheduleTrialReminders() {
  const sent = new Set<number>();

  async function checkTrials() {
    try {
      const { db: _db, businessesTable: bt } = await import("@workspace/db");
      const { eq, and, lte, gte, isNotNull } = await import("drizzle-orm");
      const { sendTrialEndingEmail } = await import("./lib/system-emails");
      const { usersTable: ut } = await import("@workspace/db");

      const now = Date.now();
      const windowStart = new Date(now + 23 * 60 * 60 * 1000).toISOString();
      const windowEnd = new Date(now + 25 * 60 * 60 * 1000).toISOString();

      const businesses = await _db
        .select()
        .from(bt)
        .where(
          and(
            eq(bt.subscriptionStatus, "trialing"),
            isNotNull(bt.trialEndsAt),
            gte(bt.trialEndsAt, windowStart),
            lte(bt.trialEndsAt, windowEnd),
          ),
        );

      for (const business of businesses) {
        if (sent.has(business.id)) continue;
        sent.add(business.id);
        const [user] = await _db.select().from(ut).where(eq(ut.id, business.userId));
        if (!user) continue;
        sendTrialEndingEmail({
          to: user.email,
          ownerName: user.ownerName,
          businessName: business.name,
          trialEndsAt: business.trialEndsAt,
        }).catch(() => {});
      }
    } catch (err) {
      console.error("[trial-reminder] Error checking trial expirations:", err);
    }
  }

  // Run once on startup (catches cases where server restarted in the window)
  setTimeout(checkTrials, 10_000);
  // Then every hour
  setInterval(checkTrials, 60 * 60 * 1000);
})();

export default app;
