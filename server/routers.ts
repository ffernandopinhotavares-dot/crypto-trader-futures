import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { getDatabase } from "./db";
import { createGateioClient, GateioClient } from "./gateio";
import { TradingEngine } from "./tradingEngine";
import {
  bybitApiKeys,
  tradingConfigs,
  trades,
  botStatus,
  tradingLogs,
} from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import GateApi from "gate-api";

// Shared trading engines map (avoid circular import with _core/index)
import { tradingEngines } from "./engineStore";

// ============================================================================
// Gate.io API Keys Router (using existing bybit_api_keys table for storage)
// ============================================================================

const gateioKeysRouter = router({
  saveKeys: protectedProcedure
    .input(
      z.object({
        apiKey: z.string().min(1),
        apiSecret: z.string().min(1),
        testnet: z.boolean().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDatabase();
      const userId = ctx.user?.id || "local-owner";

      // Delete existing keys for this user
      await db.delete(bybitApiKeys).where(eq(bybitApiKeys.userId, userId));

      // Insert new Gate.io keys (reusing bybit_api_keys table)
      await db.insert(bybitApiKeys).values({
        id: nanoid(),
        userId,
        apiKey: input.apiKey,
        apiSecret: input.apiSecret,
        testnet: input.testnet,
        isActive: true,
      });

      return { success: true };
    }),

  getKeys: protectedProcedure.query(async ({ ctx }) => {
    const db = getDatabase();
    const userId = ctx.user?.id || "local-owner";

    const keys = await db
      .select()
      .from(bybitApiKeys)
      .where(eq(bybitApiKeys.userId, userId))
      .limit(1);

    if (keys.length === 0) return null;

    const key = keys[0];
    return {
      id: key.id,
      apiKey: key.apiKey?.substring(0, 8) + "***",
      testnet: key.testnet,
      isActive: key.isActive,
    };
  }),

  deleteKeys: protectedProcedure.mutation(async ({ ctx }) => {
    const db = getDatabase();
    const userId = ctx.user?.id || "local-owner";
    await db.delete(bybitApiKeys).where(eq(bybitApiKeys.userId, userId));
    return { success: true };
  }),

  testConnection: protectedProcedure.mutation(async ({ ctx }) => {
    const db = getDatabase();
    const userId = ctx.user?.id || "local-owner";

    const keys = await db
      .select()
      .from(bybitApiKeys)
      .where(eq(bybitApiKeys.userId, userId))
      .limit(1);

    if (keys.length === 0) {
      throw new Error("Chaves da API Gate.io não configuradas");
    }

    const apiKey = keys[0];
    const client = createGateioClient({
      apiKey: apiKey.apiKey,
      apiSecret: apiKey.apiSecret,
    });

    try {
      const result = await client.testConnection();
      return result;
    } catch (error: any) {
      throw new Error(`Falha na conexão: ${error?.message || String(error)}`);
    }
  }),
});

// ============================================================================
// Trading Configuration Router — Autonomous AI Strategy
// ============================================================================

const tradingConfigRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        aggressiveness: z.enum(["conservative", "moderate", "aggressive"]).default("moderate"),
        maxRiskPerTrade: z.number().min(1).max(20).default(5),
        maxDrawdown: z.number().min(5).max(50).default(15),
        maxOpenPositions: z.number().min(1).max(30).default(10),
        timeframe: z.enum(["1m", "5m", "15m", "30m", "1h", "4h", "1d"]).default("15m"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDatabase();
      const userId = ctx.user?.id || "local-owner";

      const id = nanoid();
      await db.insert(tradingConfigs).values({
        id,
        userId,
        name: input.name,
        description: `${input.aggressiveness}|${input.description ?? "Estratégia AI Autônoma"}`,
        tradingPairs: ["AUTO"],
        maxPositionSize: input.maxRiskPerTrade.toString(),
        maxDrawdown: input.maxDrawdown.toString(),
        stopLossPercent: "0",
        takeProfitPercent: "0",
        rsiPeriod: input.maxOpenPositions,
        rsiOverbought: 70,
        rsiOversold: 30,
        macdFastPeriod: 12,
        macdSlowPeriod: 26,
        macdSignalPeriod: 9,
        bbPeriod: 20,
        bbStdDev: "2",
        emaPeriod: 50,
        minVolume: "0",
        timeframe: input.timeframe,
        isActive: false,
      });

      return { success: true, id };
    }),

  getAll: protectedProcedure.query(async ({ ctx }) => {
    const db = getDatabase();
    const userId = ctx.user?.id || "local-owner";

    const configs = await db
      .select()
      .from(tradingConfigs)
      .where(eq(tradingConfigs.userId, userId));

    return configs.map((c: any) => {
      const descParts = (c.description ?? "moderate|").split("|");
      const aggressiveness = ["conservative", "moderate", "aggressive"].includes(descParts[0]) ? descParts[0] : "moderate";
      const description = descParts.slice(1).join("|") || "Estratégia AI Autônoma";

      return {
        id: c.id,
        name: c.name,
        description,
        aggressiveness,
        maxRiskPerTrade: parseFloat(c.maxPositionSize ?? "5"),
        maxDrawdown: parseFloat(c.maxDrawdown ?? "15"),
        maxOpenPositions: c.rsiPeriod ?? 10,
        timeframe: c.timeframe ?? "15m",
        isActive: c.isActive,
        createdAt: c.createdAt,
      };
    });
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const db = getDatabase();
      const userId = ctx.user?.id || "local-owner";

      const configs = await db
        .select()
        .from(tradingConfigs)
        .where(and(eq(tradingConfigs.id, input.id), eq(tradingConfigs.userId, userId)))
        .limit(1);

      if (configs.length === 0) throw new Error("Configuração não encontrada");

      const c = configs[0];
      const descParts = (c.description ?? "moderate|").split("|");
      const aggressiveness = ["conservative", "moderate", "aggressive"].includes(descParts[0]) ? descParts[0] : "moderate";

      return {
        id: c.id,
        name: c.name,
        description: descParts.slice(1).join("|") || "Estratégia AI Autônoma",
        aggressiveness,
        maxRiskPerTrade: parseFloat(c.maxPositionSize ?? "5"),
        maxDrawdown: parseFloat(c.maxDrawdown ?? "15"),
        maxOpenPositions: c.rsiPeriod ?? 10,
        timeframe: c.timeframe ?? "15m",
        isActive: c.isActive,
      };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        aggressiveness: z.enum(["conservative", "moderate", "aggressive"]).optional(),
        maxRiskPerTrade: z.number().optional(),
        maxDrawdown: z.number().optional(),
        maxOpenPositions: z.number().optional(),
        timeframe: z.enum(["1m", "5m", "15m", "30m", "1h", "4h", "1d"]).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDatabase();
      const userId = ctx.user?.id || "local-owner";

      const updates: any = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.maxRiskPerTrade !== undefined) updates.maxPositionSize = input.maxRiskPerTrade.toString();
      if (input.maxDrawdown !== undefined) updates.maxDrawdown = input.maxDrawdown.toString();
      if (input.maxOpenPositions !== undefined) updates.rsiPeriod = input.maxOpenPositions;
      if (input.timeframe !== undefined) updates.timeframe = input.timeframe;

      if (input.aggressiveness !== undefined) {
        const existing = await db.select().from(tradingConfigs)
          .where(and(eq(tradingConfigs.id, input.id), eq(tradingConfigs.userId, userId)))
          .limit(1);
        if (existing.length > 0) {
          const descParts = (existing[0].description ?? "moderate|").split("|");
          updates.description = `${input.aggressiveness}|${descParts.slice(1).join("|") || "Estratégia AI Autônoma"}`;
        }
      }

      await db
        .update(tradingConfigs)
        .set(updates)
        .where(and(eq(tradingConfigs.id, input.id), eq(tradingConfigs.userId, userId)));

      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDatabase();
      const userId = ctx.user?.id || "local-owner";

      await db
        .delete(tradingConfigs)
        .where(and(eq(tradingConfigs.id, input.id), eq(tradingConfigs.userId, userId)));

      return { success: true };
    }),
});

// ============================================================================
// Bot Control Router — Autonomous AI (Gate.io)
// ============================================================================

const botControlRouter = router({
  start: protectedProcedure
    .input(z.object({ configId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDatabase();
      const userId = ctx.user?.id || "local-owner";

      // Get configuration
      const configs = await db
        .select()
        .from(tradingConfigs)
        .where(and(eq(tradingConfigs.id, input.configId), eq(tradingConfigs.userId, userId)))
        .limit(1);

      if (configs.length === 0) throw new Error("Configuração não encontrada");

      // Get API keys
      const keys = await db
        .select()
        .from(bybitApiKeys)
        .where(eq(bybitApiKeys.userId, userId))
        .limit(1);

      if (keys.length === 0) throw new Error("Chaves da API Gate.io não configuradas");

      const config = configs[0];
      const apiKey = keys[0];

      // Create Gate.io client
      const gateioClient = createGateioClient({
        apiKey: apiKey.apiKey,
        apiSecret: apiKey.apiSecret,
      });

      // Parse aggressiveness from description
      const descParts = (config.description ?? "moderate|").split("|");
      const aggressiveness = (["conservative", "moderate", "aggressive"].includes(descParts[0]) ? descParts[0] : "moderate") as "conservative" | "moderate" | "aggressive";

      // Create and start AI trading engine
      const engine = new TradingEngine({
        userId,
        configId: input.configId,
        gateioClient,
        maxRiskPerTrade: parseFloat(config.maxPositionSize ?? "5"),
        maxDrawdown: parseFloat(config.maxDrawdown ?? "15"),
        maxOpenPositions: config.rsiPeriod ?? 10,
        timeframe: config.timeframe ?? "15m",
        aggressiveness,
      });

      await engine.start();
      tradingEngines.set(userId, engine);

      return { success: true };
    }),

  stop: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.user?.id || "local-owner";

    const engine = tradingEngines.get(userId);
    if (!engine) throw new Error("Bot de trading não está em execução");

    await engine.stop();
    tradingEngines.delete(userId);

    return { success: true };
  }),

  emergencyCloseAll: protectedProcedure.mutation(async ({ ctx }) => {
    const db = getDatabase();
    const userId = ctx.user?.id || "local-owner";

    // Get API keys directly from DB
    const keys = await db.select().from(bybitApiKeys).where(eq(bybitApiKeys.userId, userId)).limit(1);
    if (keys.length === 0) throw new Error("Chaves da API não encontradas");

    const gateioClient = createGateioClient({
      apiKey: keys[0].apiKey,
      apiSecret: keys[0].apiSecret,
    });

    // [FIX 5.9] Get current prices BEFORE closing positions
    const openTrades = await db.select().from(trades)
      .where(and(eq(trades.userId, userId), eq(trades.status, "OPEN")));

    // Build a map of current prices for open trade symbols
    const priceMap: Record<string, number> = {};
    for (const t of openTrades) {
      if (!priceMap[t.symbol]) {
        try {
          const ticker = await gateioClient.getTicker(t.symbol);
          priceMap[t.symbol] = parseFloat(ticker.lastPrice);
        } catch {
          priceMap[t.symbol] = 0;
        }
      }
    }

    // Close all positions directly on the exchange
    const result = await gateioClient.closeAllPositions();

    // [FIX 5.9] Update OPEN trades with exitPrice and PnL
    for (const t of openTrades) {
      try {
        const exitPrice = priceMap[t.symbol] || 0;
        const entryPrice = parseFloat(t.entryPrice || "0");
        const quantity = parseFloat(t.quantity || "0");
        // Read quantoMultiplier from stopLoss field (where we store it)
        const quantoMultiplier = parseFloat(t.stopLoss || "0") > 0 ? parseFloat(t.stopLoss!) : 1;

        let pnl = 0;
        let pnlPercent = 0;
        if (exitPrice > 0 && entryPrice > 0) {
          pnl = t.side === "BUY"
            ? (exitPrice - entryPrice) * quantity * quantoMultiplier
            : (entryPrice - exitPrice) * quantity * quantoMultiplier;
          pnlPercent = t.side === "BUY"
            ? ((exitPrice - entryPrice) / entryPrice) * 100
            : ((entryPrice - exitPrice) / entryPrice) * 100;
        }

        await db.update(trades).set({
          status: "CLOSED",
          exitPrice: exitPrice > 0 ? exitPrice.toString() : null,
          exitTime: new Date(),
          exitReason: "EMERGENCY_CLOSE",
          pnl: pnl.toString(),
          pnlPercent: Math.max(-999.99, Math.min(999.99, pnlPercent)).toFixed(2),
        }).where(eq(trades.id, t.id));
      } catch (e) { /* ignore */ }
    }

    // Stop engine if running
    const engine = tradingEngines.get(userId);
    if (engine) {
      engine.stop();
      tradingEngines.delete(userId);
    }

    return { closed: result.closed, errors: result.errors };
  }),

  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const db = getDatabase();
    const userId = ctx.user?.id || "local-owner";

    const status = await db
      .select()
      .from(botStatus)
      .where(eq(botStatus.userId, userId))
      .limit(1);

    const engineRunning = tradingEngines.has(userId);

    if (status.length === 0) {
      return { isRunning: engineRunning, isPaused: false };
    }

    return { ...status[0], isRunning: engineRunning || status[0].isRunning };
  }),
});

// ============================================================================
// Market Data Router (public Gate.io data, no auth required)
// ============================================================================

const marketDataRouter = router({
  getTicker: protectedProcedure
    .input(z.object({ symbol: z.string() }))
    .query(async ({ input }) => {
      const client = new GateApi.FuturesApi();
      const result = await client.listFuturesTickers("usdt", { contract: input.symbol });
      const tickers = result.body;
      if (!tickers || tickers.length === 0) throw new Error("Ticker not found");
      const t = tickers[0] as any;
      return {
        symbol: t.contract || input.symbol,
        lastPrice: t.last || "0",
        priceChangePercent: t.change_percentage || "0",
        volume: t.volume_24h_quote || "0",
        highPrice: t.high_24h || "0",
        lowPrice: t.low_24h || "0",
      };
    }),

  getKlines: protectedProcedure
    .input(
      z.object({
        symbol: z.string(),
        interval: z.string().default("1h"),
        limit: z.number().default(100),
      })
    )
    .query(async ({ input }) => {
      const client = new GateApi.FuturesApi();
      const result = await client.listFuturesCandlesticks("usdt", input.symbol, {
        interval: input.interval as any,
        limit: input.limit,
      });
      return (result.body as any[]).map((c: any) => ({
        time: c.t ? c.t * 1000 : 0,
        open: parseFloat(c.o || "0"),
        high: parseFloat(c.h || "0"),
        low: parseFloat(c.l || "0"),
        close: parseFloat(c.c || "0"),
        volume: parseFloat(c.v || "0"),
      }));
    }),

  getBalance: protectedProcedure.query(async ({ ctx }) => {
    const db = getDatabase();
    const userId = ctx.user?.id || "local-owner";

    const keys = await db
      .select()
      .from(bybitApiKeys)
      .where(eq(bybitApiKeys.userId, userId))
      .limit(1);

    if (keys.length === 0) {
      return { balance: "0", available: "0", unrealizedPnl: "0" };
    }

    const apiKey = keys[0];
    const client = createGateioClient({
      apiKey: apiKey.apiKey,
      apiSecret: apiKey.apiSecret,
    });

    try {
      const balance = await client.getBalance();
      return {
        balance: balance.totalBalance,
        available: balance.availableBalance,
        unrealizedPnl: balance.unrealizedPnl,
        marginBalance: balance.marginBalance,
      };
    } catch (error: any) {
      console.error("Error fetching balance:", error?.message || error);
      return { balance: "0", available: "0", unrealizedPnl: "0" };
    }
  }),

  getPositions: protectedProcedure.query(async ({ ctx }) => {
    const db = getDatabase();
    const userId = ctx.user?.id || "local-owner";

    const keys = await db
      .select()
      .from(bybitApiKeys)
      .where(eq(bybitApiKeys.userId, userId))
      .limit(1);

    if (keys.length === 0) return [];

    const apiKey = keys[0];
    const client = createGateioClient({
      apiKey: apiKey.apiKey,
      apiSecret: apiKey.apiSecret,
    });

    try {
      return await client.getPositions();
    } catch (error: any) {
      console.error("Error fetching positions:", error?.message || error);
      return [];
    }
  }),
});

// ============================================================================
// Trades Router
// ============================================================================

const tradesRouter = router({
  getRecent: protectedProcedure
    .input(z.object({ limit: z.number().default(50) }))
    .query(async ({ input, ctx }) => {
      const db = getDatabase();
      const userId = ctx.user?.id || "local-owner";

      return await db
        .select()
        .from(trades)
        .where(eq(trades.userId, userId))
        .orderBy(desc(trades.createdAt))
        .limit(input.limit);
    }),

  getBySymbol: protectedProcedure
    .input(z.object({ symbol: z.string(), limit: z.number().default(50) }))
    .query(async ({ input, ctx }) => {
      const db = getDatabase();
      const userId = ctx.user?.id || "local-owner";

      return await db
        .select()
        .from(trades)
        .where(and(eq(trades.userId, userId), eq(trades.symbol, input.symbol)))
        .orderBy(desc(trades.createdAt))
        .limit(input.limit);
    }),

  getStats: protectedProcedure.query(async ({ ctx }) => {
    const db = getDatabase();
    const userId = ctx.user?.id || "local-owner";

    const tradeList = await db.select().from(trades).where(eq(trades.userId, userId));

    const closedTrades = tradeList.filter((t: any) => t.status === "CLOSED");
    const winningTrades = closedTrades.filter((t: any) => parseFloat(t.pnl || "0") > 0);
    const losingTrades = closedTrades.filter((t: any) => parseFloat(t.pnl || "0") < 0);
    const totalPnl = closedTrades.reduce((sum: number, t: any) => sum + parseFloat(t.pnl || "0"), 0);

    return {
      totalTrades: tradeList.length,
      openTrades: tradeList.filter((t: any) => t.status === "OPEN").length,
      closedTrades: closedTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0,
      totalPnl,
      avgPnl: closedTrades.length > 0 ? totalPnl / closedTrades.length : 0,
    };
  }),
});

// ============================================================================
// Logs Router
// ============================================================================

const logsRouter = router({
  getRecent: protectedProcedure
    .input(z.object({ limit: z.number().default(100) }))
    .query(async ({ input, ctx }) => {
      const db = getDatabase();
      const userId = ctx.user?.id || "local-owner";

      return await db
        .select()
        .from(tradingLogs)
        .where(eq(tradingLogs.userId, userId))
        .orderBy(desc(tradingLogs.createdAt))
        .limit(input.limit);
    }),
});

// ============================================================================
// Maintenance Router — Fix historical data issues
// ============================================================================

const maintenanceRouter = router({
  /**
   * Recalculate PnL for all closed trades that have incorrect or missing PnL values.
   * This fixes the historical bug where quantoMultiplier was calculated as 1/entryPrice.
   * It fetches the correct quantoMultiplier from Gate.io for each symbol and recalculates.
   */
  fixHistoricalPnl: protectedProcedure.mutation(async ({ ctx }) => {
    const db = getDatabase();
    const userId = ctx.user?.id || "local-owner";

    // Get all closed trades for this user
    const closedTrades = await db.select().from(trades)
      .where(and(eq(trades.userId, userId), eq(trades.status, "CLOSED")));

    // Create a public Gate.io client for contract info
    const publicClient = createGateioClient({ apiKey: "", apiSecret: "" });

    // Cache quantoMultiplier per symbol
    const qmCache: Record<string, number> = {};

    let fixed = 0;
    let skipped = 0;
    let errors = 0;
    const details: Array<{ id: string; symbol: string; oldPnl: string; newPnl: string; reason: string }> = [];

    for (const t of closedTrades) {
      try {
        // Skip trades without exit price (truly unknown)
        if (!t.exitPrice || parseFloat(t.exitPrice) === 0) {
          skipped++;
          continue;
        }

        const entryPrice = parseFloat(t.entryPrice || "0");
        const exitPrice = parseFloat(t.exitPrice || "0");
        const quantity = parseFloat(t.quantity || "0");

        if (entryPrice <= 0 || exitPrice <= 0 || quantity <= 0) {
          skipped++;
          continue;
        }

        // Get quantoMultiplier (from cache or API)
        if (!qmCache[t.symbol]) {
          try {
            const contractInfo = await publicClient.getContractInfo(t.symbol);
            qmCache[t.symbol] = parseFloat(
              contractInfo.quantoMultiplier || contractInfo.quanto_multiplier || "1"
            );
            // Rate limiting delay
            await new Promise(r => setTimeout(r, 150));
          } catch {
            qmCache[t.symbol] = 1; // safe default
          }
        }

        const qm = qmCache[t.symbol];

        // Recalculate PnL
        const correctPnl = t.side === "BUY"
          ? (exitPrice - entryPrice) * quantity * qm
          : (entryPrice - exitPrice) * quantity * qm;
        const correctPnlPercent = t.side === "BUY"
          ? ((exitPrice - entryPrice) / entryPrice) * 100
          : ((entryPrice - exitPrice) / entryPrice) * 100;

        const oldPnl = parseFloat(t.pnl || "0");

        // Check if PnL needs fixing (more than 10% difference or null)
        const needsFix = !t.pnl
          || Math.abs(oldPnl) === 0
          || (correctPnl !== 0 && Math.abs((oldPnl - correctPnl) / correctPnl) > 0.1);

        if (needsFix) {
          await db.update(trades).set({
            pnl: correctPnl.toFixed(8),
            pnlPercent: Math.max(-999.99, Math.min(999.99, correctPnlPercent)).toFixed(2),
            stopLoss: qm.toString(), // Store correct QM for future reference
          }).where(eq(trades.id, t.id));

          details.push({
            id: t.id,
            symbol: t.symbol,
            oldPnl: (t.pnl || "null"),
            newPnl: correctPnl.toFixed(8),
            reason: `QM=${qm}, entry=${entryPrice}, exit=${exitPrice}, qty=${quantity}`,
          });
          fixed++;
        } else {
          skipped++;
        }
      } catch (e) {
        errors++;
      }
    }

    // Recalculate bot_status counters from corrected trade data
    try {
      const allTrades = await db.select().from(trades)
        .where(and(eq(trades.userId, userId), eq(trades.status, "CLOSED")));

      const totalTrades = allTrades.length;
      const winningTrades = allTrades.filter(t => parseFloat(t.pnl || "0") > 0).length;
      const losingTrades = allTrades.filter(t => parseFloat(t.pnl || "0") <= 0).length;
      const totalPnl = allTrades.reduce((sum, t) => sum + parseFloat(t.pnl || "0"), 0);

      await db.update(botStatus).set({
        totalTrades,
        winningTrades,
        losingTrades,
        totalPnl: totalPnl.toFixed(8),
      }).where(eq(botStatus.userId, userId));
    } catch (e) {
      console.error("Error recalculating bot stats:", e);
    }

    return {
      totalProcessed: closedTrades.length,
      fixed,
      skipped,
      errors,
      details: details.slice(0, 50), // limit response size
    };
  }),

  /**
   * Reset bot statistics (totalTrades, winningTrades, losingTrades, totalPnl)
   * by recalculating from actual trade records in the database.
   */
  recalculateStats: protectedProcedure.mutation(async ({ ctx }) => {
    const db = getDatabase();
    const userId = ctx.user?.id || "local-owner";

    const allTrades = await db.select().from(trades)
      .where(and(eq(trades.userId, userId), eq(trades.status, "CLOSED")));

    const totalTrades = allTrades.length;
    const winningTrades = allTrades.filter(t => parseFloat(t.pnl || "0") > 0).length;
    const losingTrades = allTrades.filter(t => parseFloat(t.pnl || "0") <= 0).length;
    const totalPnl = allTrades.reduce((sum, t) => sum + parseFloat(t.pnl || "0"), 0);

    await db.update(botStatus).set({
      totalTrades,
      winningTrades,
      losingTrades,
      totalPnl: totalPnl.toFixed(8),
    }).where(eq(botStatus.userId, userId));

    return {
      totalTrades,
      winningTrades,
      losingTrades,
      totalPnl: parseFloat(totalPnl.toFixed(8)),
      winRate: totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0,
    };
  }),
});

// ============================================================================
// Main Router
// ============================================================================

export const appRouter = router({
  gateioKeys: gateioKeysRouter,
  // Backward compatibility aliases
  binanceKeys: gateioKeysRouter,
  bybitKeys: gateioKeysRouter,
  tradingConfig: tradingConfigRouter,
  botControl: botControlRouter,
  marketData: marketDataRouter,
  trades: tradesRouter,
  logs: logsRouter,
  maintenance: maintenanceRouter,
});

export type AppRouter = typeof appRouter;
