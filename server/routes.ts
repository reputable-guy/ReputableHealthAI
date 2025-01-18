import type { Router } from "express";
import { ragService } from "./services/rag-service";

export function registerRoutes(router: Router): void {
  // Add CORS headers for API routes
  router.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
    next();
  });

  // Add endpoint to check RAG stats
  router.get("/rag/stats", async (_req, res) => {
    try {
      const stats = await ragService.checkIndexStats();
      if (!stats) {
        return res.status(503).json({ 
          error: "RAG service not initialized or unavailable",
          status: "unavailable" 
        });
      }
      res.json({
        status: "available",
        totalVectors: stats.totalRecordCount || 0,
        namespaces: stats.namespaces ? Object.keys(stats.namespaces).length : 0,
        dimensionality: stats.dimension || 1536,
        lastChecked: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("Failed to fetch RAG statistics:", error);
      res.status(500).json({ 
        error: "Failed to fetch RAG statistics", 
        details: error.message 
      });
    }
  });

  // Add endpoint to reload PubMed studies
  router.post("/rag/reload-studies", async (_req, res) => {
    try {
      console.log("Starting PubMed studies reload...");
      const result = await ragService.loadPublicStudies();
      if (result) {
        const stats = await ragService.checkIndexStats();
        res.json({
          status: "success",
          message: "Successfully reloaded PubMed studies",
          currentStats: stats
        });
      } else {
        res.status(500).json({
          status: "error",
          message: "Failed to reload PubMed studies"
        });
      }
    } catch (error: any) {
      console.error("Failed to reload PubMed studies:", error);
      res.status(500).json({
        status: "error",
        message: error.message
      });
    }
  });
}