import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  sandboxTestsTable,
  servicesTable,
  pricingRulesTable,
} from "@workspace/db";
import {
  ListSandboxTestsResponse,
  RunSandboxTestBody,
  RunSandboxTestResponse,
  SaveSandboxFeedbackParams,
  SaveSandboxFeedbackBody,
  SaveSandboxFeedbackResponse,
} from "@workspace/api-zod";
import { requireBusiness } from "../lib/auth";
import { logActivity } from "../lib/business";
import {
  generateAgentResponse,
  type ServiceContext,
} from "../lib/aiService";

const router: IRouter = Router();

function toServiceContext(rows: (typeof servicesTable.$inferSelect)[]): ServiceContext[] {
  return rows.map((s) => ({
    name: s.name,
    description: s.description,
    basePrice: s.basePrice,
    hourlyRate: s.hourlyRate,
    minimumPrice: s.minimumPrice,
  }));
}

router.get(
  "/sandbox-tests",
  requireBusiness,
  async (req, res): Promise<void> => {
    const rows = await db
      .select()
      .from(sandboxTestsTable)
      .where(eq(sandboxTestsTable.businessId, req.business!.id))
      .orderBy(desc(sandboxTestsTable.createdAt));
    res.json(ListSandboxTestsResponse.parse(rows));
  },
);

router.post(
  "/sandbox-tests",
  requireBusiness,
  async (req, res): Promise<void> => {
    const parsed = RunSandboxTestBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const bid = req.business!.id;
    const [services, pricingRows] = await Promise.all([
      db.select().from(servicesTable).where(eq(servicesTable.businessId, bid)),
      db
        .select()
        .from(pricingRulesTable)
        .where(eq(pricingRulesTable.businessId, bid)),
    ]);

    const { agentResponse, estimate } = await generateAgentResponse({
      business: {
        name: req.business!.name,
        industry: req.business!.industry,
        serviceArea: req.business!.serviceArea,
        customerType: req.business!.customerType,
      },
      services: toServiceContext(services),
      pricing: pricingRows[0] ?? null,
      prompt: parsed.data.prompt,
    });

    const [row] = await db
      .insert(sandboxTestsTable)
      .values({
        businessId: bid,
        scenario: parsed.data.scenario ?? null,
        prompt: parsed.data.prompt,
        agentResponse,
        estimate,
      })
      .returning();

    await logActivity(bid, "sandbox_test", "Ran a sandbox test");
    res.status(201).json(RunSandboxTestResponse.parse(row));
  },
);

router.post(
  "/sandbox-tests/:id/feedback",
  requireBusiness,
  async (req, res): Promise<void> => {
    const params = SaveSandboxFeedbackParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = SaveSandboxFeedbackBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const bid = req.business!.id;
    const [existing] = await db
      .select()
      .from(sandboxTestsTable)
      .where(
        and(
          eq(sandboxTestsTable.id, params.data.id),
          eq(sandboxTestsTable.businessId, bid),
        ),
      );
    if (!existing) {
      res.status(404).json({ error: "Sandbox test not found" });
      return;
    }

    const [services, pricingRows] = await Promise.all([
      db.select().from(servicesTable).where(eq(servicesTable.businessId, bid)),
      db
        .select()
        .from(pricingRulesTable)
        .where(eq(pricingRulesTable.businessId, bid)),
    ]);

    const { agentResponse, estimate } = await generateAgentResponse({
      business: {
        name: req.business!.name,
        industry: req.business!.industry,
        serviceArea: req.business!.serviceArea,
        customerType: req.business!.customerType,
      },
      services: toServiceContext(services),
      pricing: pricingRows[0] ?? null,
      prompt: `${existing.prompt}\n\nThe previous response was rated ${parsed.data.rating}/5.${
        parsed.data.feedbackNotes
          ? ` Feedback: ${parsed.data.feedbackNotes}.`
          : ""
      } Improve the reply and the estimate accordingly.`,
    });

    const [row] = await db
      .update(sandboxTestsTable)
      .set({
        rating: parsed.data.rating,
        feedbackNotes: parsed.data.feedbackNotes ?? null,
        agentResponse,
        estimate,
      })
      .where(eq(sandboxTestsTable.id, existing.id))
      .returning();

    await logActivity(bid, "sandbox_feedback", "Sandbox test refined with feedback");
    res.json(SaveSandboxFeedbackResponse.parse(row));
  },
);

export default router;
