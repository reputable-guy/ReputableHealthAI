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
  const response = await fetch("/api/literature-review", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(errorData.message || `Failed to generate literature review: ${response.statusText}`);
  }

  const { review } = await response.json();
  return review;
}