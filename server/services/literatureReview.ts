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
  "Sexual Health & Performance",
] as const;

const CACHE_DURATION = 1000 * 60 * 60; // 1 hour
const scrapeCache = new Map<string, { content: string; timestamp: number }>();

// Add safeAssign helper function after scrapeCache definition
function safeAssign(targetArray: string[], newValues: string[]): string[] {
  return [...new Set(newValues)]; // Remove duplicates
}

export const literatureReviewRequestSchema = z.object({
  productName: z.string().min(1, "Product name is required"),
  websiteUrl: z.string().url("Please enter a valid URL").optional(),
});

// Improved website scraping with proper error handling
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

// Improved section extraction with better regex handling
function extractSectionContent(content: string, sectionHeader: string): string {
  // Make the regex more flexible to catch variations in formatting
  const sectionRegex = new RegExp(
    `${sectionHeader}[\\s\\S]*?(?=\\n\\n(?:\\d\\.\\s|[🛌💪❤️🧠🔥💙]|$)|$)`,
    "i",
  );
  const match = content.match(sectionRegex);
  return match ? match[0].trim() : "Content not found.";
}

function parseListItems(content: string, marker: string = "*"): string[] {
  if (!content || content === "Content not found.")
    return ["No data available"];

  // Split by newlines and clean up
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  // Try to extract content even if bullet points are missing
  const items = lines
    .filter(
      (line) =>
        line.startsWith(marker) ||
        (!line.startsWith("*") &&
          !line.startsWith("✅") &&
          !line.startsWith("❌")),
    )
    .map((line) => line.replace(new RegExp(`^\\${marker}\\s*`), "").trim())
    .filter((line) => line && !line.match(/^[🛌💪❤️🧠🔥💙]/)); // Filter out section headers

  return items.length > 0 ? items : ["No specific items found"];
}

function parseCheckmarkItems(content: string): string[] {
  if (!content || content === "Content not found.")
    return ["No data available"];

  // Split by newlines and clean up
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  // Try to find checkmark items or fall back to regular lines
  const items = lines
    .filter(
      (line) =>
        line.includes("✅") ||
        (!line.startsWith("*") && !line.startsWith("❌")),
    )
    .map((line) => line.replace(/^✅\s*/, "").trim())
    .filter((line) => line && !line.match(/^[🛌💪❤️🧠🔥💙]/));

  return items.length > 0 ? items : ["No checkmark items found"];
}

function parseXmarkItems(content: string): string[] {
  if (!content || content === "Content not found.")
    return ["No data available"];

  // Split by newlines and clean up
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  // Try to find x-mark items or fall back to lines under "Research Gaps"
  const items = lines
    .filter(
      (line) =>
        line.includes("❌") ||
        (!line.startsWith("*") && !line.startsWith("✅")),
    )
    .map((line) => line.replace(/^❌\s*/, "").trim())
    .filter((line) => line && !line.match(/^[🛌💪❤️🧠🔥💙]/));

  return items.length > 0 ? items : ["No research gaps identified"];
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
    // Extract title - more flexible pattern
    const titleMatch =
      content.match(/📝\s*Literature Review:([^\n]+)/) ||
      content.match(/^([^\n]+)/);
    review.title = titleMatch ? titleMatch[1].trim() : "Literature Review";

    // Extract Overview section with more flexible patterns
    const overviewContent = extractSectionContent(content, "1\. Overview");
    if (overviewContent !== "Content not found.") {
      // Product description - ensure single entry
      const productDescriptionMatch = overviewContent.match(
        /What is [^\n]*\??\n([\s\S]*?)(?=\nPrimary Benefits|$)/i
      );
      if (productDescriptionMatch) {
        // Store as single entry
        review.overview.description = [productDescriptionMatch[1].trim()];
      }

      // Benefits - avoid duplicate entries
      const benefitsMatch = overviewContent.match(
        /Primary Benefits:\n([\s\S]*?)(?=\nCommon Supplement Forms|$)/i
      );
      if (benefitsMatch) {
        const benefits = parseCheckmarkItems(
          benefitsMatch[1].replace(/Primary Benefits:?/i, "").trim()
        );
        review.overview.benefits = safeAssign([], benefits);
      }

      // Supplement forms - avoid duplicate entries
      const formsMatch = overviewContent.match(
        /Common Supplement Forms:\n([\s\S]*?)(?=\d\.|$)/i
      );
      if (formsMatch) {
        const forms = parseListItems(
          formsMatch[1].replace(/Common Supplement Forms:?/i, "").trim()
        );
        review.overview.supplementForms = safeAssign([], forms);
      }
    }

    // Extract Wellness Areas with more flexible emoji matching
    const wellnessAreaPatterns = [
      { emoji: "🛌", name: "Sleep & Recovery" },
      { emoji: "💪", name: "Physical Performance" },
      { emoji: "❤️", name: "Cardiovascular Health" },
      { emoji: "🧠", name: "Cognitive Function & Mood" },
      { emoji: "🔥", name: "Metabolic & Gut Health" },
      { emoji: "💙", name: "Sexual Health & Performance" },
    ];

    for (const { emoji, name } of wellnessAreaPatterns) {
      // More flexible area content extraction
      const areaRegex = new RegExp(
        `${emoji}[\\s\\S]*?(?=(?:[🛌💪❤️🧠🔥💙]|\\d\\.\\s|$))`,
        "i",
      );
      const areaContent = content.match(areaRegex)?.[0] || "";

      if (areaContent) {
        const wellnessArea = {
          emoji,
          name,
          mechanism: [] as string[],
          keyFindings: [] as string[],
          researchGaps: [] as string[],
        };

        // More flexible mechanism matching
        const mechanismMatch = areaContent.match(
          /How It Works:?[\s\S]*?(?=Key Findings|$)/i,
        );
        if (mechanismMatch) {
          wellnessArea.mechanism = parseListItems(
            mechanismMatch[0].replace(/How It Works:?/i, "").trim(),
          );
        }

        // More flexible findings matching
        const findingsMatch = areaContent.match(
          /Key Findings:?[\s\S]*?(?=Research Gaps|$)/i,
        );
        if (findingsMatch) {
          wellnessArea.keyFindings = parseCheckmarkItems(
            findingsMatch[0].replace(/Key Findings:?/i, "").trim(),
          );
        }

        // More flexible gaps matching
        const gapsMatch = areaContent.match(
          /Research Gaps:?[\s\S]*?(?=\n\n|$)/i,
        );
        if (gapsMatch) {
          wellnessArea.researchGaps = parseXmarkItems(
            gapsMatch[0].replace(/Research Gaps:?/i, "").trim(),
          );
        }

        // Only add areas that have some content
        if (
          wellnessArea.mechanism.length > 0 ||
          wellnessArea.keyFindings.length > 0 ||
          wellnessArea.researchGaps.length > 0
        ) {
          review.wellnessAreas.push(wellnessArea);
        }
      }
    }

    // Extract Research Gaps section with more flexible matching
    const researchContent = extractSectionContent(
      content,
      "3\. Research Gaps & Future Studies",
    );
    const questionsMatch =
      researchContent.match(/📌[^:]*:?[\s\S]*?(?=\d\.|$)/i) ||
      researchContent.match(/Unanswered Questions[^:]*:?[\s\S]*?(?=\d\.|$)/i);
    if (questionsMatch) {
      review.researchGaps.questions = parseListItems(questionsMatch[0]);
    }

    // Extract Conclusion section with more flexible matching
    const conclusionContent = extractSectionContent(content, "4\. Conclusion");
    if (conclusionContent !== "Content not found.") {
      const keyPointsMatch = conclusionContent.match(
        /Key Points:?[\s\S]*?(?=Safety Considerations|$)/i,
      );
      if (keyPointsMatch) {
        review.conclusion.keyPoints = parseListItems(
          keyPointsMatch[0].replace(/Key Points:?/i, "").trim(),
        );
      }

      const safetyMatch = conclusionContent.match(
        /Safety Considerations:?[\s\S]*?(?=📌|Who Benefits|$)/i,
      );
      if (safetyMatch) {
        review.conclusion.safetyConsiderations = parseListItems(
          safetyMatch[0].replace(/Safety Considerations:?/i, "").trim(),
        );
      }

      const audienceMatch = conclusionContent.match(
        /(?:📌\s*)?Who Benefits Most\??[\s\S]*?$/i,
      );
      if (audienceMatch) {
        review.conclusion.targetAudience = parseCheckmarkItems(
          audienceMatch[0],
        );
      }
    }

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
You are an expert in nutritional science, tasked with generating a structured literature review on ${productName}. 
Follow this exact format to ensure consistency:

📝 Literature Review: ${productName} & Its Impact on Wellness

1. Overview
* What is ${productName}?
    * [Provide a brief, 1-2 sentence introduction to the compound, focusing on its basic form and primary purpose.]
* Primary Benefits:
    ✅ [List 3-4 key unique benefits, avoid repeating detailed mechanisms.]
* Common Supplement Forms:
    * [List main supplement forms available.]

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

💙 Sexual Health & Performance
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

Follow this exact structure. Ensure proper headings, bullet points, and scientific sources.`;

  try {
    console.log("Sending literature review request to OpenAI...");
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are a scientific research assistant specializing in nutritional science and supplement research. Provide detailed, evidence-based analysis.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
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