import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  doublePrecision,
  timestamp,
  jsonb,
  varchar,
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
    .references(() => usersTable.id, { onDelete: "cascade" }),
  clientId: text("client_id").notNull().unique(),
  name: text("name").notNull(),
  industry: text("industry"),
  industryOther: text("industry_other"),
  companySize: text("company_size"),
  customerType: text("customer_type"),
  website: text("website"),
  phone: text("phone"),
  email: text("email"),
  serviceArea: text("service_area"),
  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  addressCity: text("address_city"),
  addressState: text("address_state"),
  addressZip: text("address_zip"),
  status: text("status").notNull().default("onboarding"),
  profileApproved: boolean("profile_approved").notNull().default(false),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
});

export const servicesTable = pgTable("services", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id")
    .notNull()
    .references(() => businessesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),
  basePrice: doublePrecision("base_price"),
  hourlyRate: doublePrecision("hourly_rate"),
  minimumPrice: doublePrecision("minimum_price"),
  estimatedDuration: text("estimated_duration"),
  requiresInspection: boolean("requires_inspection").notNull().default(false),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
});

export const pricingRulesTable = pgTable("pricing_rules", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id")
    .notNull()
    .references(() => businessesTable.id, { onDelete: "cascade" })
    .unique(),
  laborRate: doublePrecision("labor_rate"),
  minimumJobCost: doublePrecision("minimum_job_cost"),
  travelFeeType: text("travel_fee_type"),
  travelFee: doublePrecision("travel_fee"),
  freeTravelRadius: integer("free_travel_radius"),
  materialMarkup: doublePrecision("material_markup"),
  weekendFeeType: text("weekend_fee_type"),
  weekendFeeValue: doublePrecision("weekend_fee_value"),
  emergencyFeeType: text("emergency_fee_type"),
  emergencyFee: doublePrecision("emergency_fee"),
  cancellationFee: doublePrecision("cancellation_fee"),
  cancellationWindow: text("cancellation_window"),
  depositRequired: boolean("deposit_required").notNull().default(false),
  depositType: text("deposit_type"),
  depositValue: doublePrecision("deposit_value"),
  taxRate: doublePrecision("tax_rate"),
  weekendMultiplier: doublePrecision("weekend_multiplier"),
  discounts: text("discounts"),
  customNotes: text("custom_notes"),
  pricingNotes: text("pricing_notes"),
  avgJobCost: doublePrecision("avg_job_cost"),
  lowJobCost: doublePrecision("low_job_cost"),
  highJobCost: doublePrecision("high_job_cost"),
  avgCrewSize: integer("avg_crew_size"),
  lowCrewSize: integer("low_crew_size"),
  highCrewSize: integer("high_crew_size"),
  typicalJobDuration: varchar("typical_job_duration", { length: 100 }),
  lowCostJobs: text("low_cost_jobs"),
  highCostJobs: text("high_cost_jobs"),
  priceIncreaseFactors: jsonb("price_increase_factors"),
  priceDecreaseFactors: jsonb("price_decrease_factors"),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow().notNull(),
});

export const requirementsTable = pgTable("requirements", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id")
    .notNull()
    .references(() => businessesTable.id, { onDelete: "cascade" }),
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
    .references(() => businessesTable.id, { onDelete: "cascade" }),
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
    .references(() => businessesTable.id, { onDelete: "cascade" }),
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
    .references(() => businessesTable.id, { onDelete: "cascade" })
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

export const businessProfileInterviewsTable = pgTable(
  "business_profile_interviews",
  {
    id: serial("id").primaryKey(),
    businessId: integer("business_id")
      .notNull()
      .references(() => businessesTable.id, { onDelete: "cascade" })
      .unique(),
    messages: jsonb("messages"),
    profileData: jsonb("profile_data"),
    status: text("status").notNull().default("in_progress"),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
);

export const businessOperationsTable = pgTable("business_operations", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id")
    .notNull()
    .references(() => businessesTable.id, { onDelete: "cascade" })
    .unique(),
  customerType: text("customer_type"),
  employeeCount: integer("employee_count"),
  yearFounded: integer("year_founded"),
  businessHours: jsonb("business_hours"),
  emergencyAvailable: boolean("emergency_available").notNull().default(false),
  emergencyNotes: text("emergency_notes"),
  seasonalAvailability: text("seasonal_availability"),
  seasonalNotes: text("seasonal_notes"),
  typicalResponseTime: text("typical_response_time"),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow().notNull(),
});

export const businessPoliciesTable = pgTable("business_policies", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id")
    .notNull()
    .references(() => businessesTable.id, { onDelete: "cascade" })
    .unique(),
  paymentTerms: text("payment_terms"),
  cancellationPolicy: text("cancellation_policy"),
  warrantyPolicy: text("warranty_policy"),
  refundPolicy: text("refund_policy"),
  weatherDelayPolicy: text("weather_delay_policy"),
  customerResponsibilities: text("customer_responsibilities"),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow().notNull(),
});

export const estimateRulesTable = pgTable("estimate_rules", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id")
    .notNull()
    .references(() => businessesTable.id, { onDelete: "cascade" })
    .unique(),
  requiredInfoBeforeQuoting: jsonb("required_info_before_quoting"),
  bdaQuestionsToAsk: jsonb("bda_questions_to_ask"),
  whenToGivePriceRange: text("when_to_give_price_range"),
  whenToRecommendVisit: text("when_to_recommend_visit"),
  estimateDisclaimer: text("estimate_disclaimer"),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow().notNull(),
});

export const businessToneTable = pgTable("business_tone", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id")
    .notNull()
    .references(() => businessesTable.id, { onDelete: "cascade" })
    .unique(),
  toneOptions: jsonb("tone_options"),
  phrasesToUse: jsonb("phrases_to_use"),
  phrasesToAvoid: jsonb("phrases_to_avoid"),
  brandVoice: text("brand_voice"),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow().notNull(),
});

export const businessProfileCompletionTable = pgTable(
  "business_profile_completion",
  {
    id: serial("id").primaryKey(),
    businessId: integer("business_id")
      .notNull()
      .references(() => businessesTable.id, { onDelete: "cascade" })
      .unique(),
    step1Complete: boolean("step1_complete").notNull().default(false),
    step2Complete: boolean("step2_complete").notNull().default(false),
    step3Complete: boolean("step3_complete").notNull().default(false),
    step4Complete: boolean("step4_complete").notNull().default(false),
    step5Complete: boolean("step5_complete").notNull().default(false),
    step6Complete: boolean("step6_complete").notNull().default(false),
    confirmedAt: timestamp("confirmed_at", { mode: "string" }),
    updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow().notNull(),
  },
);

export const sandboxTestsTable = pgTable("sandbox_tests", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id")
    .notNull()
    .references(() => businessesTable.id, { onDelete: "cascade" }),
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
    .references(() => businessesTable.id, { onDelete: "cascade" }),
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
    .references(() => businessesTable.id, { onDelete: "cascade" })
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
    .references(() => businessesTable.id, { onDelete: "cascade" }),
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
    .references(() => businessesTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
});
