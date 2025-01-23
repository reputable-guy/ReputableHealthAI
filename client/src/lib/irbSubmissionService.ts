import { z } from "zod";

export const irbSubmissionRequestSchema = z.object({
  protocol: z.object({
    title: z.string(),
    investigator: z.object({
      name: z.string().optional(),
      credentials: z.array(z.string()).optional(),
      contact: z.record(z.string()).optional()
    }).optional(),
    studyObjective: z.string(),
    studyDesign: z.string(),
    participantCount: z.number(),
    eligibilityCriteria: z.array(z.string()),
    procedures: z.array(z.string()),
    durationWeeks: z.number(),
    risks: z.array(z.string()).optional(),
    safetyPrecautions: z.array(z.string()).optional(),
    dataPrivacy: z.array(z.string()).optional(),
    consentProcess: z.record(z.unknown()).optional(),
    compensation: z.unknown().optional(),
    dataCollection: z.unknown(),
    dataStorage: z.unknown(),
    analysisMethod: z.unknown(),
    timeline: z.array(z.unknown()).optional()
  }),
  literatureReview: z.object({
    overview: z.object({
      description: z.array(z.string()),
      benefits: z.array(z.string())
    }),
    conclusion: z.object({
      keyPoints: z.array(z.string())
    })
  }),
  riskAssessment: z.object({
    categories: z.object({
      participantSafety: z.number()
    })
  })
});

export type IrbSubmissionRequest = z.infer<typeof irbSubmissionRequestSchema>;

export async function generateIrbSubmission(request: IrbSubmissionRequest) {
  console.log('Sending IRB submission request:', JSON.stringify(request, null, 2));

  try {
    const parseResult = irbSubmissionRequestSchema.safeParse(request);
    if (!parseResult.success) {
      console.error('Validation error:', parseResult.error);
      throw new Error('Invalid request data: ' + JSON.stringify(parseResult.error.flatten()));
    }

    const response = await fetch("/api/protocols/irb-submission", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(parseResult.data),
      credentials: 'include'
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ 
        message: `HTTP error! status: ${response.status}` 
      }));
      console.error('Server error:', errorData);
      throw new Error(errorData.message || `Failed to generate IRB submission (Status: ${response.status})`);
    }

    const data = await response.json();
    if (!data.submission) {
      console.error('Invalid response format:', data);
      throw new Error('Invalid response format from server');
    }

    console.log('Successfully received IRB submission:', data.submission);
    return data.submission;
  } catch (error) {
    console.error('IRB submission generation error:', error);
    throw error instanceof Error ? error : new Error('Failed to generate IRB submission');
  }
}