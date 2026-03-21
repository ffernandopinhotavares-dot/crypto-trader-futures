import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { initializeDatabase, getDatabase } from "../db";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { createGateioClient } from "../gateio";
import { TradingEngine } from "../tradingEngine";
import { bybitApiKeys, tradingConfigs, botStatus } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import path from "path";

const app = express();
const PORT = process.env.PORT || 3000;

// Export trading engines map so routers can access it
export const tradingEngines = new Map<string, TradingEngine>();

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

// Auto-restart bot if it was running before server restart
async function autoRestartBot(): Promise<void> {
  try {
    const db = getDatabase();

    // Find any bot that was marked as running
    const runningBots = await db
      .select()
      .from(botStatus)
      .where(eq(botStatus.isRunning, true))
      .limit(1);

    if (runningBots.length === 0) {
      console.log("ℹ️ No active bot found to auto-restart");
      return;
    }

    const bot = runningBots[0];
    const userId = bot.userId;
    const configId = bot.configId;

    if (!configId) {
      console.log("ℹ️ Bot has no configId, skipping auto-restart");
      return;
    }

    // Get API keys
    const keys = await db
      .select()
      .from(bybitApiKeys)
      .where(eq(bybitApiKeys.userId, userId))
      .limit(1);

    if (keys.length === 0) {
      console.log("⚠️ No API keys found, cannot auto-restart bot");
      return;
    }

    // Get config
    const configs = await db
      .select()
      .from(tradingConfigs)
      .where(eq(tradingConfigs.id, configId))
      .limit(1);

    if (configs.length === 0) {
      console.log("⚠️ Config not found, cannot auto-restart bot");
      return;
    }

    const config = configs[0];
    const apiKey = keys[0];

    // Create Gate.io client
    const gateioClient = createGateioClient({
      apiKey: apiKey.apiKey,
      apiSecret: apiKey.apiSecret,
    });

    // Parse aggressiveness from description
    const descParts = (config.description ?? "moderate|").split("|");
    const aggressiveness = (
      ["conservative", "moderate", "aggressive"].includes(descParts[0])
        ? descParts[0]
        : "moderate"
    ) as "conservative" | "moderate" | "aggressive";

    // Create and start engine
    const engine = new TradingEngine({
      userId,
      configId,
      gateioClient,
      maxRiskPerTrade: parseFloat(config.maxPositionSize ?? "5"),
      maxDrawdown: parseFloat(config.maxDrawdown ?? "15"),
      maxOpenPositions: config.rsiPeriod ?? 10,
      timeframe: config.timeframe ?? "15m",
      aggressiveness,
    });

    await engine.start();
    tradingEngines.set(userId, engine);

    console.log(`🤖 Bot auto-restarted for user ${userId} with config ${configId} (${aggressiveness})`);
  } catch (error) {
    console.error("⚠️ Failed to auto-restart bot:", error);
  }
}

// Initialize database and start server
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

    // Auto-restart bot after server is up (with small delay to ensure DB is ready)
    setTimeout(() => {
      autoRestartBot().catch((e) => console.error("Auto-restart error:", e));
    }, 3000);
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
