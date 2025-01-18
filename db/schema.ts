import { pgTable, text, serial, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const protocols = pgTable("protocols", {
  id: serial("id").primaryKey(),
  // Basic Information
  productName: text("product_name").notNull(),
  websiteUrl: text("website_url"),
  studyGoal: text("study_goal").notNull(),

  // Core Study Parameters
  studyCategory: text("study_category").notNull(), // Sleep, Stress, Recovery, etc.
  experimentTitle: text("experiment_title").notNull(),
  studyObjective: text("study_objective").notNull(),
  studyType: text("study_type").notNull(), // Real-World Evidence or RCT
  participantCount: integer("participant_count").notNull(),
  durationWeeks: integer("duration_weeks").notNull(),

  // Data Collection
  targetMetrics: jsonb("target_metrics").notNull(), // Wearable metrics
  questionnaires: jsonb("questionnaires").notNull(), // Validated questionnaires
  customFactors: jsonb("custom_factors").default('[]').notNull(), // Life events to track

  // Study Information
  studySummary: text("study_summary").notNull(),
  participantInstructions: jsonb("participant_instructions").notNull(),
  safetyPrecautions: jsonb("safety_precautions").notNull(),
  educationalResources: jsonb("educational_resources").notNull(), // Array of {title, description, type}

  // Participant Management
  consentFormSections: jsonb("consent_form_sections").notNull(), // Array of {title, content}
  eligibilityCriteria: jsonb("eligibility_criteria").notNull(), // Complex object with multiple criteria

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const insertProtocolSchema = createInsertSchema(protocols);
export const selectProtocolSchema = createSelectSchema(protocols);
export type InsertProtocol = typeof protocols.$inferInsert;
export type SelectProtocol = typeof protocols.$inferSelect;