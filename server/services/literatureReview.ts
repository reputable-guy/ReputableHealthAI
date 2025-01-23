import OpenAI from "openai";
import { z } from "zod";
import axios from "axios";
import { load } from "cheerio";
import { wellnessAreas } from "./literatureReview";

const CACHE_DURATION = 1000 * 60 * 60; // 1 hour
const scrapeCache = new Map<string, { content: string; timestamp: number }>();

export const literatureReviewRequestSchema = z.object({
  productName: z.string().min(1, "Product name is required"),
  websiteUrl: z.string().url("Please enter a valid URL").optional(),
});

export async function scrapeWebsite(url: string): Promise<string> {
  const cached = scrapeCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log('Using cached website content');
    return cached.content;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await axios.get(url, {
      signal: controller.signal,
      timeout: 5000,
    });
    clearTimeout(timeout);

    const $ = load(response.data);

    $('nav, footer, header, script, style, .navigation, .footer, .header, .menu').remove();

    const content = $('main, article, div[role="main"], .content, #content, .product-description')
      .text()
      .trim()
      .replace(/\s+/g, ' ')
      .substring(0, 2000); 

    scrapeCache.set(url, { content, timestamp: Date.now() });
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

  const systemPrompt = `You are a scientific literature review expert. Generate a detailed, evidence-based review following this exact structure:

1. Overview
- Description: Provide a clear, scientific explanation of the product
- Benefits: List each benefit with a "BENEFIT:" prefix
- Forms: List each form with a "FORM:" prefix

2. Wellness Areas
For each applicable area, provide:
- Name with "AREA:" prefix
- Mechanism with "MECHANISM:" prefix
- Key findings with "FINDING:" prefix
- Research gaps with "GAP:" prefix

3. Research Gaps
List each future research question with "QUESTION:" prefix

4. Conclusion
- Key points with "KEY:" prefix
- Target audience with "AUDIENCE:" prefix
- Safety considerations with "SAFETY:" prefix

Use scientific language and maintain consistency in formatting.`;

  const userPrompt = `Generate a comprehensive literature review for ${productName}.
${productContext ? '\nProduct Context:\n' + productContext : ''}

Follow the exact structure and formatting specified. Include at least 3 items for each list section.`;

  try {
    console.log('Sending literature review request to OpenAI...');
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Failed to generate content from OpenAI");
    }

    console.log('Successfully received OpenAI response');
    return parseReviewContent(content);
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
    const lines = content.split('\n').map(line => line.trim());
    let currentSection = '';
    let currentArea: typeof review.wellnessAreas[0] | null = null;

    for (const line of lines) {
      if (line.startsWith('1. Overview')) {
        currentSection = 'overview';
        continue;
      } else if (line.startsWith('2. Wellness Areas')) {
        currentSection = 'wellness';
        continue;
      } else if (line.startsWith('3. Research Gaps')) {
        currentSection = 'gaps';
        continue;
      } else if (line.startsWith('4. Conclusion')) {
        currentSection = 'conclusion';
        continue;
      }

      if (!line) continue;

      switch (currentSection) {
        case 'overview':
          if (line.startsWith('BENEFIT:')) {
            review.overview.benefits.push(line.replace('BENEFIT:', '').trim());
          } else if (line.startsWith('FORM:')) {
            review.overview.supplementForms.push(line.replace('FORM:', '').trim());
          } else if (!line.includes(':') && line.length > 10) {
            review.overview.description += ' ' + line;
          }
          break;

        case 'wellness':
          if (line.startsWith('AREA:')) {
            if (currentArea && currentArea.name) {
              review.wellnessAreas.push(currentArea);
            }
            currentArea = {
              name: line.replace('AREA:', '').trim(),
              mechanism: '',
              keyFindings: [],
              researchGaps: [],
            };
          } else if (line.startsWith('MECHANISM:') && currentArea) {
            currentArea.mechanism = line.replace('MECHANISM:', '').trim();
          } else if (line.startsWith('FINDING:') && currentArea) {
            currentArea.keyFindings.push(line.replace('FINDING:', '').trim());
          } else if (line.startsWith('GAP:') && currentArea) {
            currentArea.researchGaps.push(line.replace('GAP:', '').trim());
          }
          break;

        case 'gaps':
          if (line.startsWith('QUESTION:')) {
            review.researchGaps.questions.push(line.replace('QUESTION:', '').trim());
          }
          break;

        case 'conclusion':
          if (line.startsWith('KEY:')) {
            review.conclusion.keyPoints.push(line.replace('KEY:', '').trim());
          } else if (line.startsWith('AUDIENCE:')) {
            review.conclusion.targetAudience.push(line.replace('AUDIENCE:', '').trim());
          } else if (line.startsWith('SAFETY:')) {
            review.conclusion.safetyConsiderations.push(line.replace('SAFETY:', '').trim());
          }
          break;
      }
    }

    if (currentArea && currentArea.name) {
      review.wellnessAreas.push(currentArea);
    }

    review.overview.description = review.overview.description.trim();

    if (review.overview.benefits.length === 0) review.overview.benefits = ['No specific benefits listed'];
    if (review.overview.supplementForms.length === 0) review.overview.supplementForms = ['Standard supplement form'];
    if (review.wellnessAreas.length === 0) {
      review.wellnessAreas = [{
        name: 'General Wellness',
        mechanism: 'Mechanism of action not specified',
        keyFindings: ['No specific findings listed'],
        researchGaps: ['Further research needed'],
      }];
    }
    if (review.researchGaps.questions.length === 0) {
      review.researchGaps.questions = ['Further research needed to establish optimal dosing'];
    }
    if (review.conclusion.keyPoints.length === 0) review.conclusion.keyPoints = ['Additional research recommended'];
    if (review.conclusion.targetAudience.length === 0) review.conclusion.targetAudience = ['General adult population'];
    if (review.conclusion.safetyConsiderations.length === 0) {
      review.conclusion.safetyConsiderations = ['Consult healthcare provider before use'];
    }

    return review;
  } catch (error) {
    console.error('Error parsing review content:', error);
    throw new Error('Failed to parse literature review content');
  }
}

export const wellnessAreas = [
  "Sleep & Recovery",
  "Physical Performance & Recovery",
  "Cardiovascular Health",
  "Cognitive Function & Mood",
  "Metabolic & Gut Health",
];