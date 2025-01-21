import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CORS middleware for all routes
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// API logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Register API routes directly to the app
  registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Server error:', err);
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status)
       .setHeader('Content-Type', 'application/json')
       .json({ 
         error: true,
         message,
         status 
       });
  });

  // Catch-all handler for unhandled routes
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404)
               .setHeader('Content-Type', 'application/json')
               .json({ 
                 error: true,
                 message: 'API endpoint not found',
                 status: 404 
               });
    }
    next();
  });

  // Setup Vite or static serving after API routes
  if (app.get("env") === "development") {
    await setupVite(app);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  const PORT = 5000;
  app.listen(PORT, "0.0.0.0", () => {
    log(`serving on port ${PORT}`);
  });
})();