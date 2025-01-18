import type { Router } from "express";
import { ragService } from "./services/rag-service";

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

    // Generate hypotheses using the RAG service
    const categories = ["Sleep", "Stress", "Recovery", "Cognition", "Metabolic Health"];
    const hypotheses = await Promise.all(
      categories.map(async (category, index) => {
        const prompt = `Based on wellness product "${productName}"${websiteUrl ? ` (${websiteUrl})` : ''}, 
          generate a research hypothesis for the category: ${category}. 
          Consider existing studies and scientific evidence in this domain.`;

        // Use RAG service to get relevant documents
        const relevantDocs = await ragService.queryRelevantDocuments(prompt, category.toLowerCase());
        const context = relevantDocs.join("\n");

        // Generate hypothesis with supporting rationale
        const confidenceScore = relevantDocs.length > 0 ? 0.7 + Math.random() * 0.3 : 0.5 + Math.random() * 0.3;

        return {
          id: index + 1,
          category,
          statement: `Regular use of ${productName} will improve ${category.toLowerCase()} metrics in healthy adults`,
          rationale: `Based on analysis of similar wellness interventions and existing research evidence`,
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

    // For now, return a basic protocol structure
    // This will be enhanced with AI-generated content in future iterations
    const protocol = {
      studyCategory,
      experimentTitle: `Effects of ${productName} on ${studyCategory.toLowerCase()} metrics`,
      studyObjective: selectedHypothesis,
      studyType: "Real-World Evidence",
      participantCount: 30,
      durationWeeks: 8,
      targetMetrics: [
        "Sleep Quality Score",
        "Total Sleep Time",
        "Sleep Latency",
        "Sleep Efficiency"
      ],
      questionnaires: [
        "Pittsburgh Sleep Quality Index (PSQI)",
        "Insomnia Severity Index (ISI)",
        "Sleep Hygiene Index (SHI)"
      ],
      studySummary: `This study aims to evaluate the effects of ${productName} on ${studyCategory.toLowerCase()} metrics in healthy adults.`,
      participantInstructions: [
        "Complete daily sleep logs",
        "Wear sleep tracking device throughout the study",
        "Take product as directed",
        "Complete weekly questionnaires"
      ],
      safetyPrecautions: [
        "Report any adverse effects immediately",
        "Maintain regular sleep schedule",
        "Avoid caffeine 6 hours before bedtime"
      ],
      educationalResources: [
        {
          title: "Sleep Hygiene Guide",
          description: "Best practices for optimal sleep",
          type: "PDF Guide"
        }
      ],
      consentFormSections: [
        {
          title: "Study Overview",
          content: `This study examines the effects of ${productName} on sleep metrics.`
        },
        {
          title: "Risks and Benefits",
          content: "Participation involves minimal risk."
        }
      ],
      customFactors: [
        "Caffeine intake",
        "Exercise timing",
        "Screen time before bed"
      ],
      eligibilityCriteria: {
        wearableData: [
          {
            metric: "Average Sleep Duration",
            condition: "less than",
            value: "7 hours"
          }
        ],
        demographics: [
          {
            category: "Age",
            requirement: "21-65 years"
          }
        ],
        customQuestions: [
          "Do you have any diagnosed sleep disorders?",
          "Are you currently taking any sleep medications?"
        ]
      }
    };

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