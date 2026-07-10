import { Router, type IRouter } from "express";
import healthRouter from "./health";
import storageRouter, { publicStorageRouter } from "./storage";
import {
  requireAuth,
  loadContext,
  requireActiveSubscription,
} from "../lib/auth";
import { widgetPublicRouter, widgetSettingsRouter } from "./widget";
import { widgetTestRouter } from "./widget-test";
import accountRouter from "./account";
import servicesRouter from "./services";
import pricingRouter from "./pricing";
import invoiceSettingsRouter from "./invoiceSettings";
import requirementsRouter from "./requirements";
import filesRouter from "./files";
import sandboxRouter from "./sandbox";
import businessProfileRouter from "./businessProfile";
import businessOperationsRouter from "./businessOperations";
import businessPoliciesRouter from "./businessPolicies";
import estimateRulesRouter from "./estimateRules";
import businessToneRouter from "./businessTone";
import leadsRouter from "./leads";
import billingRouter from "./billing";
import dashboardRouter from "./dashboard";
import assistantRouter from "./assistant";
import agentPreferencesRouter from "./agentPreferences";

const router: IRouter = Router();

// Public routes (no auth).
router.use(healthRouter);
router.use(widgetPublicRouter);
// Object serving is public: object paths are unguessable UUIDs and logos are
// non-sensitive (they appear on customer PDFs), so <img> previews load without
// an auth header. Upload URL minting is authed separately below.
router.use(publicStorageRouter);

// All routes below require an authenticated Clerk session and a loaded context.
router.use(requireAuth, loadContext);

// Always accessible (even after trial expiration): account settings + billing.
router.use(accountRouter);
router.use(billingRouter);
// Presigned upload URL minting: authed (accessible during onboarding/trial) so
// only signed-in tenants can write objects into the private bucket.
router.use(storageRouter);

// Agent Management routes: locked server-side once the trial has expired
// without an active subscription.
router.use(requireActiveSubscription);
router.use(servicesRouter);
router.use(pricingRouter);
router.use(invoiceSettingsRouter);
router.use(requirementsRouter);
router.use(filesRouter);
router.use(sandboxRouter);
router.use(businessProfileRouter);
router.use(businessOperationsRouter);
router.use(businessPoliciesRouter);
router.use(estimateRulesRouter);
router.use(businessToneRouter);
router.use(leadsRouter);
router.use(widgetSettingsRouter);
router.use(widgetTestRouter);
router.use(dashboardRouter);
router.use(assistantRouter);
router.use(agentPreferencesRouter);

export default router;
