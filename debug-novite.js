import express from "express";
import { createServer } from "http";

console.log("Starting server without Vite...");

// Add error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

async function startServer() {
  try {
    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    
    // Add basic logging middleware
    app.use((req, res, next) => {
      console.log(`${req.method} ${req.path}`);
      next();
    });
    
    const { registerRoutes } = await import('./server/routes.js');
    console.log("Registering routes...");
    const server = await registerRoutes(app);
    
    console.log("Adding error handler...");
    app.use((err, _req, res, _next) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
      console.error("Request error:", err);
    });
    
    // Skip Vite setup and just add a basic route
    app.get('*', (req, res) => {
      res.send('<h1>Server is running!</h1><p>Vite setup skipped for debugging</p>');
    });
    
    const port = parseInt(process.env.PORT || '5004', 10);
    server.listen({
      port,
      host: "0.0.0.0", 
      reusePort: true,
    }, () => {
      console.log(`Server listening on port ${port}`);
    });
    
  } catch (error) {
    console.error("Error starting server:", error);
  }
}

startServer();