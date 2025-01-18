import OpenAI from "openai";
import type { ProtocolData } from "@/pages/protocol-designer";

if (!import.meta.env.VITE_OPENAI_API_KEY) {
  throw new Error("VITE_OPENAI_API_KEY is required");
}

const openai = new OpenAI({ 
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

export async function generateProtocolInsights(setupData: Partial<ProtocolData>): Promise<ProtocolData> {
  const prompt = `
As a clinical research expert, generate a comprehensive study protocol based on these initial details:

Product Name: ${setupData.productName}
Website: ${setupData.websiteUrl || 'N/A'}
Study Goal: ${setupData.studyGoal}

Generate a complete study protocol including:
1. Study Category (Sleep, Stress, Recovery, etc.)
2. Experiment Title (participant-facing)
3. Study Objective/Hypothesis
4. Study Type (Real-World Evidence or RCT)
5. Recommended participant count (with statistical justification)
6. Study duration in weeks
7. Target metrics to measure (specific to the wearable devices)
8. Recommended validated questionnaires
9. Eligibility criteria including:
   - Wearable data requirements
   - Demographic requirements
   - Screening questions

Format the response as a JSON object matching this TypeScript type:
{
  studyCategory: string,
  experimentTitle: string,
  studyObjective: string,
  studyType: string,
  participantCount: number,
  durationWeeks: number,
  targetMetrics: string[],
  questionnaires: string[],
  eligibilityCriteria: {
    wearableData: any[],
    demographics: any[],
    customQuestions: string[]
  }
}

Ensure the protocol design follows scientific best practices and is appropriate for the product category.
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert clinical research advisor specializing in wellness product studies. Generate study protocols that are scientifically rigorous yet practical for wellness brands."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7
    });

    if (!response.choices[0].message.content) {
      throw new Error("No response content received from OpenAI");
    }

    const generatedProtocol = JSON.parse(response.choices[0].message.content);
    return {
      ...setupData,
      ...generatedProtocol
    } as ProtocolData;
  } catch (error: any) {
    console.error("Failed to generate protocol:", error);

    // Handle specific OpenAI API errors
    if (error.status === 429) {
      throw new Error("OpenAI API rate limit exceeded. Please try again in a few minutes.");
    } else if (error.status === 401) {
      throw new Error("Invalid OpenAI API key. Please check your API key configuration.");
    } else if (error.message.includes("JSON")) {
      throw new Error("Invalid response format from OpenAI. Please try again.");
    }

    throw new Error(`Failed to generate protocol: ${error.message}`);
  }
}