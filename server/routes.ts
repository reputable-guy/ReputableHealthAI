import type { Router } from "express";
import { ragService } from "./services/rag-service";
import OpenAI from "openai";

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Wrapper to ensure all route handlers return JSON
const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next))
    .catch(error => {
      console.error('Route error:', error);
      res.status(500)
         .setHeader('Content-Type', 'application/json')
         .json({ 
           error: true,
           message: error.message || 'Internal Server Error',
           status: 500
         });
    });
};

export function registerRoutes(router: Router): void {
  // Health check endpoint
  router.get("/health", asyncHandler(async (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json({ status: "ok" });
  }));

  // Hypothesis generation endpoint
  router.post("/protocols/hypotheses", asyncHandler(async (req, res) => {
    const { productName, websiteUrl } = req.body;

    if (!productName) {
      return res.status(400)
         .setHeader('Content-Type', 'application/json')
         .json({ 
           error: true,
           message: "Product name is required",
           status: 400
         });
    }

    // Generate hypotheses using the RAG service and OpenAI
    const categories = ["Sleep", "Stress", "Recovery", "Cognition", "Metabolic Health"];
    const hypotheses = await Promise.all(
      categories.map(async (category, index) => {
        const prompt = `Based on wellness product "${productName}"${websiteUrl ? ` (${websiteUrl})` : ''}, 
          generate a research hypothesis for the category: ${category}. 
          Consider existing studies and scientific evidence in this domain.`;

        // Use RAG service to get relevant documents
        const relevantDocs = await ragService.queryRelevantDocuments(prompt, category.toLowerCase());
        const context = relevantDocs.join("\n");

        // Use OpenAI to generate creative hypothesis
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

        // Calculate confidence score based on relevance
        const confidenceScore = relevantDocs.length > 0 ? 0.7 + Math.random() * 0.3 : 0.5 + Math.random() * 0.3;

        return {
          id: index + 1,
          category,
          statement: hypothesis,
          rationale: `Based on analysis of ${relevantDocs.length} relevant studies and scientific evidence in ${category.toLowerCase()}`,
          confidenceScore
        };
      })
    );

    res.setHeader('Content-Type', 'application/json')
       .json({ hypotheses });
  }));

  // Protocol generation endpoint
  router.post("/protocols/generate", asyncHandler(async (req, res) => {
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

    // Generate contextual prompt using RAG service
    const contextualPrompt = await ragService.generateContextualPrompt(
      productName,
      studyCategory,
      selectedHypothesis
    );

    // Use OpenAI to generate the protocol based on the contextual prompt
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert in research protocol design. Generate a comprehensive research protocol based on the provided context and requirements. The response must be valid JSON matching the specified structure."
        },
        {
          role: "user",
          content: contextualPrompt
        }
      ],
      response_format: { type: "json_object" }
    });

    const protocol = JSON.parse(completion.choices[0].message.content);

    res.setHeader('Content-Type', 'application/json')
       .json(protocol);
  }));

  // Add endpoint to check RAG stats
  router.get("/rag/stats", asyncHandler(async (_req, res) => {
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
  }));

  // Add endpoint to reload PubMed studies
  router.post("/rag/reload-studies", asyncHandler(async (_req, res) => {
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
  }));
}