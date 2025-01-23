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
  "Sexual Health",
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
    console.log("Using cached website content");
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
    $(
      "nav, footer, header, script, style, .navigation, .footer, .header, .menu",
    ).remove();

    const content = $(
      'main, article, div[role="main"], .content, #content, .product-description',
    )
      .text()
      .trim()
      .replace(/\s+/g, " ")
      .substring(0, 2000);

    scrapeCache.set(url, { content, timestamp: Date.now() });
    return content;
  } catch (error) {
    console.error("Error scraping website:", error);
    return "";
  }
}

function extractSectionContent(content: string, sectionHeader: string): string {
  const sectionRegex = new RegExp(`${sectionHeader}[\\s\\S]*?(?=\\n\\n|\\d\\. |$)`, 'i');
  const match = content.match(sectionRegex);
  return match ? match[0].trim() : 'Content not found.';
}

function parseListItems(content: string, marker: string = "*"): string[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith(marker))
    .map((line) => line.replace(new RegExp(`^\\${marker}\\s*`), "").trim());
}

function parseCheckmarkItems(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.includes("✅"))
    .map((line) => line.replace(/^✅\s*/, "").trim());
}

function parseXmarkItems(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.includes("❌"))
    .map((line) => line.replace(/^❌\s*/, "").trim());
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
    const titleLines = content
      .split("\n")
      .slice(0, 2)
      .map((line) => line.trim())
      .filter(Boolean);
    review.title = titleLines.join("\n") || "Literature Review";

    // Extract Overview section with fallback
    const overviewContent = extractSectionContent(content, '1\\. Overview') || "No overview available.";

    // Extract "What is the Product?" section
    const productDescriptionMatch = overviewContent.match(
      /What is [^?]+\?([\s\S]*?)(?=Primary Benefits|$)/i,
    );
    review.overview.description = productDescriptionMatch 
      ? parseListItems(productDescriptionMatch[1])
      : ["Product description not available"];

    // Extract Primary Benefits
    const benefitsMatch = overviewContent.match(
      /Primary Benefits([\s\S]*?)(?=Common Supplement Forms|$)/i,
    );
    review.overview.benefits = benefitsMatch 
      ? parseCheckmarkItems(benefitsMatch[1])
      : ["Benefits information not available"];

    // Extract Common Supplement Forms
    const formsMatch = overviewContent.match(
      /Common Supplement Forms([\s\S]*?)(?=\d\.|$)/i,
    );
    review.overview.supplementForms = formsMatch 
      ? parseListItems(formsMatch[1])
      : ["Supplement forms not specified"];

    // Extract Wellness Areas section
    const wellnessAreas = [
      { emoji: "🛌", name: "Sleep & Recovery" },
      { emoji: "💪", name: "Physical Performance" },
      { emoji: "❤️", name: "Cardiovascular Health" },
      { emoji: "🧠", name: "Cognitive Function & Mood" },
      { emoji: "🍔", name: "Metabolic & Gut Health" },
      { emoji: "🍆", name: "Sexual Health" }
    ];

    for (const area of wellnessAreas) {
      const areaContent = extractSectionContent(content, `${area.emoji} ${area.name}`) || `No ${area.name.toLowerCase()} data found.`;

      const wellnessArea = {
        emoji: area.emoji,
        name: area.name,
        mechanism: [],
        keyFindings: [],
        researchGaps: [],
      };

      // Extract mechanism
      const mechanismMatch = areaContent.match(
        /How It Works[\s\S]*?(?=Key Findings|$)/i,
      );
      wellnessArea.mechanism = mechanismMatch
        ? parseListItems(mechanismMatch[0].replace(/How It Works:?/i, "").trim())
        : ["Mechanism of action not specified"];

      // Extract findings
      const findingsMatch = areaContent.match(
        /Key Findings[\s\S]*?(?=Research Gaps|$)/i,
      );
      wellnessArea.keyFindings = findingsMatch
        ? parseCheckmarkItems(findingsMatch[0].replace(/Key Findings:?/i, "").trim())
        : ["No key findings available"];

      // Extract gaps
      const gapsMatch = areaContent.match(/Research Gaps[\s\S]*?(?=\n\n|$)/i);
      wellnessArea.researchGaps = gapsMatch
        ? parseXmarkItems(gapsMatch[0].replace(/Research Gaps:?/i, "").trim())
        : ["Research gaps not identified"];

      review.wellnessAreas.push(wellnessArea);
    }

    // Extract Research Gaps section
    const researchContent = extractSectionContent(content, "3\\. Research Gaps & Future Studies") || "No research gaps section found.";
    const questionsMatch = researchContent.match(
      /📌\s*Unanswered Questions in Research:?([\s\S]*?)(?=\d\.|$)/i,
    );
    review.researchGaps.questions = questionsMatch
      ? parseListItems(questionsMatch[1])
      : ["Research questions not specified"];

    // Extract Conclusion section
    const conclusionContent = extractSectionContent(content, "4\\. Conclusion") || "No conclusion available.";

    // Extract key points
    const keyPointsMatch = conclusionContent.match(
      /Key Points([\s\S]*?)(?=Safety Considerations|$)/i,
    );
    review.conclusion.keyPoints = keyPointsMatch
      ? parseListItems(keyPointsMatch[1])
      : ["Key points not available"];

    // Extract safety considerations
    const safetyMatch = conclusionContent.match(
      /Safety Considerations([\s\S]*?)(?=📌|$)/i,
    );
    review.conclusion.safetyConsiderations = safetyMatch
      ? parseListItems(safetyMatch[1])
      : ["Safety considerations not specified"];

    // Extract target audience
    const audienceMatch = conclusionContent.match(
      /Who Benefits Most\?([\s\S]*?)$/i,
    );
    review.conclusion.targetAudience = audienceMatch
      ? parseCheckmarkItems(audienceMatch[1])
      : ["Target audience not specified"];

    return review;
  } catch (error) {
    console.error("Error parsing review content:", error);
    throw new Error("Failed to parse literature review content");
  }
}

export async function generateLiteratureReview(
  productName: string,
  websiteUrl?: string,
) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI API key is required");
  }

  // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  let productContext = "";
  if (websiteUrl) {
    try {
      productContext = await scrapeWebsite(websiteUrl);
      console.log("Scraped website content length:", productContext.length);
    } catch (error) {
      console.error("Error getting product context:", error);
    }
  }

  const prompt = `
You are an expert in wellness research, tasked with generating a structured literature review on ${productName}. 
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

🍔 Metabolic & Gut Health
* How It Works:
    * [Explain mechanism of action.]
* Key Findings:
    ✅ [List scientific findings, each on a new line, include sources.]
* Research Gaps:
    ❌ [List research gaps, each on a new line.]

🍆 Sexual Health
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
${productContext ? "\nProduct Context:\n" + productContext : ""}

Follow this exact structure. Ensure proper headings, bullet points, and scientific sources.
`;

  try {
    console.log("Sending literature review request to OpenAI...");
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a scientific research assistant." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 2500,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Failed to generate content from OpenAI");
    }

    console.log("Received OpenAI response:", content);
    return parseReviewContent(content);
  } catch (error) {
    console.error("OpenAI API Error:", error);
    throw error;
  }
}

export const wellnessAreas = WELLNESS_AREAS;