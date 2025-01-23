import OpenAI from "openai";
import { z } from "zod";
import axios from "axios";
import { load } from "cheerio";

// Define wellness areas at the top level to avoid circular imports
export const WELLNESS_AREAS = [
  "Sleep & Recovery",
  "Physical Performance",
  "Cardiovascular Health",
  "Cognitive Function",
  "Metabolic Health",
] as const;

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

  // Enhanced system prompt with clear formatting instructions
  const systemPrompt = `You are a scientific literature review expert. Generate a comprehensive review in this exact format:

[OVERVIEW]
DESCRIPTION: {Scientific explanation of the supplement/product}

BENEFITS:
- {Benefit 1}
- {Benefit 2}
- {Benefit 3}

FORMS:
- {Form 1}
- {Form 2}
- {Form 3}

[WELLNESS]
For each relevant wellness area:

AREA: {Area name}
MECHANISM: {Scientific mechanism of action}
FINDINGS:
- {Finding 1}
- {Finding 2}
- {Finding 3}
GAPS:
- {Gap 1}
- {Gap 2}

[RESEARCH]
QUESTIONS:
- {Research question 1}
- {Research question 2}
- {Research question 3}

[CONCLUSION]
KEY POINTS:
- {Key point 1}
- {Key point 2}
- {Key point 3}

TARGET AUDIENCE:
- {Audience 1}
- {Audience 2}
- {Audience 3}

SAFETY:
- {Safety consideration 1}
- {Safety consideration 2}
- {Safety consideration 3}`;

  const userPrompt = `Generate a scientific literature review for ${productName}.
${productContext ? '\nProduct Context:\n' + productContext : ''}

Follow the exact format above. Include specific scientific details and research-backed information.
Each section must have at least 3 detailed bullet points.`;

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
    const sections = content.split(/\[(.*?)\]/);

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i].trim();

      if (section === 'OVERVIEW') {
        const overviewContent = sections[i + 1];
        const descriptionMatch = overviewContent.match(/DESCRIPTION:\s*([\s\S]*?)(?=BENEFITS:|$)/);
        if (descriptionMatch) {
          review.overview.description = descriptionMatch[1].trim();
        }

        // Parse benefits
        const benefitsMatch = overviewContent.match(/BENEFITS:([\s\S]*?)(?=FORMS:|$)/);
        if (benefitsMatch) {
          review.overview.benefits = benefitsMatch[1]
            .split('-')
            .map(b => b.trim())
            .filter(b => b.length > 0);
        }

        // Parse forms
        const formsMatch = overviewContent.match(/FORMS:([\s\S]*?)(?=$)/);
        if (formsMatch) {
          review.overview.supplementForms = formsMatch[1]
            .split('-')
            .map(f => f.trim())
            .filter(f => f.length > 0);
        }
      }

      if (section === 'WELLNESS') {
        const wellnessContent = sections[i + 1];
        const areas = wellnessContent.split(/AREA:/g).slice(1);

        areas.forEach(area => {
          const areaContent = area.trim();
          const nameMatch = areaContent.match(/(.*?)(?=MECHANISM:|$)/);
          const mechanismMatch = areaContent.match(/MECHANISM:([\s\S]*?)(?=FINDINGS:|$)/);
          const findingsMatch = areaContent.match(/FINDINGS:([\s\S]*?)(?=GAPS:|$)/);
          const gapsMatch = areaContent.match(/GAPS:([\s\S]*?)(?=$)/);

          if (nameMatch) {
            const wellnessArea = {
              name: nameMatch[1].trim(),
              mechanism: mechanismMatch ? mechanismMatch[1].trim() : '',
              keyFindings: findingsMatch ? 
                findingsMatch[1]
                  .split('-')
                  .map(f => f.trim())
                  .filter(f => f.length > 0) : [],
              researchGaps: gapsMatch ?
                gapsMatch[1]
                  .split('-')
                  .map(g => g.trim())
                  .filter(g => g.length > 0) : [],
            };
            review.wellnessAreas.push(wellnessArea);
          }
        });
      }

      if (section === 'RESEARCH') {
        const researchContent = sections[i + 1];
        const questionsMatch = researchContent.match(/QUESTIONS:([\s\S]*?)(?=$)/);
        if (questionsMatch) {
          review.researchGaps.questions = questionsMatch[1]
            .split('-')
            .map(q => q.trim())
            .filter(q => q.length > 0);
        }
      }

      if (section === 'CONCLUSION') {
        const conclusionContent = sections[i + 1];

        // Parse key points
        const keyPointsMatch = conclusionContent.match(/KEY POINTS:([\s\S]*?)(?=TARGET AUDIENCE:|$)/);
        if (keyPointsMatch) {
          review.conclusion.keyPoints = keyPointsMatch[1]
            .split('-')
            .map(k => k.trim())
            .filter(k => k.length > 0);
        }

        // Parse target audience
        const audienceMatch = conclusionContent.match(/TARGET AUDIENCE:([\s\S]*?)(?=SAFETY:|$)/);
        if (audienceMatch) {
          review.conclusion.targetAudience = audienceMatch[1]
            .split('-')
            .map(a => a.trim())
            .filter(a => a.length > 0);
        }

        // Parse safety considerations
        const safetyMatch = conclusionContent.match(/SAFETY:([\s\S]*?)(?=$)/);
        if (safetyMatch) {
          review.conclusion.safetyConsiderations = safetyMatch[1]
            .split('-')
            .map(s => s.trim())
            .filter(s => s.length > 0);
        }
      }
    }

    // Only use fallback values if sections are completely empty
    if (review.overview.description.length === 0) {
      console.log('Using fallback description');
      review.overview.description = 'Scientific description not available';
    }
    if (review.overview.benefits.length === 0) {
      console.log('Using fallback benefits');
      review.overview.benefits = ['Scientific benefits under investigation'];
    }
    if (review.overview.supplementForms.length === 0) {
      console.log('Using fallback forms');
      review.overview.supplementForms = ['Common supplement forms being researched'];
    }
    if (review.wellnessAreas.length === 0) {
      console.log('Using fallback wellness area');
      review.wellnessAreas = [{
        name: 'General Wellness',
        mechanism: 'Scientific mechanisms under investigation',
        keyFindings: ['Research in progress'],
        researchGaps: ['Comprehensive studies needed'],
      }];
    }
    if (review.researchGaps.questions.length === 0) {
      console.log('Using fallback research questions');
      review.researchGaps.questions = ['Optimal dosing studies needed'];
    }
    if (review.conclusion.keyPoints.length === 0) {
      console.log('Using fallback key points');
      review.conclusion.keyPoints = ['Further research recommended'];
    }
    if (review.conclusion.targetAudience.length === 0) {
      console.log('Using fallback target audience');
      review.conclusion.targetAudience = ['Subject to clinical evaluation'];
    }
    if (review.conclusion.safetyConsiderations.length === 0) {
      console.log('Using fallback safety considerations');
      review.conclusion.safetyConsiderations = ['Consult healthcare provider'];
    }

    return review;
  } catch (error) {
    console.error('Error parsing review content:', error);
    throw new Error('Failed to parse literature review content');
  }
}

export const wellnessAreas = WELLNESS_AREAS;