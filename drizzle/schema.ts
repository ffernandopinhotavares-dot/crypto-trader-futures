import {
  mysqlTable,
  mysqlEnum,
  varchar,
  text,
  decimal,
  int,
  bigint,
  timestamp,
  boolean,
  index,
  primaryKey,
  json,
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

// ============================================================================
// Users & Authentication
// ============================================================================

export const users = mysqlTable(
  "users",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    email: varchar("email", { length: 255 }).unique(),
    username: varchar("username", { length: 255 }).unique(),
    passwordHash: text("password_hash"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => ({
    emailIdx: index("email_idx").on(table.email),
  })
);

// ============================================================================
// Bybit API Configuration
// ============================================================================

export const bybitApiKeys = mysqlTable(
  "bybit_api_keys",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    apiKey: text("api_key").notNull(),
    apiSecret: text("api_secret").notNull(),
    isActive: boolean("is_active").default(true),
    testnet: boolean("testnet").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => ({
    userIdIdx: index("user_id_idx").on(table.userId),
  })
);

// ============================================================================
// Trading Configuration
// ============================================================================

export const tradingConfigs = mysqlTable(
  "trading_configs",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    isActive: boolean("is_active").default(false),
    
    // Trading pairs
    tradingPairs: json("trading_pairs").$type<string[]>().default([]),
    
    // Risk management
    maxPositionSize: decimal("max_position_size", { precision: 20, scale: 8 }).default("0"),
    maxDrawdown: decimal("max_drawdown", { precision: 5, scale: 2 }).default("10"),
    stopLossPercent: decimal("stop_loss_percent", { precision: 5, scale: 2 }).default("2"),
    takeProfitPercent: decimal("take_profit_percent", { precision: 5, scale: 2 }).default("5"),
    
    // Strategy parameters
    rsiPeriod: int("rsi_period").default(14),
    rsiOverbought: int("rsi_overbought").default(70),
    rsiOversold: int("rsi_oversold").default(30),
    
    macdFastPeriod: int("macd_fast_period").default(12),
    macdSlowPeriod: int("macd_slow_period").default(26),
    macdSignalPeriod: int("macd_signal_period").default(9),
    
    bbPeriod: int("bb_period").default(20),
    bbStdDev: decimal("bb_std_dev", { precision: 3, scale: 1 }).default("2"),
    
    emaPeriod: int("ema_period").default(50),
    
    // Volume settings
    minVolume: decimal("min_volume", { precision: 20, scale: 8 }).default("0"),
    
    // Timeframe
    timeframe: mysqlEnum("timeframe", ["1m", "5m", "15m", "30m", "1h", "4h", "1d"]).default("1h"),
    
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => ({
    userIdIdx: index("config_user_id_idx").on(table.userId),
  })
);

// ============================================================================
// Trading Pairs
// ============================================================================

export const tradingPairs = mysqlTable(
  "trading_pairs",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    symbol: varchar("symbol", { length: 50 }).notNull().unique(),
    baseCoin: varchar("base_coin", { length: 50 }).notNull(),
    quoteCoin: varchar("quote_coin", { length: 50 }).notNull(),
    minOrderQty: decimal("min_order_qty", { precision: 20, scale: 8 }).notNull(),
    maxOrderQty: decimal("max_order_qty", { precision: 20, scale: 8 }).notNull(),
    minOrderAmt: decimal("min_order_amt", { precision: 20, scale: 8 }).notNull(),
    maxOrderAmt: decimal("max_order_amt", { precision: 20, scale: 8 }).notNull(),
    priceScale: int("price_scale").notNull(),
    qtyScale: int("qty_scale").notNull(),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => ({
    symbolIdx: index("symbol_idx").on(table.symbol),
  })
);

// ============================================================================
// Trades
// ============================================================================

export const trades = mysqlTable(
  "trades",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    configId: varchar("config_id", { length: 255 }).notNull(),
    symbol: varchar("symbol", { length: 50 }).notNull(),
    
    // Trade details
    side: mysqlEnum("side", ["BUY", "SELL"]).notNull(),
    entryPrice: decimal("entry_price", { precision: 20, scale: 8 }).notNull(),
    quantity: decimal("quantity", { precision: 20, scale: 8 }).notNull(),
    entryTime: timestamp("entry_time").notNull(),
    
    // Exit details
    exitPrice: decimal("exit_price", { precision: 20, scale: 8 }),
    exitTime: timestamp("exit_time"),
    exitReason: varchar("exit_reason", { length: 50 }),
    
    // P&L
    pnl: decimal("pnl", { precision: 20, scale: 8 }),
    pnlPercent: decimal("pnl_percent", { precision: 5, scale: 2 }),
    
    // Risk management
    stopLoss: decimal("stop_loss", { precision: 20, scale: 8 }),
    takeProfit: decimal("take_profit", { precision: 20, scale: 8 }),
    
    // Status
    status: mysqlEnum("status", ["OPEN", "CLOSED", "CANCELLED"]).default("OPEN"),
    
    // Indicators at entry
    rsiAtEntry: decimal("rsi_at_entry", { precision: 5, scale: 2 }),
    macdAtEntry: json("macd_at_entry"),
    bbAtEntry: json("bb_at_entry"),
    
    // Bybit order IDs
    bybitOrderId: varchar("bybit_order_id", { length: 255 }),
    
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => ({
    userIdIdx: index("trade_user_id_idx").on(table.userId),
    configIdIdx: index("trade_config_id_idx").on(table.configId),
    symbolIdx: index("trade_symbol_idx").on(table.symbol),
    statusIdx: index("trade_status_idx").on(table.status),
  })
);

// ============================================================================
// OHLCV Candles (for technical analysis)
// ============================================================================

export const candles = mysqlTable(
  "candles",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    symbol: varchar("symbol", { length: 50 }).notNull(),
    timeframe: varchar("timeframe", { length: 10 }).notNull(),
    
    timestamp: bigint("timestamp", { mode: "number" }).notNull(),
    open: decimal("open", { precision: 20, scale: 8 }).notNull(),
    high: decimal("high", { precision: 20, scale: 8 }).notNull(),
    low: decimal("low", { precision: 20, scale: 8 }).notNull(),
    close: decimal("close", { precision: 20, scale: 8 }).notNull(),
    volume: decimal("volume", { precision: 20, scale: 8 }).notNull(),
    quoteAssetVolume: decimal("quote_asset_volume", { precision: 20, scale: 8 }),
    
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    symbolTimeframeIdx: index("symbol_timeframe_idx").on(table.symbol, table.timeframe),
    timestampIdx: index("timestamp_idx").on(table.timestamp),
  })
);

// ============================================================================
// Technical Indicators
// ============================================================================

export const indicators = mysqlTable(
  "indicators",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    symbol: varchar("symbol", { length: 50 }).notNull(),
    timeframe: varchar("timeframe", { length: 10 }).notNull(),
    timestamp: bigint("timestamp", { mode: "number" }).notNull(),
    
    // RSI
    rsi: decimal("rsi", { precision: 5, scale: 2 }),
    
    // MACD
    macdLine: decimal("macd_line", { precision: 20, scale: 8 }),
    signalLine: decimal("signal_line", { precision: 20, scale: 8 }),
    histogram: decimal("histogram", { precision: 20, scale: 8 }),
    
    // Bollinger Bands
    bbUpper: decimal("bb_upper", { precision: 20, scale: 8 }),
    bbMiddle: decimal("bb_middle", { precision: 20, scale: 8 }),
    bbLower: decimal("bb_lower", { precision: 20, scale: 8 }),
    
    // EMA
    ema: decimal("ema", { precision: 20, scale: 8 }),
    
    // Volume
    volumeMA: decimal("volume_ma", { precision: 20, scale: 8 }),
    
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    symbolTimeframeIdx: index("ind_symbol_timeframe_idx").on(table.symbol, table.timeframe),
    timestampIdx: index("ind_timestamp_idx").on(table.timestamp),
  })
);

// ============================================================================
// Trading Logs
// ============================================================================

export const tradingLogs = mysqlTable(
  "trading_logs",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    configId: varchar("config_id", { length: 255 }).notNull(),
    symbol: varchar("symbol", { length: 50 }).notNull(),
    
    logType: mysqlEnum("log_type", [
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
    ]).notNull(),
    
    message: text("message").notNull(),
    details: json("details"),
    
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("log_user_id_idx").on(table.userId),
    configIdIdx: index("log_config_id_idx").on(table.configId),
    logTypeIdx: index("log_type_idx").on(table.logType),
  })
);

// ============================================================================
// Bot Status
// ============================================================================

export const botStatus = mysqlTable(
  "bot_status",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    userId: varchar("user_id", { length: 255 }).notNull().unique(),
    configId: varchar("config_id", { length: 255 }).notNull(),
    
    isRunning: boolean("is_running").default(false),
    isPaused: boolean("is_paused").default(false),
    
    totalTrades: int("total_trades").default(0),
    winningTrades: int("winning_trades").default(0),
    losingTrades: int("losing_trades").default(0),
    
    totalPnl: decimal("total_pnl", { precision: 20, scale: 8 }).default("0"),
    totalPnlPercent: decimal("total_pnl_percent", { precision: 5, scale: 2 }).default("0"),
    
    currentBalance: decimal("current_balance", { precision: 20, scale: 8 }).default("0"),
    initialBalance: decimal("initial_balance", { precision: 20, scale: 8 }).default("0"),
    
    maxDrawdownPercent: decimal("max_drawdown_percent", { precision: 5, scale: 2 }).default("0"),
    winRate: decimal("win_rate", { precision: 5, scale: 2 }).default("0"),
    
    lastTradeTime: timestamp("last_trade_time"),
    lastUpdateTime: timestamp("last_update_time").defaultNow().onUpdateNow(),
    
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => ({
    userIdIdx: index("status_user_id_idx").on(table.userId),
  })
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
