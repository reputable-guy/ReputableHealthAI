import OpenAI from "openai";
import { z } from "zod";
import axios from "axios";
import { load } from "cheerio";

const CACHE_DURATION = 1000 * 60 * 60; // 1 hour
const scrapeCache = new Map<string, { content: string; timestamp: number }>();

export const literatureReviewRequestSchema = z.object({
  productName: z.string().min(1, "Product name is required"),
  websiteUrl: z.string().url("Please enter a valid URL").optional(),
});

export async function scrapeWebsite(url: string): Promise<string> {
  // Check cache first
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

    // Remove unnecessary elements that might contain irrelevant text
    $('nav, footer, header, script, style, .navigation, .footer, .header, .menu').remove();

    // Focus on main content areas
    const content = $('main, article, div[role="main"], .content, #content, .product-description')
      .text()
      .trim()
      .replace(/\s+/g, ' ')
      .substring(0, 2000); // Limit content length

    // Cache the result
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

  // Generate initial structure with gpt-3.5-turbo
  const structurePrompt = `Create a basic structure for a literature review of ${productName}. Include only section headers and key points to be expanded. Keep it concise.`;

  const initialStructure = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: "Create a concise outline for a scientific literature review. Include only headers and key points."
      },
      {
        role: "user",
        content: structurePrompt
      }
    ],
    temperature: 0.3,
    max_tokens: 500,
  });

  // Use the initial structure to generate detailed content with GPT-4
  const detailPrompt = `Expand this literature review structure with detailed scientific information for ${productName}:

${initialStructure.choices[0].message.content}

${productContext ? 'Based on the following product information: ' + productContext : ''}

Follow the exact format provided in the structure. Include specific scientific references where possible.`;

  try {
    console.log('Sending detailed request to OpenAI...');
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a scientific literature review expert. Generate detailed, evidence-based reviews that maintain a balance between highlighting benefits and acknowledging research gaps. Focus on accuracy and scientific validity."
        },
        {
          role: "user",
          content: detailPrompt
        }
      ],
      temperature: 0.5,
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
    // Split into major sections
    const sections = content.split(/\d+\.\s+/);

    // Parse Overview section
    if (sections[1] && sections[1].includes('Overview')) {
      const overviewSection = sections[1];

      // Extract description (everything under "What is [Product Name]?")
      const descriptionMatch = overviewSection.match(/What is.*?\?([\s\S]*?)(?=\* Primary Benefits|\* Common Supplement Forms|$)/);
      if (descriptionMatch) {
        review.overview.description = descriptionMatch[1]
          .split('*')
          .map(line => line.trim())
          .filter(Boolean)
          .join(' ');
      }

      // Extract benefits
      review.overview.benefits = overviewSection
        .split('\n')
        .filter(line => line.includes('✅'))
        .map(line => line.replace('✅', '').trim());

      // Extract supplement forms
      const formsMatch = overviewSection.match(/Common Supplement Forms:([\s\S]*?)(?=\d+\.|$)/);
      if (formsMatch) {
        review.overview.supplementForms = formsMatch[1]
          .split('*')
          .map(line => line.trim())
          .filter(Boolean);
      }
    }

    // Parse Wellness Areas
    if (sections[2]) {
      const wellnessSection = sections[2];
      const areas = wellnessSection.split(/[🛌💪❤️🧠🔥]/);

      areas.forEach(area => {
        if (!area.trim()) return;

        const lines = area.split('\n').map(l => l.trim()).filter(Boolean);
        const areaName = lines[0];

        if (areaName) {
          const mechanismMatch = area.match(/How It Works:([\s\S]*?)(?=\* Key Findings|$)/);
          const mechanism = mechanismMatch
            ? mechanismMatch[1]
                .split('*')
                .map(line => line.trim())
                .filter(Boolean)
                .join(' ')
            : '';

          const keyFindings = lines
            .filter(l => l.includes('✅'))
            .map(l => l.replace('✅', '').trim());

          const researchGaps = lines
            .filter(l => l.includes('❌'))
            .map(l => l.replace('❌', '').trim());

          if (areaName) {
            review.wellnessAreas.push({
              name: areaName,
              mechanism,
              keyFindings,
              researchGaps,
            });
          }
        }
      });
    }

    // Parse Research Gaps
    if (sections[3]) {
      review.researchGaps.questions = sections[3]
        .split('\n')
        .filter(line => line.includes('📌'))
        .map(line => line.replace('📌', '').trim());
    }

    // Parse Conclusion
    if (sections[4]) {
      const conclusionSection = sections[4];

      // Extract key points
      const keyPointsMatch = conclusionSection.match(/Key Points:([\s\S]*?)(?=\* Target Audience|$)/);
      if (keyPointsMatch) {
        review.conclusion.keyPoints = keyPointsMatch[1]
          .split('\n')
          .filter(line => line.includes('✅'))
          .map(line => line.replace('✅', '').trim());
      }

      // Extract target audience
      const audienceMatch = conclusionSection.match(/Target Audience:([\s\S]*?)(?=\* Safety Considerations|$)/);
      if (audienceMatch) {
        review.conclusion.targetAudience = audienceMatch[1]
          .split('*')
          .map(line => line.trim())
          .filter(Boolean);
      }

      // Extract safety considerations
      const safetyMatch = conclusionSection.match(/Safety Considerations:([\s\S]*?)(?=\d+\.|$)/);
      if (safetyMatch) {
        review.conclusion.safetyConsiderations = safetyMatch[1]
          .split('*')
          .map(line => line.trim())
          .filter(Boolean);
      }
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