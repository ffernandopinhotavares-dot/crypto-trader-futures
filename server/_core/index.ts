import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { initializeDatabase } from "../db";
import { appRouter } from "../routers";
import { createContext } from "./context";
import path from "path";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS for dev mode
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Initialize database
async function startServer() {
  try {
    console.log("🔧 Initializing database...");
    await initializeDatabase();

    // TRPC middleware
    app.use(
      "/trpc",
      createExpressMiddleware({
        router: appRouter,
        createContext,
      })
    );

    // Serve static files in production
    if (process.env.NODE_ENV === "production") {
      const publicPath = path.join(process.cwd(), "dist/public");
      app.use(express.static(publicPath));

      // Fallback to index.html for SPA
      app.get("*", (req, res) => {
        res.sendFile(path.join(publicPath, "index.html"));
      });
    }

    // Start server
    app.listen(Number(PORT), "0.0.0.0", () => {
      console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
