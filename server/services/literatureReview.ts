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

Please follow this exact format and include ALL sections:

📝 Literature Review: [Product Name]

1. Overview
* What is [Product Name]?
    * [Detailed description of the product]
    * [Key components or active ingredients]
    * [Primary mechanism of action]
* Primary Benefits:
    ✅ [Major benefit 1 with scientific basis]
    ✅ [Major benefit 2 with scientific basis]
    ✅ [Major benefit 3 with scientific basis]
* Common Supplement Forms:
    * [Form 1 with description]
    * [Form 2 with description]
    * [Form 3 with description]

2. Impact on Key Wellness Areas

🛌 Sleep & Recovery
* How It Works:
    * [Detailed mechanism explanation]
    * [Physiological pathways]
* Key Findings:
    ✅ [Finding 1 with research reference]
    ✅ [Finding 2 with research reference]
* Research Gaps:
    ❌ [Gap 1 in current research]
    ❌ [Gap 2 in current research]

💪 Physical Performance & Recovery
[Same structure as above]

❤️ Cardiovascular Health
[Same structure as above]

🧠 Cognitive Function & Mood
[Same structure as above]

🔥 Metabolic & Gut Health
[Same structure as above]

3. Research Gaps & Future Studies
📌 [Specific research question 1]
📌 [Specific research question 2]
📌 [Specific research question 3]
📌 [Specific research question 4]

4. Conclusion
* Key Points:
    ✅ [Main conclusion 1 about efficacy]
    ✅ [Main conclusion 2 about mechanisms]
    ✅ [Main conclusion 3 about research status]
* Target Audience:
    * [Specific population 1 with rationale]
    * [Specific population 2 with rationale]
    * [Specific population 3 with rationale]
* Safety Considerations:
    * [Safety point 1 with evidence]
    * [Safety point 2 with evidence]
    * [Safety point 3 with evidence]

Use the exact emojis and formatting shown. Include scientific references where possible. Balance both benefits and limitations.`;

  try {
    console.log('Sending request to OpenAI...');
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a scientific literature review expert. Generate detailed, evidence-based reviews that maintain a balance between highlighting benefits and acknowledging research gaps. Include specific scientific references and maintain consistent formatting with emojis and structure."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 3000,
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