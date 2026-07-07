import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import {
  db,
  servicesTable,
  pricingRulesTable,
  requirementsTable,
  sandboxTestsTable,
  leadsTable,
  activityEventsTable,
} from "@workspace/db";
import {
  GetDashboardSummaryResponse,
  ListActivityResponse,
} from "@workspace/api-zod";
import { requireBusiness } from "../lib/auth";
import { computeRequirementStatus } from "../lib/business";

const router: IRouter = Router();

router.get(
  "/dashboard/summary",
  requireBusiness,
  async (req, res): Promise<void> => {
    const bid = req.business!.id;
    const business = req.business!;
    const [services, pricingRows, reqs, tests, leads] = await Promise.all([
      db.select().from(servicesTable).where(eq(servicesTable.businessId, bid)),
      db
        .select()
        .from(pricingRulesTable)
        .where(eq(pricingRulesTable.businessId, bid)),
      db
        .select()
        .from(requirementsTable)
        .where(eq(requirementsTable.businessId, bid)),
      db
        .select()
        .from(sandboxTestsTable)
        .where(eq(sandboxTestsTable.businessId, bid)),
      db.select().from(leadsTable).where(eq(leadsTable.businessId, bid)),
    ]);
    const pricing = pricingRows[0] ?? null;

    const derived = reqs.map((r) =>
      computeRequirementStatus(r, {
        business,
        servicesCount: services.length,
        pricing,
      }),
    );
    const requirementsComplete = derived.filter((s) => s === "completed").length;
    const requirementsTotal = reqs.length;
    const knowledgeScore = requirementsTotal
      ? Math.round((requirementsComplete / requirementsTotal) * 100)
      : 0;

    const rated = tests.filter((t) => t.rating != null);
    const avgRating = rated.length
      ? rated.reduce((a, t) => a + (t.rating ?? 0), 0) / rated.length
      : 0;
    const trainingScore =
      tests.length === 0
        ? 0
        : Math.round(
            Math.min(
              100,
              40 +
                (avgRating
                  ? (avgRating / 5) * 60
                  : Math.min(tests.length * 10, 40)),
            ),
          );

    const filledPricing = pricing
      ? [
          pricing.laborRate,
          pricing.emergencyFee,
          pricing.travelFee,
          pricing.weekendMultiplier,
          pricing.taxRate,
          pricing.minimumJobCost,
        ].filter((v) => v != null).length
      : 0;
    const pricingConfidence = Math.round(
      ((filledPricing / 6) * 0.6 + (services.length > 0 ? 0.4 : 0)) * 100,
    );

    const now = new Date();
    const conversationsThisMonth = leads.filter((l) => {
      const d = new Date(l.createdAt);
      return (
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      );
    }).length;

    const leadsGenerated = leads.length;
    const revenueInfluenced = Math.round(
      leads.reduce((a, l) => a + (l.estimatedHigh ?? 0), 0),
    );

    const bdaStatus =
      business.status === "active"
        ? "live"
        : business.profileApproved
          ? "training"
          : "draft";

    res.json(
      GetDashboardSummaryResponse.parse({
        bdaStatus,
        trainingScore,
        knowledgeScore,
        pricingConfidence,
        conversationsThisMonth,
        leadsGenerated,
        revenueInfluenced,
        requirementsComplete,
        requirementsTotal,
      }),
    );
  },
);

router.get(
  "/dashboard/activity",
  requireBusiness,
  async (req, res): Promise<void> => {
    const rows = await db
      .select()
      .from(activityEventsTable)
      .where(eq(activityEventsTable.businessId, req.business!.id))
      .orderBy(desc(activityEventsTable.createdAt))
      .limit(25);
    res.json(ListActivityResponse.parse(rows));
  },
);

export default router;
