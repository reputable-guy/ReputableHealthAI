import { pgTable, text, serial, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const protocols = pgTable("protocols", {
  id: serial("id").primaryKey(),
  // Basic Information
  productName: text("product_name").notNull(),
  websiteUrl: text("website_url"),
  studyGoal: text("study_goal").notNull(),

  // Core Study Parameters
  studyCategory: text("study_category").notNull(),
  experimentTitle: text("experiment_title").notNull(),
  studyObjective: text("study_objective").notNull(),
  studyType: text("study_type").notNull(),
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

  // Enhanced Custom Factors for Sleep Studies as Tags
  customFactors: jsonb("custom_factors").default(`{
    "tags": [
      {
        "id": "lateCaffeine",
        "label": "Late caffeine",
        "description": "Consumed caffeine late in the day",
        "impactedMetrics": ["sleepScore", "sleepLatency"]
      },
      {
        "id": "lateMeal",
        "label": "Late meal",
        "description": "Consumed a meal close to bedtime",
        "impactedMetrics": ["sleepScore", "hrvAverage"]
      },
      {
        "id": "alcohol",
        "label": "Alcohol intake",
        "description": "Consumed alcohol",
        "impactedMetrics": ["deepSleepTime", "remSleepTime"]
      },
      {
        "id": "noisyRoom",
        "label": "Noisy room",
        "description": "Sleep environment was noisy",
        "impactedMetrics": ["sleepScore", "sleepLatency"]
      },
      {
        "id": "blueLight",
        "label": "Blue light",
        "description": "Extended screen exposure before bed",
        "impactedMetrics": ["sleepLatency", "sleepScore"]
      },
      {
        "id": "jetLag",
        "label": "Jet lag",
        "description": "Experiencing jet lag",
        "impactedMetrics": ["sleepScore", "bodyTemperature"]
      },
      {
        "id": "lateWorkout",
        "label": "Late workout",
        "description": "Exercise close to bedtime",
        "impactedMetrics": ["sleepLatency", "hrvAverage"]
      },
      {
        "id": "stress",
        "label": "Stress",
        "description": "High stress levels",
        "impactedMetrics": ["hrvAverage", "sleepScore"]
      }
    ],
    "maxDailyTags": 5,
    "requireDaily": true
  }`).notNull(),

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
      "description": "Review of existing research and scientific evidence on the intervention's efficacy",
      "type": "article",
      "content": "Detailed overview of previous studies and their findings"
    },
    {
      "title": "Product Information",
      "description": "Comprehensive information about the intervention",
      "type": "documentation",
      "content": "Details about ingredients, mechanism of action, and usage instructions"
    },
    {
      "title": "Safety Information",
      "description": "Safety data and guidelines for the intervention",
      "type": "guide",
      "content": "Information about safety studies, potential side effects, and precautions"
    }
  ]`).notNull(),

  // Consent Form based on provided example
  consentFormSections: jsonb("consent_form_sections").default(`{
    "title": "RESEARCH CONSENT SUMMARY",
    "introduction": {
      "title": "Introduction",
      "content": "You are being asked for your consent to take part in the study. This document provides a concise summary of this research and expectations associated with participating. Your participation in this study is voluntary. You may decide not to participate or you may leave the study at any time. Your decision will not result in any penalty or loss to which you are otherwise entitled."
    },
    "contact": {
      "title": "Contact Information",
      "content": "If you have any questions, you can contact the research team anytime at mackenzie@reputable.health, or by using the chat feature located in your Reputable Health dashboard."
    },
    "purpose": {
      "title": "Why is this research being done?",
      "content": "The purpose of this research is to assess the impact of the intervention on participant sleep, mental well-being, and other health metrics in a real world setting following a 4-week intervention period."
    },
    "expectations": {
      "title": "What is expected of me if I agree to take part in this research?",
      "content": "If you decide to take part in this research study, you will be asked to engage in the following activities:\n\n1. Complete Surveys: You will be required to complete two surveys—one at the start of the study (baseline, 0 weeks) and another at the end of the study (4 weeks). These surveys are designed to gather information on your sleep patterns, well-being, and other relevant metrics.\n\n2. Connect and Wear Your Oura Device: You will need to connect your Oura Ring device to the Reputable platform. This connection will allow us to collect objective data on your sleep and other health-related biomarker metrics continuously throughout the study period. It is important that you keep your Oura Ring charged and wear it over the course of the study period.\n\n3. Intervention Adherence: You will be asked to consume the supplement as directed, 5 days on (taking the supplement) and 2 days off (not taking the supplement). It is important that you follow these instructions carefully to ensure the accuracy and reliability of the study's results. You will be automatically withdrawn from the study if you fail to meet a 70% compliance threshold. Compliance is defined as you confirming that you took or did not take the supplement in the Reputable Health app daily."
    },
    "risks": {
      "title": "What are the risks associated with participating in this study?",
      "content": "There are no known adverse risks associated with participating in this study. The intervention may produce morning drowsiness if not taken as directed."
    },
    "benefits": {
      "title": "What are the benefits associated with participating in this study?",
      "content": "By participating in this study, you may experience potential benefits. Through use of the Reputable Health app and the continuous monitoring of biomarker metrics, you may also become more aware of your sleep patterns and overall health metrics, which may help establish more informed decisions about your health. You will also be contributing to a foundation of scientific knowledge that will contribute to the growth of a body of research assessing the effectiveness of organic sleep supplementation on sleep and health.\n\nWhile the study has the potential to provide these benefits, it is important to note that benefits are not guaranteed, and the primary goal of the research is to gather data that will contribute to scientific understanding. Your involvement is greatly valued and will play a key role in advancing knowledge in this area."
    },
    "incentives": {
      "title": "Are there any incentives associated with participating in this research?",
      "content": "Participants in this study will receive compensation for their time and effort, contingent on their adherence to study protocols and the completion of key milestones. Upon successful completion of the study, defined as maintaining at least 70% adherence to the study protocols and completing the end-of-study survey, participants will be awarded an electronic gift card valued at $50."
    },
    "privacy": {
      "title": "How are you protecting privacy and ensuring confidentiality?",
      "content": "Upon enrollment into the Reputable App, all participants are de-identified using a randomly assigned alias that will follow them throughout the course of their participation in the study and time in the Reputable platform. All communications and research activities will be conducted under the alias and personal identifying information will be minimized to an administrative level for safety and regulatory purposes only.\n\nDe-identified data from this study will be shared with the commercial sponsor of the study and used to validate claims surrounding product efficacy and to advance future research in this area. No personal information that could be used to identify you will be shared with any external parties, including the sponsor."
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
        "id": "magnesiumUse",
        "question": "Have you taken any magnesium supplements in the last 3 months?",
        "type": "select",
        "options": [
          {"value": "no", "label": "No, I have not taken any magnesium supplements", "eligible": true},
          {"value": "yes", "label": "Yes, I have taken magnesium supplements", "eligible": false},
          {"value": "unsure", "label": "I'm not sure", "eligible": false}
        ],
        "required": true
      },
      {
        "id": "sleepDisorders",
        "question": "Do you have any diagnosed sleep disorders?",
        "type": "select",
        "options": [
          {"value": "no", "label": "No diagnosed sleep disorders", "eligible": true},
          {"value": "apnea", "label": "Sleep apnea", "eligible": false},
          {"value": "insomnia", "label": "Insomnia", "eligible": false},
          {"value": "other", "label": "Other sleep disorder", "eligible": false}
        ],
        "required": true
      },
      {
        "id": "sleepQuality",
        "question": "How would you rate your overall sleep quality in the past month?",
        "type": "scale",
        "options": [
          {"value": 1, "label": "Very Poor", "eligible": true},
          {"value": 2, "label": "Poor", "eligible": true},
          {"value": 3, "label": "Fair", "eligible": true},
          {"value": 4, "label": "Good", "eligible": false},
          {"value": 5, "label": "Excellent", "eligible": false}
        ],
        "required": true
      },
      {
        "id": "ouraRing",
        "question": "Do you own an Oura Ring that you can wear throughout the study period?",
        "type": "select",
        "options": [
          {"value": "yes", "label": "Yes, I own an Oura Ring", "eligible": true},
          {"value": "no", "label": "No, I don't own an Oura Ring", "eligible": false},
          {"value": "ordered", "label": "I've ordered one but haven't received it yet", "eligible": false}
        ],
        "required": true
      },
      {
        "id": "healthConditions",
        "question": "Do you have any of the following conditions? (Select all that apply)",
        "type": "multiselect",
        "options": [
          {"value": "none", "label": "None of the above", "eligible": true},
          {"value": "kidney", "label": "Kidney problems", "eligible": false},
          {"value": "heart", "label": "Heart conditions", "eligible": false},
          {"value": "pregnant", "label": "Pregnant or planning pregnancy", "eligible": false},
          {"value": "medication", "label": "Taking medications that interact with magnesium", "eligible": false}
        ],
        "eligibilityLogic": "must_select_none",
        "required": true
      }
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