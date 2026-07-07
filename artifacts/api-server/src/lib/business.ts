import { randomBytes } from "crypto";
import {
  db,
  businessesTable,
  requirementsTable,
  pricingRulesTable,
  widgetSettingsTable,
  billingSubscriptionsTable,
  activityEventsTable,
} from "@workspace/db";
import { DEFAULT_REQUIREMENTS } from "./defaults";

type Business = typeof businessesTable.$inferSelect;
type Pricing = typeof pricingRulesTable.$inferSelect;

export function generateClientId(): string {
  return "bda_" + randomBytes(6).toString("hex");
}

export async function logActivity(
  businessId: number,
  type: string,
  description: string,
): Promise<void> {
  await db.insert(activityEventsTable).values({ businessId, type, description });
}

export async function seedBusinessDefaults(businessId: number): Promise<void> {
  await db.insert(requirementsTable).values(
    DEFAULT_REQUIREMENTS.map((r) => ({
      businessId,
      key: r.key,
      label: r.label,
    })),
  );
  await db.insert(pricingRulesTable).values({ businessId });
  await db.insert(widgetSettingsTable).values({ businessId });
  await db.insert(billingSubscriptionsTable).values({ businessId });
}

export function computeRequirementStatus(
  row: { key: string; status: string; value?: string | null },
  ctx: { business: Business; servicesCount: number; pricing: Pricing | null },
): string {
  const { business, servicesCount, pricing } = ctx;
  // A manually entered value always counts as completed, regardless of key.
  if (row.value) return "completed";
  switch (row.key) {
    case "business_info": {
      const filled = [
        business.industry,
        business.companySize,
        business.customerType,
      ].filter(Boolean).length;
      if (filled === 3) return "completed";
      if (filled > 0) return "in_progress";
      return "pending";
    }
    case "services":
      return servicesCount > 0 ? "completed" : "pending";
    case "pricing": {
      if (pricing?.laborRate != null) return "completed";
      const any =
        pricing &&
        [
          pricing.emergencyFee,
          pricing.travelFee,
          pricing.weekendMultiplier,
          pricing.taxRate,
          pricing.minimumJobCost,
        ].some((v) => v != null);
      return any ? "in_progress" : "pending";
    }
    case "service_area":
      return business.serviceArea ? "completed" : "pending";
    default:
      return row.value ? "completed" : row.status;
  }
}
