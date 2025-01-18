import { pgTable, text, serial, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const protocols = pgTable("protocols", {
  id: serial("id").primaryKey(),
  productName: text("product_name").notNull(),
  websiteUrl: text("website_url"),
  studyGoal: text("study_goal").notNull(),
  studyCategory: text("study_category").notNull(),
  experimentTitle: text("experiment_title").notNull(),
  studyObjective: text("study_objective").notNull(), 
  studyType: text("study_type").notNull(),
  participantCount: integer("participant_count").notNull(),
  durationWeeks: integer("duration_weeks").notNull(),
  targetMetrics: jsonb("target_metrics").notNull(),
  questionnaires: jsonb("questionnaires").notNull(),
  eligibilityCriteria: jsonb("eligibility_criteria").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const insertProtocolSchema = createInsertSchema(protocols);
export const selectProtocolSchema = createSelectSchema(protocols);
export type InsertProtocol = typeof protocols.$inferInsert;
export type SelectProtocol = typeof protocols.$inferSelect;
