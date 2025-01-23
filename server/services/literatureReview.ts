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
  "Sexual Health"
] as const;

const CACHE_DURATION = 1000 * 60 * 60; // 1 hour
const scrapeCache = new Map<string, { content: string; timestamp: number }>();

export const literatureReviewRequestSchema = z.object({
  productName: z.string().min(1, "Product name is required"),
  websiteUrl: z.string().url("Please enter a valid URL").optional(),
});

// Scraping function remains unchanged
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

// Updated system prompt to match the Nitric Oxide template format
const systemPrompt = `You are a scientific literature review expert. Generate a comprehensive review following this exact format:

📝 Literature Review: [Product Name] & Its Impact on Wellness

1. Overview
* What is [Product]?
    * {Scientific explanation point 1}
    * {Scientific explanation point 2}
    * {Scientific explanation point 3}
* Primary Benefits:
    ✅ {Benefit 1}
    ✅ {Benefit 2}
    ✅ {Benefit 3}
* Common Supplement Forms:
    * {Form 1}
    * {Form 2}
    * {Form 3}

2. Impact on Key Wellness Areas
For each relevant wellness area, use emojis:
🛌 Sleep & Recovery
💪 Physical Performance
❤️ Cardiovascular Health
🧠 Cognitive Function & Mood
🔥 Metabolic & Gut Health
💙 Sexual Health

[For each area:]
* How It Works:
    * {Detailed mechanism explanation}
* Key Findings:
    ✅ {Finding 1 with source if available}
    ✅ {Finding 2 with source if available}
    ✅ {Finding 3 with source if available}
* Research Gaps:
    ❌ {Gap 1}
    ❌ {Gap 2}

3. Research Gaps & Future Studies
📌 Unanswered Questions in Research:
* {Research question 1}
* {Research question 2}
* {Research question 3}

4. Conclusion
* {Key points about the product, effectiveness, and current state of research}
* Safety considerations: {List safety notes and precautions}
📌 Who Benefits Most?
✅ {Target group 1}
✅ {Target group 2}
✅ {Target group 3}`;

// Previous scraping function remains unchanged

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

  const userPrompt = `Generate a scientific literature review for ${productName}.
${productContext ? '\nProduct Context:\n' + productContext : ''}

Follow the exact format above. Each section must be detailed and research-backed.
Include emojis exactly as shown in the template.
Keep bullet points and checkmark/x-mark formatting consistent.
Include specific studies and sources where possible.
Format the content exactly as shown, maintaining all emojis, bullet points, and section numbering.`;

  try {
    console.log('Sending literature review request to OpenAI...');
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 2500,
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
    // Extract title - Matches the 📝 line until next empty line
    const titleMatch = content.match(/📝[\s\S]*?(?=\n\s*\n|$)/);
    if (titleMatch) {
      review.title = titleMatch[0].trim();
    }

    // Split into main sections using numbered headers
    const sections = content.split(/\d\.\s+/).filter(Boolean);

    // Parse Overview section
    const overviewSection = sections[0];
    if (overviewSection) {
      // Extract product description - Everything between "What is" and "Primary Benefits"
      const descriptionContent = overviewSection.match(/What is.*?\?([\s\S]*?)(?=Primary Benefits|$)/i);
      if (descriptionContent && descriptionContent[1]) {
        review.overview.description = descriptionContent[1]
          .split('\n')
          .map(line => line.trim())
          .filter(line => line && line.startsWith('*'))
          .map(line => line.replace(/^\*\s*/, '').trim());
      }

      // Extract benefits - Look for ✅ marks
      const benefitsContent = overviewSection.match(/Primary Benefits:?([\s\S]*?)(?=Common Supplement Forms|$)/i);
      if (benefitsContent && benefitsContent[1]) {
        review.overview.benefits = benefitsContent[1]
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.includes('✅'))
          .map(line => line.replace(/^✅\s*/, '').trim());
      }

      // Extract supplement forms - Everything after "Common Supplement Forms"
      const formsContent = overviewSection.match(/Common Supplement Forms:?([\s\S]*?)(?=\n\s*\n|$)/i);
      if (formsContent && formsContent[1]) {
        review.overview.supplementForms = formsContent[1]
          .split('\n')
          .map(line => line.trim())
          .filter(line => line && line.startsWith('*'))
          .map(line => line.replace(/^\*\s*/, '').trim());
      }
    }

    // Parse Wellness Areas section
    const wellnessSection = sections[1];
    if (wellnessSection) {
      // Split by emoji characters
      const areas = wellnessSection.split(/(?=[\u{1F300}-\u{1F9FF}])/u);

      for (const area of areas) {
        if (!area.trim()) continue;

        // Extract emoji and area name from the header
        const headerMatch = area.match(/([\u{1F300}-\u{1F9FF}])\s*(.*?)(?=\n|$)/u);
        if (headerMatch) {
          const wellnessArea = {
            emoji: headerMatch[1],
            name: headerMatch[2].trim(),
            mechanism: [] as string[],
            keyFindings: [] as string[],
            researchGaps: [] as string[],
          };

          // Extract mechanism
          const mechanismContent = area.match(/How It Works:?([\s\S]*?)(?=Key Findings|$)/i);
          if (mechanismContent && mechanismContent[1]) {
            wellnessArea.mechanism = mechanismContent[1]
              .split('\n')
              .map(line => line.trim())
              .filter(line => line && !line.toLowerCase().includes('how it works'))
              .map(line => line.replace(/^\*\s*/, '').trim());
          }

          // Extract findings
          const findingsContent = area.match(/Key Findings:?([\s\S]*?)(?=Research Gaps|$)/i);
          if (findingsContent && findingsContent[1]) {
            wellnessArea.keyFindings = findingsContent[1]
              .split('\n')
              .map(line => line.trim())
              .filter(line => line.includes('✅'))
              .map(line => line.replace(/^✅\s*/, '').trim());
          }

          // Extract gaps
          const gapsContent = area.match(/Research Gaps:?([\s\S]*?)(?=\n\n|$)/i);
          if (gapsContent && gapsContent[1]) {
            wellnessArea.researchGaps = gapsContent[1]
              .split('\n')
              .map(line => line.trim())
              .filter(line => line.includes('❌'))
              .map(line => line.replace(/^❌\s*/, '').trim());
          }

          // Only add areas that have content
          if (wellnessArea.mechanism.length > 0 || 
              wellnessArea.keyFindings.length > 0 || 
              wellnessArea.researchGaps.length > 0) {
            review.wellnessAreas.push(wellnessArea);
          }
        }
      }
    }

    // Parse Research Gaps section
    const researchSection = sections[2];
    if (researchSection) {
      const questionsContent = researchSection.match(/📌\s*Unanswered Questions in Research:?([\s\S]*?)(?=\n\s*\n|$)/i);
      if (questionsContent && questionsContent[1]) {
        review.researchGaps.questions = questionsContent[1]
          .split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.includes('Unanswered Questions'))
          .map(line => line.replace(/^\*\s*/, '').trim());
      }
    }

    // Parse Conclusion section
    const conclusionSection = sections[3];
    if (conclusionSection) {
      // Extract key points
      const keyPointsContent = conclusionSection.match(/^([\s\S]*?)(?=Safety considerations:|📌|$)/i);
      if (keyPointsContent && keyPointsContent[1]) {
        review.conclusion.keyPoints = [keyPointsContent[1].trim()];
      }

      // Extract safety considerations
      const safetyContent = conclusionSection.match(/Safety considerations:?([\s\S]*?)(?=📌|$)/i);
      if (safetyContent && safetyContent[1]) {
        review.conclusion.safetyConsiderations = [safetyContent[1].trim()];
      }

      // Extract target audience
      const audienceContent = conclusionSection.match(/Who Benefits Most\?[\s\S]*?$/i);
      if (audienceContent) {
        review.conclusion.targetAudience = audienceContent[0]
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.includes('✅'))
          .map(line => line.replace(/^✅\s*/, '').trim());
      }
    }

    return review;
  } catch (error) {
    console.error('Error parsing review content:', error);
    throw new Error('Failed to parse literature review content');
  }
}

export const wellnessAreas = WELLNESS_AREAS;