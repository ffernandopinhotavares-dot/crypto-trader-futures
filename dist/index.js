var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/_core/index.ts
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// server/db.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// drizzle/schema.ts
var schema_exports = {};
__export(schema_exports, {
  botStatus: () => botStatus,
  botStatusRelations: () => botStatusRelations,
  bybitApiKeys: () => bybitApiKeys,
  bybitApiKeysRelations: () => bybitApiKeysRelations,
  candles: () => candles,
  indicators: () => indicators,
  logTypeEnum: () => logTypeEnum,
  sideEnum: () => sideEnum,
  timeframeEnum: () => timeframeEnum,
  tradeStatusEnum: () => tradeStatusEnum,
  trades: () => trades,
  tradesRelations: () => tradesRelations,
  tradingConfigs: () => tradingConfigs,
  tradingConfigsRelations: () => tradingConfigsRelations,
  tradingLogs: () => tradingLogs,
  tradingLogsRelations: () => tradingLogsRelations,
  tradingPairs: () => tradingPairs,
  users: () => users,
  usersRelations: () => usersRelations
});
import {
  pgTable,
  pgEnum,
  varchar,
  text,
  numeric,
  integer,
  bigint,
  timestamp,
  boolean,
  index,
  jsonb
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
var timeframeEnum = pgEnum("timeframe", ["1m", "5m", "15m", "30m", "1h", "4h", "1d"]);
var sideEnum = pgEnum("side", ["BUY", "SELL"]);
var tradeStatusEnum = pgEnum("trade_status", ["OPEN", "CLOSED", "CANCELLED"]);
var logTypeEnum = pgEnum("log_type", [
  "BOT_START",
  "BOT_STOP",
  "SIGNAL_GENERATED",
  "ORDER_PLACED",
  "ORDER_FILLED",
  "ORDER_CANCELLED",
  "POSITION_OPENED",
  "POSITION_CLOSED",
  "ERROR",
  "INFO"
]);
var users = pgTable(
  "users",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    email: varchar("email", { length: 255 }).unique(),
    username: varchar("username", { length: 255 }).unique(),
    passwordHash: text("password_hash"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow()
  },
  (table) => [index("email_idx").on(table.email)]
);
var bybitApiKeys = pgTable(
  "bybit_api_keys",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    apiKey: text("api_key").notNull(),
    apiSecret: text("api_secret").notNull(),
    isActive: boolean("is_active").default(true),
    testnet: boolean("testnet").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow()
  },
  (table) => [index("user_id_idx").on(table.userId)]
);
var tradingConfigs = pgTable(
  "trading_configs",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    isActive: boolean("is_active").default(false),
    // Trading pairs
    tradingPairs: jsonb("trading_pairs").$type().default([]),
    // Risk management
    maxPositionSize: numeric("max_position_size", { precision: 20, scale: 8 }).default("0"),
    maxDrawdown: numeric("max_drawdown", { precision: 5, scale: 2 }).default("10"),
    stopLossPercent: numeric("stop_loss_percent", { precision: 5, scale: 2 }).default("2"),
    takeProfitPercent: numeric("take_profit_percent", { precision: 5, scale: 2 }).default("5"),
    // Strategy parameters
    rsiPeriod: integer("rsi_period").default(14),
    rsiOverbought: integer("rsi_overbought").default(70),
    rsiOversold: integer("rsi_oversold").default(30),
    macdFastPeriod: integer("macd_fast_period").default(12),
    macdSlowPeriod: integer("macd_slow_period").default(26),
    macdSignalPeriod: integer("macd_signal_period").default(9),
    bbPeriod: integer("bb_period").default(20),
    bbStdDev: numeric("bb_std_dev", { precision: 3, scale: 1 }).default("2"),
    emaPeriod: integer("ema_period").default(50),
    // Volume settings
    minVolume: numeric("min_volume", { precision: 20, scale: 8 }).default("0"),
    // Timeframe
    timeframe: timeframeEnum("timeframe").default("1h"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow()
  },
  (table) => [index("config_user_id_idx").on(table.userId)]
);
var tradingPairs = pgTable(
  "trading_pairs",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    symbol: varchar("symbol", { length: 50 }).notNull().unique(),
    baseCoin: varchar("base_coin", { length: 50 }).notNull(),
    quoteCoin: varchar("quote_coin", { length: 50 }).notNull(),
    minOrderQty: numeric("min_order_qty", { precision: 20, scale: 8 }).notNull(),
    maxOrderQty: numeric("max_order_qty", { precision: 20, scale: 8 }).notNull(),
    minOrderAmt: numeric("min_order_amt", { precision: 20, scale: 8 }).notNull(),
    maxOrderAmt: numeric("max_order_amt", { precision: 20, scale: 8 }).notNull(),
    priceScale: integer("price_scale").notNull(),
    qtyScale: integer("qty_scale").notNull(),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow()
  },
  (table) => [index("symbol_idx").on(table.symbol)]
);
var trades = pgTable(
  "trades",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    configId: varchar("config_id", { length: 255 }).notNull(),
    symbol: varchar("symbol", { length: 50 }).notNull(),
    // Trade details
    side: sideEnum("side").notNull(),
    entryPrice: numeric("entry_price", { precision: 20, scale: 8 }).notNull(),
    quantity: numeric("quantity", { precision: 20, scale: 8 }).notNull(),
    entryTime: timestamp("entry_time").notNull(),
    // Exit details
    exitPrice: numeric("exit_price", { precision: 20, scale: 8 }),
    exitTime: timestamp("exit_time"),
    exitReason: varchar("exit_reason", { length: 50 }),
    // P&L
    pnl: numeric("pnl", { precision: 20, scale: 8 }),
    pnlPercent: numeric("pnl_percent", { precision: 5, scale: 2 }),
    // Risk management
    stopLoss: numeric("stop_loss", { precision: 20, scale: 8 }),
    takeProfit: numeric("take_profit", { precision: 20, scale: 8 }),
    // Status
    status: tradeStatusEnum("status").default("OPEN"),
    // Indicators at entry
    rsiAtEntry: numeric("rsi_at_entry", { precision: 5, scale: 2 }),
    macdAtEntry: jsonb("macd_at_entry"),
    bbAtEntry: jsonb("bb_at_entry"),
    // Bybit order IDs
    bybitOrderId: varchar("bybit_order_id", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow()
  },
  (table) => [
    index("trade_user_id_idx").on(table.userId),
    index("trade_config_id_idx").on(table.configId),
    index("trade_symbol_idx").on(table.symbol),
    index("trade_status_idx").on(table.status)
  ]
);
var candles = pgTable(
  "candles",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    symbol: varchar("symbol", { length: 50 }).notNull(),
    timeframe: varchar("timeframe", { length: 10 }).notNull(),
    timestamp: bigint("timestamp", { mode: "number" }).notNull(),
    open: numeric("open", { precision: 20, scale: 8 }).notNull(),
    high: numeric("high", { precision: 20, scale: 8 }).notNull(),
    low: numeric("low", { precision: 20, scale: 8 }).notNull(),
    close: numeric("close", { precision: 20, scale: 8 }).notNull(),
    volume: numeric("volume", { precision: 20, scale: 8 }).notNull(),
    quoteAssetVolume: numeric("quote_asset_volume", { precision: 20, scale: 8 }),
    createdAt: timestamp("created_at").defaultNow()
  },
  (table) => [
    index("symbol_timeframe_idx").on(table.symbol, table.timeframe),
    index("timestamp_idx").on(table.timestamp)
  ]
);
var indicators = pgTable(
  "indicators",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    symbol: varchar("symbol", { length: 50 }).notNull(),
    timeframe: varchar("timeframe", { length: 10 }).notNull(),
    timestamp: bigint("timestamp", { mode: "number" }).notNull(),
    // RSI
    rsi: numeric("rsi", { precision: 5, scale: 2 }),
    // MACD
    macdLine: numeric("macd_line", { precision: 20, scale: 8 }),
    signalLine: numeric("signal_line", { precision: 20, scale: 8 }),
    histogram: numeric("histogram", { precision: 20, scale: 8 }),
    // Bollinger Bands
    bbUpper: numeric("bb_upper", { precision: 20, scale: 8 }),
    bbMiddle: numeric("bb_middle", { precision: 20, scale: 8 }),
    bbLower: numeric("bb_lower", { precision: 20, scale: 8 }),
    // EMA
    ema: numeric("ema", { precision: 20, scale: 8 }),
    // Volume
    volumeMA: numeric("volume_ma", { precision: 20, scale: 8 }),
    createdAt: timestamp("created_at").defaultNow()
  },
  (table) => [
    index("ind_symbol_timeframe_idx").on(table.symbol, table.timeframe),
    index("ind_timestamp_idx").on(table.timestamp)
  ]
);
var tradingLogs = pgTable(
  "trading_logs",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    configId: varchar("config_id", { length: 255 }).notNull(),
    symbol: varchar("symbol", { length: 50 }).notNull(),
    logType: logTypeEnum("log_type").notNull(),
    message: text("message").notNull(),
    details: jsonb("details"),
    createdAt: timestamp("created_at").defaultNow()
  },
  (table) => [
    index("log_user_id_idx").on(table.userId),
    index("log_config_id_idx").on(table.configId),
    index("log_type_idx").on(table.logType)
  ]
);
var botStatus = pgTable(
  "bot_status",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    userId: varchar("user_id", { length: 255 }).notNull().unique(),
    configId: varchar("config_id", { length: 255 }).notNull(),
    isRunning: boolean("is_running").default(false),
    isPaused: boolean("is_paused").default(false),
    totalTrades: integer("total_trades").default(0),
    winningTrades: integer("winning_trades").default(0),
    losingTrades: integer("losing_trades").default(0),
    totalPnl: numeric("total_pnl", { precision: 20, scale: 8 }).default("0"),
    startedAt: timestamp("started_at"),
    stoppedAt: timestamp("stopped_at"),
    lastHeartbeat: timestamp("last_heartbeat"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow()
  },
  (table) => [index("status_user_id_idx").on(table.userId)]
);
var usersRelations = relations(users, ({ many }) => ({
  apiKeys: many(bybitApiKeys),
  tradingConfigs: many(tradingConfigs),
  trades: many(trades),
  logs: many(tradingLogs),
  botStatus: many(botStatus)
}));
var bybitApiKeysRelations = relations(bybitApiKeys, ({ one }) => ({
  user: one(users, {
    fields: [bybitApiKeys.userId],
    references: [users.id]
  })
}));
var tradingConfigsRelations = relations(tradingConfigs, ({ one, many }) => ({
  user: one(users, {
    fields: [tradingConfigs.userId],
    references: [users.id]
  }),
  trades: many(trades),
  logs: many(tradingLogs),
  botStatus: many(botStatus)
}));
var tradesRelations = relations(trades, ({ one }) => ({
  user: one(users, {
    fields: [trades.userId],
    references: [users.id]
  }),
  config: one(tradingConfigs, {
    fields: [trades.configId],
    references: [tradingConfigs.id]
  })
}));
var tradingLogsRelations = relations(tradingLogs, ({ one }) => ({
  user: one(users, {
    fields: [tradingLogs.userId],
    references: [users.id]
  }),
  config: one(tradingConfigs, {
    fields: [tradingLogs.configId],
    references: [tradingConfigs.id]
  })
}));
var botStatusRelations = relations(botStatus, ({ one }) => ({
  user: one(users, {
    fields: [botStatus.userId],
    references: [users.id]
  }),
  config: one(tradingConfigs, {
    fields: [botStatus.configId],
    references: [tradingConfigs.id]
  })
}));

// server/db.ts
var db;
var client;
async function initializeDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  const isInternalFlyDb = databaseUrl.includes(".internal") || databaseUrl.includes(".flycast");
  const sslConfig = isInternalFlyDb ? false : process.env.NODE_ENV === "production" ? "require" : void 0;
  client = postgres(databaseUrl, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 30,
    ssl: sslConfig
  });
  db = drizzle(client, { schema: schema_exports });
  await client`SELECT 1`;
  console.log("\u2705 Database connected successfully");
  return db;
}
function getDatabase() {
  if (!db) {
    return new Proxy({}, {
      get(target, prop) {
        if (db) return db[prop];
        throw new Error("Database not initialized. Call initializeDatabase() first.");
      }
    });
  }
  return db;
}

// server/_core/trpc.ts
import { initTRPC } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var protectedProcedure = t.procedure;

// server/routers.ts
import { z } from "zod";

// server/gateio.ts
import GateApi from "gate-api";
var GateioClient = class _GateioClient {
  futuresApi;
  settle = "usdt";
  isDualMode = null;
  // cached after first check
  constructor(config) {
    const client2 = new GateApi.ApiClient();
    client2.setApiKeySecret(config.apiKey, config.apiSecret);
    this.futuresApi = new GateApi.FuturesApi(client2);
  }
  // ========== Dual Mode Detection ==========
  async checkDualMode() {
    if (this.isDualMode !== null) return this.isDualMode;
    try {
      const positions = await this.futuresApi.listPositions(this.settle, { holding: true });
      const body = positions.body;
      this.isDualMode = body.some((p) => p.mode === "dual_long" || p.mode === "dual_short");
      if (!this.isDualMode && body.length === 0) {
        try {
          await this.futuresApi.getDualModePosition(this.settle, "BTC_USDT");
          this.isDualMode = true;
        } catch {
          this.isDualMode = false;
        }
      }
    } catch {
      this.isDualMode = false;
    }
    console.log(`[GATEIO] Dual mode detected: ${this.isDualMode}`);
    return this.isDualMode;
  }
  // ========== Public Methods (no auth needed) ==========
  static createPublicClient() {
    return new _GateioClient({ apiKey: "", apiSecret: "" });
  }
  async getTopPairs(limit = 20) {
    const result = await this.futuresApi.listFuturesTickers(this.settle);
    const tickers = result.body;
    const sorted = tickers.filter((t2) => t2.volume24hQuote && parseFloat(t2.volume24hQuote) > 0).sort((a, b) => parseFloat(b.volume24hQuote || "0") - parseFloat(a.volume24hQuote || "0")).slice(0, limit);
    return sorted.map((t2) => ({
      symbol: t2.contract || "",
      lastPrice: t2.last || "0",
      priceChangePercent: t2.changePercentage || "0",
      volume24h: t2.volume24hQuote || "0",
      highPrice: t2.high24h || "0",
      lowPrice: t2.low24h || "0",
      fundingRate: t2.fundingRate || "0"
    }));
  }
  async getTicker(symbol) {
    const result = await this.futuresApi.listFuturesTickers(this.settle, {
      contract: symbol
    });
    const tickers = result.body;
    if (!tickers || tickers.length === 0) {
      throw new Error(`Ticker not found for ${symbol}`);
    }
    const t2 = tickers[0];
    return {
      symbol: t2.contract || symbol,
      lastPrice: t2.last || "0",
      priceChangePercent: t2.changePercentage || "0",
      volume24h: t2.volume24hQuote || "0",
      highPrice: t2.high24h || "0",
      lowPrice: t2.low24h || "0",
      fundingRate: t2.fundingRate || "0"
    };
  }
  async getCandles(symbol, interval = "15m", limit = 100) {
    const result = await this.futuresApi.listFuturesCandlesticks(
      this.settle,
      symbol,
      { interval, limit }
    );
    const candles2 = result.body;
    return candles2.map((c) => ({
      time: c.t ? c.t * 1e3 : 0,
      open: parseFloat(c.o || "0"),
      high: parseFloat(c.h || "0"),
      low: parseFloat(c.l || "0"),
      close: parseFloat(c.c || "0"),
      volume: parseFloat(c.v || "0")
    }));
  }
  async getContractInfo(symbol) {
    const result = await this.futuresApi.getFuturesContract(this.settle, symbol);
    return result.body;
  }
  // ========== Private Methods (auth required) ==========
  async getBalance() {
    const result = await this.futuresApi.listFuturesAccounts(this.settle);
    const account = result.body;
    const total = parseFloat(account.total || "0");
    const unrealizedPnl = parseFloat(account.unrealisedPnl || account.unrealised_pnl || "0");
    return {
      totalBalance: account.total || "0",
      availableBalance: account.available || "0",
      unrealizedPnl: String(unrealizedPnl),
      marginBalance: String(total + unrealizedPnl)
    };
  }
  async getPositions() {
    const result = await this.futuresApi.listPositions(this.settle, {
      holding: true
    });
    const positions = result.body;
    return positions.map((p) => {
      const mode = p.mode || "single";
      let side;
      if (mode === "dual_long") {
        side = "LONG";
      } else if (mode === "dual_short") {
        side = "SHORT";
      } else {
        side = p.size > 0 ? "LONG" : "SHORT";
      }
      return {
        symbol: p.contract || "",
        side,
        size: String(Math.abs(p.size || 0)),
        entryPrice: p.entryPrice || p.entry_price || "0",
        markPrice: p.markPrice || p.mark_price || "0",
        unrealizedPnl: p.unrealisedPnl || p.unrealised_pnl || "0",
        leverage: p.leverage || p.crossLeverageLimit || "0",
        marginMode: mode
      };
    });
  }
  async setLeverage(symbol, leverage) {
    const dual = await this.checkDualMode();
    try {
      if (dual) {
        await this.futuresApi.updateDualModePositionLeverage(
          this.settle,
          symbol,
          String(leverage),
          { crossLeverageLimit: String(leverage) }
        );
      } else {
        await this.futuresApi.updatePositionLeverage(
          this.settle,
          symbol,
          String(leverage),
          { crossLeverageLimit: String(leverage) }
        );
      }
    } catch (e) {
      console.log(`[GATEIO] Leverage set note for ${symbol}: ${e?.message || String(e)}`);
    }
  }
  async placeOrder(params) {
    const sizeValue = params.side === "BUY" ? Math.abs(params.size) : -Math.abs(params.size);
    const order = {
      contract: params.symbol,
      size: sizeValue,
      price: params.price ? String(params.price) : "0",
      // 0 = market order
      tif: params.price ? "gtc" : "ioc"
      // ioc for market, gtc for limit
    };
    if (params.autoSize) {
      order.size = 0;
      order.autoSize = params.autoSize;
    } else if (params.reduceOnly) {
      order.reduceOnly = true;
    }
    const result = await this.futuresApi.createFuturesOrder(this.settle, order);
    const o = result.body;
    return {
      orderId: String(o.id || ""),
      symbol: o.contract || params.symbol,
      side: params.side,
      size: Math.abs(o.size || params.size),
      price: o.fillPrice || o.fill_price || o.price || "0",
      status: o.status || "unknown"
    };
  }
  async closePosition(symbol, positionSide) {
    const dual = await this.checkDualMode();
    const positions = await this.getPositions();
    if (dual) {
      const pos = positions.find((p) => p.symbol === symbol && (!positionSide || p.side === positionSide));
      if (!pos || parseFloat(pos.size) === 0) return null;
      const autoSize = pos.side === "LONG" ? "close_long" : "close_short";
      const closeSide = pos.side === "LONG" ? "SELL" : "BUY";
      console.log(`[GATEIO] Closing dual ${pos.side} position ${symbol}: autoSize=${autoSize}`);
      return await this.placeOrder({
        symbol,
        side: closeSide,
        size: 0,
        // auto_size will determine
        autoSize
      });
    } else {
      const pos = positions.find((p) => p.symbol === symbol);
      if (!pos || parseFloat(pos.size) === 0) return null;
      const closeSide = pos.side === "LONG" ? "SELL" : "BUY";
      return await this.placeOrder({
        symbol,
        side: closeSide,
        size: Math.abs(parseFloat(pos.size)),
        reduceOnly: true
      });
    }
  }
  async closeAllPositions() {
    const positions = await this.getPositions();
    const closed = [];
    const errors = [];
    for (const pos of positions) {
      if (parseFloat(pos.size) > 0) {
        try {
          await this.closePosition(pos.symbol, pos.side);
          closed.push(`${pos.symbol} ${pos.side}`);
          console.log(`[GATEIO] Closed ${pos.symbol} ${pos.side} (${pos.size} contracts)`);
        } catch (err) {
          const msg = `${pos.symbol} ${pos.side}: ${err?.message || String(err)}`;
          errors.push(msg);
          console.error(`[GATEIO] Error closing ${msg}`);
        }
      }
    }
    return { closed, errors };
  }
  async testConnection() {
    try {
      const balance = await this.getBalance();
      const dual = await this.checkDualMode();
      return {
        success: true,
        balance: balance.totalBalance,
        message: `Conex\xE3o com Gate.io Futures estabelecida com sucesso (modo: ${dual ? "dual/hedge" : "single"})`
      };
    } catch (error) {
      throw new Error(`Falha na conex\xE3o: ${error?.message || String(error)}`);
    }
  }
};
function createGateioClient(config) {
  return new GateioClient(config);
}

// server/indicators.ts
function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) {
    throw new Error(
      `Not enough data for RSI calculation. Need at least ${period + 1} prices.`
    );
  }
  const changes = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }
  let gains = 0;
  let losses = 0;
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) {
      gains += changes[i];
    } else {
      losses += Math.abs(changes[i]);
    }
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period; i < changes.length; i++) {
    if (changes[i] > 0) {
      avgGain = (avgGain * (period - 1) + changes[i]) / period;
      avgLoss = avgLoss * (period - 1) / period;
    } else {
      avgGain = avgGain * (period - 1) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(changes[i])) / period;
    }
  }
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);
  return {
    rsi: Math.round(rsi * 100) / 100,
    overbought: rsi > 70,
    oversold: rsi < 30
  };
}
function calculateEMA(prices, period) {
  const ema = [];
  const multiplier = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += prices[i];
  }
  ema[period - 1] = sum / period;
  for (let i = period; i < prices.length; i++) {
    ema[i] = prices[i] * multiplier + ema[i - 1] * (1 - multiplier);
  }
  return ema;
}
function calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  if (prices.length < slowPeriod) {
    throw new Error(
      `Not enough data for MACD calculation. Need at least ${slowPeriod} prices.`
    );
  }
  const fastEMA = calculateEMA(prices, fastPeriod);
  const slowEMA = calculateEMA(prices, slowPeriod);
  const macdLine = [];
  for (let i = slowPeriod - 1; i < prices.length; i++) {
    macdLine.push(fastEMA[i] - slowEMA[i]);
  }
  const signalEMA = calculateEMA(macdLine, signalPeriod);
  const lastSignalLine = signalEMA[signalEMA.length - 1] || macdLine[macdLine.length - 1];
  const lastMACDLine = macdLine[macdLine.length - 1];
  const histogram = lastMACDLine - lastSignalLine;
  return {
    macdLine: Math.round(lastMACDLine * 1e4) / 1e4,
    signalLine: Math.round(lastSignalLine * 1e4) / 1e4,
    histogram: Math.round(histogram * 1e4) / 1e4,
    bullish: lastMACDLine > lastSignalLine,
    bearish: lastMACDLine < lastSignalLine
  };
}
function calculateBollingerBands(prices, period = 20, stdDev = 2) {
  if (prices.length < period) {
    throw new Error(
      `Not enough data for Bollinger Bands calculation. Need at least ${period} prices.`
    );
  }
  const lastPrices = prices.slice(-period);
  const sum = lastPrices.reduce((a, b) => a + b, 0);
  const middle = sum / period;
  const squaredDiffs = lastPrices.map((price) => Math.pow(price - middle, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
  const std = Math.sqrt(variance);
  const upper = middle + std * stdDev;
  const lower = middle - std * stdDev;
  const width = upper - lower;
  const currentPrice = prices[prices.length - 1];
  const position = width === 0 ? 50 : (currentPrice - lower) / width * 100;
  return {
    upper: Math.round(upper * 100) / 100,
    middle: Math.round(middle * 100) / 100,
    lower: Math.round(lower * 100) / 100,
    width: Math.round(width * 100) / 100,
    position: Math.min(100, Math.max(0, Math.round(position * 100) / 100))
  };
}
function calculateEMAValue(prices, period = 50) {
  if (prices.length < period) {
    throw new Error(
      `Not enough data for EMA calculation. Need at least ${period} prices.`
    );
  }
  const ema = calculateEMA(prices, period);
  return Math.round(ema[ema.length - 1] * 100) / 100;
}
function analyzeVolume(volumes, period = 20) {
  if (volumes.length < period) {
    throw new Error(
      `Not enough data for volume analysis. Need at least ${period} volumes.`
    );
  }
  const lastVolumes = volumes.slice(-period);
  const volumeMA = lastVolumes.reduce((a, b) => a + b, 0) / period;
  const currentVolume = volumes[volumes.length - 1];
  const volumeRatio = currentVolume / volumeMA;
  return {
    volumeMA: Math.round(volumeMA * 100) / 100,
    currentVolume: Math.round(currentVolume * 100) / 100,
    volumeRatio: Math.round(volumeRatio * 100) / 100,
    highVolume: volumeRatio > 1.5
  };
}
function analyzeVolatility(prices, period = 20) {
  if (prices.length < period) {
    throw new Error(
      `Not enough data for volatility analysis. Need at least ${period} prices.`
    );
  }
  const lastPrices = prices.slice(-period);
  const returns = [];
  for (let i = 1; i < lastPrices.length; i++) {
    const ret = (lastPrices[i] - lastPrices[i - 1]) / lastPrices[i - 1];
    returns.push(ret);
  }
  const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - meanReturn, 2), 0) / returns.length;
  const volatility = Math.sqrt(variance) * 100;
  let trend;
  if (volatility > 5) {
    trend = "HIGH";
  } else if (volatility > 2) {
    trend = "NORMAL";
  } else {
    trend = "LOW";
  }
  return {
    volatility: Math.round(volatility * 100) / 100,
    trend
  };
}

// server/tradingEngine.ts
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import OpenAI from "openai";
var TradingEngine = class {
  config;
  isRunning = false;
  positions = /* @__PURE__ */ new Map();
  openai;
  cycleCount = 0;
  initialBalance = 0;
  get db() {
    return getDatabase();
  }
  constructor(config) {
    this.config = config;
    this.openai = new OpenAI();
  }
  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      const balance = await this.config.gateioClient.getBalance();
      this.initialBalance = parseFloat(balance.totalBalance);
    } catch {
      this.initialBalance = 0;
    }
    console.log(`AI Trading engine started for user ${this.config.userId}`);
    await this.updateBotStatus({ isRunning: true });
    await this.logEvent("BOT_START", "SYSTEM", `AI Trading bot started | Profile: ${this.config.aggressiveness} | Max risk/trade: ${this.config.maxRiskPerTrade}%`);
    this.mainLoop();
  }
  async stop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    console.log(`AI Trading engine stopping for user ${this.config.userId}...`);
    try {
      await this.logEvent("BOT_STOP", "SYSTEM", "Closing all positions before stopping...");
      const result = await this.config.gateioClient.closeAllPositions();
      if (result.closed.length > 0) {
        await this.logEvent("BOT_STOP", "SYSTEM", `Closed ${result.closed.length} positions: ${result.closed.join(", ")}`);
      }
      if (result.errors.length > 0) {
        await this.logEvent("ERROR", "SYSTEM", `Failed to close ${result.errors.length} positions: ${result.errors.join("; ")}`);
      }
      for (const [symbol] of Array.from(this.positions.entries())) {
        try {
          const ticker = await this.config.gateioClient.getTicker(symbol);
          const exitPrice = parseFloat(ticker.lastPrice);
          await this.closePositionRecord(symbol, exitPrice, "BOT_STOPPED");
        } catch (e) {
          console.error(`Error updating trade record for ${symbol}:`, e);
        }
      }
    } catch (error) {
      console.error("Error closing positions on stop:", error);
      await this.logEvent("ERROR", "SYSTEM", `Error closing positions: ${this.errStr(error)}`);
    }
    await this.updateBotStatus({ isRunning: false });
    await this.logEvent("BOT_STOP", "SYSTEM", "AI Trading bot stopped. All positions closed.");
    console.log(`AI Trading engine stopped for user ${this.config.userId}`);
  }
  // --------------------------------------------------------------------------
  // Main Loop
  // --------------------------------------------------------------------------
  async mainLoop() {
    while (this.isRunning) {
      try {
        this.cycleCount++;
        await this.logEvent("CYCLE_START", "SYSTEM", `Cycle #${this.cycleCount} started`);
        if (await this.isDrawdownExceeded()) {
          await this.logEvent("RISK_STOP", "SYSTEM", `Max drawdown ${this.config.maxDrawdown}% exceeded. Closing all positions.`);
          await this.closeAllPositions("MAX_DRAWDOWN");
          await this.stop();
          return;
        }
        await this.monitorPositions();
        if (this.positions.size < this.config.maxOpenPositions) {
          await this.scanAndTrade();
        }
        await this.updateBotStatus({ isRunning: true });
        const waitMs = this.config.aggressiveness === "aggressive" ? 2 * 60 * 1e3 : this.config.aggressiveness === "moderate" ? 5 * 60 * 1e3 : 10 * 60 * 1e3;
        await this.sleep(waitMs);
      } catch (error) {
        const msg = this.errStr(error);
        console.error("Error in AI trading loop:", msg);
        await this.logEvent("ERROR", "SYSTEM", `Trading loop error: ${msg}`);
        await this.sleep(60 * 1e3);
      }
    }
  }
  // --------------------------------------------------------------------------
  // Market Scanning — Discover top opportunities
  // --------------------------------------------------------------------------
  async scanAndTrade() {
    try {
      const topPairs = await this.config.gateioClient.getTopPairs(20);
      console.log(`[SCAN] Found ${topPairs.length} top pairs: ${topPairs.slice(0, 5).map((p) => p.symbol).join(", ")}...`);
      const snapshots = [];
      let snapshotErrors = 0;
      for (const pair of topPairs) {
        try {
          const snapshot = await this.getMarketSnapshot(pair.symbol);
          if (snapshot) {
            snapshots.push(snapshot);
          } else {
            snapshotErrors++;
          }
        } catch (err) {
          snapshotErrors++;
          console.error(`[SCAN] Snapshot error for ${pair.symbol}: ${this.errStr(err)}`);
        }
      }
      console.log(`[SCAN] Got ${snapshots.length} snapshots, ${snapshotErrors} errors`);
      if (snapshots.length === 0) {
        console.log(`[SCAN] No valid snapshots \u2014 skipping AI analysis`);
        await this.logEvent("ERROR", "SYSTEM", `Scan: 0 valid snapshots from ${topPairs.length} pairs (${snapshotErrors} errors)`);
        return;
      }
      const decisions = await this.askAIForOpportunities(snapshots);
      for (const decision of decisions) {
        if (!this.isRunning) break;
        if (decision.action === "SKIP" || decision.action === "HOLD") continue;
        if (decision.confidence < this.getMinConfidence()) continue;
        if (this.positions.has(decision.symbol)) continue;
        if (this.positions.size >= this.config.maxOpenPositions) break;
        try {
          await this.executeDecision(decision);
        } catch (error) {
          await this.logEvent("ERROR", decision.symbol, `Failed to execute: ${this.errStr(error)}`);
        }
      }
    } catch (error) {
      await this.logEvent("ERROR", "SYSTEM", `Scan error: ${this.errStr(error)}`);
    }
  }
  getMinConfidence() {
    return this.config.aggressiveness === "conservative" ? 75 : this.config.aggressiveness === "moderate" ? 65 : 55;
  }
  // --------------------------------------------------------------------------
  // Position Monitoring — AI decides when to close
  // --------------------------------------------------------------------------
  async monitorPositions() {
    for (const [symbol, position] of Array.from(this.positions.entries())) {
      try {
        const snapshot = await this.getMarketSnapshot(symbol);
        if (!snapshot) continue;
        const pnlPercent = position.side === "BUY" ? (snapshot.price - position.entryPrice) / position.entryPrice * 100 : (position.entryPrice - snapshot.price) / position.entryPrice * 100;
        const decision = await this.askAIForPositionManagement(position, snapshot, pnlPercent);
        if (decision.action === "CLOSE") {
          await this.closePosition(symbol, snapshot.price, decision.reasoning);
        }
      } catch (error) {
        console.error(`Error monitoring ${symbol}:`, this.errStr(error));
      }
    }
  }
  // --------------------------------------------------------------------------
  // AI Decision Engine
  // --------------------------------------------------------------------------
  async askAIForOpportunities(snapshots) {
    const balance = await this.config.gateioClient.getBalance();
    const availableBalance = parseFloat(balance.availableBalance);
    const marketSummary = snapshots.map((s) => ({
      symbol: s.symbol,
      price: s.price,
      change24h: `${s.change24h}%`,
      rsi: s.rsi,
      macd_bullish: s.macd.bullish,
      macd_histogram: s.macd.histogram,
      bb_position: s.bb.position,
      volume_ratio: s.volumeAnalysis.volumeRatio,
      volatility: `${s.volatility.volatility}% (${s.volatility.trend})`,
      trend: s.trend,
      funding_rate: s.fundingRate,
      above_ema50: s.price > s.ema50
    }));
    const systemPrompt = `Voc\xEA \xE9 um agente de trading algor\xEDtmico avan\xE7ado especializado em criptoativos (futuros), com foco em maximiza\xE7\xE3o de retorno ajustado ao risco.

COMPORTAMENTO:
- Tome decis\xF5es din\xE2micas e aut\xF4nomas baseadas em probabilidade, contexto de mercado e gest\xE3o de risco.
- Corte preju\xEDzos rapidamente quando a probabilidade piorar.
- Garanta lucros quando houver sinais de revers\xE3o.
- Ajuste capital e alavancagem dinamicamente.
- Prefira abrir MUITAS posi\xE7\xF5es de valores BAIXOS alavancados para diversificar.

EXCHANGE: Gate.io Futures (USDT-M)
- S\xEDmbolos usam formato: BTC_USDT, ETH_USDT (com underscore)

PERFIL DE RISCO: ${this.config.aggressiveness}
- Conservative: alavancagem 1-5x, confian\xE7a m\xEDnima 75%, posi\xE7\xF5es menores
- Moderate: alavancagem 3-10x, confian\xE7a m\xEDnima 65%, posi\xE7\xF5es m\xE9dias
- Aggressive: alavancagem 5-20x, confian\xE7a m\xEDnima 55%, posi\xE7\xF5es maiores

REGRAS OBRIGAT\xD3RIAS:
- CADA posi\xE7\xE3o deve ter valor nocional de no M\xC1XIMO $10 USDT (antes da alavancagem)
- Abra MUITAS posi\xE7\xF5es pequenas para diversificar (at\xE9 ${this.config.maxOpenPositions} simult\xE2neas, atualmente ${this.positions.size} abertas)
- Saldo dispon\xEDvel: ${availableBalance.toFixed(2)} USDT
- positionSizePercent deve resultar em ~$5-10 USDT por trade (calcule: ${availableBalance.toFixed(2)} * percent/100 = valor base)
- Considere funding rate (negativo favorece longs, positivo favorece shorts)
- Sempre considere risco de liquida\xE7\xE3o
- PRIORIZE abrir v\xE1rias posi\xE7\xF5es diferentes em vez de poucas grandes

Responda APENAS com um JSON array de decis\xF5es. Cada decis\xE3o:
{
  "action": "OPEN_LONG" | "OPEN_SHORT" | "SKIP",
  "symbol": "BTC_USDT",
  "confidence": 75,
  "leverage": 5,
  "positionSizePercent": 3,
  "reasoning": "breve explica\xE7\xE3o"
}

Retorne no m\xE1ximo 10 oportunidades, ordenadas por confian\xE7a. Se n\xE3o houver boas oportunidades, retorne array vazio []. PRIORIZE diversifica\xE7\xE3o: escolha pares DIFERENTES.`;
    try {
      const response = await this.openai.chat.completions.create({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Dados de mercado atuais:
${JSON.stringify(marketSummary, null, 2)}` }
        ],
        temperature: 0.3,
        max_tokens: 2e3
      });
      const content = response.choices[0]?.message?.content ?? "[]";
      console.log(`[AI] Raw response: ${content.substring(0, 300)}`);
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.log(`[AI] No JSON array found in response`);
        return [];
      }
      const decisions = JSON.parse(jsonMatch[0]);
      console.log(`[AI] Got ${decisions.length} decisions: ${decisions.map((d) => `${d.action} ${d.symbol} conf:${d.confidence}`).join(", ")}`);
      return decisions;
    } catch (error) {
      await this.logEvent("ERROR", "AI", `AI opportunity analysis failed: ${this.errStr(error)}`);
      return [];
    }
  }
  async askAIForPositionManagement(position, snapshot, pnlPercent) {
    const holdTime = (Date.now() - position.entryTime.getTime()) / (1e3 * 60);
    const prompt = `Posi\xE7\xE3o aberta:
- Symbol: ${position.symbol}
- Side: ${position.side}
- Entry: ${position.entryPrice}
- Current: ${snapshot.price}
- P&L: ${pnlPercent.toFixed(2)}%
- Leverage: ${position.leverage}x
- Confian\xE7a na entrada: ${position.confidence}%
- Tempo aberta: ${holdTime.toFixed(0)} minutos

Indicadores atuais:
- RSI: ${snapshot.rsi}
- MACD bullish: ${snapshot.macd.bullish}, histogram: ${snapshot.macd.histogram}
- BB position: ${snapshot.bb.position}
- Volatilidade: ${snapshot.volatility.volatility}% (${snapshot.volatility.trend})
- Volume ratio: ${snapshot.volumeAnalysis.volumeRatio}
- Tend\xEAncia: ${snapshot.trend}

Decida: CLOSE ou HOLD?
- Se P&L positivo e sinais de revers\xE3o \u2192 CLOSE (proteger lucro)
- Se P&L negativo e probabilidade de recupera\xE7\xE3o baixa \u2192 CLOSE (cortar preju\xEDzo)
- Se tend\xEAncia continua favor\xE1vel \u2192 HOLD

Responda APENAS com JSON:
{"action": "CLOSE" ou "HOLD", "symbol": "${position.symbol}", "confidence": 0, "leverage": 0, "positionSizePercent": 0, "reasoning": "explica\xE7\xE3o"}`;
    try {
      const response = await this.openai.chat.completions.create({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: "Voc\xEA \xE9 um gestor de risco de trading de futuros cripto. Seja decisivo. Priorize proteger capital e garantir lucros." },
          { role: "user", content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 500
      });
      const content = response.choices[0]?.message?.content ?? '{"action":"HOLD"}';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { action: "HOLD", symbol: position.symbol, confidence: 0, leverage: 0, positionSizePercent: 0, reasoning: "Parse error" };
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      await this.logEvent("ERROR", "AI", `AI position management failed: ${this.errStr(error)}`);
      return { action: "HOLD", symbol: position.symbol, confidence: 0, leverage: 0, positionSizePercent: 0, reasoning: "AI error - holding" };
    }
  }
  // --------------------------------------------------------------------------
  // Market Data Collection
  // --------------------------------------------------------------------------
  async getMarketSnapshot(symbol) {
    try {
      const gateCandles = await this.config.gateioClient.getCandles(
        symbol,
        this.config.timeframe,
        200
      );
      if (gateCandles.length < 50) return null;
      const prices = gateCandles.map((k) => k.close);
      const volumes = gateCandles.map((k) => k.volume);
      const currentPrice = prices[prices.length - 1];
      const rsi = calculateRSI(prices, 14);
      const macd = calculateMACD(prices, 12, 26, 9);
      const bb = calculateBollingerBands(prices, 20, 2);
      const vol = analyzeVolume(volumes);
      const volat = analyzeVolatility(prices);
      const ema50 = calculateEMAValue(prices, 50);
      const ticker = await this.config.gateioClient.getTicker(symbol);
      const change24h = parseFloat(ticker.priceChangePercent);
      const fundingRate = parseFloat(ticker.fundingRate);
      const volume24h = parseFloat(ticker.volume24h);
      let trend = "SIDEWAYS";
      if (currentPrice > ema50 && macd.bullish && rsi.rsi > 50) trend = "BULLISH";
      else if (currentPrice < ema50 && !macd.bullish && rsi.rsi < 50) trend = "BEARISH";
      await this.saveCandles(symbol, gateCandles);
      await this.saveIndicators(symbol, prices, volumes);
      return {
        symbol,
        price: currentPrice,
        change24h,
        volume24h,
        rsi: rsi.rsi,
        macd: { macdLine: macd.macdLine, signalLine: macd.signalLine, histogram: macd.histogram, bullish: macd.bullish },
        bb: { upper: bb.upper, middle: bb.middle, lower: bb.lower, position: bb.position },
        volumeAnalysis: { volumeRatio: vol.volumeRatio, highVolume: vol.highVolume },
        volatility: { volatility: volat.volatility, trend: volat.trend },
        ema50,
        fundingRate,
        trend
      };
    } catch (error) {
      console.error(`[SNAPSHOT] Error for ${symbol}: ${this.errStr(error)}`);
      return null;
    }
  }
  // --------------------------------------------------------------------------
  // Trade Execution (Gate.io Futures)
  // --------------------------------------------------------------------------
  async executeDecision(decision) {
    const side = decision.action === "OPEN_LONG" ? "BUY" : "SELL";
    try {
      const balance = await this.config.gateioClient.getBalance();
      const available = parseFloat(balance.availableBalance);
      const sizePercent = Math.min(decision.positionSizePercent, this.config.maxRiskPerTrade);
      const baseValue = Math.min(available * (sizePercent / 100), 10);
      const notionalValue = baseValue * decision.leverage;
      const ticker = await this.config.gateioClient.getTicker(decision.symbol);
      const currentPrice = parseFloat(ticker.lastPrice);
      if (currentPrice <= 0) return;
      const contractInfo = await this.config.gateioClient.getContractInfo(decision.symbol);
      const quantoMultiplier = parseFloat(contractInfo.quantoMultiplier || contractInfo.quanto_multiplier || "0.001");
      console.log(`[EXEC] ${decision.symbol}: base=$${baseValue.toFixed(2)}, notional=$${notionalValue.toFixed(2)}, price=${currentPrice}, qm=${quantoMultiplier}`);
      const contractValue = currentPrice * quantoMultiplier;
      const rawContracts = notionalValue / contractValue;
      const contracts = Math.floor(rawContracts);
      if (contracts <= 0) return;
      try {
        await this.config.gateioClient.setLeverage(decision.symbol, decision.leverage);
      } catch (e) {
        console.log(`Leverage set warning for ${decision.symbol}:`, this.errStr(e));
      }
      const order = await this.config.gateioClient.placeOrder({
        symbol: decision.symbol,
        side,
        size: contracts
      });
      this.positions.set(decision.symbol, {
        symbol: decision.symbol,
        side,
        entryPrice: currentPrice,
        quantity: contracts,
        entryTime: /* @__PURE__ */ new Date(),
        leverage: decision.leverage,
        confidence: decision.confidence
      });
      await this.db.insert(trades).values({
        id: nanoid(),
        userId: this.config.userId,
        configId: this.config.configId,
        symbol: decision.symbol,
        side,
        entryPrice: currentPrice.toString(),
        quantity: contracts.toString(),
        entryTime: /* @__PURE__ */ new Date(),
        stopLoss: "0",
        // AI manages exits dynamically
        takeProfit: "0",
        status: "OPEN",
        rsiAtEntry: String(decision.confidence),
        macdAtEntry: JSON.stringify({ leverage: decision.leverage }),
        bbAtEntry: JSON.stringify({ reasoning: decision.reasoning }),
        bybitOrderId: order.orderId
      });
      await this.logEvent(
        "POSITION_OPENED",
        decision.symbol,
        `${side} ${contracts} contracts @ ${currentPrice} | Lev: ${decision.leverage}x | Conf: ${decision.confidence}% | ${decision.reasoning}`
      );
    } catch (error) {
      await this.logEvent("ERROR", decision.symbol, `Execute error: ${this.errStr(error)}`);
    }
  }
  /**
   * Close position on exchange AND update DB record
   */
  async closePosition(symbol, exitPrice, reason) {
    try {
      const position = this.positions.get(symbol);
      if (!position) return;
      const positionSide = position.side === "BUY" ? "LONG" : "SHORT";
      await this.config.gateioClient.closePosition(symbol, positionSide);
      await this.closePositionRecord(symbol, exitPrice, reason);
    } catch (error) {
      await this.logEvent("ERROR", symbol, `Close error: ${this.errStr(error)}`);
    }
  }
  /**
   * Update DB trade record and in-memory position (does NOT close on exchange)
   * Used by stop() after closeAllPositions() already closed on exchange
   */
  async closePositionRecord(symbol, exitPrice, reason) {
    try {
      const position = this.positions.get(symbol);
      if (!position) return;
      let quantoMultiplier = 1;
      try {
        const contractInfo = await this.config.gateioClient.getContractInfo(symbol);
        quantoMultiplier = parseFloat(contractInfo.quantoMultiplier || contractInfo.quanto_multiplier || "1");
      } catch {
        quantoMultiplier = 1 / position.entryPrice;
      }
      const pnl = position.side === "BUY" ? (exitPrice - position.entryPrice) * position.quantity * quantoMultiplier : (position.entryPrice - exitPrice) * position.quantity * quantoMultiplier;
      const pnlPercent = position.side === "BUY" ? (exitPrice - position.entryPrice) / position.entryPrice * 100 : (position.entryPrice - exitPrice) / position.entryPrice * 100;
      const tradeRecord = await this.db.select().from(trades).where(and(eq(trades.symbol, symbol), eq(trades.status, "OPEN"), eq(trades.userId, this.config.userId))).limit(1);
      if (tradeRecord.length > 0) {
        const truncatedReason = reason.substring(0, 50);
        const clampedPnlPercent = Math.max(-999.99, Math.min(999.99, pnlPercent));
        await this.db.update(trades).set({
          exitPrice: exitPrice.toString(),
          exitTime: /* @__PURE__ */ new Date(),
          pnl: pnl.toString(),
          pnlPercent: clampedPnlPercent.toFixed(2),
          status: "CLOSED",
          exitReason: truncatedReason
        }).where(eq(trades.id, tradeRecord[0].id));
      }
      try {
        const statusRows = await this.db.select().from(botStatus).where(eq(botStatus.userId, this.config.userId)).limit(1);
        if (statusRows.length > 0) {
          const s = statusRows[0];
          const newTotal = (s.totalTrades || 0) + 1;
          const newWins = (s.winningTrades || 0) + (pnl > 0 ? 1 : 0);
          const newLosses = (s.losingTrades || 0) + (pnl <= 0 ? 1 : 0);
          const newPnl = parseFloat(s.totalPnl || "0") + pnl;
          await this.db.update(botStatus).set({
            totalTrades: newTotal,
            winningTrades: newWins,
            losingTrades: newLosses,
            totalPnl: newPnl.toFixed(8)
          }).where(eq(botStatus.userId, this.config.userId));
        }
      } catch (e) {
        console.error("Error updating bot stats:", e);
      }
      this.positions.delete(symbol);
      await this.logEvent(
        "POSITION_CLOSED",
        symbol,
        `Closed @ ${exitPrice} | P&L: ${pnl >= 0 ? "+" : ""}${pnl.toFixed(4)} USDT (${pnlPercent >= 0 ? "+" : ""}${pnlPercent.toFixed(2)}%) | ${reason}`
      );
    } catch (error) {
      await this.logEvent("ERROR", symbol, `Record close error: ${this.errStr(error)}`);
    }
  }
  async closeAllPositions(reason) {
    for (const [symbol] of Array.from(this.positions.entries())) {
      try {
        const ticker = await this.config.gateioClient.getTicker(symbol);
        await this.closePosition(symbol, parseFloat(ticker.lastPrice), reason);
      } catch (error) {
        await this.logEvent("ERROR", symbol, `Failed to close: ${this.errStr(error)}`);
      }
    }
  }
  // --------------------------------------------------------------------------
  // Risk Management
  // --------------------------------------------------------------------------
  async isDrawdownExceeded() {
    if (this.initialBalance <= 0) return false;
    try {
      const balance = await this.config.gateioClient.getBalance();
      const currentBalance = parseFloat(balance.totalBalance);
      const drawdown = (this.initialBalance - currentBalance) / this.initialBalance * 100;
      return drawdown >= this.config.maxDrawdown;
    } catch {
      return false;
    }
  }
  // --------------------------------------------------------------------------
  // Data Persistence
  // --------------------------------------------------------------------------
  async saveCandles(symbol, gateCandles) {
    try {
      for (const c of gateCandles.slice(-10)) {
        await this.db.insert(candles).values({
          id: nanoid(),
          symbol,
          timeframe: this.config.timeframe,
          timestamp: c.time,
          open: c.open.toString(),
          high: c.high.toString(),
          low: c.low.toString(),
          close: c.close.toString(),
          volume: c.volume.toString(),
          quoteAssetVolume: "0"
        }).onConflictDoNothing();
      }
    } catch (_) {
    }
  }
  async saveIndicators(symbol, prices, volumes) {
    try {
      const rsi = calculateRSI(prices, 14);
      const macd = calculateMACD(prices, 12, 26, 9);
      const bb = calculateBollingerBands(prices, 20, 2);
      const vol = analyzeVolume(volumes);
      await this.db.insert(indicators).values({
        id: nanoid(),
        symbol,
        timeframe: this.config.timeframe,
        timestamp: Date.now(),
        rsi: rsi.rsi.toString(),
        macdLine: macd.macdLine.toString(),
        signalLine: macd.signalLine.toString(),
        histogram: macd.histogram.toString(),
        bbUpper: bb.upper.toString(),
        bbMiddle: bb.middle.toString(),
        bbLower: bb.lower.toString(),
        volumeMA: vol.volumeMA.toString()
      });
    } catch (_) {
    }
  }
  // Map engine log types to DB enum values
  mapLogType(type) {
    const mapping = {
      "BOT_START": "BOT_START",
      "BOT_STOP": "BOT_STOP",
      "CYCLE_START": "INFO",
      "RISK_STOP": "ERROR",
      "POSITION_OPENED": "POSITION_OPENED",
      "POSITION_CLOSED": "POSITION_CLOSED",
      "ERROR": "ERROR",
      "SIGNAL_GENERATED": "SIGNAL_GENERATED",
      "ORDER_PLACED": "ORDER_PLACED",
      "ORDER_FILLED": "ORDER_FILLED"
    };
    return mapping[type] || "INFO";
  }
  async logEvent(type, symbol, message) {
    try {
      await this.db.insert(tradingLogs).values({
        id: nanoid(),
        userId: this.config.userId,
        configId: this.config.configId,
        symbol,
        logType: this.mapLogType(type),
        message,
        details: null,
        createdAt: /* @__PURE__ */ new Date()
      });
      console.log(`[${type}] ${message}`);
    } catch (error) {
      console.error("Error logging event:", error);
    }
  }
  async updateBotStatus(update) {
    try {
      const existing = await this.db.select().from(botStatus).where(eq(botStatus.userId, this.config.userId)).limit(1);
      if (existing.length === 0) {
        await this.db.insert(botStatus).values({
          id: nanoid(),
          userId: this.config.userId,
          configId: this.config.configId,
          isRunning: update.isRunning ?? false,
          startedAt: update.isRunning ? /* @__PURE__ */ new Date() : null,
          lastHeartbeat: /* @__PURE__ */ new Date()
        });
      } else {
        await this.db.update(botStatus).set({
          isRunning: update.isRunning ?? existing[0].isRunning,
          startedAt: update.isRunning ? /* @__PURE__ */ new Date() : existing[0].startedAt,
          lastHeartbeat: /* @__PURE__ */ new Date()
        }).where(eq(botStatus.userId, this.config.userId));
      }
    } catch (error) {
      console.error("Error updating bot status:", error);
    }
  }
  // --------------------------------------------------------------------------
  // Utilities
  // --------------------------------------------------------------------------
  sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
  errStr(e) {
    return e instanceof Error ? e.message : typeof e === "object" && e !== null ? JSON.stringify(e) : String(e);
  }
  getPositions() {
    return Array.from(this.positions.values());
  }
  getIsRunning() {
    return this.isRunning;
  }
};

// server/routers.ts
import { eq as eq2, and as and2, desc } from "drizzle-orm";
import { nanoid as nanoid2 } from "nanoid";
import GateApi2 from "gate-api";

// server/engineStore.ts
var tradingEngines = /* @__PURE__ */ new Map();

// server/routers.ts
var gateioKeysRouter = router({
  saveKeys: protectedProcedure.input(
    z.object({
      apiKey: z.string().min(1),
      apiSecret: z.string().min(1),
      testnet: z.boolean().default(false)
    })
  ).mutation(async ({ input, ctx }) => {
    const db2 = getDatabase();
    const userId = ctx.user?.id || "local-owner";
    await db2.delete(bybitApiKeys).where(eq2(bybitApiKeys.userId, userId));
    await db2.insert(bybitApiKeys).values({
      id: nanoid2(),
      userId,
      apiKey: input.apiKey,
      apiSecret: input.apiSecret,
      testnet: input.testnet,
      isActive: true
    });
    return { success: true };
  }),
  getKeys: protectedProcedure.query(async ({ ctx }) => {
    const db2 = getDatabase();
    const userId = ctx.user?.id || "local-owner";
    const keys = await db2.select().from(bybitApiKeys).where(eq2(bybitApiKeys.userId, userId)).limit(1);
    if (keys.length === 0) return null;
    const key = keys[0];
    return {
      id: key.id,
      apiKey: key.apiKey?.substring(0, 8) + "***",
      testnet: key.testnet,
      isActive: key.isActive
    };
  }),
  deleteKeys: protectedProcedure.mutation(async ({ ctx }) => {
    const db2 = getDatabase();
    const userId = ctx.user?.id || "local-owner";
    await db2.delete(bybitApiKeys).where(eq2(bybitApiKeys.userId, userId));
    return { success: true };
  }),
  testConnection: protectedProcedure.mutation(async ({ ctx }) => {
    const db2 = getDatabase();
    const userId = ctx.user?.id || "local-owner";
    const keys = await db2.select().from(bybitApiKeys).where(eq2(bybitApiKeys.userId, userId)).limit(1);
    if (keys.length === 0) {
      throw new Error("Chaves da API Gate.io n\xE3o configuradas");
    }
    const apiKey = keys[0];
    const client2 = createGateioClient({
      apiKey: apiKey.apiKey,
      apiSecret: apiKey.apiSecret
    });
    try {
      const result = await client2.testConnection();
      return result;
    } catch (error) {
      throw new Error(`Falha na conex\xE3o: ${error?.message || String(error)}`);
    }
  })
});
var tradingConfigRouter = router({
  create: protectedProcedure.input(
    z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      aggressiveness: z.enum(["conservative", "moderate", "aggressive"]).default("moderate"),
      maxRiskPerTrade: z.number().min(1).max(20).default(5),
      maxDrawdown: z.number().min(5).max(50).default(15),
      maxOpenPositions: z.number().min(1).max(30).default(10),
      timeframe: z.enum(["1m", "5m", "15m", "30m", "1h", "4h", "1d"]).default("15m")
    })
  ).mutation(async ({ input, ctx }) => {
    const db2 = getDatabase();
    const userId = ctx.user?.id || "local-owner";
    const id = nanoid2();
    await db2.insert(tradingConfigs).values({
      id,
      userId,
      name: input.name,
      description: `${input.aggressiveness}|${input.description ?? "Estrat\xE9gia AI Aut\xF4noma"}`,
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
      isActive: false
    });
    return { success: true, id };
  }),
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const db2 = getDatabase();
    const userId = ctx.user?.id || "local-owner";
    const configs = await db2.select().from(tradingConfigs).where(eq2(tradingConfigs.userId, userId));
    return configs.map((c) => {
      const descParts = (c.description ?? "moderate|").split("|");
      const aggressiveness = ["conservative", "moderate", "aggressive"].includes(descParts[0]) ? descParts[0] : "moderate";
      const description = descParts.slice(1).join("|") || "Estrat\xE9gia AI Aut\xF4noma";
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
        createdAt: c.createdAt
      };
    });
  }),
  getById: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ input, ctx }) => {
    const db2 = getDatabase();
    const userId = ctx.user?.id || "local-owner";
    const configs = await db2.select().from(tradingConfigs).where(and2(eq2(tradingConfigs.id, input.id), eq2(tradingConfigs.userId, userId))).limit(1);
    if (configs.length === 0) throw new Error("Configura\xE7\xE3o n\xE3o encontrada");
    const c = configs[0];
    const descParts = (c.description ?? "moderate|").split("|");
    const aggressiveness = ["conservative", "moderate", "aggressive"].includes(descParts[0]) ? descParts[0] : "moderate";
    return {
      id: c.id,
      name: c.name,
      description: descParts.slice(1).join("|") || "Estrat\xE9gia AI Aut\xF4noma",
      aggressiveness,
      maxRiskPerTrade: parseFloat(c.maxPositionSize ?? "5"),
      maxDrawdown: parseFloat(c.maxDrawdown ?? "15"),
      maxOpenPositions: c.rsiPeriod ?? 10,
      timeframe: c.timeframe ?? "15m",
      isActive: c.isActive
    };
  }),
  update: protectedProcedure.input(
    z.object({
      id: z.string(),
      name: z.string().optional(),
      aggressiveness: z.enum(["conservative", "moderate", "aggressive"]).optional(),
      maxRiskPerTrade: z.number().optional(),
      maxDrawdown: z.number().optional(),
      maxOpenPositions: z.number().optional(),
      timeframe: z.enum(["1m", "5m", "15m", "30m", "1h", "4h", "1d"]).optional()
    })
  ).mutation(async ({ input, ctx }) => {
    const db2 = getDatabase();
    const userId = ctx.user?.id || "local-owner";
    const updates = {};
    if (input.name !== void 0) updates.name = input.name;
    if (input.maxRiskPerTrade !== void 0) updates.maxPositionSize = input.maxRiskPerTrade.toString();
    if (input.maxDrawdown !== void 0) updates.maxDrawdown = input.maxDrawdown.toString();
    if (input.maxOpenPositions !== void 0) updates.rsiPeriod = input.maxOpenPositions;
    if (input.timeframe !== void 0) updates.timeframe = input.timeframe;
    if (input.aggressiveness !== void 0) {
      const existing = await db2.select().from(tradingConfigs).where(and2(eq2(tradingConfigs.id, input.id), eq2(tradingConfigs.userId, userId))).limit(1);
      if (existing.length > 0) {
        const descParts = (existing[0].description ?? "moderate|").split("|");
        updates.description = `${input.aggressiveness}|${descParts.slice(1).join("|") || "Estrat\xE9gia AI Aut\xF4noma"}`;
      }
    }
    await db2.update(tradingConfigs).set(updates).where(and2(eq2(tradingConfigs.id, input.id), eq2(tradingConfigs.userId, userId)));
    return { success: true };
  }),
  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ input, ctx }) => {
    const db2 = getDatabase();
    const userId = ctx.user?.id || "local-owner";
    await db2.delete(tradingConfigs).where(and2(eq2(tradingConfigs.id, input.id), eq2(tradingConfigs.userId, userId)));
    return { success: true };
  })
});
var botControlRouter = router({
  start: protectedProcedure.input(z.object({ configId: z.string() })).mutation(async ({ input, ctx }) => {
    const db2 = getDatabase();
    const userId = ctx.user?.id || "local-owner";
    const configs = await db2.select().from(tradingConfigs).where(and2(eq2(tradingConfigs.id, input.configId), eq2(tradingConfigs.userId, userId))).limit(1);
    if (configs.length === 0) throw new Error("Configura\xE7\xE3o n\xE3o encontrada");
    const keys = await db2.select().from(bybitApiKeys).where(eq2(bybitApiKeys.userId, userId)).limit(1);
    if (keys.length === 0) throw new Error("Chaves da API Gate.io n\xE3o configuradas");
    const config = configs[0];
    const apiKey = keys[0];
    const gateioClient = createGateioClient({
      apiKey: apiKey.apiKey,
      apiSecret: apiKey.apiSecret
    });
    const descParts = (config.description ?? "moderate|").split("|");
    const aggressiveness = ["conservative", "moderate", "aggressive"].includes(descParts[0]) ? descParts[0] : "moderate";
    const engine = new TradingEngine({
      userId,
      configId: input.configId,
      gateioClient,
      maxRiskPerTrade: parseFloat(config.maxPositionSize ?? "5"),
      maxDrawdown: parseFloat(config.maxDrawdown ?? "15"),
      maxOpenPositions: config.rsiPeriod ?? 10,
      timeframe: config.timeframe ?? "15m",
      aggressiveness
    });
    await engine.start();
    tradingEngines.set(userId, engine);
    return { success: true };
  }),
  stop: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.user?.id || "local-owner";
    const engine = tradingEngines.get(userId);
    if (!engine) throw new Error("Bot de trading n\xE3o est\xE1 em execu\xE7\xE3o");
    await engine.stop();
    tradingEngines.delete(userId);
    return { success: true };
  }),
  emergencyCloseAll: protectedProcedure.mutation(async ({ ctx }) => {
    const db2 = getDatabase();
    const userId = ctx.user?.id || "local-owner";
    const keys = await db2.select().from(bybitApiKeys).where(eq2(bybitApiKeys.userId, userId)).limit(1);
    if (keys.length === 0) throw new Error("Chaves da API n\xE3o encontradas");
    const gateioClient = createGateioClient({
      apiKey: keys[0].apiKey,
      apiSecret: keys[0].apiSecret
    });
    const result = await gateioClient.closeAllPositions();
    const openTrades = await db2.select().from(trades).where(and2(eq2(trades.userId, userId), eq2(trades.status, "OPEN")));
    for (const t2 of openTrades) {
      try {
        await db2.update(trades).set({
          status: "CLOSED",
          exitTime: /* @__PURE__ */ new Date(),
          exitReason: "EMERGENCY_CLOSE"
        }).where(eq2(trades.id, t2.id));
      } catch (e) {
      }
    }
    const engine = tradingEngines.get(userId);
    if (engine) {
      engine.stop();
      tradingEngines.delete(userId);
    }
    return { closed: result.closed, errors: result.errors };
  }),
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const db2 = getDatabase();
    const userId = ctx.user?.id || "local-owner";
    const status = await db2.select().from(botStatus).where(eq2(botStatus.userId, userId)).limit(1);
    const engineRunning = tradingEngines.has(userId);
    if (status.length === 0) {
      return { isRunning: engineRunning, isPaused: false };
    }
    return { ...status[0], isRunning: engineRunning || status[0].isRunning };
  })
});
var marketDataRouter = router({
  getTicker: protectedProcedure.input(z.object({ symbol: z.string() })).query(async ({ input }) => {
    const client2 = new GateApi2.FuturesApi();
    const result = await client2.listFuturesTickers("usdt", { contract: input.symbol });
    const tickers = result.body;
    if (!tickers || tickers.length === 0) throw new Error("Ticker not found");
    const t2 = tickers[0];
    return {
      symbol: t2.contract || input.symbol,
      lastPrice: t2.last || "0",
      priceChangePercent: t2.change_percentage || "0",
      volume: t2.volume_24h_quote || "0",
      highPrice: t2.high_24h || "0",
      lowPrice: t2.low_24h || "0"
    };
  }),
  getKlines: protectedProcedure.input(
    z.object({
      symbol: z.string(),
      interval: z.string().default("1h"),
      limit: z.number().default(100)
    })
  ).query(async ({ input }) => {
    const client2 = new GateApi2.FuturesApi();
    const result = await client2.listFuturesCandlesticks("usdt", input.symbol, {
      interval: input.interval,
      limit: input.limit
    });
    return result.body.map((c) => ({
      time: c.t ? c.t * 1e3 : 0,
      open: parseFloat(c.o || "0"),
      high: parseFloat(c.h || "0"),
      low: parseFloat(c.l || "0"),
      close: parseFloat(c.c || "0"),
      volume: parseFloat(c.v || "0")
    }));
  }),
  getBalance: protectedProcedure.query(async ({ ctx }) => {
    const db2 = getDatabase();
    const userId = ctx.user?.id || "local-owner";
    const keys = await db2.select().from(bybitApiKeys).where(eq2(bybitApiKeys.userId, userId)).limit(1);
    if (keys.length === 0) {
      return { balance: "0", available: "0", unrealizedPnl: "0" };
    }
    const apiKey = keys[0];
    const client2 = createGateioClient({
      apiKey: apiKey.apiKey,
      apiSecret: apiKey.apiSecret
    });
    try {
      const balance = await client2.getBalance();
      return {
        balance: balance.totalBalance,
        available: balance.availableBalance,
        unrealizedPnl: balance.unrealizedPnl,
        marginBalance: balance.marginBalance
      };
    } catch (error) {
      console.error("Error fetching balance:", error?.message || error);
      return { balance: "0", available: "0", unrealizedPnl: "0" };
    }
  }),
  getPositions: protectedProcedure.query(async ({ ctx }) => {
    const db2 = getDatabase();
    const userId = ctx.user?.id || "local-owner";
    const keys = await db2.select().from(bybitApiKeys).where(eq2(bybitApiKeys.userId, userId)).limit(1);
    if (keys.length === 0) return [];
    const apiKey = keys[0];
    const client2 = createGateioClient({
      apiKey: apiKey.apiKey,
      apiSecret: apiKey.apiSecret
    });
    try {
      return await client2.getPositions();
    } catch (error) {
      console.error("Error fetching positions:", error?.message || error);
      return [];
    }
  })
});
var tradesRouter = router({
  getRecent: protectedProcedure.input(z.object({ limit: z.number().default(50) })).query(async ({ input, ctx }) => {
    const db2 = getDatabase();
    const userId = ctx.user?.id || "local-owner";
    return await db2.select().from(trades).where(eq2(trades.userId, userId)).orderBy(desc(trades.createdAt)).limit(input.limit);
  }),
  getBySymbol: protectedProcedure.input(z.object({ symbol: z.string(), limit: z.number().default(50) })).query(async ({ input, ctx }) => {
    const db2 = getDatabase();
    const userId = ctx.user?.id || "local-owner";
    return await db2.select().from(trades).where(and2(eq2(trades.userId, userId), eq2(trades.symbol, input.symbol))).orderBy(desc(trades.createdAt)).limit(input.limit);
  }),
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const db2 = getDatabase();
    const userId = ctx.user?.id || "local-owner";
    const tradeList = await db2.select().from(trades).where(eq2(trades.userId, userId));
    const closedTrades = tradeList.filter((t2) => t2.status === "CLOSED");
    const winningTrades = closedTrades.filter((t2) => parseFloat(t2.pnl || "0") > 0);
    const losingTrades = closedTrades.filter((t2) => parseFloat(t2.pnl || "0") < 0);
    const totalPnl = closedTrades.reduce((sum, t2) => sum + parseFloat(t2.pnl || "0"), 0);
    return {
      totalTrades: tradeList.length,
      openTrades: tradeList.filter((t2) => t2.status === "OPEN").length,
      closedTrades: closedTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: closedTrades.length > 0 ? winningTrades.length / closedTrades.length * 100 : 0,
      totalPnl,
      avgPnl: closedTrades.length > 0 ? totalPnl / closedTrades.length : 0
    };
  })
});
var logsRouter = router({
  getRecent: protectedProcedure.input(z.object({ limit: z.number().default(100) })).query(async ({ input, ctx }) => {
    const db2 = getDatabase();
    const userId = ctx.user?.id || "local-owner";
    return await db2.select().from(tradingLogs).where(eq2(tradingLogs.userId, userId)).orderBy(desc(tradingLogs.createdAt)).limit(input.limit);
  })
});
var appRouter = router({
  gateioKeys: gateioKeysRouter,
  // Backward compatibility aliases
  binanceKeys: gateioKeysRouter,
  bybitKeys: gateioKeysRouter,
  tradingConfig: tradingConfigRouter,
  botControl: botControlRouter,
  marketData: marketDataRouter,
  trades: tradesRouter,
  logs: logsRouter
});

// server/_core/context.ts
function createContext(opts) {
  return {
    user: {
      id: "local-owner"
    }
  };
}

// server/_core/index.ts
import { eq as eq3 } from "drizzle-orm";
import path from "path";
var app = express();
var PORT = process.env.PORT || 3e3;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});
async function autoRestartBot() {
  try {
    const db2 = getDatabase();
    const runningBots = await db2.select().from(botStatus).where(eq3(botStatus.isRunning, true)).limit(1);
    if (runningBots.length === 0) {
      console.log("\u2139\uFE0F No active bot found to auto-restart");
      return;
    }
    const bot = runningBots[0];
    const userId = bot.userId;
    const configId = bot.configId;
    if (!configId) {
      console.log("\u2139\uFE0F Bot has no configId, skipping auto-restart");
      return;
    }
    const keys = await db2.select().from(bybitApiKeys).where(eq3(bybitApiKeys.userId, userId)).limit(1);
    if (keys.length === 0) {
      console.log("\u26A0\uFE0F No API keys found, cannot auto-restart bot");
      return;
    }
    const configs = await db2.select().from(tradingConfigs).where(eq3(tradingConfigs.id, configId)).limit(1);
    if (configs.length === 0) {
      console.log("\u26A0\uFE0F Config not found, cannot auto-restart bot");
      return;
    }
    const config = configs[0];
    const apiKey = keys[0];
    const gateioClient = createGateioClient({
      apiKey: apiKey.apiKey,
      apiSecret: apiKey.apiSecret
    });
    const descParts = (config.description ?? "moderate|").split("|");
    const aggressiveness = ["conservative", "moderate", "aggressive"].includes(descParts[0]) ? descParts[0] : "moderate";
    const engine = new TradingEngine({
      userId,
      configId,
      gateioClient,
      maxRiskPerTrade: parseFloat(config.maxPositionSize ?? "5"),
      maxDrawdown: parseFloat(config.maxDrawdown ?? "15"),
      maxOpenPositions: config.rsiPeriod ?? 10,
      timeframe: config.timeframe ?? "15m",
      aggressiveness
    });
    await engine.start();
    tradingEngines.set(userId, engine);
    console.log(`\u{1F916} Bot auto-restarted for user ${userId} with config ${configId} (${aggressiveness})`);
  } catch (error) {
    console.error("\u26A0\uFE0F Failed to auto-restart bot:", error);
  }
}
async function startServer() {
  try {
    console.log("\u{1F527} Initializing database...");
    await initializeDatabase();
    app.use(
      "/trpc",
      createExpressMiddleware({
        router: appRouter,
        createContext
      })
    );
    if (process.env.NODE_ENV === "production") {
      const publicPath = path.join(process.cwd(), "dist/public");
      app.use(express.static(publicPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(publicPath, "index.html"));
      });
    }
    app.listen(Number(PORT), "0.0.0.0", () => {
      console.log(`\u2705 Server running on http://0.0.0.0:${PORT}`);
    });
    setTimeout(() => {
      autoRestartBot().catch((e) => console.error("Auto-restart error:", e));
    }, 3e3);
  } catch (error) {
    console.error("\u274C Failed to start server:", error);
    process.exit(1);
  }
}
startServer();
