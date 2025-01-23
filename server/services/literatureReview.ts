import OpenAI from "openai";
import { z } from "zod";
import axios from "axios";
import { load } from "cheerio";

// Define wellness areas based on the template
export const WELLNESS_AREAS = [
  "Sleep & Recovery",
  "Physical Performance",
  "Cardiovascular Health",
  "Cognitive Function & Mood",
  "Metabolic & Gut Health",
] as const;

const CACHE_DURATION = 1000 * 60 * 60; // 1 hour
const scrapeCache = new Map<string, { content: string; timestamp: number }>();

export const literatureReviewRequestSchema = z.object({
  productName: z.string().min(1, "Product name is required"),
  websiteUrl: z.string().url("Please enter a valid URL").optional(),
});

// Improved website scraping with proper error handling
export async function scrapeWebsite(url: string): Promise<string> {
  const cached = scrapeCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log('Using cached website content');
    return cached.content;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

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

// Improved section extraction with better regex handling
function extractSectionContent(content: string, sectionHeader: string): string {
  const sectionRegex = new RegExp(`${sectionHeader}[\\s\\S]*?(?=\\n\\n|\\d\\. |$)`, 'i');
  const match = content.match(sectionRegex);
  return match ? match[0].trim() : 'Content not found.';
}

function parseListItems(content: string, marker: string = '*'): string[] {
  if (!content || content === 'Content not found.') return ['No data available'];
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith(marker))
    .map(line => line.replace(new RegExp(`^\\${marker}\\s*`), '').trim())
    || ['No specific items found'];
}

function parseCheckmarkItems(content: string): string[] {
  if (!content || content === 'Content not found.') return ['No data available'];
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.includes('✅'))
    .map(line => line.replace(/^✅\s*/, '').trim())
    || ['No checkmark items found'];
}

function parseXmarkItems(content: string): string[] {
  if (!content || content === 'Content not found.') return ['No data available'];
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.includes('❌'))
    .map(line => line.replace(/^❌\s*/, '').trim())
    || ['No research gaps identified'];
}

function parseReviewContent(content: string) {
  const review = {
    title: "",
    overview: {
      description: [] as string[],
      benefits: [] as string[],
      supplementForms: [] as string[],
    },
    wellnessAreas: [] as Array<{
      emoji: string;
      name: string;
      mechanism: string[];
      keyFindings: string[];
      researchGaps: string[];
    }>,
    researchGaps: {
      questions: [] as string[],
    },
    conclusion: {
      keyPoints: [] as string[],
      safetyConsiderations: [] as string[],
      targetAudience: [] as string[],
    },
  };

  try {
    // Extract title
    const titleMatch = content.match(/📝\s*Literature Review:([^\n]+)/);
    review.title = titleMatch ? titleMatch[1].trim() : "Literature Review";

    // Extract Overview section with fallback
    const overviewContent = extractSectionContent(content, '1\\. Overview');
    if (overviewContent !== 'Content not found.') {
      const productDescriptionMatch = overviewContent.match(/What is[^?]*\?([\s\S]*?)(?=Primary Benefits|$)/i);
      if (productDescriptionMatch) {
        review.overview.description = parseListItems(productDescriptionMatch[1]);
      }

      const benefitsMatch = overviewContent.match(/Primary Benefits:([\s\S]*?)(?=Common Supplement Forms|$)/i);
      if (benefitsMatch) {
        review.overview.benefits = parseCheckmarkItems(benefitsMatch[1]);
      }

      const formsMatch = overviewContent.match(/Common Supplement Forms:([\s\S]*?)(?=\d\.|$)/i);
      if (formsMatch) {
        review.overview.supplementForms = parseListItems(formsMatch[1]);
      }
    }

    // Extract Wellness Areas
    const wellnessAreaEmojis = {
      'Sleep & Recovery': '🛌',
      'Physical Performance': '💪',
      'Cardiovascular Health': '❤️',
      'Cognitive Function & Mood': '🧠',
      'Metabolic & Gut Health': '🔥'
    };

    for (const areaName of Object.keys(wellnessAreaEmojis)) {
      const areaContent = extractSectionContent(content, `${wellnessAreaEmojis[areaName]} ${areaName}`);
      if (areaContent !== 'Content not found.') {
        const wellnessArea = {
          emoji: wellnessAreaEmojis[areaName],
          name: areaName,
          mechanism: [] as string[],
          keyFindings: [] as string[],
          researchGaps: [] as string[],
        };

        const mechanismMatch = areaContent.match(/How It Works:([\s\S]*?)(?=Key Findings:|$)/i);
        if (mechanismMatch) {
          wellnessArea.mechanism = parseListItems(mechanismMatch[1]);
        }

        const findingsMatch = areaContent.match(/Key Findings:([\s\S]*?)(?=Research Gaps:|$)/i);
        if (findingsMatch) {
          wellnessArea.keyFindings = parseCheckmarkItems(findingsMatch[1]);
        }

        const gapsMatch = areaContent.match(/Research Gaps:([\s\S]*?)(?=\n\n|$)/i);
        if (gapsMatch) {
          wellnessArea.researchGaps = parseXmarkItems(gapsMatch[1]);
        }

        review.wellnessAreas.push(wellnessArea);
      }
    }

    // Extract Research Gaps section
    const researchContent = extractSectionContent(content, '3\\. Research Gaps & Future Studies');
    const questionsMatch = researchContent.match(/📌[^:]*:([\s\S]*?)(?=\d\.|$)/i);
    if (questionsMatch) {
      review.researchGaps.questions = parseListItems(questionsMatch[1]);
    }

    // Extract Conclusion section
    const conclusionContent = extractSectionContent(content, '4\\. Conclusion');
    if (conclusionContent !== 'Content not found.') {
      const keyPointsMatch = conclusionContent.match(/Key Points:([\s\S]*?)(?=Safety Considerations:|$)/i);
      if (keyPointsMatch) {
        review.conclusion.keyPoints = parseListItems(keyPointsMatch[1]);
      }

      const safetyMatch = conclusionContent.match(/Safety Considerations:([\s\S]*?)(?=📌|$)/i);
      if (safetyMatch) {
        review.conclusion.safetyConsiderations = parseListItems(safetyMatch[1]);
      }

      const audienceMatch = conclusionContent.match(/📌\s*Who Benefits Most\?([\s\S]*?)$/i);
      if (audienceMatch) {
        review.conclusion.targetAudience = parseCheckmarkItems(audienceMatch[1]);
      }
    }

    return review;
  } catch (error) {
    console.error('Error parsing review content:', error);
    throw new Error('Failed to parse literature review content');
  }
}

export async function generateLiteratureReview(productName: string, websiteUrl?: string) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key is required");
  }

  // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
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

  const prompt = `
You are an expert in nutritional science, tasked with generating a structured literature review on ${productName}. 
Follow this exact format to ensure consistency:

📝 Literature Review: ${productName} & Its Impact on Wellness

1. Overview
* What is ${productName}?
    * [Provide 2-3 sentences summarizing the compound.]
* Primary Benefits:
    ✅ [List key benefits, each on a new line.]
* Common Supplement Forms:
    * [List supplement forms, each on a new line.]

2. Impact on Key Wellness Areas

🛌 Sleep & Recovery
* How It Works:
    * [Explain mechanism of action.]
* Key Findings:
    ✅ [List scientific findings, each on a new line, include sources.]
* Research Gaps:
    ❌ [List research gaps, each on a new line.]

💪 Physical Performance
* How It Works:
    * [Explain mechanism of action.]
* Key Findings:
    ✅ [List scientific findings, each on a new line, include sources.]
* Research Gaps:
    ❌ [List research gaps, each on a new line.]

❤️ Cardiovascular Health
* How It Works:
    * [Explain mechanism of action.]
* Key Findings:
    ✅ [List scientific findings, each on a new line, include sources.]
* Research Gaps:
    ❌ [List research gaps, each on a new line.]

🧠 Cognitive Function & Mood
* How It Works:
    * [Explain mechanism of action.]
* Key Findings:
    ✅ [List scientific findings, each on a new line, include sources.]
* Research Gaps:
    ❌ [List research gaps, each on a new line.]

🔥 Metabolic & Gut Health
* How It Works:
    * [Explain mechanism of action.]
* Key Findings:
    ✅ [List scientific findings, each on a new line, include sources.]
* Research Gaps:
    ❌ [List research gaps, each on a new line.]

💙 Sexual Health
* How It Works:
    * [Explain mechanism of action.]
* Key Findings:
    ✅ [List scientific findings, each on a new line, include sources.]
* Research Gaps:
    ❌ [List research gaps, each on a new line.]


3. Research Gaps & Future Studies
📌 Unanswered Questions in Research:
* [List 3+ unanswered research questions.]

4. Conclusion
* Key Points:
    * [Summarize the literature review in 3-5 bullet points.]
* Safety Considerations:
    * [Include key safety notes.]
* 📌 Who Benefits Most?
    ✅ [List target audiences who may benefit from this supplement.]

${productContext ? '\nProduct Context:\n' + productContext : ''}

Follow this exact structure. Ensure proper headings, bullet points, and scientific sources.`;

  try {
    console.log('Sending literature review request to OpenAI...');
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { 
          role: "system", 
          content: "You are a scientific research assistant specializing in nutritional science and supplement research. Provide detailed, evidence-based analysis." 
        },
        { 
          role: "user", 
          content: prompt 
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Failed to generate content from OpenAI");
    }

    console.log('Received OpenAI response:', content);
    return parseReviewContent(content);
  } catch (error) {
    console.error('OpenAI API Error:', error);
    throw error;
  }
}

export const wellnessAreas = WELLNESS_AREAS;