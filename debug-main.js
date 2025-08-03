import express from "express";
import { createServer } from "http";

console.log("Starting debug main server...");

// Add error handlers for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

async function startServer() {
  try {
    console.log("Creating Express app...");
    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    
    console.log("Creating HTTP server...");
    const server = createServer(app);
    
    console.log("Importing registerRoutes...");
    const { registerRoutes } = await import('./server/routes.js');
    
    console.log("Registering routes...");
    await registerRoutes(app);
    
    console.log("Starting server on port 5003...");
    server.listen({
      port: 5003,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      console.log("Server listening on port 5003");
    });
    
  } catch (error) {
    console.error("Error starting server:", error);
  }
}

startServer();