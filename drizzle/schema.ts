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
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================================================
// Enums
// ============================================================================

export const timeframeEnum = pgEnum("timeframe", ["1m", "5m", "15m", "30m", "1h", "4h", "1d"]);
export const sideEnum = pgEnum("side", ["BUY", "SELL"]);
export const tradeStatusEnum = pgEnum("trade_status", ["OPEN", "CLOSED", "CANCELLED"]);
export const logTypeEnum = pgEnum("log_type", [
  "BOT_START",
  "BOT_STOP",
  "SIGNAL_GENERATED",
  "ORDER_PLACED",
  "ORDER_FILLED",
  "ORDER_CANCELLED",
  "POSITION_OPENED",
  "POSITION_CLOSED",
  "ERROR",
  "INFO",
]);

// ============================================================================
// Users & Authentication
// ============================================================================

export const users = pgTable(
  "users",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    email: varchar("email", { length: 255 }).unique(),
    username: varchar("username", { length: 255 }).unique(),
    passwordHash: text("password_hash"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [index("email_idx").on(table.email)]
);

// ============================================================================
// Bybit API Configuration
// ============================================================================

export const bybitApiKeys = pgTable(
  "bybit_api_keys",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    apiKey: text("api_key").notNull(),
    apiSecret: text("api_secret").notNull(),
    isActive: boolean("is_active").default(true),
    testnet: boolean("testnet").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [index("user_id_idx").on(table.userId)]
);

// ============================================================================
// Trading Configuration
// ============================================================================

export const tradingConfigs = pgTable(
  "trading_configs",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    isActive: boolean("is_active").default(false),

    // Trading pairs
    tradingPairs: jsonb("trading_pairs").$type<string[]>().default([]),

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
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [index("config_user_id_idx").on(table.userId)]
);

// ============================================================================
// Trading Pairs
// ============================================================================

export const tradingPairs = pgTable(
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
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [index("symbol_idx").on(table.symbol)]
);

// ============================================================================
// Trades
// ============================================================================

export const trades = pgTable(
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
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("trade_user_id_idx").on(table.userId),
    index("trade_config_id_idx").on(table.configId),
    index("trade_symbol_idx").on(table.symbol),
    index("trade_status_idx").on(table.status),
  ]
);

// ============================================================================
// OHLCV Candles (for technical analysis)
// ============================================================================

export const candles = pgTable(
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

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("symbol_timeframe_idx").on(table.symbol, table.timeframe),
    index("timestamp_idx").on(table.timestamp),
  ]
);

// ============================================================================
// Technical Indicators
// ============================================================================

export const indicators = pgTable(
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

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("ind_symbol_timeframe_idx").on(table.symbol, table.timeframe),
    index("ind_timestamp_idx").on(table.timestamp),
  ]
);

// ============================================================================
// Trading Logs
// ============================================================================

export const tradingLogs = pgTable(
  "trading_logs",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    configId: varchar("config_id", { length: 255 }).notNull(),
    symbol: varchar("symbol", { length: 50 }).notNull(),

    logType: logTypeEnum("log_type").notNull(),

    message: text("message").notNull(),
    details: jsonb("details"),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("log_user_id_idx").on(table.userId),
    index("log_config_id_idx").on(table.configId),
    index("log_type_idx").on(table.logType),
  ]
);

// ============================================================================
// Bot Status
// ============================================================================

export const botStatus = pgTable(
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
    totalPnlPercent: numeric("total_pnl_percent", { precision: 5, scale: 2 }).default("0"),

    currentBalance: numeric("current_balance", { precision: 20, scale: 8 }).default("0"),
    initialBalance: numeric("initial_balance", { precision: 20, scale: 8 }).default("0"),

    maxDrawdownPercent: numeric("max_drawdown_percent", { precision: 5, scale: 2 }).default("0"),
    winRate: numeric("win_rate", { precision: 5, scale: 2 }).default("0"),

    lastTradeTime: timestamp("last_trade_time"),
    lastUpdateTime: timestamp("last_update_time").defaultNow(),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [index("status_user_id_idx").on(table.userId)]
);

// ============================================================================
// Relations
// ============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  apiKeys: many(bybitApiKeys),
  tradingConfigs: many(tradingConfigs),
  trades: many(trades),
  logs: many(tradingLogs),
  botStatus: many(botStatus),
}));

export const bybitApiKeysRelations = relations(bybitApiKeys, ({ one }) => ({
  user: one(users, {
    fields: [bybitApiKeys.userId],
    references: [users.id],
  }),
}));

export const tradingConfigsRelations = relations(tradingConfigs, ({ one, many }) => ({
  user: one(users, {
    fields: [tradingConfigs.userId],
    references: [users.id],
  }),
  trades: many(trades),
  logs: many(tradingLogs),
  botStatus: many(botStatus),
}));

export const tradesRelations = relations(trades, ({ one }) => ({
  user: one(users, {
    fields: [trades.userId],
    references: [users.id],
  }),
  config: one(tradingConfigs, {
    fields: [trades.configId],
    references: [tradingConfigs.id],
  }),
}));

export const tradingLogsRelations = relations(tradingLogs, ({ one }) => ({
  user: one(users, {
    fields: [tradingLogs.userId],
    references: [users.id],
  }),
  config: one(tradingConfigs, {
    fields: [tradingLogs.configId],
    references: [tradingConfigs.id],
  }),
}));

export const botStatusRelations = relations(botStatus, ({ one }) => ({
  user: one(users, {
    fields: [botStatus.userId],
    references: [users.id],
  }),
  config: one(tradingConfigs, {
    fields: [botStatus.configId],
    references: [tradingConfigs.id],
  }),
}));
