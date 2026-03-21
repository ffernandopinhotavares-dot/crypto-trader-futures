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

// server/binance.ts
import { USDMClient } from "binance";
var BinanceClient = class {
  client;
  constructor(config) {
    this.client = new USDMClient({
      api_key: config.apiKey,
      api_secret: config.apiSecret,
      ...config.testnet ? { baseUrl: "https://testnet.binancefuture.com" } : {}
    });
  }
  /**
   * Get account balance (USDT futures)
   */
  async getBalance() {
    const balances = await this.client.getBalance();
    return balances.map((b) => ({
      coin: b.asset,
      walletBalance: b.balance
    }));
  }
  /**
   * Get account info (includes balance, unrealized PnL, positions count)
   */
  async getAccountInfo() {
    const account = await this.client.getAccountInformation();
    const positions = account.positions.filter((p) => parseFloat(p.positionAmt) !== 0).map((p) => ({
      symbol: p.symbol,
      positionSide: p.positionSide,
      positionAmt: p.positionAmt,
      entryPrice: p.entryPrice,
      markPrice: p.markPrice ?? "0",
      unrealizedProfit: p.unrealizedProfit,
      leverage: p.leverage,
      notional: p.notional ?? "0"
    }));
    return {
      totalWalletBalance: account.totalWalletBalance,
      availableBalance: account.availableBalance,
      totalMarginBalance: account.totalMarginBalance,
      totalUnrealizedProfit: account.totalUnrealizedProfit,
      positions
    };
  }
  /**
   * Get open positions
   */
  async getPositions(symbol) {
    const positions = await this.client.getPositions(symbol ? { symbol } : void 0);
    return positions.filter((p) => parseFloat(p.positionAmt) !== 0).map((p) => ({
      symbol: p.symbol,
      positionSide: p.positionSide,
      positionAmt: p.positionAmt,
      entryPrice: p.entryPrice,
      markPrice: p.markPrice ?? "0",
      unrealizedProfit: p.unrealizedProfit,
      leverage: p.leverage,
      notional: p.notional ?? "0"
    }));
  }
  /**
   * Place order
   */
  async placeOrder(symbol, side, orderType, qty, price) {
    const params = {
      symbol,
      side,
      type: orderType,
      quantity: qty
    };
    if (orderType === "LIMIT" && price) {
      params.price = price;
      params.timeInForce = "GTC";
    }
    const response = await this.client.submitNewOrder(params);
    return { orderId: String(response.orderId) };
  }
  /**
   * Cancel order
   */
  async cancelOrder(symbol, orderId) {
    await this.client.cancelOrder({
      symbol,
      orderId: parseInt(orderId)
    });
  }
  /**
   * Get order history
   */
  async getOrderHistory(symbol, limit = 50) {
    const params = { limit };
    if (symbol) params.symbol = symbol;
    const orders = await this.client.getAllOrders(params);
    return orders.map((o) => ({
      orderId: String(o.orderId),
      symbol: o.symbol,
      side: o.side,
      type: o.type,
      price: o.price,
      origQty: o.origQty,
      status: o.status,
      time: o.time,
      updateTime: o.updateTime
    }));
  }
  /**
   * Get klines (candlestick data)
   */
  async getKlines(symbol, interval, limit = 200, startTime) {
    const params = {
      symbol,
      interval,
      limit
    };
    if (startTime) params.startTime = startTime;
    const klines = await this.client.getKlines(params);
    return klines.map((k) => ({
      startTime: String(k[0]),
      openPrice: String(k[1]),
      highPrice: String(k[2]),
      lowPrice: String(k[3]),
      closePrice: String(k[4]),
      volume: String(k[5]),
      turnover: String(k[7])
      // quoteAssetVolume
    }));
  }
  /**
   * Get ticker (current price and stats)
   */
  async getTicker(symbol) {
    const ticker = await this.client.get24hrChangeStatistics({ symbol });
    const t2 = Array.isArray(ticker) ? ticker[0] : ticker;
    return {
      symbol: t2.symbol,
      lastPrice: t2.lastPrice,
      highPrice: t2.highPrice,
      lowPrice: t2.lowPrice,
      prevClosePrice: t2.prevClosePrice,
      volume: t2.volume,
      quoteVolume: t2.quoteVolume,
      bidPrice: t2.bidPrice ?? t2.lastPrice,
      askPrice: t2.askPrice ?? t2.lastPrice
    };
  }
  /**
   * Get exchange info (instruments)
   */
  async getInstruments(symbol) {
    const info = await this.client.getExchangeInfo();
    let symbols = info.symbols;
    if (symbol) {
      symbols = symbols.filter((s) => s.symbol === symbol);
    }
    return symbols.map((s) => ({
      symbol: s.symbol,
      baseAsset: s.baseAsset,
      quoteAsset: s.quoteAsset,
      filters: s.filters,
      status: s.status
    }));
  }
  /**
   * Get all USDT perpetual trading pairs
   */
  async getAllInstruments() {
    const info = await this.client.getExchangeInfo();
    return info.symbols.filter((s) => s.quoteAsset === "USDT" && s.status === "TRADING").map((s) => ({
      symbol: s.symbol,
      baseAsset: s.baseAsset,
      quoteAsset: s.quoteAsset,
      filters: s.filters,
      status: s.status
    }));
  }
  /**
   * Set leverage
   */
  async setLeverage(symbol, leverage) {
    await this.client.setLeverage({ symbol, leverage });
  }
  /**
   * Place order with stop loss and take profit (using STOP_MARKET and TAKE_PROFIT_MARKET)
   */
  async setStopLossTakeProfit(symbol, side, stopLoss, takeProfit) {
    const closeSide = side === "BUY" ? "SELL" : "BUY";
    if (stopLoss) {
      await this.client.submitNewOrder({
        symbol,
        side: closeSide,
        type: "STOP_MARKET",
        stopPrice: stopLoss,
        closePosition: "true"
      });
    }
    if (takeProfit) {
      await this.client.submitNewOrder({
        symbol,
        side: closeSide,
        type: "TAKE_PROFIT_MARKET",
        stopPrice: takeProfit,
        closePosition: "true"
      });
    }
  }
  /**
   * Get funding rate
   */
  async getFundingRate(symbol) {
    const rates = await this.client.getFundingRateHistory({ symbol, limit: 1 });
    const r = Array.isArray(rates) ? rates[0] : rates;
    return { fundingRate: String(r?.fundingRate ?? "0") };
  }
  /**
   * Get current mark price
   */
  async getMarkPrice(symbol) {
    const price = await this.client.getMarkPrice({ symbol });
    const p = Array.isArray(price) ? price[0] : price;
    return String(p.markPrice ?? "0");
  }
};
function createBinanceClient(config) {
  return new BinanceClient(config);
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
function generateTradingSignal(prices, volumes, rsiConfig, macdConfig, bbConfig) {
  let signalScore = 0;
  const signals = {
    rsi: 0,
    macd: 0,
    bollinger: 0,
    volume: 0
  };
  try {
    const rsi = calculateRSI(prices, rsiConfig.period);
    if (rsi.oversold) {
      signals.rsi = 1;
      signalScore += 25;
    } else if (rsi.overbought) {
      signals.rsi = -1;
      signalScore -= 25;
    }
  } catch (e) {
  }
  try {
    const macd = calculateMACD(
      prices,
      macdConfig.fast,
      macdConfig.slow,
      macdConfig.signal
    );
    if (macd.bullish && macd.histogram > 0) {
      signals.macd = 1;
      signalScore += 25;
    } else if (macd.bearish && macd.histogram < 0) {
      signals.macd = -1;
      signalScore -= 25;
    }
  } catch (e) {
  }
  try {
    const bb = calculateBollingerBands(
      prices,
      bbConfig.period,
      bbConfig.stdDev
    );
    if (bb.position < 20) {
      signals.bollinger = 1;
      signalScore += 25;
    } else if (bb.position > 80) {
      signals.bollinger = -1;
      signalScore -= 25;
    }
  } catch (e) {
  }
  try {
    const volume = analyzeVolume(volumes);
    if (volume.highVolume) {
      if (signalScore > 0) {
        signals.volume = 1;
        signalScore += 25;
      } else if (signalScore < 0) {
        signals.volume = -1;
        signalScore -= 25;
      }
    }
  } catch (e) {
  }
  const strength = Math.max(-100, Math.min(100, signalScore));
  let recommendation;
  if (strength >= 75) {
    recommendation = "STRONG_BUY";
  } else if (strength >= 25) {
    recommendation = "BUY";
  } else if (strength <= -75) {
    recommendation = "STRONG_SELL";
  } else if (strength <= -25) {
    recommendation = "SELL";
  } else {
    recommendation = "NEUTRAL";
  }
  return {
    strength,
    signals,
    recommendation
  };
}

// server/tradingEngine.ts
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
var TradingEngine = class {
  config;
  isRunning = false;
  positions = /* @__PURE__ */ new Map();
  get db() {
    return getDatabase();
  }
  constructor(config) {
    this.config = config;
  }
  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`\u{1F680} Trading engine started for user ${this.config.userId}`);
    await this.updateBotStatus({ isRunning: true });
    await this.logEvent("BOT_START", "SYSTEM", "Trading bot started");
    this.mainLoop();
  }
  async stop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    console.log(`\u26D4 Trading engine stopped for user ${this.config.userId}`);
    await this.updateBotStatus({ isRunning: false });
    await this.logEvent("BOT_STOP", "SYSTEM", "Trading bot stopped");
  }
  async mainLoop() {
    while (this.isRunning) {
      try {
        for (const symbol of this.config.tradingPairs) {
          await this.analyzeAndTrade(symbol);
        }
        await this.checkPositions();
        await this.sleep(5 * 60 * 1e3);
      } catch (error) {
        const msg = this.errStr(error);
        console.error("Error in trading loop:", msg);
        await this.logEvent("ERROR", "SYSTEM", `Trading loop error: ${msg}`);
      }
    }
  }
  async analyzeAndTrade(symbol) {
    try {
      const klines = await this.config.binanceClient.getKlines(
        symbol,
        this.timeframeToInterval(this.config.timeframe),
        200
      );
      if (klines.length < 50) return;
      const prices = klines.map((k) => parseFloat(k.closePrice));
      const volumes = klines.map((k) => parseFloat(k.volume));
      await this.saveCandles(symbol, klines);
      const signal = generateTradingSignal(
        prices,
        volumes,
        { period: this.config.rsiPeriod, overbought: this.config.rsiOverbought, oversold: this.config.rsiOversold },
        { fast: this.config.macdFastPeriod, slow: this.config.macdSlowPeriod, signal: this.config.macdSignalPeriod },
        { period: this.config.bbPeriod, stdDev: this.config.bbStdDev }
      );
      await this.saveIndicators(symbol, prices, volumes);
      await this.logEvent("SIGNAL_GENERATED", symbol, `Signal: ${signal.recommendation} (strength: ${signal.strength})`);
      if (signal.strength >= 50 && !this.positions.has(symbol)) {
        const ticker = await this.config.binanceClient.getTicker(symbol);
        const currentPrice = parseFloat(ticker.lastPrice);
        const positionSize = await this.calculatePositionSize(currentPrice);
        if (positionSize > 0) await this.openPosition(symbol, "BUY", currentPrice, positionSize, prices);
      } else if (signal.strength <= -50 && this.positions.has(symbol)) {
        const ticker = await this.config.binanceClient.getTicker(symbol);
        await this.closePosition(symbol, parseFloat(ticker.lastPrice));
      }
    } catch (error) {
      const msg = this.errStr(error);
      console.error(`Error analyzing ${symbol}:`, msg);
      await this.logEvent("ERROR", symbol, `Error analyzing: ${msg}`);
    }
  }
  async openPosition(symbol, side, entryPrice, quantity, prices) {
    try {
      await this.config.binanceClient.setLeverage(symbol, 5);
      const order = await this.config.binanceClient.placeOrder(symbol, side, "MARKET", quantity.toFixed(3));
      const stopLoss = entryPrice * (1 - this.config.stopLossPercent / 100);
      const takeProfit = entryPrice * (1 + this.config.takeProfitPercent / 100);
      await this.config.binanceClient.setStopLossTakeProfit(symbol, side, stopLoss.toFixed(2), takeProfit.toFixed(2));
      const rsi = calculateRSI(prices, this.config.rsiPeriod);
      const macd = calculateMACD(prices, this.config.macdFastPeriod, this.config.macdSlowPeriod, this.config.macdSignalPeriod);
      const bb = calculateBollingerBands(prices, this.config.bbPeriod, this.config.bbStdDev);
      await this.db.insert(trades).values({
        id: nanoid(),
        userId: this.config.userId,
        configId: this.config.configId,
        symbol,
        side,
        entryPrice: entryPrice.toString(),
        quantity: quantity.toString(),
        entryTime: /* @__PURE__ */ new Date(),
        stopLoss: stopLoss.toString(),
        takeProfit: takeProfit.toString(),
        status: "OPEN",
        rsiAtEntry: rsi.rsi.toString(),
        macdAtEntry: macd,
        bbAtEntry: bb,
        bybitOrderId: order.orderId
      });
      this.positions.set(symbol, { symbol, side, entryPrice, quantity, entryTime: /* @__PURE__ */ new Date(), stopLoss, takeProfit });
      await this.logEvent("POSITION_OPENED", symbol, `Opened ${side} at ${entryPrice}`);
    } catch (error) {
      await this.logEvent("ERROR", symbol, `Error opening position: ${this.errStr(error)}`);
    }
  }
  async closePosition(symbol, exitPrice) {
    try {
      const position = this.positions.get(symbol);
      if (!position) return;
      const closeSide = position.side === "BUY" ? "SELL" : "BUY";
      await this.config.binanceClient.placeOrder(symbol, closeSide, "MARKET", position.quantity.toFixed(3));
      const pnl = position.side === "BUY" ? (exitPrice - position.entryPrice) * position.quantity : (position.entryPrice - exitPrice) * position.quantity;
      const pnlPercent = (exitPrice - position.entryPrice) / position.entryPrice * 100;
      const tradeRecord = await this.db.select().from(trades).where(and(eq(trades.symbol, symbol), eq(trades.status, "OPEN"))).limit(1);
      if (tradeRecord.length > 0) {
        await this.db.update(trades).set({
          exitPrice: exitPrice.toString(),
          exitTime: /* @__PURE__ */ new Date(),
          pnl: pnl.toString(),
          pnlPercent: pnlPercent.toString(),
          status: "CLOSED",
          exitReason: pnl > 0 ? "TAKE_PROFIT" : "STOP_LOSS"
        }).where(eq(trades.id, tradeRecord[0].id));
      }
      this.positions.delete(symbol);
      await this.logEvent("POSITION_CLOSED", symbol, `Closed at ${exitPrice}. PnL: ${pnl.toFixed(2)}`);
    } catch (error) {
      await this.logEvent("ERROR", symbol, `Error closing position: ${this.errStr(error)}`);
    }
  }
  async checkPositions() {
    for (const [symbol, position] of Array.from(this.positions.entries())) {
      try {
        const ticker = await this.config.binanceClient.getTicker(symbol);
        const currentPrice = parseFloat(ticker.lastPrice);
        const slTriggered = position.side === "BUY" && currentPrice <= position.stopLoss || position.side === "SELL" && currentPrice >= position.stopLoss;
        const tpTriggered = position.side === "BUY" && currentPrice >= position.takeProfit || position.side === "SELL" && currentPrice <= position.takeProfit;
        if (slTriggered || tpTriggered) await this.closePosition(symbol, currentPrice);
      } catch (error) {
        console.error(`Error checking position ${symbol}:`, this.errStr(error));
      }
    }
  }
  async calculatePositionSize(currentPrice) {
    try {
      const balances = await this.config.binanceClient.getBalance();
      const usdtBalance = balances.find((b) => b.coin === "USDT");
      if (!usdtBalance) return 0;
      const available = parseFloat(usdtBalance.walletBalance);
      return Math.max(0, available * (this.config.maxPositionSize / 100) / currentPrice);
    } catch {
      return 0;
    }
  }
  async saveCandles(symbol, klines) {
    try {
      for (const kline of klines.slice(-10)) {
        await this.db.insert(candles).values({
          id: nanoid(),
          symbol,
          timeframe: this.config.timeframe,
          timestamp: parseInt(kline.startTime),
          open: kline.openPrice,
          high: kline.highPrice,
          low: kline.lowPrice,
          close: kline.closePrice,
          volume: kline.volume,
          quoteAssetVolume: kline.turnover
        }).onConflictDoNothing();
      }
    } catch (_) {
    }
  }
  async saveIndicators(symbol, prices, volumes) {
    try {
      const rsi = calculateRSI(prices, this.config.rsiPeriod);
      const macd = calculateMACD(prices, this.config.macdFastPeriod, this.config.macdSlowPeriod, this.config.macdSignalPeriod);
      const bb = calculateBollingerBands(prices, this.config.bbPeriod, this.config.bbStdDev);
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
  async logEvent(type, symbol, message) {
    try {
      await this.db.insert(tradingLogs).values({
        id: nanoid(),
        userId: this.config.userId,
        configId: this.config.configId,
        symbol,
        logType: type,
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
  timeframeToInterval(timeframe) {
    return { "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m", "1h": "1h", "4h": "4h", "1d": "1d" }[timeframe] || "1h";
  }
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
var tradingEngines = /* @__PURE__ */ new Map();
var binanceKeysRouter = router({
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
      throw new Error("Chaves da API Binance n\xE3o configuradas");
    }
    const apiKey = keys[0];
    const client2 = createBinanceClient({
      apiKey: apiKey.apiKey,
      apiSecret: apiKey.apiSecret,
      testnet: apiKey.testnet ?? false
    });
    try {
      const balances = await client2.getBalance();
      const usdtBalance = balances.find((b) => b.coin === "USDT");
      return {
        success: true,
        balance: usdtBalance?.walletBalance ?? "0",
        message: "Conex\xE3o com Binance Futures estabelecida com sucesso"
      };
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
      timeframe: z.enum(["1m", "5m", "15m", "30m", "1h", "4h", "1d"])
    })
  ).mutation(async ({ input, ctx }) => {
    const db2 = getDatabase();
    const userId = ctx.user?.id || "local-owner";
    const id = nanoid2();
    await db2.insert(tradingConfigs).values({
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
      isActive: false
    });
    return { success: true, id };
  }),
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const db2 = getDatabase();
    const userId = ctx.user?.id || "local-owner";
    const configs = await db2.select().from(tradingConfigs).where(eq2(tradingConfigs.userId, userId));
    return configs.map((c) => ({
      ...c,
      tradingPairs: Array.isArray(c.tradingPairs) ? c.tradingPairs : typeof c.tradingPairs === "string" ? JSON.parse(c.tradingPairs) : []
    }));
  }),
  getById: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ input, ctx }) => {
    const db2 = getDatabase();
    const userId = ctx.user?.id || "local-owner";
    const configs = await db2.select().from(tradingConfigs).where(and2(eq2(tradingConfigs.id, input.id), eq2(tradingConfigs.userId, userId))).limit(1);
    if (configs.length === 0) throw new Error("Configura\xE7\xE3o n\xE3o encontrada");
    const c = configs[0];
    return {
      ...c,
      tradingPairs: Array.isArray(c.tradingPairs) ? c.tradingPairs : typeof c.tradingPairs === "string" ? JSON.parse(c.tradingPairs) : []
    };
  }),
  update: protectedProcedure.input(
    z.object({
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      tradingPairs: z.array(z.string()).optional(),
      maxPositionSize: z.number().optional(),
      stopLossPercent: z.number().optional(),
      takeProfitPercent: z.number().optional()
    })
  ).mutation(async ({ input, ctx }) => {
    const db2 = getDatabase();
    const userId = ctx.user?.id || "local-owner";
    const updates = {};
    if (input.name !== void 0) updates.name = input.name;
    if (input.description !== void 0) updates.description = input.description;
    if (input.tradingPairs !== void 0) updates.tradingPairs = input.tradingPairs;
    if (input.maxPositionSize !== void 0) updates.maxPositionSize = input.maxPositionSize.toString();
    if (input.stopLossPercent !== void 0) updates.stopLossPercent = input.stopLossPercent.toString();
    if (input.takeProfitPercent !== void 0) updates.takeProfitPercent = input.takeProfitPercent.toString();
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
    if (keys.length === 0) throw new Error("Chaves da API Binance n\xE3o configuradas");
    const config = configs[0];
    const apiKey = keys[0];
    const binanceClient = createBinanceClient({
      apiKey: apiKey.apiKey,
      apiSecret: apiKey.apiSecret,
      testnet: apiKey.testnet ?? false
    });
    const tradingPairs2 = Array.isArray(config.tradingPairs) ? config.tradingPairs : typeof config.tradingPairs === "string" ? JSON.parse(config.tradingPairs) : ["BTCUSDT"];
    const engine = new TradingEngine({
      userId,
      configId: input.configId,
      binanceClient,
      tradingPairs: tradingPairs2,
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
      timeframe: config.timeframe ?? "1h"
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
    const { USDMClient: USDMClient2 } = await import("binance");
    const client2 = new USDMClient2();
    const ticker = await client2.get24hrChangeStatistics({ symbol: input.symbol });
    const t2 = Array.isArray(ticker) ? ticker[0] : ticker;
    return {
      symbol: t2.symbol,
      lastPrice: t2.lastPrice,
      priceChangePercent: t2.priceChangePercent,
      volume: t2.volume,
      highPrice: t2.highPrice,
      lowPrice: t2.lowPrice
    };
  }),
  getKlines: protectedProcedure.input(
    z.object({
      symbol: z.string(),
      interval: z.string().default("1h"),
      limit: z.number().default(100)
    })
  ).query(async ({ input }) => {
    const { USDMClient: USDMClient2 } = await import("binance");
    const client2 = new USDMClient2();
    const klines = await client2.getKlines({
      symbol: input.symbol,
      interval: input.interval,
      limit: input.limit
    });
    return klines.map((k) => ({
      time: k[0],
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5])
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
    const client2 = createBinanceClient({
      apiKey: apiKey.apiKey,
      apiSecret: apiKey.apiSecret,
      testnet: apiKey.testnet ?? false
    });
    try {
      const account = await client2.getAccountInfo();
      return {
        balance: account.totalWalletBalance,
        available: account.availableBalance,
        unrealizedPnl: account.totalUnrealizedProfit,
        marginBalance: account.totalMarginBalance
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
    const client2 = createBinanceClient({
      apiKey: apiKey.apiKey,
      apiSecret: apiKey.apiSecret,
      testnet: apiKey.testnet ?? false
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
  binanceKeys: binanceKeysRouter,
  // Keep bybitKeys as alias for backward compatibility with any existing frontend calls
  bybitKeys: binanceKeysRouter,
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
  } catch (error) {
    console.error("\u274C Failed to start server:", error);
    process.exit(1);
  }
}
startServer();
