import OpenAI from "openai";
import { z } from "zod";

export const literatureReviewRequestSchema = z.object({
  productName: z.string().min(1),
  ingredients: z.array(z.string()).min(1),
});

const wellnessAreas = [
  "Sleep & Recovery",
  "Physical Performance & Recovery",
  "Cardiovascular Health",
  "Cognitive Function & Mood",
  "Metabolic & Gut Health",
  "Sexual Health & Performance",
];

export async function generateLiteratureReview(productName: string, ingredients: string[]) {
  const openai = new OpenAI();
  
  const prompt = `Generate a comprehensive literature review for ${productName} containing the following ingredients: ${ingredients.join(", ")}.

Follow this exact structure from the example:

1. Overview
- What is it?
- Primary Benefits (with checkmark emoji ✅)
- Common Supplement Forms

2. Impact on Key Wellness Areas
For each relevant area (Sleep & Recovery, Physical Performance, etc):
- How It Works (mechanism)
- Key Findings (with ✅)
- Research Gaps (with ❌)

3. Research Gaps & Future Studies
- List key unanswered questions with 📌

4. Conclusion
- Essential functions
- Supplementation insights
- Safety considerations
- Who Benefits Most (with ✅)

Use emojis consistently as shown in the example. Format in markdown.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: "You are a scientific literature review expert. Provide detailed, evidence-based reviews following the exact format specified. Use emojis as instructed."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    temperature: 0.7,
    max_tokens: 2000,
  });

  return response.choices[0].message.content;
}
