import { createServer } from "http";
import express from "express";

console.log("Starting debug server...");

const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'working' });
});

app.get('/test', (req, res) => {  
  res.json({ message: 'Server is responding' });
});

const server = createServer(app);

server.listen({
  port: 5002,
  host: "0.0.0.0",
  reusePort: true,
}, () => {
  console.log("Debug server listening on port 5002");
});

// Keep alive for testing
setTimeout(() => {
  console.log("Debug server still running...");
}, 3000);