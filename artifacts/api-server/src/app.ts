import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

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

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use("/api", router);

export default app;
