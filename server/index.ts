import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { initializeDatabase } from "./db";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import path from "path";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

    // Serve static files
    const publicPath = path.join(process.cwd(), "dist/public");
    app.use(express.static(publicPath));

    // Fallback to index.html for SPA
    app.get("*", (req, res) => {
      res.sendFile(path.join(publicPath, "index.html"));
    });

    // Start server
    app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
