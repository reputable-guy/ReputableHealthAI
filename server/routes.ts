import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { protocols } from "@db/schema";
import { eq } from "drizzle-orm";
import OpenAI from "openai";
import { ragService } from "./services/rag-service";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY must be set");
}

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY
});

export function registerRoutes(app: Express): Server {
  app.post("/api/protocols/hypotheses", async (req, res) => {
    try {
      const { productName, websiteUrl } = req.body;

      const prompt = `
Analyze this wellness product and generate up to 5 scientifically plausible research hypotheses:

Product Name: ${productName}
Website: ${websiteUrl || 'N/A'}

Generate a response in this JSON format:
{
  "hypotheses": [
    {
      "id": number,
      "category": string,  // e.g., "Sleep", "Stress", "Recovery", etc.
      "statement": string, // The hypothesis statement
      "rationale": string, // Brief scientific rationale
      "confidenceScore": number // 0-1 score based on available evidence
    }
  ]
}

Guidelines:
1. Each hypothesis should be specific and testable
2. Focus on primary outcomes that can be measured with wearables
3. Consider the product's ingredients/mechanism of action
4. Base confidence scores on existing research
5. Order hypotheses by confidence score (highest first)
`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a research scientist specializing in wellness product efficacy analysis. Generate evidence-based hypotheses that can be tested using wearable devices and validated measurement tools."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: "json_object" }
      });

      if (!completion.choices[0].message.content) {
        throw new Error("No hypotheses generated");
      }

      const hypotheses = JSON.parse(completion.choices[0].message.content);
      res.json(hypotheses);
    } catch (error: any) {
      console.error("Hypothesis generation error:", error);
      res.status(500).json({
        error: "Failed to generate hypotheses",
        details: error.message
      });
    }
  });

  app.post("/api/protocols/generate", async (req, res) => {
    try {
      const setupData = req.body;

      console.log("Generating protocol with data:", setupData);

      // Get contextual prompt using RAG
      const contextualPrompt = await ragService.generateContextualPrompt(
        setupData.productName,
        setupData.studyCategory,
        setupData.selectedHypothesis
      );

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert clinical research advisor with deep expertise in wellness product studies and advanced statistical methods. Generate comprehensive, scientifically-sound protocols that combine academic rigor with practical implementation. Focus on:
1. Evidence-based methodology
2. Statistical validity
3. Participant engagement
4. Data quality assurance
5. Ethical considerations`
          },
          {
            role: "user",
            content: contextualPrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 4000,
        response_format: { type: "json_object" }
      });

      if (!completion.choices[0].message.content) {
        throw new Error("Failed to generate protocol");
      }

      try {
        const generatedProtocol = JSON.parse(completion.choices[0].message.content.trim());
        console.log("Parsed protocol:", generatedProtocol);

        const fullProtocol = {
          ...setupData,
          ...generatedProtocol
        };

        console.log("Saving protocol to database...");
        const savedProtocol = await db.insert(protocols).values(fullProtocol).returning();
        res.json(savedProtocol[0]);
      } catch (parseError) {
        console.error("Failed to parse OpenAI response:", completion.choices[0].message.content);
        throw new Error("Failed to parse protocol data from AI response");
      }
    } catch (error: any) {
      console.error("Protocol generation error:", error);
      res.status(500).json({ 
        error: "Failed to generate protocol",
        details: error.message 
      });
    }
  });

  app.post("/api/protocols/insights", async (req, res) => {
    try {
      const protocolData = req.body;

      const prompt = `
Based on the following study protocol details, generate comprehensive insights and recommendations:

Product: ${protocolData.productName}
Study Category: ${protocolData.studyCategory}
Study Type: ${protocolData.studyType}
Duration: ${protocolData.durationWeeks} weeks
Participants: ${protocolData.participantCount}

Generate a detailed markdown analysis including:

1. Study Design Analysis
- Evaluate the strength of the study design
- Discuss potential limitations and how to address them
- Suggest ways to improve data quality

2. Statistical Power Assessment
- Analyze if the participant count is sufficient
- Discuss expected effect sizes
- Recommend any adjustments needed

3. Data Collection Strategy
- Review the selected metrics and their relevance
- Evaluate the questionnaire choices
- Suggest additional data points if needed

4. Participant Management
- Discuss strategies for maintaining engagement
- Recommend compliance monitoring approaches
- Outline potential challenges and solutions

5. Expected Outcomes
- Predict potential findings
- Discuss how results could be used (based on study goal: ${protocolData.studyGoal})
- Suggest follow-up study possibilities

Keep the tone professional but accessible, and focus on actionable insights.
`;

      console.log("Generating protocol insights...");
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert research consultant providing detailed analysis and recommendations for wellness product studies. Your insights should be both scientifically rigorous and practically applicable."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 4000
      });

      if (!completion.choices[0].message.content) {
        throw new Error("No insights generated");
      }

      res.json(completion.choices[0].message.content);
    } catch (error: any) {
      console.error("Insights generation error:", error);
      res.status(500).json({ 
        error: "Failed to generate insights",
        details: error.message 
      });
    }
  });

  app.get("/api/protocols/:id", async (req, res) => {
    try {
      const protocol = await db.query.protocols.findFirst({
        where: eq(protocols.id, parseInt(req.params.id))
      });

      if (!protocol) {
        return res.status(404).json({ error: "Protocol not found" });
      }

      res.json(protocol);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch protocol" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}