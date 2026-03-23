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
  /**
   * Returns ALL available futures tickers (no limit), pre-filtered by minimum volume.
   * Used for full-market scanning across all 650+ pairs.
   * @param minVolume24hUsd Minimum 24h volume in USD to include (default $50,000)
   */
  async getAllTickers(minVolume24hUsd = 5e4) {
    const result = await this.futuresApi.listFuturesTickers(this.settle);
    const tickers = result.body;
    return tickers.filter((t2) => {
      const vol = parseFloat(t2.volume24hQuote || "0");
      const price = parseFloat(t2.last || "0");
      return vol >= minVolume24hUsd && price > 0 && t2.contract;
    }).sort((a, b) => parseFloat(b.volume24hQuote || "0") - parseFloat(a.volume24hQuote || "0")).map((t2) => ({
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
        // [FIX 5.9] In cross margin, leverage=0 and the real value is in crossLeverageLimit
        leverage: p.leverage && p.leverage !== "0" ? p.leverage : p.crossLeverageLimit || p.cross_leverage_limit || "10",
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
  /**
   * [FIX 6.0] Set margin mode for a contract: 'cross' or 'isolated'.
   * Uses updateContractPositionLeverage which accepts marginMode parameter.
   * Called automatically when total balance exceeds ISOLATED_MARGIN_THRESHOLD ($200).
   */
  async setMarginMode(symbol, marginMode, leverage = 10) {
    try {
      await this.futuresApi.updateContractPositionLeverage(
        this.settle,
        symbol,
        String(leverage),
        marginMode
      );
      console.log(`[GATEIO] Margin mode set to ${marginMode} for ${symbol} (lev=${leverage}x)`);
    } catch (e) {
      console.log(`[GATEIO] Margin mode note for ${symbol}: ${e?.message || String(e)}`);
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
    const positions = await this.getPositions();
    const pos = positions.find((p) => p.symbol === symbol && (!positionSide || p.side === positionSide)) || positions.find((p) => p.symbol === symbol);
    if (!pos || parseFloat(pos.size) === 0) return null;
    const absSize = Math.abs(parseFloat(pos.size));
    const closeSize = pos.side === "LONG" ? -absSize : absSize;
    console.log(`[GATEIO] Closing ${pos.side} position ${symbol}: size=${closeSize} reduceOnly=true`);
    const order = {
      contract: symbol,
      size: closeSize,
      price: "0",
      tif: "ioc",
      reduceOnly: true
    };
    const result = await this.futuresApi.createFuturesOrder(this.settle, order);
    const o = result.body;
    return {
      orderId: String(o.id || ""),
      symbol: o.contract || symbol,
      side: pos.side === "LONG" ? "SELL" : "BUY",
      size: absSize,
      price: o.fillPrice || o.fill_price || o.price || "0",
      status: o.status || "unknown"
    };
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
var TradingEngine = class _TradingEngine {
  config;
  isRunning = false;
  positions = /* @__PURE__ */ new Map();
  openai;
  cycleCount = 0;
  initialBalance = 0;
  highWaterMarkBalance = 0;
  // [FIX 13.0] Melhor baseline para drawdown
  // [CREDIT GUARD] Track consecutive AI 402/credit errors
  consecutiveAIErrors = 0;
  static MAX_CONSECUTIVE_AI_ERRORS = 3;
  // Cache
  contractInfoCache = /* @__PURE__ */ new Map();
  allTickersCache = { data: null, cachedAt: 0 };
  macroContext = null;
  static CONTRACT_CACHE_TTL = 60 * 60 * 1e3;
  static ALL_TICKERS_CACHE_TTL = 3 * 60 * 1e3;
  static MACRO_CACHE_TTL = 5 * 60 * 1e3;
  // BTC macro refreshes every 5 min
  static API_DELAY_MS = 100;
  static SNAPSHOT_BATCH_SIZE = 15;
  static AI_BATCH_SIZE = 50;
  // Capital management
  static CAPITAL_RESERVE_PCT = 0.05;
  // 5% reserve (down from 15% to deploy more capital)
  static MIN_VOLUME_24H = 5e5;
  // $500k min volume (up from $200k for better liquidity)
  // Win rate monitoring
  static WIN_RATE_ALERT_THRESHOLD = 40;
  static WIN_RATE_CHECK_INTERVAL = 10;
  static WIN_RATE_MIN_SAMPLE = 15;
  // Margin mode
  static ISOLATED_MARGIN_THRESHOLD = 200;
  static ISOLATED_MARGIN_MODE = "isolated";
  static CROSS_MARGIN_MODE = "cross";
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
      this.highWaterMarkBalance = Math.max(this.highWaterMarkBalance, this.initialBalance);
    } catch {
      this.initialBalance = 0;
    }
    await this.syncPositionsFromExchange();
    console.log(`[ENGINE v2.0] Started for user ${this.config.userId}`);
    await this.updateBotStatus({ isRunning: true });
    await this.logEvent(
      "BOT_START",
      "SYSTEM",
      `AI Trading bot v2.0 started | Profile: ${this.config.aggressiveness} | Max risk/trade: ${this.config.maxRiskPerTrade}% | Synced ${this.positions.size} positions | Balance: $${this.initialBalance.toFixed(2)}`
    );
    this.mainLoop();
  }
  async stop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    console.log(`[ENGINE v2.0] Stopping for user ${this.config.userId}...`);
    try {
      await this.logEvent("BOT_STOP", "SYSTEM", "Closing all positions before stopping...");
      const result = await this.config.gateioClient.closeAllPositions();
      if (result.closed.length > 0) {
        await this.logEvent("BOT_STOP", "SYSTEM", `Closed ${result.closed.length} positions: ${result.closed.join(", ")}`);
      }
      if (result.errors.length > 0) {
        await this.logEvent("ERROR", "SYSTEM", `Failed to close ${result.errors.length} positions: ${result.errors.join("; ")}`);
      }
      for (const [symbol, position] of Array.from(this.positions.entries())) {
        try {
          let exitPrice;
          try {
            const ticker = await this.config.gateioClient.getTicker(symbol);
            exitPrice = parseFloat(ticker.lastPrice);
          } catch {
            try {
              const exchangePositions = await this.config.gateioClient.getPositions();
              const pos = exchangePositions.find((p) => p.symbol === symbol);
              exitPrice = pos ? parseFloat(pos.markPrice) : position.entryPrice;
            } catch {
              exitPrice = position.entryPrice;
            }
          }
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
    await this.logEvent("BOT_STOP", "SYSTEM", "AI Trading bot v2.0 stopped. All positions closed.");
  }
  // --------------------------------------------------------------------------
  // Sync positions from exchange into memory on start/restart
  // --------------------------------------------------------------------------
  async syncPositionsFromExchange() {
    try {
      const exchangePositions = await this.config.gateioClient.getPositions();
      let openDbTrades = [];
      try {
        openDbTrades = await this.db.select({
          symbol: trades.symbol,
          entryTime: trades.entryTime,
          entryPrice: trades.entryPrice,
          side: trades.side,
          quantity: trades.quantity
        }).from(trades).where(and(eq(trades.status, "OPEN"), eq(trades.userId, this.config.userId)));
      } catch (dbErr) {
        console.error("[SYNC] Could not fetch open trades from DB:", this.errStr(dbErr));
      }
      let syncedCount = 0;
      for (const pos of exchangePositions) {
        const absSize = Math.abs(parseFloat(pos.size));
        if (absSize > 0 && !this.positions.has(pos.symbol)) {
          const side = pos.side === "LONG" ? "BUY" : "SELL";
          const leverage = parseFloat(pos.leverage) || 5;
          const entryPrice = parseFloat(pos.entryPrice) || 0;
          const dbTrade = openDbTrades.find((t2) => t2.symbol === pos.symbol && t2.side === side);
          const entryTime = dbTrade?.entryTime ?? /* @__PURE__ */ new Date();
          const qm = await this.getCachedContractMultiplier(pos.symbol);
          this.positions.set(pos.symbol, {
            symbol: pos.symbol,
            side,
            entryPrice: dbTrade ? parseFloat(dbTrade.entryPrice ?? "0") || entryPrice : entryPrice,
            quantity: absSize,
            entryTime,
            leverage,
            confidence: 50,
            quantoMultiplier: qm,
            highWaterMarkPct: 0,
            trailingStopPct: -(this.config.maxRiskPerTrade ?? 3)
          });
          syncedCount++;
          console.log(`[SYNC] Restored: ${pos.symbol} ${side} qty=${absSize} entry=${entryPrice} lev=${leverage}x`);
        }
      }
      console.log(`[SYNC] Complete: ${syncedCount} positions restored`);
    } catch (error) {
      console.error("[SYNC] Error:", this.errStr(error));
    }
  }
  // --------------------------------------------------------------------------
  // Main Loop
  // --------------------------------------------------------------------------
  async mainLoop() {
    while (this.isRunning) {
      try {
        this.cycleCount++;
        await this.logEvent(
          "CYCLE_START",
          "SYSTEM",
          `Cycle #${this.cycleCount} | Positions: ${this.positions.size}`
        );
        if (await this.isDrawdownExceeded()) {
          await this.logEvent(
            "RISK_STOP",
            "SYSTEM",
            `Max drawdown ${this.config.maxDrawdown}% exceeded. Closing all positions.`
          );
          await this.closeAllPositions("MAX_DRAWDOWN");
          await this.logEvent(
            "AUTO_RESTART",
            "SYSTEM",
            "Drawdown limit hit. All positions closed. Resetting baseline."
          );
          try {
            const freshBalance = await this.config.gateioClient.getBalance();
            this.initialBalance = parseFloat(freshBalance.totalBalance);
            this.highWaterMarkBalance = this.initialBalance;
            await this.logEvent(
              "AUTO_RESTART",
              "SYSTEM",
              `New baseline: $${this.initialBalance.toFixed(2)}. HWM reset. Cooldown 3 min.`
            );
          } catch (e) {
            await this.logEvent("ERROR", "SYSTEM", `Failed to reset balance: ${this.errStr(e)}`);
            await this.stop();
            return;
          }
          await this.sleep(3 * 60 * 1e3);
          continue;
        }
        await this.updateMacroContext();
        await this.monitorPositions();
        await this.scanAndTrade();
        if (this.cycleCount % _TradingEngine.WIN_RATE_CHECK_INTERVAL === 0) {
          await this.checkWinRateAlert();
        }
        await this.updateBotStatus({ isRunning: true });
        const waitMs = this.config.aggressiveness === "aggressive" ? 10 * 60 * 1e3 : this.config.aggressiveness === "moderate" ? 15 * 60 * 1e3 : 20 * 60 * 1e3;
        await this.sleep(waitMs);
      } catch (error) {
        const msg = this.errStr(error);
        console.error("Error in trading loop:", msg);
        await this.logEvent("ERROR", "SYSTEM", `Loop error: ${msg}`);
        await this.sleep(60 * 1e3);
      }
    }
  }
  // --------------------------------------------------------------------------
  // BTC Macro Trend Filter
  // --------------------------------------------------------------------------
  async updateMacroContext() {
    if (this.macroContext && Date.now() - this.macroContext.timestamp < _TradingEngine.MACRO_CACHE_TTL) {
      return;
    }
    try {
      const btcSnapshot = await this.getMarketSnapshot("BTC_USDT");
      if (!btcSnapshot) {
        this.macroContext = {
          btcTrend: "SIDEWAYS",
          btcRsi: 50,
          btcChange24h: 0,
          btcVolatility: 0,
          marketSentiment: "NEUTRAL",
          timestamp: Date.now()
        };
        return;
      }
      let sentiment = "NEUTRAL";
      if (btcSnapshot.trend === "BULLISH" && btcSnapshot.rsi > 45 && btcSnapshot.rsi < 75) {
        sentiment = "RISK_ON";
      } else if (btcSnapshot.trend === "BEARISH" || btcSnapshot.rsi > 80 || btcSnapshot.change24h < -3) {
        sentiment = "RISK_OFF";
      }
      this.macroContext = {
        btcTrend: btcSnapshot.trend,
        btcRsi: btcSnapshot.rsi,
        btcChange24h: btcSnapshot.change24h,
        btcVolatility: btcSnapshot.volatility.volatility,
        marketSentiment: sentiment,
        timestamp: Date.now()
      };
      await this.logEvent(
        "INFO",
        "BTC",
        `[MACRO] BTC: ${btcSnapshot.trend} | RSI: ${btcSnapshot.rsi.toFixed(1)} | 24h: ${btcSnapshot.change24h.toFixed(2)}% | Sentiment: ${sentiment}`
      );
    } catch (error) {
      console.error("[MACRO] Error updating BTC context:", this.errStr(error));
    }
  }
  // --------------------------------------------------------------------------
  // Market Scanning — Discover top opportunities with macro filter
  // --------------------------------------------------------------------------
  async scanAndTrade() {
    try {
      const isRiskOff = this.macroContext?.marketSentiment === "RISK_OFF";
      if (isRiskOff) {
        await this.logEvent(
          "INFO",
          "SYSTEM",
          `[SCAN] RISK_OFF (BTC: ${this.macroContext.btcTrend}, RSI: ${this.macroContext.btcRsi.toFixed(1)}, 24h: ${this.macroContext.btcChange24h.toFixed(2)}%) \u2014 IA instru\xEDda a priorizar SHORTs`
        );
      }
      const allTickers = await this.getCachedAllTickers();
      const candidateTickers = allTickers.filter((t2) => !this.positions.has(t2.symbol));
      await this.logEvent(
        "INFO",
        "SYSTEM",
        `[SCAN] Stage 1: ${allTickers.length} tickers (vol>$${(_TradingEngine.MIN_VOLUME_24H / 1e3).toFixed(0)}k) | ${candidateTickers.length} candidates`
      );
      if (candidateTickers.length === 0) return;
      const snapshots = [];
      let snapshotErrors = 0;
      const batchSize = _TradingEngine.SNAPSHOT_BATCH_SIZE;
      for (let i = 0; i < candidateTickers.length; i += batchSize) {
        if (!this.isRunning) break;
        const batch = candidateTickers.slice(i, i + batchSize);
        const batchResults = await Promise.allSettled(
          batch.map((ticker) => this.getMarketSnapshot(ticker.symbol))
        );
        for (const result of batchResults) {
          if (result.status === "fulfilled" && result.value) {
            snapshots.push(result.value);
          } else {
            snapshotErrors++;
          }
        }
        if (i + batchSize < candidateTickers.length) {
          await this.sleep(_TradingEngine.API_DELAY_MS * 3);
        }
      }
      await this.logEvent(
        "INFO",
        "SYSTEM",
        `[SCAN] Stage 2: ${snapshots.length} snapshots | ${snapshotErrors} errors`
      );
      if (snapshots.length === 0) return;
      const filteredSnapshots = snapshots.filter((s) => {
        if (s.volatility.volatility < 0.4) return false;
        if (s.volumeAnalysis.volumeRatio < 0.5) return false;
        if (s.rsi > 85 || s.rsi < 15) return false;
        if (Math.abs(s.change24h) > 15) return false;
        return true;
      });
      await this.logEvent(
        "INFO",
        "SYSTEM",
        `[SCAN] Pre-filter: ${filteredSnapshots.length}/${snapshots.length} passed quantitative filters`
      );
      if (filteredSnapshots.length === 0) return;
      const allDecisions = [];
      const aiBatchSize = _TradingEngine.AI_BATCH_SIZE;
      for (let i = 0; i < filteredSnapshots.length; i += aiBatchSize) {
        if (!this.isRunning) break;
        const snapshotBatch = filteredSnapshots.slice(i, i + aiBatchSize);
        const batchDecisions = await this.askAIForOpportunities(snapshotBatch);
        allDecisions.push(...batchDecisions);
      }
      allDecisions.sort((a, b) => b.confidence - a.confidence);
      await this.logEvent(
        "INFO",
        "SYSTEM",
        `[SCAN] AI returned ${allDecisions.length} recommendations`
      );
      let openedCount = 0;
      for (const decision of allDecisions) {
        if (!this.isRunning) break;
        if (decision.action === "SKIP" || decision.action === "HOLD") continue;
        if (decision.confidence < this.getMinConfidence()) continue;
        if (this.positions.has(decision.symbol)) continue;
        if (isRiskOff && decision.action === "OPEN_LONG" && decision.confidence < this.getMinConfidence() + 5) {
          await this.logEvent("INFO", decision.symbol, `[MACRO] LONG rejeitado em RISK_OFF (confian\xE7a ${decision.confidence}% insuficiente)`);
          continue;
        }
        const balance = await this.config.gateioClient.getBalance();
        const totalBalance = parseFloat(balance.totalBalance);
        const available = parseFloat(balance.availableBalance);
        const reserveFloor = totalBalance * _TradingEngine.CAPITAL_RESERVE_PCT;
        const deployable = available - reserveFloor;
        if (deployable < 2) {
          await this.logEvent(
            "INFO",
            "SYSTEM",
            `[SCAN] Capital limit: deployable $${deployable.toFixed(2)} (reserve $${reserveFloor.toFixed(2)})`
          );
          break;
        }
        decision.leverage = Math.min(decision.leverage, this.getMaxLeverage());
        if (this.macroContext?.marketSentiment === "NEUTRAL") {
          decision.leverage = Math.max(1, decision.leverage - 1);
        }
        try {
          await this.executeDecision(decision);
          openedCount++;
          await this.sleep(_TradingEngine.API_DELAY_MS * 2);
        } catch (error) {
          await this.logEvent("ERROR", decision.symbol, `Execute failed: ${this.errStr(error)}`);
        }
      }
      await this.logEvent(
        "INFO",
        "SYSTEM",
        `[SCAN] Opened ${openedCount} positions | Total: ${this.positions.size} | ~$${(this.positions.size * 10).toFixed(0)} deployed`
      );
    } catch (error) {
      await this.logEvent("ERROR", "SYSTEM", `Scan error: ${this.errStr(error)}`);
    }
  }
  // Confidence thresholds — OTIMIZADO PARA MAIS TRADES
  getMinConfidence() {
    return this.config.aggressiveness === "conservative" ? 80 : this.config.aggressiveness === "moderate" ? 75 : 70;
  }
  // Leverage limits — OTIMIZADO PARA MAIOR LUCRO EM SINAIS FORTES
  getMaxLeverage() {
    return this.config.aggressiveness === "conservative" ? 5 : this.config.aggressiveness === "moderate" ? 8 : 12;
  }
  // --------------------------------------------------------------------------
  // Position Monitoring — Hard stops + Trailing + AI decisions
  // --------------------------------------------------------------------------
  async monitorPositions() {
    for (const [symbol, position] of Array.from(this.positions.entries())) {
      try {
        const holdTimeMinutes = (Date.now() - position.entryTime.getTime()) / (1e3 * 60);
        const minHoldMinutes = this.getMinHoldMinutes();
        const snapshot = await this.getMarketSnapshot(symbol);
        if (!snapshot) continue;
        const pnlPercent = position.side === "BUY" ? (snapshot.price - position.entryPrice) / position.entryPrice * 100 : (position.entryPrice - snapshot.price) / position.entryPrice * 100;
        if (pnlPercent > position.highWaterMarkPct) {
          position.highWaterMarkPct = pnlPercent;
          if (pnlPercent >= 8) {
            position.trailingStopPct = Math.max(position.trailingStopPct, 6);
          } else if (pnlPercent >= 4) {
            position.trailingStopPct = Math.max(position.trailingStopPct, 2.5);
          } else if (pnlPercent >= 2) {
            position.trailingStopPct = Math.max(position.trailingStopPct, 1);
          } else if (pnlPercent >= 1) {
            position.trailingStopPct = Math.max(position.trailingStopPct, 0.1);
          }
        }
        const stopLevel = position.trailingStopPct;
        if (pnlPercent <= stopLevel) {
          const stopType = stopLevel >= 0 ? "TRAIL_STOP" : "HARD_STOP";
          const reason = `[${stopType}] P&L ${pnlPercent.toFixed(2)}% <= stop ${stopLevel.toFixed(2)}% (HWM: ${position.highWaterMarkPct.toFixed(2)}%)`;
          await this.logEvent("RISK_STOP", symbol, reason);
          await this.closePosition(symbol, snapshot.price, reason);
          continue;
        }
        if (holdTimeMinutes > 60 && Math.abs(pnlPercent) < 0.5) {
          const reason = `[TIME_STOP] Held ${holdTimeMinutes.toFixed(0)}m with only ${pnlPercent.toFixed(2)}% P&L \u2014 freeing capital`;
          await this.logEvent("INFO", symbol, reason);
          await this.closePosition(symbol, snapshot.price, reason);
          continue;
        }
        if (holdTimeMinutes < minHoldMinutes) {
          continue;
        }
        const decision = await this.askAIForPositionManagement(position, snapshot, pnlPercent);
        if (decision.action === "CLOSE") {
          await this.closePosition(symbol, snapshot.price, decision.reasoning);
        }
        await this.sleep(_TradingEngine.API_DELAY_MS);
      } catch (error) {
        console.error(`Error monitoring ${symbol}:`, this.errStr(error));
      }
    }
  }
  // Minimum hold time — gives positions time to develop
  getMinHoldMinutes() {
    const tfMinutes = {
      "1m": 5,
      "5m": 20,
      "15m": 30,
      "30m": 60,
      "1h": 90,
      "4h": 360,
      "1d": 1440
    };
    return tfMinutes[this.config.timeframe] || 30;
  }
  // --------------------------------------------------------------------------
  // Win Rate Monitoring
  // --------------------------------------------------------------------------
  async checkWinRateAlert() {
    try {
      const statusRows = await this.db.select().from(botStatus).where(eq(botStatus.userId, this.config.userId)).limit(1);
      if (statusRows.length === 0) return;
      const s = statusRows[0];
      const total = s.totalTrades || 0;
      const wins = s.winningTrades || 0;
      const losses = s.losingTrades || 0;
      const pnl = parseFloat(s.totalPnl || "0");
      if (total < _TradingEngine.WIN_RATE_MIN_SAMPLE) return;
      const winRate = wins / total * 100;
      if (winRate < _TradingEngine.WIN_RATE_ALERT_THRESHOLD) {
        await this.logEvent(
          "ERROR",
          "SYSTEM",
          `[WIN_RATE] ALERT: ${winRate.toFixed(1)}% < ${_TradingEngine.WIN_RATE_ALERT_THRESHOLD}% | W:${wins} L:${losses} | PnL: ${pnl >= 0 ? "+" : ""}${pnl.toFixed(4)} USDT`
        );
      } else {
        await this.logEvent(
          "INFO",
          "SYSTEM",
          `[WIN_RATE] OK: ${winRate.toFixed(1)}% (${wins}W/${losses}L) | PnL: ${pnl >= 0 ? "+" : ""}${pnl.toFixed(4)} USDT`
        );
      }
    } catch (e) {
      console.error("[WIN_RATE] Error:", this.errStr(e));
    }
  }
  // --------------------------------------------------------------------------
  // AI Decision Engine — Optimized Prompts
  // --------------------------------------------------------------------------
  async askAIForOpportunities(snapshots) {
    const balance = await this.config.gateioClient.getBalance();
    const totalBalance = parseFloat(balance.totalBalance);
    const availableBalance = parseFloat(balance.availableBalance);
    const reserveFloor = totalBalance * _TradingEngine.CAPITAL_RESERVE_PCT;
    const deployableBalance = Math.max(0, availableBalance - reserveFloor);
    const marketSummary = snapshots.map((s) => ({
      symbol: s.symbol,
      price: s.price,
      change24h: `${s.change24h.toFixed(2)}%`,
      rsi: s.rsi.toFixed(1),
      macd_bullish: s.macd.bullish,
      macd_histogram: s.macd.histogram.toFixed(6),
      bb_position: s.bb.position.toFixed(1),
      volume_ratio: s.volumeAnalysis.volumeRatio.toFixed(2),
      volatility: `${s.volatility.volatility.toFixed(2)}% (${s.volatility.trend})`,
      trend: s.trend,
      funding_rate: s.fundingRate.toFixed(6),
      above_ema50: s.price > s.ema50,
      above_ema200: s.price > s.ema200
    }));
    const minConf = this.getMinConfidence();
    const maxLev = this.getMaxLeverage();
    const maxNewPositions = Math.max(1, Math.floor(deployableBalance / 10));
    const macroInfo = this.macroContext ? `
CONTEXTO MACRO (BTC): Tend\xEAncia=${this.macroContext.btcTrend} | RSI=${this.macroContext.btcRsi.toFixed(1)} | 24h=${this.macroContext.btcChange24h.toFixed(2)}% | Sentimento=${this.macroContext.marketSentiment}` : "";
    const systemPrompt = `Voc\xEA \xE9 um gestor quantitativo de futuros cripto com foco em QUALIDADE sobre QUANTIDADE de trades.

OBJETIVO: Identificar APENAS trades de ALTA PROBABILIDADE com conflu\xEAncia t\xE9cnica clara. Prefira N\xC3O operar a operar mal.

FILOSOFIA:
- MAXIMIZAR LUCRO: Identifique as tend\xEAncias mais fortes. Se o mercado est\xE1 vol\xE1til, capture os rompimentos.
- CONFLU\xCANCIA OBRIGAT\xD3RIA: M\xEDnimo 3 indicadores alinhados para abrir posi\xE7\xE3o.
- N\xC3O HESITE EM SHORTAR: Se o mercado est\xE1 caindo, abra shorts agressivamente nas moedas mais fracas.
- ALAVANCAGEM ADAPTATIVA: Use alavancagem m\xE1xima permitida apenas quando houver rompimento claro de resist\xEAncia/suporte com alto volume.
- RESPEITE O MACRO: Se BTC est\xE1 bearish, priorize SHORTS. Se bullish, priorize LONGS.
${macroInfo}

CRIT\xC9RIOS DE ENTRADA (TODOS devem ser atendidos):

LONG requer pelo menos 3 de:
  1. RSI < 40 (oversold) OU RSI entre 40-55 com tend\xEAncia de alta
  2. MACD bullish (histogram positivo e crescente)
  3. Pre\xE7o acima da EMA50
  4. BB position < 30 (perto da banda inferior = desconto)
  5. Volume ratio > 1.2 (confirma\xE7\xE3o de volume)
  6. Tend\xEAncia geral BULLISH
  7. Funding rate negativo (shorts pagando longs = press\xE3o de alta)

SHORT requer pelo menos 3 de:
  1. RSI > 60 (overbought) OU RSI entre 45-60 com tend\xEAncia de queda
  2. MACD bearish (histogram negativo e decrescente)
  3. Pre\xE7o abaixo da EMA50
  4. BB position > 70 (perto da banda superior = sobrevalorizado)
  5. Volume ratio > 1.2 (confirma\xE7\xE3o de volume)
  6. Tend\xEAncia geral BEARISH
  7. Funding rate positivo (longs pagando shorts = press\xE3o de queda)

FILTROS DE REJEI\xC7\xC3O (N\xC3O abra posi\xE7\xE3o se):
  - Volatilidade > 8% (risco de whipsaw)
  - Volume ratio < 0.5 (sem liquidez)
  - RSI entre 45-55 SEM confirma\xE7\xE3o de MACD e tend\xEAncia (zona neutra)
  - Mudan\xE7a 24h > 10% (movimento j\xE1 exausto)

EXCHANGE: Gate.io Futures (USDT-M) \u2014 S\xEDmbolos: BTC_USDT, ETH_USDT

PERFIL: ${this.config.aggressiveness}
- Alavancagem: 1-${maxLev}x (use MENOR alavancagem para menor confian\xE7a)
- Confian\xE7a m\xEDnima: ${minConf}%

CAPITAL:
- Deploy\xE1vel: ${deployableBalance.toFixed(2)} USDT
- Posi\xE7\xF5es abertas: ${this.positions.size}
- M\xE1x novas posi\xE7\xF5es: ${maxNewPositions} ($10 cada)

REGRAS:
- Retorne APENAS trades com confian\xE7a >= ${minConf}%
- Ordene por confian\xE7a (maior primeiro)
- NUNCA repita s\xEDmbolo
- Se nenhum trade atende os crit\xE9rios, retorne []
- Na d\xFAvida, N\xC3O opere (retorne [])
- Alavancagem deve ser proporcional \xE0 confian\xE7a: 75-80% \u2192 ${Math.max(1, maxLev - 2)}x, 80-90% \u2192 ${Math.max(1, maxLev - 1)}x, 90%+ \u2192 ${maxLev}x

Responda APENAS com JSON array:
[{"action":"OPEN_LONG"|"OPEN_SHORT","symbol":"BTC_USDT","confidence":80,"leverage":${maxLev},"positionSizePercent":100,"reasoning":"3+ indicadores: RSI=35 oversold + MACD bullish + acima EMA50 + volume_ratio=1.8"}]`;
    try {
      const response = await this.openai.chat.completions.create({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Dados de mercado:
${JSON.stringify(marketSummary, null, 2)}` }
        ],
        temperature: 0.2,
        // Lower temperature for more conservative decisions
        max_tokens: 2e3
      });
      this.consecutiveAIErrors = 0;
      const content = response.choices[0]?.message?.content ?? "[]";
      console.log(`[AI] Response: ${content.substring(0, 300)}`);
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];
      const decisions = JSON.parse(jsonMatch[0]);
      console.log(`[AI] ${decisions.length} decisions: ${decisions.map((d) => `${d.action} ${d.symbol} conf:${d.confidence}`).join(", ")}`);
      return decisions;
    } catch (error) {
      const errMsg = this.errStr(error);
      await this.logEvent("ERROR", "AI", `AI analysis failed: ${errMsg}`);
      await this.handleAIError(errMsg);
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
- Tempo: ${holdTime.toFixed(0)} min
- Trailing stop: ${position.trailingStopPct.toFixed(2)}% (HWM: ${position.highWaterMarkPct.toFixed(2)}%)

Indicadores:
- RSI: ${snapshot.rsi.toFixed(1)}
- MACD: bullish=${snapshot.macd.bullish}, histogram=${snapshot.macd.histogram.toFixed(6)}
- BB position: ${snapshot.bb.position.toFixed(1)}
- Volatilidade: ${snapshot.volatility.volatility.toFixed(2)}% (${snapshot.volatility.trend})
- Volume ratio: ${snapshot.volumeAnalysis.volumeRatio.toFixed(2)}
- Tend\xEAncia: ${snapshot.trend}
- Acima EMA50: ${snapshot.price > snapshot.ema50}
- Acima EMA200: ${snapshot.price > snapshot.ema200}

CONTEXTO MACRO: BTC ${this.macroContext?.btcTrend ?? "N/A"} | Sentimento: ${this.macroContext?.marketSentiment ?? "N/A"}

REGRAS (siga rigorosamente):

1. ZONA DE RU\xCDDO (|P&L| < 1%):
   - N\xC3O feche por ru\xEDdo. D\xEA espa\xE7o para o trade respirar.
   
2. POSI\xC7\xC3O LUCRATIVA (P&L > +1.5%):
   - HOLD absoluto se a tend\xEAncia continuar a seu favor (RSI subindo para LONGs, caindo para SHORTs).
   - O trailing stop do sistema \xE9 agressivo e j\xE1 protege os lucros. S\xD3 ordene CLOSE se houver um PICO CLIM\xC1TICO (volume explosivo + RSI > 85 ou < 15) indicando exaust\xE3o imediata.
   
3. POSI\xC7\xC3O COM PREJU\xCDZO (P&L < -1.0%):
   - CORTAR PERDAS R\xC1PIDO: Se a tend\xEAncia virou contra a posi\xE7\xE3o (MACD cruzou contra, pre\xE7o cruzou EMA50 contra) \u2192 CLOSE imediatamente. N\xE3o espere o stop-loss bater.
   - Se a estrutura ainda est\xE1 intacta (apenas um pullback) \u2192 HOLD.

4. O sistema j\xE1 tem stop-loss autom\xE1tico e trailing stop \u2014 voc\xEA foca apenas em ler a estrutura de mercado.

5. MAXIMIZE GANHOS: Deixe os trades vencedores correrem o m\xE1ximo poss\xEDvel.

6. CORTE PERDAS: Seja impiedoso com trades que perderam a estrutura t\xE9cnica.

Decida: CLOSE ou HOLD?
JSON: {"action":"CLOSE"|"HOLD","symbol":"${position.symbol}","confidence":0,"leverage":0,"positionSizePercent":0,"reasoning":"..."}`;
    try {
      const response = await this.openai.chat.completions.create({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: "Voc\xEA \xE9 um gestor de risco quantitativo. Siga as REGRAS rigorosamente. Deixe os trades se desenvolverem. Na d\xFAvida, HOLD." },
          { role: "user", content: prompt }
        ],
        temperature: 0.15,
        max_tokens: 500
      });
      this.consecutiveAIErrors = 0;
      const content = response.choices[0]?.message?.content ?? '{"action":"HOLD"}';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { action: "HOLD", symbol: position.symbol, confidence: 0, leverage: 0, positionSizePercent: 0, reasoning: "Parse error" };
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      const errMsg = this.errStr(error);
      await this.logEvent("ERROR", "AI", `AI position mgmt failed: ${errMsg}`);
      await this.handleAIError(errMsg);
      return { action: "HOLD", symbol: position.symbol, confidence: 0, leverage: 0, positionSizePercent: 0, reasoning: "AI error - holding" };
    }
  }
  // --------------------------------------------------------------------------
  // [CREDIT GUARD] AI credit exhaustion detection
  // --------------------------------------------------------------------------
  async handleAIError(errMsg) {
    const isCreditError = errMsg.includes("402") || errMsg.toLowerCase().includes("insufficient credits") || errMsg.toLowerCase().includes("credit") || errMsg.toLowerCase().includes("quota") || errMsg.toLowerCase().includes("billing");
    if (isCreditError) {
      this.consecutiveAIErrors++;
      await this.logEvent(
        "ERROR",
        "AI",
        `[CREDIT GUARD] Error #${this.consecutiveAIErrors}/${_TradingEngine.MAX_CONSECUTIVE_AI_ERRORS}: ${errMsg}`
      );
      if (this.consecutiveAIErrors >= _TradingEngine.MAX_CONSECUTIVE_AI_ERRORS) {
        await this.logEvent(
          "ERROR",
          "SYSTEM",
          `[CREDIT GUARD] AI credits EXHAUSTED. EMERGENCY CLOSING ${this.positions.size} positions.`
        );
        await this.closeAllPositions("AI_CREDITS_EXHAUSTED");
        await this.stop();
      }
    } else {
      this.consecutiveAIErrors = 0;
    }
  }
  // --------------------------------------------------------------------------
  // Market Data Collection — with EMA200 and multi-timeframe
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
      let ema200 = ema50;
      if (prices.length >= 200) {
        ema200 = calculateEMAValue(prices, 200);
      }
      const ticker = await this.config.gateioClient.getTicker(symbol);
      const change24h = parseFloat(ticker.priceChangePercent);
      const fundingRate = parseFloat(ticker.fundingRate);
      const volume24h = parseFloat(ticker.volume24h);
      let trend = "SIDEWAYS";
      const bullishSignals = [
        currentPrice > ema50,
        macd.bullish,
        rsi.rsi > 45,
        currentPrice > ema200
      ].filter(Boolean).length;
      const bearishSignals = [
        currentPrice < ema50,
        !macd.bullish,
        rsi.rsi < 55,
        currentPrice < ema200
      ].filter(Boolean).length;
      if (bullishSignals >= 3) trend = "BULLISH";
      else if (bearishSignals >= 3) trend = "BEARISH";
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
        ema200,
        fundingRate,
        trend
      };
    } catch (error) {
      console.error(`[SNAPSHOT] Error for ${symbol}: ${this.errStr(error)}`);
      return null;
    }
  }
  // --------------------------------------------------------------------------
  // Cached API calls
  // --------------------------------------------------------------------------
  async getCachedContractMultiplier(symbol) {
    const cached = this.contractInfoCache.get(symbol);
    if (cached && Date.now() - cached.cachedAt < _TradingEngine.CONTRACT_CACHE_TTL) {
      return parseFloat(cached.data.quantoMultiplier || cached.data.quanto_multiplier || "1");
    }
    try {
      const contractInfo = await this.config.gateioClient.getContractInfo(symbol);
      this.contractInfoCache.set(symbol, { data: contractInfo, cachedAt: Date.now() });
      return parseFloat(contractInfo.quantoMultiplier || contractInfo.quanto_multiplier || "1");
    } catch (error) {
      if (cached) return parseFloat(cached.data.quantoMultiplier || cached.data.quanto_multiplier || "1");
      return 1;
    }
  }
  async getCachedContractInfo(symbol) {
    const cached = this.contractInfoCache.get(symbol);
    if (cached && Date.now() - cached.cachedAt < _TradingEngine.CONTRACT_CACHE_TTL) {
      return cached.data;
    }
    const contractInfo = await this.config.gateioClient.getContractInfo(symbol);
    this.contractInfoCache.set(symbol, { data: contractInfo, cachedAt: Date.now() });
    return contractInfo;
  }
  async getCachedAllTickers() {
    if (this.allTickersCache.data && Date.now() - this.allTickersCache.cachedAt < _TradingEngine.ALL_TICKERS_CACHE_TTL) {
      return this.allTickersCache.data;
    }
    const tickers = await this.config.gateioClient.getAllTickers(_TradingEngine.MIN_VOLUME_24H);
    this.allTickersCache = { data: tickers, cachedAt: Date.now() };
    return tickers;
  }
  // --------------------------------------------------------------------------
  // Trade Execution
  // --------------------------------------------------------------------------
  async executeDecision(decision) {
    const side = decision.action === "OPEN_LONG" ? "BUY" : "SELL";
    decision.leverage = Math.min(decision.leverage, this.getMaxLeverage());
    try {
      const balance = await this.config.gateioClient.getBalance();
      const totalBalance = parseFloat(balance.totalBalance);
      const available = parseFloat(balance.availableBalance);
      const reserveFloor = totalBalance * _TradingEngine.CAPITAL_RESERVE_PCT;
      const deployable = Math.max(0, available - reserveFloor);
      const targetSize = decision.confidence >= 90 ? 20 : decision.confidence >= 80 ? 15 : 10;
      const baseValue = Math.min(deployable, targetSize);
      const notionalValue = baseValue * decision.leverage;
      const ticker = await this.config.gateioClient.getTicker(decision.symbol);
      const currentPrice = parseFloat(ticker.lastPrice);
      if (currentPrice <= 0) return;
      const contractInfo = await this.getCachedContractInfo(decision.symbol);
      const quantoMultiplier = parseFloat(contractInfo.quantoMultiplier || contractInfo.quanto_multiplier || "0.001");
      const contractValue = currentPrice * quantoMultiplier;
      const rawContracts = notionalValue / contractValue;
      const contracts = Math.floor(rawContracts);
      if (contracts <= 0) return;
      const targetMarginMode = totalBalance >= _TradingEngine.ISOLATED_MARGIN_THRESHOLD ? _TradingEngine.ISOLATED_MARGIN_MODE : _TradingEngine.CROSS_MARGIN_MODE;
      try {
        await this.config.gateioClient.setMarginMode(
          decision.symbol,
          targetMarginMode,
          decision.leverage
        );
      } catch (e) {
        console.log(`Margin mode note for ${decision.symbol}:`, this.errStr(e));
      }
      try {
        await this.config.gateioClient.setLeverage(decision.symbol, decision.leverage);
      } catch (e) {
        console.log(`Leverage note for ${decision.symbol}:`, this.errStr(e));
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
        confidence: decision.confidence,
        quantoMultiplier,
        highWaterMarkPct: 0,
        // OTIMIZADO: Stop-loss inicial dinâmico (mais largo para menor alavancagem, mais justo para alta)
        // Isso evita violinadas em moedas voláteis com baixa alavancagem
        trailingStopPct: decision.leverage > 8 ? -2.5 : -3.5
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
        stopLoss: quantoMultiplier.toString(),
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
        `${side} ${contracts}ct @ ${currentPrice} | Lev:${decision.leverage}x | Conf:${decision.confidence}% | Base:$${baseValue.toFixed(2)} | ${decision.reasoning}`
      );
    } catch (error) {
      await this.logEvent("ERROR", decision.symbol, `Execute error: ${this.errStr(error)}`);
    }
  }
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
  async closePositionRecord(symbol, exitPrice, reason) {
    try {
      const position = this.positions.get(symbol);
      if (!position) return;
      let quantoMultiplier = position.quantoMultiplier;
      if (!quantoMultiplier || quantoMultiplier <= 0) {
        try {
          const tradeRecord2 = await this.db.select().from(trades).where(and(eq(trades.symbol, symbol), eq(trades.status, "OPEN"), eq(trades.userId, this.config.userId))).limit(1);
          if (tradeRecord2.length > 0 && tradeRecord2[0].stopLoss) {
            const dbQm = parseFloat(tradeRecord2[0].stopLoss);
            if (dbQm > 0) quantoMultiplier = dbQm;
          }
        } catch {
        }
        if (!quantoMultiplier || quantoMultiplier <= 0) {
          quantoMultiplier = await this.getCachedContractMultiplier(symbol);
        }
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
        await this.sleep(_TradingEngine.API_DELAY_MS);
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
      const total = parseFloat(balance.totalBalance);
      const unrealized = parseFloat(balance.unrealizedPnl || "0");
      const equity = total + unrealized;
      if (equity > this.highWaterMarkBalance) {
        this.highWaterMarkBalance = equity;
      }
      const baseline = Math.max(this.highWaterMarkBalance, this.initialBalance);
      const drawdown = (baseline - equity) / baseline * 100;
      const effectiveLimit = Math.max(this.config.maxDrawdown, 20);
      if (drawdown >= effectiveLimit * 0.75) {
        await this.logEvent(
          "ERROR",
          "SYSTEM",
          `[DRAWDOWN] Warning: ${drawdown.toFixed(2)}% (limit: ${effectiveLimit}%) | equity=$${equity.toFixed(2)} hwm=$${baseline.toFixed(2)}`
        );
      }
      if (drawdown >= effectiveLimit) {
        const hasWinningPositions = Array.from(this.positions.values()).some((p) => {
          return unrealized > 0;
        });
        if (hasWinningPositions && drawdown < effectiveLimit + 5) {
          await this.logEvent(
            "ERROR",
            "SYSTEM",
            `[DRAWDOWN] ${drawdown.toFixed(2)}% >= ${effectiveLimit}% mas h\xE1 posi\xE7\xF5es lucrativas \u2014 aguardando`
          );
          return false;
        }
        return true;
      }
      return false;
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
          startedAt: update.isRunning && !existing[0].startedAt ? /* @__PURE__ */ new Date() : existing[0].startedAt,
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
      maxDrawdown: z.number().min(5).max(50).default(10),
      maxOpenPositions: z.number().min(1).max(500).default(100),
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
      const aggressiveness = ["conservative", "moderate", "aggressive"].includes(descParts[0]) ? descParts[0] : "aggressive";
      const description = descParts.slice(1).join("|") || "Estrat\xE9gia AI Aut\xF4noma";
      return {
        id: c.id,
        name: c.name,
        description,
        aggressiveness,
        maxRiskPerTrade: parseFloat(c.maxPositionSize ?? "5"),
        maxDrawdown: parseFloat(c.maxDrawdown ?? "10"),
        maxOpenPositions: c.rsiPeriod ?? 100,
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
    const aggressiveness = ["conservative", "moderate", "aggressive"].includes(descParts[0]) ? descParts[0] : "aggressive";
    return {
      id: c.id,
      name: c.name,
      description: descParts.slice(1).join("|") || "Estrat\xE9gia AI Aut\xF4noma",
      aggressiveness,
      maxRiskPerTrade: parseFloat(c.maxPositionSize ?? "5"),
      maxDrawdown: parseFloat(c.maxDrawdown ?? "10"),
      maxOpenPositions: c.rsiPeriod ?? 100,
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
    const aggressiveness = ["conservative", "moderate", "aggressive"].includes(descParts[0]) ? descParts[0] : "aggressive";
    const engine = new TradingEngine({
      userId,
      configId: input.configId,
      gateioClient,
      maxRiskPerTrade: parseFloat(config.maxPositionSize ?? "5"),
      maxDrawdown: parseFloat(config.maxDrawdown ?? "10"),
      maxOpenPositions: config.rsiPeriod ?? 100,
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
    const openTrades = await db2.select().from(trades).where(and2(eq2(trades.userId, userId), eq2(trades.status, "OPEN")));
    const priceMap = {};
    for (const t2 of openTrades) {
      if (!priceMap[t2.symbol]) {
        try {
          const ticker = await gateioClient.getTicker(t2.symbol);
          priceMap[t2.symbol] = parseFloat(ticker.lastPrice);
        } catch {
          priceMap[t2.symbol] = 0;
        }
      }
    }
    const result = await gateioClient.closeAllPositions();
    for (const t2 of openTrades) {
      try {
        const exitPrice = priceMap[t2.symbol] || 0;
        const entryPrice = parseFloat(t2.entryPrice || "0");
        const quantity = parseFloat(t2.quantity || "0");
        const quantoMultiplier = parseFloat(t2.stopLoss || "0") > 0 ? parseFloat(t2.stopLoss) : 1;
        let pnl = 0;
        let pnlPercent = 0;
        if (exitPrice > 0 && entryPrice > 0) {
          pnl = t2.side === "BUY" ? (exitPrice - entryPrice) * quantity * quantoMultiplier : (entryPrice - exitPrice) * quantity * quantoMultiplier;
          pnlPercent = t2.side === "BUY" ? (exitPrice - entryPrice) / entryPrice * 100 : (entryPrice - exitPrice) / entryPrice * 100;
        }
        await db2.update(trades).set({
          status: "CLOSED",
          exitPrice: exitPrice > 0 ? exitPrice.toString() : null,
          exitTime: /* @__PURE__ */ new Date(),
          exitReason: "EMERGENCY_CLOSE",
          pnl: pnl.toString(),
          pnlPercent: Math.max(-999.99, Math.min(999.99, pnlPercent)).toFixed(2)
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
var maintenanceRouter = router({
  /**
   * Recalculate PnL for all closed trades that have incorrect or missing PnL values.
   * This fixes the historical bug where quantoMultiplier was calculated as 1/entryPrice.
   * It fetches the correct quantoMultiplier from Gate.io for each symbol and recalculates.
   */
  fixHistoricalPnl: protectedProcedure.mutation(async ({ ctx }) => {
    const db2 = getDatabase();
    const userId = ctx.user?.id || "local-owner";
    const closedTrades = await db2.select().from(trades).where(and2(eq2(trades.userId, userId), eq2(trades.status, "CLOSED")));
    const publicClient = createGateioClient({ apiKey: "", apiSecret: "" });
    const qmCache = {};
    let fixed = 0;
    let skipped = 0;
    let errors = 0;
    const details = [];
    for (const t2 of closedTrades) {
      try {
        if (!t2.exitPrice || parseFloat(t2.exitPrice) === 0) {
          skipped++;
          continue;
        }
        const entryPrice = parseFloat(t2.entryPrice || "0");
        const exitPrice = parseFloat(t2.exitPrice || "0");
        const quantity = parseFloat(t2.quantity || "0");
        if (entryPrice <= 0 || exitPrice <= 0 || quantity <= 0) {
          skipped++;
          continue;
        }
        if (!qmCache[t2.symbol]) {
          try {
            const contractInfo = await publicClient.getContractInfo(t2.symbol);
            qmCache[t2.symbol] = parseFloat(
              contractInfo.quantoMultiplier || contractInfo.quanto_multiplier || "1"
            );
            await new Promise((r) => setTimeout(r, 150));
          } catch {
            qmCache[t2.symbol] = 1;
          }
        }
        const qm = qmCache[t2.symbol];
        const correctPnl = t2.side === "BUY" ? (exitPrice - entryPrice) * quantity * qm : (entryPrice - exitPrice) * quantity * qm;
        const correctPnlPercent = t2.side === "BUY" ? (exitPrice - entryPrice) / entryPrice * 100 : (entryPrice - exitPrice) / entryPrice * 100;
        const oldPnl = parseFloat(t2.pnl || "0");
        const needsFix = !t2.pnl || Math.abs(oldPnl) === 0 || correctPnl !== 0 && Math.abs((oldPnl - correctPnl) / correctPnl) > 0.1;
        if (needsFix) {
          await db2.update(trades).set({
            pnl: correctPnl.toFixed(8),
            pnlPercent: Math.max(-999.99, Math.min(999.99, correctPnlPercent)).toFixed(2),
            stopLoss: qm.toString()
            // Store correct QM for future reference
          }).where(eq2(trades.id, t2.id));
          details.push({
            id: t2.id,
            symbol: t2.symbol,
            oldPnl: t2.pnl || "null",
            newPnl: correctPnl.toFixed(8),
            reason: `QM=${qm}, entry=${entryPrice}, exit=${exitPrice}, qty=${quantity}`
          });
          fixed++;
        } else {
          skipped++;
        }
      } catch (e) {
        errors++;
      }
    }
    try {
      const allTrades = await db2.select().from(trades).where(and2(eq2(trades.userId, userId), eq2(trades.status, "CLOSED")));
      const totalTrades = allTrades.length;
      const winningTrades = allTrades.filter((t2) => parseFloat(t2.pnl || "0") > 0).length;
      const losingTrades = allTrades.filter((t2) => parseFloat(t2.pnl || "0") <= 0).length;
      const totalPnl = allTrades.reduce((sum, t2) => sum + parseFloat(t2.pnl || "0"), 0);
      await db2.update(botStatus).set({
        totalTrades,
        winningTrades,
        losingTrades,
        totalPnl: totalPnl.toFixed(8)
      }).where(eq2(botStatus.userId, userId));
    } catch (e) {
      console.error("Error recalculating bot stats:", e);
    }
    return {
      totalProcessed: closedTrades.length,
      fixed,
      skipped,
      errors,
      details: details.slice(0, 50)
      // limit response size
    };
  }),
  /**
   * Reset bot statistics (totalTrades, winningTrades, losingTrades, totalPnl)
   * by recalculating from actual trade records in the database.
   */
  recalculateStats: protectedProcedure.mutation(async ({ ctx }) => {
    const db2 = getDatabase();
    const userId = ctx.user?.id || "local-owner";
    const allTrades = await db2.select().from(trades).where(and2(eq2(trades.userId, userId), eq2(trades.status, "CLOSED")));
    const totalTrades = allTrades.length;
    const winningTrades = allTrades.filter((t2) => parseFloat(t2.pnl || "0") > 0).length;
    const losingTrades = allTrades.filter((t2) => parseFloat(t2.pnl || "0") <= 0).length;
    const totalPnl = allTrades.reduce((sum, t2) => sum + parseFloat(t2.pnl || "0"), 0);
    await db2.update(botStatus).set({
      totalTrades,
      winningTrades,
      losingTrades,
      totalPnl: totalPnl.toFixed(8)
    }).where(eq2(botStatus.userId, userId));
    return {
      totalTrades,
      winningTrades,
      losingTrades,
      totalPnl: parseFloat(totalPnl.toFixed(8)),
      winRate: totalTrades > 0 ? winningTrades / totalTrades * 100 : 0
    };
  })
});
var logAnalysisRouter = router({
  /**
   * Retorna métricas calculadas a partir dos trades e logs do banco:
   * win rate, PnL, tendência, erros por tipo, heartbeat lag, etc.
   */
  getMetrics: protectedProcedure.input(z.object({ lastHours: z.number().optional() })).query(async ({ input, ctx }) => {
    const db2 = getDatabase();
    const userId = ctx.user?.id || "local-owner";
    const since = input.lastHours ? new Date(Date.now() - input.lastHours * 3600 * 1e3) : null;
    const allTrades = await db2.select().from(trades).where(eq2(trades.userId, userId)).orderBy(desc(trades.createdAt));
    const closed = allTrades.filter((t2) => t2.status === "CLOSED");
    const open = allTrades.filter((t2) => t2.status === "OPEN");
    const closedFiltered = since ? closed.filter((t2) => t2.updatedAt && new Date(t2.updatedAt) >= since) : closed;
    const wins = closedFiltered.filter((t2) => parseFloat(t2.pnl || "0") > 0);
    const losses = closedFiltered.filter((t2) => parseFloat(t2.pnl || "0") <= 0);
    const totalPnl = closedFiltered.reduce((s, t2) => s + parseFloat(t2.pnl || "0"), 0);
    const winRate = closedFiltered.length > 0 ? wins.length / closedFiltered.length * 100 : 0;
    const last10 = closed.slice(0, 10).reduce((s, t2) => s + parseFloat(t2.pnl || "0"), 0);
    const prev10 = closed.slice(10, 20).reduce((s, t2) => s + parseFloat(t2.pnl || "0"), 0);
    const pnlTrend = last10 > prev10 ? "melhorando" : last10 < prev10 ? "piorando" : "est\xE1vel";
    const allLogs = await db2.select().from(tradingLogs).where(eq2(tradingLogs.userId, userId)).orderBy(desc(tradingLogs.createdAt)).limit(500);
    const logsFiltered = since ? allLogs.filter((l) => l.createdAt && new Date(l.createdAt) >= since) : allLogs;
    const errorLogs = logsFiltered.filter((l) => l.logType === "ERROR");
    const errorsByType = {};
    for (const l of errorLogs) {
      const key = l.message?.split(":")[0]?.trim()?.substring(0, 40) || "ERROR";
      errorsByType[key] = (errorsByType[key] || 0) + 1;
    }
    const statusRows = await db2.select().from(botStatus).where(eq2(botStatus.userId, userId)).limit(1);
    const status = statusRows[0] || null;
    const heartbeatLagMin = status?.lastHeartbeat ? (Date.now() - new Date(status.lastHeartbeat).getTime()) / 6e4 : null;
    const pnlSeries = closed.slice(0, 50).reverse().map((t2) => ({
      time: t2.exitTime || t2.updatedAt,
      pnl: parseFloat(t2.pnl || "0"),
      symbol: t2.symbol,
      side: t2.side
    }));
    let cumPnl = 0;
    const cumPnlSeries = pnlSeries.map((p) => {
      cumPnl += p.pnl;
      return { time: p.time, cumPnl };
    });
    const bySymbol = {};
    for (const t2 of closedFiltered) {
      const sym = t2.symbol;
      if (!bySymbol[sym]) bySymbol[sym] = { wins: 0, losses: 0, pnl: 0 };
      const p = parseFloat(t2.pnl || "0");
      if (p > 0) bySymbol[sym].wins++;
      else bySymbol[sym].losses++;
      bySymbol[sym].pnl += p;
    }
    const WINRATE_THRESHOLD = 40;
    const BALANCE_MIN = 5;
    const HEARTBEAT_MAX = 15;
    const diagnoses = [];
    if (winRate < WINRATE_THRESHOLD) {
      diagnoses.push({
        severity: "ALERTA",
        category: "Win Rate",
        message: `Win Rate ${winRate.toFixed(1)}% abaixo do limiar ${WINRATE_THRESHOLD}%`,
        action: "Recalcular estat\xEDsticas ou revisar configura\xE7\xE3o de trading"
      });
    } else {
      diagnoses.push({ severity: "OK", category: "Win Rate", message: `Win Rate ${winRate.toFixed(1)}% dentro do esperado`, action: "" });
    }
    if (pnlTrend === "piorando") {
      diagnoses.push({
        severity: "ALERTA",
        category: "PnL",
        message: `PnL em tend\xEAncia de piora (\xFAltimos 10 trades: ${last10.toFixed(4)} USDT)`,
        action: "Corrigir PnL hist\xF3rico ou revisar estrat\xE9gia"
      });
    } else {
      diagnoses.push({ severity: "OK", category: "PnL", message: `PnL tend\xEAncia: ${pnlTrend}`, action: "" });
    }
    if (heartbeatLagMin !== null && heartbeatLagMin > HEARTBEAT_MAX) {
      diagnoses.push({
        severity: "CR\xCDTICO",
        category: "Heartbeat",
        message: `Heartbeat atrasado ${heartbeatLagMin.toFixed(1)} min (limite: ${HEARTBEAT_MAX} min)`,
        action: "Verificar se o bot est\xE1 em execu\xE7\xE3o"
      });
    } else {
      diagnoses.push({
        severity: "OK",
        category: "Heartbeat",
        message: heartbeatLagMin !== null ? `Heartbeat ${heartbeatLagMin.toFixed(1)} min \u2014 normal` : "Heartbeat sem dados",
        action: ""
      });
    }
    if (errorLogs.length > 10) {
      diagnoses.push({
        severity: "AVISO",
        category: "Erros",
        message: `${errorLogs.length} erros encontrados no per\xEDodo`,
        action: "Verificar logs de erro e corrigir se necess\xE1rio"
      });
    } else {
      diagnoses.push({ severity: "OK", category: "Erros", message: `${errorLogs.length} erros no per\xEDodo \u2014 normal`, action: "" });
    }
    return {
      period: {
        from: since ? since.toISOString() : null,
        totalTrades: closedFiltered.length,
        openTrades: open.length
      },
      winRate,
      wins: wins.length,
      losses: losses.length,
      totalPnl,
      pnlTrend,
      last10Pnl: last10,
      heartbeatLagMin,
      isRunning: status?.isRunning ?? false,
      errorCount: errorLogs.length,
      errorsByType,
      pnlSeries,
      cumPnlSeries,
      bySymbol,
      diagnoses,
      recentErrors: errorLogs.slice(0, 20).map((l) => ({
        time: l.createdAt,
        message: l.message,
        details: l.details
      }))
    };
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
  logs: logsRouter,
  maintenance: maintenanceRouter,
  logAnalysis: logAnalysisRouter
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
import { eq as eq4 } from "drizzle-orm";
import path from "path";

// server/systemMonitor.ts
import cron from "node-cron";
import { eq as eq3, and as and3 } from "drizzle-orm";
var HEARTBEAT_STALE_MS = 10 * 60 * 1e3;
var HEARTBEAT_CRITICAL_MS = 20 * 60 * 1e3;
var CHECK_INTERVAL_CRON = "*/15 * * * *";
async function runHealthCheck() {
  const result = {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    severity: "OK",
    checks: [],
    actionsPerformed: []
  };
  const db2 = getDatabase();
  try {
    const rows = await db2.select().from(botStatus).limit(1);
    if (rows.length === 0) {
      result.checks.push({ name: "heartbeat", status: "WARN", message: "Nenhum registro de botStatus encontrado" });
    } else {
      const bot = rows[0];
      const lastHeartbeat = bot.lastHeartbeat ? new Date(bot.lastHeartbeat).getTime() : 0;
      const lagMs = Date.now() - lastHeartbeat;
      const lagMin = (lagMs / 6e4).toFixed(1);
      if (!bot.isRunning) {
        const openTrades = await db2.select().from(trades).where(and3(eq3(trades.status, "OPEN"), eq3(trades.userId, bot.userId ?? "")));
        if (openTrades.length > 0) {
          result.checks.push({
            name: "heartbeat",
            status: "CRITICAL",
            message: `Bot parado com ${openTrades.length} posi\xE7\xF5es abertas sem monitoramento!`,
            value: openTrades.length
          });
          result.severity = "CRITICAL";
          console.error(`[MONITOR_CRON] \u{1F6A8} CR\xCDTICO: Bot parado com ${openTrades.length} posi\xE7\xF5es abertas!`);
        } else {
          result.checks.push({ name: "heartbeat", status: "OK", message: "Bot parado, sem posi\xE7\xF5es abertas" });
        }
      } else if (lagMs > HEARTBEAT_CRITICAL_MS) {
        result.checks.push({
          name: "heartbeat",
          status: "CRITICAL",
          message: `Heartbeat stale h\xE1 ${lagMin} min \u2014 bot pode estar travado`,
          value: lagMin
        });
        result.severity = "CRITICAL";
        console.error(`[MONITOR_CRON] \u{1F6A8} CR\xCDTICO: Heartbeat stale ${lagMin} min`);
      } else if (lagMs > HEARTBEAT_STALE_MS) {
        result.checks.push({
          name: "heartbeat",
          status: "WARN",
          message: `Heartbeat atrasado: ${lagMin} min (limite: ${HEARTBEAT_STALE_MS / 6e4} min)`,
          value: lagMin
        });
        if (result.severity === "OK") result.severity = "WARN";
        console.warn(`[MONITOR_CRON] \u26A0\uFE0F WARN: Heartbeat atrasado ${lagMin} min`);
      } else {
        result.checks.push({ name: "heartbeat", status: "OK", message: `Heartbeat OK: ${lagMin} min atr\xE1s` });
      }
    }
  } catch (e) {
    result.checks.push({ name: "heartbeat", status: "WARN", message: `Erro ao verificar heartbeat: ${e}` });
  }
  try {
    const engines = Array.from(tradingEngines.values());
    if (engines.length === 0) {
      result.checks.push({ name: "positions", status: "SKIP", message: "Nenhum engine ativo em mem\xF3ria" });
    } else {
      const criticalPositions = [];
      for (const engine of engines) {
        const positions = engine.getPositions();
        for (const pos of positions) {
          if (pos.highWaterMarkPct >= 2 && pos.trailingStopPct < 0) {
            criticalPositions.push(
              `${pos.symbol}: HWM=${pos.highWaterMarkPct.toFixed(1)}% mas trailing stop ainda negativo (${pos.trailingStopPct.toFixed(1)}%)`
            );
          }
        }
        if (criticalPositions.length > 0) {
          result.checks.push({
            name: "positions",
            status: "WARN",
            message: `${criticalPositions.length} posi\xE7\xE3o(\xF5es) com trailing stop desatualizado: ${criticalPositions.join("; ")}`,
            value: criticalPositions.length
          });
          if (result.severity === "OK") result.severity = "WARN";
        } else {
          result.checks.push({
            name: "positions",
            status: "OK",
            message: `${positions.length} posi\xE7\xF5es monitoradas, trailing stops OK`,
            value: positions.length
          });
        }
      }
    }
  } catch (e) {
    result.checks.push({ name: "positions", status: "WARN", message: `Erro ao verificar posi\xE7\xF5es: ${e}` });
  }
  try {
    const openDbTrades = await db2.select().from(trades).where(eq3(trades.status, "OPEN"));
    const enginePositionCount = Array.from(tradingEngines.values()).reduce((acc, e) => acc + e.getPositions().length, 0);
    const orphanCount = openDbTrades.length - enginePositionCount;
    if (orphanCount > 0) {
      result.checks.push({
        name: "orphan_trades",
        status: "WARN",
        message: `${orphanCount} trade(s) OPEN no banco sem posi\xE7\xE3o correspondente no engine (poss\xEDvel restart sem sync)`,
        value: orphanCount
      });
      if (result.severity === "OK") result.severity = "WARN";
      console.warn(`[MONITOR_CRON] \u26A0\uFE0F ${orphanCount} trades \xF3rf\xE3os no banco`);
    } else {
      result.checks.push({
        name: "orphan_trades",
        status: "OK",
        message: `DB e engine sincronizados: ${openDbTrades.length} trades OPEN`
      });
    }
  } catch (e) {
    result.checks.push({ name: "orphan_trades", status: "WARN", message: `Erro ao verificar trades: ${e}` });
  }
  try {
    const rows = await db2.select().from(botStatus).limit(1);
    if (rows.length > 0) {
      const bot = rows[0];
      const total = bot.totalTrades ?? 0;
      const wins = bot.winningTrades ?? 0;
      const winRate = total > 0 ? wins / total * 100 : 0;
      if (total >= 30 && winRate < 35) {
        result.checks.push({
          name: "win_rate",
          status: "WARN",
          message: `Win Rate baixo: ${winRate.toFixed(1)}% (${wins}W/${total - wins}L) \u2014 abaixo do limiar de 35%`,
          value: winRate
        });
        if (result.severity === "OK") result.severity = "WARN";
        console.warn(`[MONITOR_CRON] \u26A0\uFE0F Win Rate baixo: ${winRate.toFixed(1)}%`);
      } else {
        result.checks.push({
          name: "win_rate",
          status: "OK",
          message: `Win Rate: ${winRate.toFixed(1)}% (${wins}W/${total - wins}L / ${total} trades)`,
          value: winRate
        });
      }
    }
  } catch (e) {
    result.checks.push({ name: "win_rate", status: "WARN", message: `Erro ao verificar win rate: ${e}` });
  }
  const criticalCount = result.checks.filter((c) => c.status === "CRITICAL").length;
  const warnCount = result.checks.filter((c) => c.status === "WARN").length;
  const okCount = result.checks.filter((c) => c.status === "OK").length;
  console.log(
    `[MONITOR_CRON] ${result.timestamp} | Severity: ${result.severity} | OK=${okCount} WARN=${warnCount} CRITICAL=${criticalCount} | Actions: ${result.actionsPerformed.length > 0 ? result.actionsPerformed.join(", ") : "none"}`
  );
  return result;
}
var monitorTask = null;
function startSystemMonitor() {
  if (monitorTask) {
    console.log("[MONITOR_CRON] Monitor j\xE1 est\xE1 rodando, ignorando segunda inicializa\xE7\xE3o");
    return;
  }
  console.log(`[MONITOR_CRON] \u{1F550} Iniciando monitoramento agendado a cada 15 minutos (cron: ${CHECK_INTERVAL_CRON})`);
  setTimeout(() => {
    runHealthCheck().catch((e) => console.error("[MONITOR_CRON] Erro na verifica\xE7\xE3o inicial:", e));
  }, 60 * 1e3);
  monitorTask = cron.schedule(CHECK_INTERVAL_CRON, () => {
    runHealthCheck().catch((e) => console.error("[MONITOR_CRON] Erro na verifica\xE7\xE3o agendada:", e));
  }, {
    timezone: "UTC"
  });
  console.log("[MONITOR_CRON] \u2705 Monitor agendado com sucesso");
}

// server/_core/index.ts
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
    const runningBots = await db2.select().from(botStatus).where(eq4(botStatus.isRunning, true)).limit(1);
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
    const keys = await db2.select().from(bybitApiKeys).where(eq4(bybitApiKeys.userId, userId)).limit(1);
    if (keys.length === 0) {
      console.log("\u26A0\uFE0F No API keys found, cannot auto-restart bot");
      return;
    }
    const configs = await db2.select().from(tradingConfigs).where(eq4(tradingConfigs.id, configId)).limit(1);
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
    const descParts = (config.description ?? "aggressive|").split("|");
    const aggressiveness = ["conservative", "moderate", "aggressive"].includes(descParts[0]) ? descParts[0] : "aggressive";
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
    try {
      const db2 = getDatabase();
      const allConfigs = await db2.select().from(tradingConfigs);
      for (const cfg of allConfigs) {
        const parts = (cfg.description ?? "").split("|");
        if (!["conservative", "moderate", "aggressive"].includes(parts[0])) {
          const newDesc = `aggressive|${cfg.description ?? "Estrat\xE9gia AI Aut\xF4noma"}`;
          await db2.update(tradingConfigs).set({ description: newDesc }).where(eq4(tradingConfigs.id, cfg.id));
          console.log(`[MIGRATION] Config ${cfg.id}: set aggressiveness=aggressive`);
        } else if (parts[0] === "moderate") {
          parts[0] = "aggressive";
          await db2.update(tradingConfigs).set({ description: parts.join("|") }).where(eq4(tradingConfigs.id, cfg.id));
          console.log(`[MIGRATION] Config ${cfg.id}: upgraded moderate \u2192 aggressive`);
        }
      }
    } catch (migErr) {
      console.warn("[MIGRATION] Could not migrate aggressiveness:", migErr);
    }
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
    startSystemMonitor();
  } catch (error) {
    console.error("\u274C Failed to start server:", error);
    process.exit(1);
  }
}
startServer();
