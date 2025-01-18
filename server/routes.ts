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
  // Test route to verify OpenAI API
  app.get("/api/test-openai", async (_req, res) => {
    try {
      console.log("Testing OpenAI API connection...");

      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "user",
            content: "Hello, this is a test message."
          }
        ],
        max_tokens: 10
      });

      console.log("OpenAI API test successful:", completion.choices[0].message);

      res.json({ 
        status: "success",
        message: "OpenAI API is working correctly",
        response: completion.choices[0].message
      });
    } catch (error: any) {
      console.error("OpenAI test error details:", {
        status: error.status,
        type: error.error?.type,
        code: error.code,
        param: error.param,
        message: error.message
      });

      res.status(500).json({ 
        status: "error",
        error: error.error?.type || error.type,
        message: error.error?.message || error.message,
        details: {
          status: error.status,
          code: error.code,
          param: error.param
        }
      });
    }
  });

  app.post("/api/protocols/generate", async (req, res) => {
    try {
      const setupData = req.body;

      console.log("Generating protocol with data:", setupData);

      const prompt = `
As a clinical research expert, generate a comprehensive study protocol based on these initial details:

Product Name: ${setupData.productName}
Website: ${setupData.websiteUrl || 'N/A'}
Study Goal: ${setupData.studyGoal}

I need you to generate a protocol in valid JSON format. The response must be parseable JSON with the following structure:

{
  "studyCategory": "Sleep",  // One of: Sleep, Stress, Recovery, Cognition, Metabolic Health, Women's Health, Other
  "experimentTitle": "string",
  "studyObjective": "string",
  "studyType": "Real-World Evidence",  // Either "Real-World Evidence" or "Randomized Controlled Trial"
  "participantCount": 100,  // number
  "durationWeeks": 8,  // number
  "targetMetrics": ["string"],  // array of strings
  "questionnaires": ["string"],  // array of strings
  "eligibilityCriteria": {
    "wearableData": [],  // array
    "demographics": [],  // array
    "customQuestions": ["string"]  // array of strings
  }
}

Important: Ensure the response is ONLY the JSON object, with no additional text or markdown formatting.

Base your protocol design on scientific best practices and make it appropriate for the product category. Include relevant wearable metrics and validated questionnaires specific to the study category.`;

      console.log("Sending request to OpenAI...");
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are an expert clinical research advisor specializing in wellness product studies. You must respond with only valid JSON data structured exactly as requested, with no additional text or explanations."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7
      });

      if (!completion.choices[0].message.content) {
        throw new Error("No response received from AI");
      }

      console.log("OpenAI response received:", completion.choices[0].message.content);

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
        console.error("Failed to parse OpenAI response. Raw response:", completion.choices[0].message.content);
        throw new Error("Failed to parse protocol data from AI response");
      }
    } catch (error: any) {
      console.error("Protocol generation error details:", {
        status: error.status,
        type: error.error?.type,
        code: error.code,
        param: error.param,
        message: error.message
      });

      // Handle specific OpenAI API errors
      if (error.error?.type === 'insufficient_quota') {
        res.status(500).json({ 
          error: "Failed to generate protocol",
          details: "OpenAI API quota exceeded. Please check your billing status and available credits."
        });
      } else if (error.status === 401) {
        res.status(500).json({
          error: "Failed to generate protocol",
          details: "Invalid API key. Please ensure your OpenAI API key is correct."
        });
      } else {
        res.status(500).json({ 
          error: "Failed to generate protocol",
          details: error.message 
        });
      }
    }
  });

  // Protocol insights endpoint
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
        model: "gpt-3.5-turbo",
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
        max_tokens: 2000
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