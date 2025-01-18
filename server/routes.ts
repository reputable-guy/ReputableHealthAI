import type { Express } from "express";
import { createServer, type Server } from "http";
import { ragService } from "./services/rag-service";

export function registerRoutes(app: Express): Server {
  // Add CORS headers for API routes
  app.use('/api', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
    next();
  });

  // Add new endpoint to check RAG stats
  app.get("/api/rag/stats", async (_req, res) => {
    // Force JSON response
    res.setHeader('Content-Type', 'application/json');

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

  const httpServer = createServer(app);
  return httpServer;
}