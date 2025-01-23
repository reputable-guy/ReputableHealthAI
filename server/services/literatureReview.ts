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

// Previous scraping function remains unchanged
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

function extractSectionContent(content: string, sectionHeader: string): string {
  const sectionRegex = new RegExp(`${sectionHeader}[\\s\\S]*?(?=\\d\\.\\s|$)`, 'i');
  const match = content.match(sectionRegex);
  return match ? match[0].trim() : '';
}

function parseListItems(content: string, marker: string = '*'): string[] {
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith(marker))
    .map(line => line.replace(new RegExp(`^\\${marker}\\s*`), '').trim());
}

function parseCheckmarkItems(content: string): string[] {
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.includes('✅'))
    .map(line => line.replace(/^✅\s*/, '').trim());
}

function parseXmarkItems(content: string): string[] {
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.includes('❌'))
    .map(line => line.replace(/^❌\s*/, '').trim());
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
    // Extract title (includes "Generate Hypotheses" line)
    const titleLines = content.split('\n')
      .slice(0, 2)
      .map(line => line.trim())
      .filter(Boolean);
    review.title = titleLines.join('\n');

    // Extract Overview section
    const overviewContent = extractSectionContent(content, '1\\. Overview');
    if (overviewContent) {
      // Extract "What is the Product?" section
      const productDescriptionMatch = overviewContent.match(/What is the Product\?([\s\S]*?)(?=Primary Benefits|$)/i);
      if (productDescriptionMatch) {
        review.overview.description = parseListItems(productDescriptionMatch[1]);
      }

      // Extract Primary Benefits
      const benefitsMatch = overviewContent.match(/Primary Benefits([\s\S]*?)(?=Common Supplement Forms|$)/i);
      if (benefitsMatch) {
        review.overview.benefits = parseCheckmarkItems(benefitsMatch[1]);
      }

      // Extract Common Supplement Forms
      const formsMatch = overviewContent.match(/Common Supplement Forms([\s\S]*?)(?=\d\.|$)/i);
      if (formsMatch) {
        review.overview.supplementForms = parseListItems(formsMatch[1]);
      }
    }

    // Extract Wellness Areas section
    const wellnessContent = extractSectionContent(content, '2\\. Impact on Key Wellness Areas');
    if (wellnessContent) {
      const areas = wellnessContent.split(/(?=[\u{1F300}-\u{1F9FF}])/u).filter(Boolean);
      for (const area of areas) {
        const headerMatch = area.match(/([\u{1F300}-\u{1F9FF}])\s*([^\n]+)/u);
        if (headerMatch) {
          const [, emoji, name] = headerMatch;

          const wellnessArea = {
            emoji,
            name: name.trim(),
            mechanism: [],
            keyFindings: [],
            researchGaps: []
          };

          // Extract mechanism
          const mechanismMatch = area.match(/How It Works[\s\S]*?(?=Key Findings|$)/i);
          if (mechanismMatch) {
            wellnessArea.mechanism = parseListItems(mechanismMatch[0].replace(/How It Works:?/i, '').trim());
          }

          // Extract findings
          const findingsMatch = area.match(/Key Findings[\s\S]*?(?=Research Gaps|$)/i);
          if (findingsMatch) {
            wellnessArea.keyFindings = parseCheckmarkItems(findingsMatch[0].replace(/Key Findings:?/i, '').trim());
          }

          // Extract gaps
          const gapsMatch = area.match(/Research Gaps[\s\S]*?(?=\n\n|$)/i);
          if (gapsMatch) {
            wellnessArea.researchGaps = parseXmarkItems(gapsMatch[0].replace(/Research Gaps:?/i, '').trim());
          }

          if (wellnessArea.mechanism.length > 0 || wellnessArea.keyFindings.length > 0 || wellnessArea.researchGaps.length > 0) {
            review.wellnessAreas.push(wellnessArea);
          }
        }
      }
    }

    // Extract Research Gaps section
    const researchContent = extractSectionContent(content, '3\\. Research Gaps & Future Studies');
    if (researchContent) {
      const questionsMatch = researchContent.match(/📌\s*Unanswered Questions in Research:?([\s\S]*?)(?=\d\.|$)/i);
      if (questionsMatch) {
        review.researchGaps.questions = parseListItems(questionsMatch[1]);
      }
    }

    // Extract Conclusion section
    const conclusionContent = extractSectionContent(content, '4\\. Conclusion');
    if (conclusionContent) {
      // Extract key points
      const keyPointsMatch = conclusionContent.match(/Key Points([\s\S]*?)(?=Safety Considerations|$)/i);
      if (keyPointsMatch) {
        review.conclusion.keyPoints = [keyPointsMatch[1].trim()];
      }

      // Extract safety considerations
      const safetyMatch = conclusionContent.match(/Safety Considerations([\s\S]*?)(?=📌|$)/i);
      if (safetyMatch) {
        review.conclusion.safetyConsiderations = [safetyMatch[1].trim()];
      }

      // Extract target audience
      const audienceMatch = conclusionContent.match(/Who Benefits Most\?([\s\S]*?)$/i);
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

export const wellnessAreas = WELLNESS_AREAS;