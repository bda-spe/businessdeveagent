import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  servicesTable,
  sandboxTestsTable,
  activityEventsTable,
} from "@workspace/db";

export interface SetupProgress {
  businessProfile: boolean;
  services: boolean;
  pricing: boolean;
  invoiceFormatting: boolean;
  widget: boolean;
  testAgent: boolean;
}

export async function computeSetupProgress(business: {
  id: number;
  profileApproved: boolean;
}): Promise<SetupProgress> {
  const [services, sandboxTests, savedEvents] = await Promise.all([
    db
      .select({ id: servicesTable.id })
      .from(servicesTable)
      .where(eq(servicesTable.businessId, business.id))
      .limit(1),
    db
      .select({ id: sandboxTestsTable.id })
      .from(sandboxTestsTable)
      .where(eq(sandboxTestsTable.businessId, business.id))
      .limit(1),
    db
      .select({ type: activityEventsTable.type })
      .from(activityEventsTable)
      .where(
        and(
          eq(activityEventsTable.businessId, business.id),
          inArray(activityEventsTable.type, [
            "pricing_updated",
            "invoice_settings_updated",
            "widget_updated",
          ]),
        ),
      ),
  ]);
  const eventTypes = new Set(savedEvents.map((e) => e.type));
  return {
    businessProfile: business.profileApproved,
    services: services.length > 0,
    pricing: eventTypes.has("pricing_updated"),
    invoiceFormatting: eventTypes.has("invoice_settings_updated"),
    widget: eventTypes.has("widget_updated"),
    testAgent: sandboxTests.length > 0,
  };
}
