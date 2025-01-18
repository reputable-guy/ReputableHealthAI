import OpenAI from "openai";

if (!import.meta.env.VITE_OPENAI_API_KEY) {
  throw new Error("VITE_OPENAI_API_KEY is required");
}

const openai = new OpenAI({ 
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

export async function generateProtocolInsights(protocolData: any) {
  const prompt = `
As a clinical research expert, analyze this study protocol and provide insights:

Product: ${protocolData.productName}
Category: ${protocolData.studyCategory}
Study Type: ${protocolData.studyType}
Duration: ${protocolData.durationWeeks} weeks
Participants: ${protocolData.participantCount}

Please provide:
1. Statistical Power Analysis
2. Potential Confounding Variables
3. Suggestions for Protocol Improvement
4. Risk Assessment
5. Expected Timeline Milestones

Format the response in markdown.
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert clinical research advisor helping to analyze and improve study protocols."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    return response.choices[0].message.content;
  } catch (error: any) {
    console.error("Failed to generate insights:", error);
    throw new Error(`Failed to generate protocol insights: ${error.message}`);
  }
}