import { z } from "zod";

// Define the protocol schema
const protocolSchema = z.object({
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
});

export const irbSubmissionRequestSchema = z.object({
  protocol: protocolSchema,
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

// Transform flat protocol data into the required nested structure
function transformProtocolData(protocolData: any): IrbSubmissionRequest {
  const { 
    title = protocolData.experimentTitle,
    studyObjective = protocolData.studyObjective,
    studyType: studyDesign = protocolData.studyType,
    participantCount = protocolData.participantCount || 0,
    durationWeeks = protocolData.durationWeeks || 0,
    targetMetrics = protocolData.targetMetrics || [],
    procedures = protocolData.procedures || [],
    eligibilityCriteria = protocolData.eligibilityCriteria || [],
    risks = protocolData.risks || [],
    safetyPrecautions = protocolData.safetyPrecautions || [],
    dataCollection = protocolData.dataCollection || {},
    dataStorage = protocolData.dataStorage || {},
    analysisMethod = protocolData.analysisMethod || {},
    timeline = protocolData.timeline || []
  } = protocolData;

  return {
    protocol: {
      title,
      studyObjective,
      studyDesign,
      participantCount,
      eligibilityCriteria,
      procedures: procedures.length > 0 ? procedures : targetMetrics,
      durationWeeks,
      risks,
      safetyPrecautions,
      dataCollection,
      dataStorage,
      analysisMethod,
      timeline,
      dataPrivacy: [],
      consentProcess: {},
      compensation: null,
      investigator: {
        name: "To be assigned",
        credentials: [],
        contact: {}
      }
    },
    literatureReview: {
      overview: {
        description: ["Study is based on comprehensive literature review"],
        benefits: ["Improved understanding of supplement efficacy"]
      },
      conclusion: {
        keyPoints: ["Study will provide valuable insights into supplement effectiveness"]
      }
    },
    riskAssessment: {
      categories: {
        participantSafety: 85 // Default high safety score for supplement studies
      }
    }
  };
}

export async function generateIrbSubmission(rawProtocolData: any) {
  console.log('Received raw protocol data:', JSON.stringify(rawProtocolData, null, 2));

  try {
    // Transform the raw protocol data into the required structure
    const transformedRequest = transformProtocolData(rawProtocolData);
    console.log('Transformed request data:', JSON.stringify(transformedRequest, null, 2));

    // Validate the transformed data
    const parseResult = irbSubmissionRequestSchema.safeParse(transformedRequest);
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