import OpenAI from "openai";
import { z } from "zod";
import axios from "axios";
import { load } from "cheerio";

export const literatureReviewRequestSchema = z.object({
  productName: z.string().min(1, "Product name is required"),
  websiteUrl: z.string().url("Please enter a valid URL").optional(),
});

export async function scrapeWebsite(url: string): Promise<string> {
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
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key is required");
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  let productContext = '';
  if (websiteUrl) {
    try {
      productContext = await scrapeWebsite(websiteUrl);
      console.log('Scraped website content length:', productContext.length);
    } catch (error) {
      console.error('Error getting product context:', error);
    }
  }

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

  try {
    console.log('Sending request to OpenAI...');
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
      throw new Error("Failed to generate content from OpenAI");
    }

    console.log('Successfully received OpenAI response');
    const review = parseReviewContent(content);
    return review;
  } catch (error) {
    console.error('OpenAI API Error:', error);
    throw error;
  }
}

function parseReviewContent(content: string) {
  const review = {
    overview: {
      description: "",
      benefits: [] as string[],
      supplementForms: [] as string[],
    },
    wellnessAreas: [] as Array<{
      name: string;
      mechanism: string;
      keyFindings: string[];
      researchGaps: string[];
    }>,
    researchGaps: {
      questions: [] as string[],
    },
    conclusion: {
      keyPoints: [] as string[],
      targetAudience: [] as string[],
      safetyConsiderations: [] as string[],
    },
  };

  try {
    // Split content into sections
    const sections = content.split(/\n\d+\./);

    if (sections.length > 1) {
      // Parse Overview section
      const overviewLines = sections[1].split('\n');
      review.overview.description = overviewLines.find(line => line.includes("What is it"))?.replace("What is it?", "").trim() || "";
      review.overview.benefits = overviewLines
        .filter(line => line.includes("✅"))
        .map(line => line.replace("✅", "").trim());
      review.overview.supplementForms = overviewLines
        .filter(line => line.includes("-") && !line.includes("✅"))
        .map(line => line.replace("-", "").trim());

      // Parse Wellness Areas
      if (sections[2]) {
        const areas = sections[2].split(/\n(?=[A-Z])/);
        areas.forEach(area => {
          const lines = area.split('\n');
          const name = lines[0].trim();
          if (name) {
            review.wellnessAreas.push({
              name,
              mechanism: lines.find(l => l.includes("How It Works"))?.replace("How It Works", "").trim() || "",
              keyFindings: lines
                .filter(l => l.includes("✅"))
                .map(l => l.replace("✅", "").trim()),
              researchGaps: lines
                .filter(l => l.includes("❌"))
                .map(l => l.replace("❌", "").trim()),
            });
          }
        });
      }

      // Parse Research Gaps
      if (sections[3]) {
        review.researchGaps.questions = sections[3]
          .split('\n')
          .filter(line => line.includes("📌"))
          .map(line => line.replace("📌", "").trim());
      }

      // Parse Conclusion
      if (sections[4]) {
        const conclusionLines = sections[4].split('\n');
        review.conclusion.keyPoints = conclusionLines
          .filter(line => line.includes("✅"))
          .map(line => line.replace("✅", "").trim());

        review.conclusion.safetyConsiderations = conclusionLines
          .filter(line => line.toLowerCase().includes("safety"))
          .map(line => line.replace(/^[^a-zA-Z]+/, "").trim());

        review.conclusion.targetAudience = conclusionLines
          .filter(line => line.toLowerCase().includes("benefits most"))
          .map(line => line.replace(/^[^a-zA-Z]+/, "").trim());
      }
    }

    return review;
  } catch (error) {
    console.error('Error parsing review content:', error);
    throw new Error('Failed to parse literature review content');
  }
}

const wellnessAreas = [
  "Sleep & Recovery",
  "Physical Performance & Recovery",
  "Cardiovascular Health",
  "Cognitive Function & Mood",
  "Metabolic & Gut Health",
  "Sexual Health & Performance",
];