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

  // Data Collection - Enhanced with Oura Metrics
  targetMetrics: jsonb("target_metrics").notNull().default(`{
    "sleep": {
      "totalSleepTime": {"description": "Total time spent sleeping", "unit": "hours"},
      "sleepEfficiency": {"description": "Percentage of time in bed spent sleeping", "unit": "percentage"},
      "deepSleepTime": {"description": "Time spent in deep sleep", "unit": "minutes"},
      "remSleepTime": {"description": "Time spent in REM sleep", "unit": "minutes"},
      "sleepLatency": {"description": "Time taken to fall asleep", "unit": "minutes"},
      "restingHeartRate": {"description": "Average resting heart rate during sleep", "unit": "bpm"},
      "hrvAverage": {"description": "Average HRV during sleep", "unit": "ms"},
      "respiratoryRate": {"description": "Average breathing rate during sleep", "unit": "breaths/min"},
      "bodyTemperature": {"description": "Deviation from baseline temperature", "unit": "celsius"},
      "sleepScore": {"description": "Overall sleep quality score", "unit": "score"}
    },
    "readiness": {
      "readinessScore": {"description": "Overall readiness score", "unit": "score"},
      "recoveryIndex": {"description": "Recovery status from previous day", "unit": "score"},
      "activityBalance": {"description": "Balance between activity and rest", "unit": "score"},
      "hrvBalance": {"description": "HRV trend analysis", "unit": "score"}
    }
  }`),

  questionnaires: jsonb("questionnaires").notNull(),

  // Enhanced Custom Factors for Sleep Studies
  customFactors: jsonb("custom_factors").default(`[
    {"tag": "Alcohol", "description": "Alcohol consumption before bed"},
    {"tag": "LateCaffeine", "description": "Caffeine consumption after 2pm"},
    {"tag": "Travel", "description": "Travel or timezone changes"},
    {"tag": "Stress", "description": "Experienced high stress levels"},
    {"tag": "Illness", "description": "Feeling unwell or sick"},
    {"tag": "LateWorkout", "description": "Exercise within 3 hours of bedtime"},
    {"tag": "ScreenTime", "description": "Extended screen time before bed"},
    {"tag": "LateFood", "description": "Heavy meal within 2 hours of bedtime"},
    {"tag": "Environment", "description": "Unusual sleep environment"}
  ]`).notNull(),

  // Study Information
  studySummary: text("study_summary").notNull(),
  participantInstructions: jsonb("participant_instructions").notNull(),

  // Enhanced Safety Precautions
  safetyPrecautions: jsonb("safety_precautions").default(`{
    "general": "All data collected will be encrypted and stored securely to protect your privacy and ensure that no identifiable information is shared outside the research team.",
    "contact": "If you have any concerns or experience any adverse effects during the study, please contact the research team for support using the chat feature in the app or by emailing Reputable at mackenzie@reputable.health.",
    "priority": "Your safety and well-being is our top priority.",
    "dataProtection": "We implement industry-standard security measures to protect your data.",
    "monitoring": "Continuous monitoring of participant well-being throughout the study"
  }`).notNull(),

  // Enhanced Educational Resources
  educationalResources: jsonb("educational_resources").default(`[
    {
      "title": "Scientific Background",
      "description": "Review of existing research and evidence",
      "type": "article"
    },
    {
      "title": "Product Information",
      "description": "Detailed information about the intervention",
      "type": "documentation"
    },
    {
      "title": "Safety Information",
      "description": "Comprehensive safety data and guidelines",
      "type": "guide"
    }
  ]`).notNull(),

  // Enhanced Consent Form based on provided example
  consentFormSections: jsonb("consent_form_sections").default(`{
    "summary": {
      "title": "Research Consent Summary",
      "content": "You are being asked for your consent to take part in this study. This document provides a concise summary of this research and expectations associated with participating."
    },
    "voluntaryParticipation": {
      "title": "Voluntary Participation",
      "content": "Your participation in this study is voluntary. You may decide not to participate or you may leave the study at any time. Your decision will not result in any penalty or loss to which you are otherwise entitled."
    },
    "contact": {
      "title": "Contact Information",
      "content": "If you have any questions, you can contact the research team anytime through the chat feature in your dashboard or via email."
    },
    "purpose": {
      "title": "Research Purpose",
      "content": "Details about why this research is being conducted and its significance."
    },
    "expectations": {
      "title": "Participant Expectations",
      "content": "Detailed description of what is expected from participants, including surveys, device usage, and intervention adherence."
    },
    "risks": {
      "title": "Risks",
      "content": "Description of any potential risks associated with participation."
    },
    "benefits": {
      "title": "Benefits",
      "content": "Potential benefits from participating in the study."
    },
    "incentives": {
      "title": "Incentives",
      "content": "Any compensation or incentives for participation."
    },
    "privacy": {
      "title": "Privacy Protection",
      "content": "How participant privacy is protected and data confidentiality is maintained."
    },
    "consent": {
      "title": "Statement of Consent",
      "content": "By completing this consent, I confirm that I have read the above information, and have received answers to any questions I asked. I consent to take part in the study."
    }
  }`).notNull(),

  // Enhanced Eligibility Criteria with Specific Answers
  eligibilityCriteria: jsonb("eligibility_criteria").default(`{
    "questions": [
      {
        "question": "Do you own an Oura Ring?",
        "type": "boolean",
        "eligibleAnswer": true,
        "required": true
      },
      {
        "question": "Are you currently taking any sleep medication?",
        "type": "boolean",
        "eligibleAnswer": false,
        "required": true
      },
      {
        "question": "What is your age?",
        "type": "range",
        "eligibleRange": {"min": 18, "max": 65},
        "required": true
      },
      {
        "question": "How would you rate your overall sleep quality?",
        "type": "scale",
        "options": ["Very Poor", "Poor", "Fair", "Good", "Excellent"],
        "eligibleOptions": ["Very Poor", "Poor", "Fair"],
        "required": true
      }
    ],
    "exclusionCriteria": [
      "Pregnancy or planning to become pregnant",
      "Diagnosed sleep disorders",
      "Current use of sleep medications",
      "Shift work or irregular sleep schedule"
    ]
  }`).notNull(),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const insertProtocolSchema = createInsertSchema(protocols);
export const selectProtocolSchema = createSelectSchema(protocols);
export type InsertProtocol = typeof protocols.$inferInsert;
export type SelectProtocol = typeof protocols.$inferSelect;