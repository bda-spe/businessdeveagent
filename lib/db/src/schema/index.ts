import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  doublePrecision,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  ownerName: text("owner_name").notNull(),
  email: text("email").notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
});

export const businessesTable = pgTable("businesses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id),
  clientId: text("client_id").notNull().unique(),
  name: text("name").notNull(),
  industry: text("industry"),
  companySize: text("company_size"),
  customerType: text("customer_type"),
  website: text("website"),
  phone: text("phone"),
  email: text("email"),
  serviceArea: text("service_area"),
  status: text("status").notNull().default("onboarding"),
  profileApproved: boolean("profile_approved").notNull().default(false),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
});

export const servicesTable = pgTable("services", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id")
    .notNull()
    .references(() => businessesTable.id),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),
  basePrice: doublePrecision("base_price"),
  hourlyRate: doublePrecision("hourly_rate"),
  minimumPrice: doublePrecision("minimum_price"),
  estimatedDuration: text("estimated_duration"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
});

export const pricingRulesTable = pgTable("pricing_rules", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id")
    .notNull()
    .references(() => businessesTable.id)
    .unique(),
  laborRate: doublePrecision("labor_rate"),
  emergencyFee: doublePrecision("emergency_fee"),
  travelFee: doublePrecision("travel_fee"),
  weekendMultiplier: doublePrecision("weekend_multiplier"),
  taxRate: doublePrecision("tax_rate"),
  discounts: text("discounts"),
  minimumJobCost: doublePrecision("minimum_job_cost"),
  customNotes: text("custom_notes"),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow().notNull(),
});

export const requirementsTable = pgTable("requirements", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id")
    .notNull()
    .references(() => businessesTable.id),
  key: text("key").notNull(),
  label: text("label").notNull(),
  status: text("status").notNull().default("pending"),
  source: text("source"),
  value: text("value"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
});

export const uploadedFilesTable = pgTable("uploaded_files", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id")
    .notNull()
    .references(() => businessesTable.id),
  filename: text("filename").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  fileType: text("file_type").notNull(),
  category: text("category"),
  summary: text("summary"),
  textContent: text("text_content"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
});

export const extractedValuesTable = pgTable("extracted_requirement_values", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id")
    .notNull()
    .references(() => businessesTable.id),
  requirementKey: text("requirement_key").notNull(),
  requirementLabel: text("requirement_label").notNull(),
  extractedValue: text("extracted_value"),
  sourceDocument: text("source_document"),
  confidenceScore: doublePrecision("confidence_score").notNull().default(0),
  overrideValue: text("override_value"),
  approved: boolean("approved").notNull().default(false),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
});

export const invoiceSettingsTable = pgTable("invoice_settings", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id")
    .notNull()
    .references(() => businessesTable.id)
    .unique(),
  selectedTemplate: text("selected_template")
    .notNull()
    .default("modern_estimate_card"),
  cancellationPolicy: text("cancellation_policy"),
  paymentTerms: text("payment_terms"),
  estimateDisclaimer: text("estimate_disclaimer"),
  termsConditions: text("terms_conditions"),
  acceptanceLanguage: text("acceptance_language"),
  depositRequirements: text("deposit_requirements"),
  footerNote: text("footer_note"),
  includedSections: jsonb("included_sections"),
  emailSubject: text("email_subject"),
  emailGreeting: text("email_greeting"),
  emailBodyText: text("email_body_text"),
  emailClosing: text("email_closing"),
  replyToEmail: text("reply_to_email"),
  ccOwner: boolean("cc_owner").notNull().default(true),
  attachPdf: boolean("attach_pdf").notNull().default(true),
  brandColor: text("brand_color").notNull().default("#1e3a5f"),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow().notNull(),
});

export const sandboxTestsTable = pgTable("sandbox_tests", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id")
    .notNull()
    .references(() => businessesTable.id),
  scenario: text("scenario"),
  prompt: text("prompt").notNull(),
  agentResponse: text("agent_response").notNull(),
  messages: jsonb("messages"),
  stage: text("stage").notNull().default("gathering"),
  customerEmail: text("customer_email"),
  emailSubject: text("email_subject"),
  emailBody: text("email_body"),
  emailSent: boolean("email_sent").notNull().default(false),
  estimate: jsonb("estimate"),
  rating: integer("rating"),
  feedbackNotes: text("feedback_notes"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
});

export const leadsTable = pgTable("leads", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id")
    .notNull()
    .references(() => businessesTable.id),
  customerName: text("customer_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  requestSummary: text("request_summary"),
  projectDescription: text("project_description"),
  aiResponse: text("ai_response"),
  estimate: jsonb("estimate"),
  estimatedLow: doublePrecision("estimated_low"),
  estimatedHigh: doublePrecision("estimated_high"),
  confidenceScore: doublePrecision("confidence_score"),
  status: text("status").notNull().default("new"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
});

export const widgetSettingsTable = pgTable("widget_settings", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id")
    .notNull()
    .references(() => businessesTable.id)
    .unique(),
  greeting: text("greeting").notNull().default("Hi! How can we help with your project today?"),
  primaryColor: text("primary_color").notNull().default("#1e3a5f"),
  position: text("position").notNull().default("bottom-right"),
  enabled: boolean("enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow().notNull(),
});

export const billingSubscriptionsTable = pgTable("billing_subscriptions", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id")
    .notNull()
    .references(() => businessesTable.id),
  planId: text("plan_id"),
  planName: text("plan_name"),
  status: text("status").notNull().default("inactive"),
  active: boolean("active").notNull().default(false),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
});

export const activityEventsTable = pgTable("activity_events", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id")
    .notNull()
    .references(() => businessesTable.id),
  type: text("type").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
});
