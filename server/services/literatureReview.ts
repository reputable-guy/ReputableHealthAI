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

🛌 Sleep & Recovery (or relevant emoji for area)
* How It Works:
    * {Mechanism explanation}
* Key Findings:
    ✅ {Finding 1}
    ✅ {Finding 2}
    ✅ {Finding 3}
* Research Gaps:
    ❌ {Gap 1}
    ❌ {Gap 2}

(Repeat the above section structure for each relevant wellness area)

3. Research Gaps & Future Studies
📌 Unanswered Questions in Research:
* {Question 1}
* {Question 2}
* {Question 3}

4. Conclusion
* Key takeaways about [Product]
* Safety considerations
📌 Who Benefits Most?
✅ {Target group 1}
✅ {Target group 2}
✅ {Target group 3}`;

  const userPrompt = `Generate a scientific literature review for ${productName}.
${productContext ? '\nProduct Context:\n' + productContext : ''}

Follow the exact format above. Each section must be detailed and research-backed.
Include emojis exactly as shown in the template.
Keep bullet points and checkmark/x-mark formatting consistent.`;

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

    console.log('Received OpenAI response:', content);
    return parseReviewContent(content);
  } catch (error) {
    console.error('OpenAI API Error:', error);
    throw error;
  }
}

function parseReviewContent(content: string) {
  // Initialize the review object with the new structure
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
    // Split content into main sections
    const sections = content.split(/\d\.\s+/);

    // Extract title
    const titleMatch = content.match(/📝\s*Literature Review:.*$/m);
    if (titleMatch) {
      review.title = titleMatch[0].trim();
    }

    // Parse Overview section
    const overviewSection = sections[1];
    if (overviewSection) {
      // Extract description points
      const descriptionMatch = overviewSection.match(/What is.*?\*([\s\S]*?)(?=\*\s*Primary Benefits|\*\s*Common)/);
      if (descriptionMatch) {
        review.overview.description = descriptionMatch[1]
          .split('*')
          .map(p => p.trim())
          .filter(p => p.length > 0);
      }

      // Extract benefits
      const benefitsMatch = overviewSection.match(/Primary Benefits:[\s\S]*?(?=\*\s*Common|$)/);
      if (benefitsMatch) {
        review.overview.benefits = benefitsMatch[0]
          .split('✅')
          .slice(1)
          .map(b => b.trim())
          .filter(b => b.length > 0);
      }

      // Extract supplement forms
      const formsMatch = overviewSection.match(/Common Supplement Forms:[\s\S]*?(?=\d\.|$)/);
      if (formsMatch) {
        review.overview.supplementForms = formsMatch[0]
          .split('*')
          .slice(1)
          .map(f => f.trim())
          .filter(f => f.length > 0);
      }
    }

    // Parse Wellness Areas
    const wellnessSection = sections[2];
    if (wellnessSection) {
      const areas = wellnessSection.split(/[🛌💪❤️🧠🔥💙]/);
      for (const area of areas) {
        if (!area.trim()) continue;

        const areaMatch = area.match(/(.*?)\n/);
        const mechanismMatch = area.match(/How It Works:[\s\S]*?(?=\*\s*Key Findings|\*\s*Research)/);
        const findingsMatch = area.match(/Key Findings:[\s\S]*?(?=\*\s*Research Gaps)/);
        const gapsMatch = area.match(/Research Gaps:[\s\S]*?(?=\n\n|$)/);

        if (areaMatch) {
          const wellnessArea = {
            emoji: area.match(/[🛌💪❤️🧠🔥💙]/)?.[0] || '',
            name: areaMatch[1].trim(),
            mechanism: mechanismMatch ? 
              mechanismMatch[0]
                .split('*')
                .slice(1)
                .map(m => m.trim())
                .filter(m => m.length > 0) : [],
            keyFindings: findingsMatch ?
              findingsMatch[0]
                .split('✅')
                .slice(1)
                .map(f => f.trim())
                .filter(f => f.length > 0) : [],
            researchGaps: gapsMatch ?
              gapsMatch[0]
                .split('❌')
                .slice(1)
                .map(g => g.trim())
                .filter(g => g.length > 0) : [],
          };
          review.wellnessAreas.push(wellnessArea);
        }
      }
    }

    // Parse Research Gaps
    const researchSection = sections[3];
    if (researchSection) {
      const questionsMatch = researchSection.match(/Unanswered Questions[\s\S]*?(?=\d\.|$)/);
      if (questionsMatch) {
        review.researchGaps.questions = questionsMatch[0]
          .split('*')
          .slice(1)
          .map(q => q.trim())
          .filter(q => q.length > 0);
      }
    }

    // Parse Conclusion
    const conclusionSection = sections[4];
    if (conclusionSection) {
      // Extract key points
      const keyPointsMatch = conclusionSection.match(/(?:\* )([\s\S]*?)(?=\* Safety|📌)/);
      if (keyPointsMatch) {
        review.conclusion.keyPoints = keyPointsMatch[1]
          .split('*')
          .map(k => k.trim())
          .filter(k => k.length > 0);
      }

      // Extract safety considerations
      const safetyMatch = conclusionSection.match(/Safety considerations[\s\S]*?(?=📌|$)/);
      if (safetyMatch) {
        review.conclusion.safetyConsiderations = safetyMatch[0]
          .split('*')
          .slice(1)
          .map(s => s.trim())
          .filter(s => s.length > 0);
      }

      // Extract target audience
      const audienceMatch = conclusionSection.match(/Who Benefits Most\?[\s\S]*?$/);
      if (audienceMatch) {
        review.conclusion.targetAudience = audienceMatch[0]
          .split('✅')
          .slice(1)
          .map(a => a.trim())
          .filter(a => a.length > 0);
      }
    }

    return review;
  } catch (error) {
    console.error('Error parsing review content:', error);
    throw new Error('Failed to parse literature review content');
  }
}

export const wellnessAreas = WELLNESS_AREAS;