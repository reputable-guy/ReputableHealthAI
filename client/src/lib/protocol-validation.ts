import * as z from "zod";

export const studySetupSchema = z.object({
  productName: z.string().min(1, "Product name is required"),
  websiteUrl: z.string().url().optional(),
  studyGoal: z.enum(["pilot", "marketing", "publication"], {
    required_error: "Please select a study goal"
  })
});

export const protocolGeneratorSchema = z.object({
  studyCategory: z.enum(["Sleep", "Stress", "Recovery", "Cognition", "Metabolic Health", "Women's Health", "Other"]),
  experimentTitle: z.string().min(1, "Experiment title is required"),
  studyObjective: z.string().min(1, "Study objective is required"),
  studyType: z.enum(["Real-World Evidence", "Randomized Controlled Trial"]),
  participantCount: z.number().min(10),
  durationWeeks: z.number().min(1),
  targetMetrics: z.array(z.string()).min(1),
  questionnaires: z.array(z.string())
});

export const eligibilityCriteriaSchema = z.object({
  wearableData: z.array(z.any()),
  demographics: z.array(z.any()),
  customQuestions: z.array(z.string())
});
