import { z } from "zod";

export const literatureReviewRequestSchema = z.object({
  productName: z.string().min(1, "Product name is required"),
  websiteUrl: z.string().url("Please enter a valid URL").optional(),
});

export type LiteratureReviewRequest = z.infer<typeof literatureReviewRequestSchema>;

export interface LiteratureReview {
  title: string;
  overview: {
    description: string[];
    benefits: string[];
    supplementForms: string[];
  };
  wellnessAreas: {
    emoji: string;
    name: string;
    mechanism: string[];
    keyFindings: string[];
    researchGaps: string[];
  }[];
  researchGaps: {
    questions: string[];
  };
  conclusion: {
    keyPoints: string[];
    safetyConsiderations: string[];
    targetAudience: string[];
  };
  references: string[]; // Add new references field
}

const MAX_RETRIES = 2;
const RETRY_DELAY = 1000; // 1 second

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function generateLiteratureReview(
  request: LiteratureReviewRequest
): Promise<LiteratureReview> {
  console.log('Sending literature review request:', request);

  let retries = 0;
  let lastError: Error | null = null;

  while (retries <= MAX_RETRIES) {
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
        throw new Error(errorData.message || `Failed to generate literature review (Status: ${response.status})`);
      }

      const data = await response.json();
      if (!data.review) {
        throw new Error('Invalid response format from server');
      }

      return data.review;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('An unknown error occurred');

      if (retries < MAX_RETRIES) {
        console.log(`Attempt ${retries + 1} failed, retrying after ${RETRY_DELAY}ms...`);
        await sleep(RETRY_DELAY * (retries + 1)); // Exponential backoff
        retries++;
      } else {
        console.error('Literature review generation error:', error);
        throw lastError;
      }
    }
  }

  // This should never be reached due to the throw in the loop
  throw lastError || new Error('Failed to generate literature review after retries');
}