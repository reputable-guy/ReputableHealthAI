import { z } from "zod";

export const literatureReviewRequestSchema = z.object({
  productName: z.string().min(1, "Product name is required"),
  websiteUrl: z.string().url("Please enter a valid URL").optional(),
});

export type LiteratureReviewRequest = z.infer<typeof literatureReviewRequestSchema>;

export interface LiteratureReview {
  overview: {
    description: string;
    benefits: string[];
    supplementForms: string[];
  };
  wellnessAreas: {
    name: string;
    mechanism: string;
    keyFindings: string[];
    researchGaps: string[];
  }[];
  researchGaps: {
    questions: string[];
  };
  conclusion: {
    keyPoints: string[];
    targetAudience: string[];
    safetyConsiderations: string[];
  };
}

export async function generateLiteratureReview(
  request: LiteratureReviewRequest
): Promise<LiteratureReview> {
  console.log('Sending literature review request:', request);

  try {
    const response = await fetch("/api/literature-review", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
      credentials: 'include'
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ 
        message: `HTTP error! status: ${response.status}` 
      }));
      throw new Error(errorData.message || 'Failed to generate literature review');
    }

    const data = await response.json();
    if (!data.review) {
      throw new Error('Invalid response format from server');
    }

    return data.review;
  } catch (error) {
    console.error('Literature review generation error:', error);
    throw error;
  }
}