import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { getDatabase } from "./db";
import { createBinanceClient } from "./binance";
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

// Store active trading engines
const tradingEngines = new Map<string, TradingEngine>();

// ============================================================================
// Binance API Keys Router (using existing bybit_api_keys table)
// ============================================================================

const binanceKeysRouter = router({
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

      // Insert new Binance keys (reusing bybit_api_keys table)
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
      throw new Error("Chaves da API Binance não configuradas");
    }

    const apiKey = keys[0];
    const client = createBinanceClient({
      apiKey: apiKey.apiKey,
      apiSecret: apiKey.apiSecret,
      testnet: apiKey.testnet ?? false,
    });

    try {
      const balances = await client.getBalance();
      const usdtBalance = balances.find((b) => b.coin === "USDT");
      return {
        success: true,
        balance: usdtBalance?.walletBalance ?? "0",
        message: "Conexão com Binance Futures estabelecida com sucesso",
      };
    } catch (error: any) {
      throw new Error(`Falha na conexão: ${error?.message || String(error)}`);
    }
  }),
});

// ============================================================================
// Trading Configuration Router
// ============================================================================

const tradingConfigRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        tradingPairs: z.array(z.string()),
        maxPositionSize: z.number().min(0).max(100),
        maxDrawdown: z.number().min(0).max(100),
        stopLossPercent: z.number().min(0.1).max(50),
        takeProfitPercent: z.number().min(0.1).max(100),
        rsiPeriod: z.number().min(5).max(50),
        rsiOverbought: z.number().min(50).max(100),
        rsiOversold: z.number().min(0).max(50),
        macdFastPeriod: z.number().min(5).max(50),
        macdSlowPeriod: z.number().min(10).max(100),
        macdSignalPeriod: z.number().min(5).max(50),
        bbPeriod: z.number().min(5).max(100),
        bbStdDev: z.number().min(0.5).max(5),
        emaPeriod: z.number().min(5).max(200),
        minVolume: z.number().min(0),
        timeframe: z.enum(["1m", "5m", "15m", "30m", "1h", "4h", "1d"]),
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
        description: input.description,
        tradingPairs: input.tradingPairs,
        maxPositionSize: input.maxPositionSize.toString(),
        maxDrawdown: input.maxDrawdown.toString(),
        stopLossPercent: input.stopLossPercent.toString(),
        takeProfitPercent: input.takeProfitPercent.toString(),
        rsiPeriod: input.rsiPeriod,
        rsiOverbought: input.rsiOverbought,
        rsiOversold: input.rsiOversold,
        macdFastPeriod: input.macdFastPeriod,
        macdSlowPeriod: input.macdSlowPeriod,
        macdSignalPeriod: input.macdSignalPeriod,
        bbPeriod: input.bbPeriod,
        bbStdDev: input.bbStdDev.toString(),
        emaPeriod: input.emaPeriod,
        minVolume: input.minVolume.toString(),
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

    return configs.map((c: any) => ({
      ...c,
      tradingPairs: Array.isArray(c.tradingPairs)
        ? c.tradingPairs
        : typeof c.tradingPairs === "string"
        ? JSON.parse(c.tradingPairs)
        : [],
    }));
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
      return {
        ...c,
        tradingPairs: Array.isArray(c.tradingPairs)
          ? c.tradingPairs
          : typeof c.tradingPairs === "string"
          ? JSON.parse(c.tradingPairs)
          : [],
      };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        tradingPairs: z.array(z.string()).optional(),
        maxPositionSize: z.number().optional(),
        stopLossPercent: z.number().optional(),
        takeProfitPercent: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDatabase();
      const userId = ctx.user?.id || "local-owner";

      const updates: any = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.description !== undefined) updates.description = input.description;
      if (input.tradingPairs !== undefined) updates.tradingPairs = input.tradingPairs;
      if (input.maxPositionSize !== undefined) updates.maxPositionSize = input.maxPositionSize.toString();
      if (input.stopLossPercent !== undefined) updates.stopLossPercent = input.stopLossPercent.toString();
      if (input.takeProfitPercent !== undefined) updates.takeProfitPercent = input.takeProfitPercent.toString();

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
// Bot Control Router
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

      if (keys.length === 0) throw new Error("Chaves da API Binance não configuradas");

      const config = configs[0];
      const apiKey = keys[0];

      // Create Binance client
      const binanceClient = createBinanceClient({
        apiKey: apiKey.apiKey,
        apiSecret: apiKey.apiSecret,
        testnet: apiKey.testnet ?? false,
      });

      const tradingPairs = Array.isArray(config.tradingPairs)
        ? config.tradingPairs
        : typeof config.tradingPairs === "string"
        ? JSON.parse(config.tradingPairs)
        : ["BTCUSDT"];

      // Create and start trading engine
      const engine = new TradingEngine({
        userId,
        configId: input.configId,
        binanceClient,
        tradingPairs,
        maxPositionSize: parseFloat(config.maxPositionSize ?? "5"),
        maxDrawdown: parseFloat(config.maxDrawdown ?? "10"),
        stopLossPercent: parseFloat(config.stopLossPercent ?? "2"),
        takeProfitPercent: parseFloat(config.takeProfitPercent ?? "5"),
        rsiPeriod: config.rsiPeriod ?? 14,
        rsiOverbought: config.rsiOverbought ?? 70,
        rsiOversold: config.rsiOversold ?? 30,
        macdFastPeriod: config.macdFastPeriod ?? 12,
        macdSlowPeriod: config.macdSlowPeriod ?? 26,
        macdSignalPeriod: config.macdSignalPeriod ?? 9,
        bbPeriod: config.bbPeriod ?? 20,
        bbStdDev: parseFloat(config.bbStdDev ?? "2"),
        emaPeriod: config.emaPeriod ?? 50,
        minVolume: parseFloat(config.minVolume ?? "0"),
        timeframe: config.timeframe ?? "1h",
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
// Market Data Router (public Binance data, no auth required)
// ============================================================================

const marketDataRouter = router({
  getTicker: protectedProcedure
    .input(z.object({ symbol: z.string() }))
    .query(async ({ input }) => {
      const { USDMClient } = await import("binance");
      const client = new USDMClient();
      const ticker = await client.get24hrChangeStatistics({ symbol: input.symbol });
      const t = Array.isArray(ticker) ? ticker[0] : ticker;
      return {
        symbol: (t as any).symbol,
        lastPrice: (t as any).lastPrice,
        priceChangePercent: (t as any).priceChangePercent,
        volume: (t as any).volume,
        highPrice: (t as any).highPrice,
        lowPrice: (t as any).lowPrice,
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
      const { USDMClient } = await import("binance");
      const client = new USDMClient();
      const klines = await client.getKlines({
        symbol: input.symbol,
        interval: input.interval as any,
        limit: input.limit,
      });
      return (klines as any[]).map((k: any) => ({
        time: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
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
    const client = createBinanceClient({
      apiKey: apiKey.apiKey,
      apiSecret: apiKey.apiSecret,
      testnet: apiKey.testnet ?? false,
    });

    try {
      const account = await client.getAccountInfo();
      return {
        balance: account.totalWalletBalance,
        available: account.availableBalance,
        unrealizedPnl: account.totalUnrealizedProfit,
        marginBalance: account.totalMarginBalance,
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
    const client = createBinanceClient({
      apiKey: apiKey.apiKey,
      apiSecret: apiKey.apiSecret,
      testnet: apiKey.testnet ?? false,
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
// Main Router
// ============================================================================

export const appRouter = router({
  binanceKeys: binanceKeysRouter,
  // Keep bybitKeys as alias for backward compatibility with any existing frontend calls
  bybitKeys: binanceKeysRouter,
  tradingConfig: tradingConfigRouter,
  botControl: botControlRouter,
  marketData: marketDataRouter,
  trades: tradesRouter,
  logs: logsRouter,
});

export type AppRouter = typeof appRouter;
