import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { protocols } from "@db/schema";
import { eq } from "drizzle-orm";
import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY must be set");
}

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY
});

export function registerRoutes(app: Express): Server {
  app.post("/api/protocols/generate", async (req, res) => {
    try {
      const setupData = req.body;

      const prompt = `
As a clinical research expert, generate a comprehensive study protocol based on these initial details:

Product Name: ${setupData.productName}
Website: ${setupData.websiteUrl || 'N/A'}
Study Goal: ${setupData.studyGoal}

Generate a complete study protocol including:
1. Study Category (Sleep, Stress, Recovery, etc.)
2. Experiment Title (participant-facing)
3. Study Objective/Hypothesis
4. Study Type (Real-World Evidence or RCT)
5. Recommended participant count (with statistical justification)
6. Study duration in weeks
7. Target metrics to measure (specific to the wearable devices)
8. Recommended validated questionnaires
9. Eligibility criteria including:
   - Wearable data requirements
   - Demographic requirements
   - Screening questions

Format the response as a JSON object with these fields:
{
  studyCategory: string,
  experimentTitle: string,
  studyObjective: string,
  studyType: string,
  participantCount: number,
  durationWeeks: number,
  targetMetrics: string[],
  questionnaires: string[],
  eligibilityCriteria: {
    wearableData: any[],
    demographics: any[],
    customQuestions: string[]
  }
}

Ensure the protocol design follows scientific best practices and is appropriate for the product category.
`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are an expert clinical research advisor specializing in wellness product studies. Generate study protocols that are scientifically rigorous yet practical for wellness brands."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7
      });

      if (!completion.choices[0].message.content) {
        throw new Error("No response received from AI");
      }

      const generatedProtocol = JSON.parse(completion.choices[0].message.content);
      const fullProtocol = {
        ...setupData,
        ...generatedProtocol
      };

      const savedProtocol = await db.insert(protocols).values(fullProtocol).returning();
      res.json(savedProtocol[0]);
    } catch (error: any) {
      console.error("Protocol generation error:", error);

      // Handle specific OpenAI API errors
      if (error.error?.type === 'insufficient_quota') {
        res.status(500).json({ 
          error: "Failed to generate protocol",
          details: "OpenAI API quota exceeded. Please try again later."
        });
      } else {
        res.status(500).json({ 
          error: "Failed to generate protocol",
          details: error.message 
        });
      }
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