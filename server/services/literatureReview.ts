import OpenAI from "openai";
import { z } from "zod";
import axios from "axios";
import { load } from "cheerio";

export const literatureReviewRequestSchema = z.object({
  productName: z.string().min(1),
  websiteUrl: z.string().url().optional(),
});

const wellnessAreas = [
  "Sleep & Recovery",
  "Physical Performance & Recovery",
  "Cardiovascular Health",
  "Cognitive Function & Mood",
  "Metabolic & Gut Health",
  "Sexual Health & Performance",
];

async function scrapeWebsite(url: string): Promise<string> {
  try {
    const response = await axios.get(url);
    const $ = load(response.data);
    // Extract text from main content areas, avoiding navigation and footer
    const content = $('main, article, div[role="main"], .content, #content')
      .text()
      .trim()
      .replace(/\s+/g, ' ');
    return content;
  } catch (error) {
    console.error('Error scraping website:', error);
    return '';
  }
}

export async function generateLiteratureReview(productName: string, websiteUrl?: string) {
  if (!productName) {
    throw new Error("Product name is required");
  }

  let productContext = '';
  if (websiteUrl) {
    try {
      productContext = await scrapeWebsite(websiteUrl);
    } catch (error) {
      console.error('Error getting product context:', error);
    }
  }

  const openai = new OpenAI();

  const prompt = `Generate a comprehensive literature review for ${productName} ${productContext ? 'based on the following product information: ' + productContext : ''}.
The goal is to support marketing claims with scientific evidence.

Follow this exact structure:

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

Use emojis consistently as shown. Format in markdown with a focus on evidence that could support marketing claims while maintaining scientific accuracy.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: "You are a scientific literature review expert. Generate detailed, evidence-based reviews that can support marketing claims while maintaining scientific accuracy and proper disclosure of research gaps."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    temperature: 0.7,
    max_tokens: 2000,
  });

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error("Failed to generate literature review");
  }

  return content;
}