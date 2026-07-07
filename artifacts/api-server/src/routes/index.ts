import { Router, type IRouter } from "express";
import healthRouter from "./health";
import { requireAuth, loadContext } from "../lib/auth";
import { widgetPublicRouter, widgetSettingsRouter } from "./widget";
import accountRouter from "./account";
import servicesRouter from "./services";
import pricingRouter from "./pricing";
import invoiceSettingsRouter from "./invoiceSettings";
import requirementsRouter from "./requirements";
import filesRouter from "./files";
import sandboxRouter from "./sandbox";
import businessProfileRouter from "./businessProfile";
import leadsRouter from "./leads";
import billingRouter from "./billing";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

// Public routes (no auth).
router.use(healthRouter);
router.use(widgetPublicRouter);

// All routes below require an authenticated Clerk session and a loaded context.
router.use(requireAuth, loadContext);
router.use(accountRouter);
router.use(servicesRouter);
router.use(pricingRouter);
router.use(invoiceSettingsRouter);
router.use(requirementsRouter);
router.use(filesRouter);
router.use(sandboxRouter);
router.use(businessProfileRouter);
router.use(leadsRouter);
router.use(widgetSettingsRouter);
router.use(billingRouter);
router.use(dashboardRouter);

export default router;
