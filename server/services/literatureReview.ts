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

Please provide a structured response following this exact format:

1. Overview
- Description: [Brief explanation of what the product is]
- Primary Benefits:
  ✅ [Benefit 1]
  ✅ [Benefit 2]
  ✅ [Benefit 3]
- Common Supplement Forms:
  - [Form 1]
  - [Form 2]

2. Wellness Areas
For each relevant area:
[Area Name]
- Mechanism: [How it works]
- Key Findings:
  ✅ [Finding 1]
  ✅ [Finding 2]
- Research Gaps:
  ❌ [Gap 1]
  ❌ [Gap 2]

3. Research Gaps & Future Studies
📌 [Question 1]
📌 [Question 2]
📌 [Question 3]

4. Conclusion
- Key Points:
  ✅ [Point 1]
  ✅ [Point 2]
- Target Audience:
  - [Audience 1]
  - [Audience 2]
- Safety Considerations:
  - [Safety point 1]
  - [Safety point 2]

Use exact emoji markers (✅, ❌, 📌) as shown above. Format in markdown with scientific accuracy.`;

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
    // Split content into main sections
    const sections = content.split(/\d+\.\s+/);

    // Parse Overview section
    if (sections[1] && sections[1].includes('Overview')) {
      const overviewSection = sections[1];

      // Extract description
      const descMatch = overviewSection.match(/Description:\s*([^\n]+)/);
      if (descMatch) {
        review.overview.description = descMatch[1].trim();
      }

      // Extract benefits (lines with ✅)
      review.overview.benefits = overviewSection
        .split('\n')
        .filter(line => line.includes('✅'))
        .map(line => line.replace('✅', '').trim());

      // Extract supplement forms
      const formsSection = overviewSection.substring(overviewSection.indexOf('Common Supplement Forms:'));
      review.overview.supplementForms = formsSection
        .split('\n')
        .filter(line => line.startsWith('-'))
        .map(line => line.replace('-', '').trim());
    }

    // Parse Wellness Areas
    if (sections[2] && sections[2].includes('Wellness Areas')) {
      const areasSection = sections[2];
      const areas = areasSection.split(/(?=\n[A-Z][^:\n]+$)/m);

      areas.forEach(area => {
        const lines = area.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length > 0 && !lines[0].toLowerCase().includes('wellness areas')) {
          const areaName = lines[0].replace(':', '').trim();
          const mechanism = lines.find(l => l.startsWith('Mechanism:'))?.replace('Mechanism:', '').trim() || '';

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
    if (sections[3] && sections[3].includes('Research Gaps')) {
      review.researchGaps.questions = sections[3]
        .split('\n')
        .filter(line => line.includes('📌'))
        .map(line => line.replace('📌', '').trim());
    }

    // Parse Conclusion
    if (sections[4] && sections[4].includes('Conclusion')) {
      const conclusionSection = sections[4];

      // Extract key points
      review.conclusion.keyPoints = conclusionSection
        .split('\n')
        .filter(line => line.includes('✅'))
        .map(line => line.replace('✅', '').trim());

      // Extract target audience
      const audienceSection = conclusionSection.substring(
        conclusionSection.indexOf('Target Audience:'),
        conclusionSection.indexOf('Safety Considerations:')
      );
      review.conclusion.targetAudience = audienceSection
        .split('\n')
        .filter(line => line.startsWith('-'))
        .map(line => line.replace('-', '').trim());

      // Extract safety considerations
      const safetySection = conclusionSection.substring(
        conclusionSection.indexOf('Safety Considerations:')
      );
      review.conclusion.safetyConsiderations = safetySection
        .split('\n')
        .filter(line => line.startsWith('-'))
        .map(line => line.replace('-', '').trim());
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