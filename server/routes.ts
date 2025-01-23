import type { Express } from "express";
import { createServer, type Server } from "http";
import { ragService } from "./services/rag-service";
import OpenAI from "openai";
import { validateStudyDesign } from "./services/validation-service";
import { generateLiteratureReview, literatureReviewRequestSchema } from "./services/literatureReview";
import { verifyProduct, verificationRequestSchema } from "./services/verification";

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);

  // Product verification endpoint
  app.post("/api/verify-product", async (req, res) => {
    try {
      console.log('Product verification request body:', req.body);

      const parseResult = verificationRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        console.error('Validation error:', parseResult.error);
        return res.status(400).json({
          error: true,
          message: "Invalid request data",
          details: parseResult.error.flatten()
        });
      }

      const { productName, websiteUrl } = parseResult.data;
      console.log('Verifying product:', { productName, websiteUrl });

      const verification = await verifyProduct(productName, websiteUrl);

      console.log('Product verification completed successfully');
      return res.status(200).json({ verification });

    } catch (error) {
      console.error("Product verification error:", error);
      return res.status(500).json({
        error: true,
        message: error instanceof Error ? error.message : "Failed to verify product",
        details: error instanceof Error ? error.stack : undefined
      });
    }
  });

  // Literature review endpoint
  app.post("/api/literature-review", async (req, res) => {
    try {
      console.log('Literature review request body:', req.body);

      const parseResult = literatureReviewRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        console.error('Validation error:', parseResult.error);
        return res.status(400).json({
          error: true,
          message: "Invalid request data",
          details: parseResult.error.flatten()
        });
      }

      const { productName, websiteUrl } = parseResult.data;
      console.log('Generating literature review for:', { productName, websiteUrl });

      const review = await generateLiteratureReview(productName, websiteUrl);

      console.log('Literature review generated successfully');
      return res.status(200).json({ review });

    } catch (error) {
      console.error("Literature review generation error:", error);
      return res.status(500).json({
        error: true,
        message: error instanceof Error ? error.message : "Failed to generate literature review",
        details: error instanceof Error ? error.stack : undefined
      });
    }
  });

  // Health check endpoint
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Hypothesis generation endpoint - Adding /api prefix
  app.post("/api/protocols/hypotheses", async (req, res) => {
    const { productName, websiteUrl, researchAreas = [
      "Sleep",
      "Stress", 
      "Recovery",
      "Cognition",
      "Physical Performance",
      "Cardiovascular Health",
      "Metabolic Health",
      "Gut Health",
      "Sexual Health"
    ]} = req.body;
    if (!productName) {
      return res.status(400)
        .json({
          error: true,
          message: "Product name is required",
          details: "Please provide a product name to generate hypotheses"
        });
    }
    try {
      const categories = researchAreas;
      const hypotheses = await Promise.all(
        categories.map(async (category, index) => {
          try {
            const prompt = `Based on wellness product "${productName}"${websiteUrl ? ` (${websiteUrl})` : ''}, 
              generate a research hypothesis for the category: ${category}. 
              Consider existing studies and scientific evidence in this domain.`;
            const relevantDocs = await ragService.queryRelevantDocuments(prompt, category.toLowerCase());
            console.log(`Found ${relevantDocs.length} relevant documents for category ${category}`);
            const context = relevantDocs.join("\n");
            const completion = await openai.chat.completions.create({
              model: "gpt-4",
              messages: [
                {
                  role: "system",
                  content: `You are a research scientist specializing in wellness studies. 
                    Based on the provided context from relevant studies, generate a specific, 
                    testable hypothesis about the effects of the given wellness product.
                    Context from relevant studies:
                    ${context}
                    Generate a hypothesis that is:
                    1. Specific and testable
                    2. Based on scientific evidence
                    3. Relevant to the product and category
                    4. Includes a clear mechanism of action`
                },
                {
                  role: "user",
                  content: prompt
                }
              ]
            });
            const hypothesis = completion.choices[0].message.content ||
              `Regular use of ${productName} will improve ${category.toLowerCase()} metrics in healthy adults`;
            const confidenceScore = relevantDocs.length > 0 ? 0.7 + Math.random() * 0.3 : 0.5 + Math.random() * 0.3;
            return {
              id: index + 1,
              category,
              statement: hypothesis,
              rationale: `Based on analysis of ${relevantDocs.length} relevant studies and scientific evidence in ${category.toLowerCase()}`,
              confidenceScore
            };
          } catch (error) {
            console.error(`Error generating hypothesis for category ${category}:`, error);
            return {
              id: index + 1,
              category,
              statement: `Regular use of ${productName} will improve ${category.toLowerCase()} metrics in healthy adults`,
              rationale: "Generated using default template due to processing error",
              confidenceScore: 0.5
            };
          }
        })
      );
      res.json({ hypotheses });
    } catch (error) {
      console.error("Failed to generate hypotheses:", error);
      res.status(500).json({
        error: true,
        message: "Failed to generate hypotheses",
        details: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  // Protocol generation endpoint
  app.post("/api/protocols/generate", async (req, res) => {
    const { productName, websiteUrl, selectedHypothesis, studyCategory } = req.body;
    if (!productName || !selectedHypothesis || !studyCategory) {
      return res.status(400)
        .setHeader('Content-Type', 'application/json')
        .json({
          error: true,
          message: "Product name, hypothesis, and category are required",
          status: 400
        });
    }
    const MAX_RETRIES = 3;
    let protocol = null;
    let validationResults = null;
    let attempts = 0;
    while (attempts < MAX_RETRIES) {
      try {
        const contextualPrompt = await ragService.generateContextualPrompt(
          productName,
          studyCategory,
          selectedHypothesis
        );
        const completion = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: `You are an expert in research protocol design. Generate a comprehensive research protocol based on the provided context and requirements. 
              IMPORTANT: Your response must be ONLY valid JSON with NO additional text or explanations.
              Follow the exact structure specified in the prompt.
              Each field should be carefully considered and specific to the study context.
              Ensure all arrays have at least 3-5 relevant items.
              Essential requirements:
              1. Statistical power must be >= 0.8
              2. Sample size must be sufficient for the chosen effect size
              3. Include clear control group design for RCTs
              4. Ensure regulatory compliance`
            },
            {
              role: "user",
              content: contextualPrompt
            }
          ]
        });
        try {
          protocol = JSON.parse(completion.choices[0].message.content);
        } catch (error) {
          console.error("Failed to parse GPT response as JSON:", error);
          throw new Error("Failed to generate valid protocol structure");
        }
        validationResults = await validateStudyDesign(protocol);
        if (validationResults.isValid) {
          break;
        }
        console.log(`Protocol validation failed on attempt ${attempts + 1}:`,
          validationResults.errors.map(e => `${e.field}: ${e.message}`).join(', '));
        attempts++;
      } catch (error) {
        console.error("Protocol generation error:", error);
        attempts++;
      }
    }
    if (!protocol || !validationResults?.isValid) {
      return res.status(500)
        .setHeader('Content-Type', 'application/json')
        .json({
          error: true,
          message: "Failed to generate a valid protocol after multiple attempts",
          details: validationResults?.errors || []
        });
    }
    const response = {
      ...protocol,
      validationResults: {
        statisticalPower: validationResults.statisticalPower,
        powerAnalysis: {
          effectSize: validationResults.effectSize,
          sampleSize: protocol.participantCount,
          minimumSampleSize: validationResults.minimumSampleSize,
          confidence: validationResults.confidence,
          powerCurve: validationResults.powerCurve
        },
        regulatoryFlags: validationResults.regulatoryFlags
      }
    };
    res.setHeader('Content-Type', 'application/json')
      .json(response);
  });

  // Add endpoint to check RAG stats
  app.get("/rag/stats", async (_req, res) => {
    const stats = await ragService.checkIndexStats();
    if (!stats) {
      return res.status(503)
        .setHeader('Content-Type', 'application/json')
        .json({
          error: "RAG service not initialized or unavailable",
          status: "unavailable"
        });
    }
    res.setHeader('Content-Type', 'application/json');
    res.json({
      status: "available",
      totalVectors: stats.totalRecordCount || 0,
      namespaces: stats.namespaces ? Object.keys(stats.namespaces).length : 0,
      dimensionality: stats.dimension || 1536,
      lastChecked: new Date().toISOString()
    });
  });

  // Add endpoint to reload PubMed studies
  app.post("/rag/reload-studies", async (_req, res) => {
    console.log("Starting PubMed studies reload...");
    const result = await ragService.loadPublicStudies();
    if (result) {
      const stats = await ragService.checkIndexStats();
      res.setHeader('Content-Type', 'application/json');
      res.json({
        status: "success",
        message: "Successfully reloaded PubMed studies",
        currentStats: stats
      });
    } else {
      res.status(500)
        .setHeader('Content-Type', 'application/json')
        .json({
          error: true,
          status: "error",
          message: "Failed to reload PubMed studies"
        });
    }
  });

  return httpServer;
}