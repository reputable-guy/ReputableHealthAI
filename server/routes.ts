import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { protocols } from "@db/schema";
import { eq } from "drizzle-orm";

export function registerRoutes(app: Express): Server {
  app.post("/api/protocols", async (req, res) => {
    try {
      const protocol = await db.insert(protocols).values(req.body).returning();
      res.json(protocol[0]);
    } catch (error) {
      res.status(500).json({ error: "Failed to create protocol" });
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
