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