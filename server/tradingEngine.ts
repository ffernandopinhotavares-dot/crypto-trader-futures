import { BybitClient, BybitKline } from "./bybit";
import {
  generateTradingSignal,
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  analyzeVolume,
  analyzeVolatility,
} from "./indicators";
import { getDatabase } from "./db";
import { trades, tradingConfigs, botStatus, tradingLogs, candles, indicators } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

// ============================================================================
// Types
// ============================================================================

export interface TradePosition {
  symbol: string;
  side: "BUY" | "SELL";
  entryPrice: number;
  quantity: number;
  entryTime: Date;
  stopLoss: number;
  takeProfit: number;
}

export interface TradingEngineConfig {
  userId: string;
  configId: string;
  bybitClient: BybitClient;
  tradingPairs: string[];
  maxPositionSize: number;
  maxDrawdown: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  rsiPeriod: number;
  rsiOverbought: number;
  rsiOversold: number;
  macdFastPeriod: number;
  macdSlowPeriod: number;
  macdSignalPeriod: number;
  bbPeriod: number;
  bbStdDev: number;
  emaPeriod: number;
  minVolume: number;
  timeframe: string;
}

// ============================================================================
// Trading Engine
// ============================================================================

export class TradingEngine {
  private config: TradingEngineConfig;
  private isRunning: boolean = false;
  private positions: Map<string, TradePosition> = new Map();

  private get db() {
    return getDatabase();
  }

  constructor(config: TradingEngineConfig) {
    this.config = config;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log("Trading engine is already running");
      return;
    }

    this.isRunning = true;
    console.log(`🚀 Trading engine started for user ${this.config.userId}`);

    await this.updateBotStatus({ isRunning: true });
    await this.logTrade("BOT_START", "Trading bot started", {
      config: this.config,
    });

    this.mainLoop();
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log("Trading engine is not running");
      return;
    }

    this.isRunning = false;
    console.log(`⛔ Trading engine stopped for user ${this.config.userId}`);

    await this.updateBotStatus({ isRunning: false });
    await this.logTrade("BOT_STOP", "Trading bot stopped", {});
  }

  private async mainLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        for (const symbol of this.config.tradingPairs) {
          await this.analyzeAndTrade(symbol);
        }
        await this.checkPositions();
        await this.sleep(5 * 60 * 1000);
      } catch (error) {
        console.error("Error in trading loop:", error);
        await this.logTrade("ERROR", `Trading loop error: ${error}`, {
          error: String(error),
        });
      }
    }
  }

  private async analyzeAndTrade(symbol: string): Promise<void> {
    try {
      const klines = await this.config.bybitClient.getKlines(
        symbol,
        this.timeframeToInterval(this.config.timeframe),
        200
      );

      if (klines.length < 50) {
        console.log(`Not enough data for ${symbol}`);
        return;
      }

      const prices = klines.map((k) => parseFloat(k.closePrice));
      const volumes = klines.map((k) => parseFloat(k.volume));

      await this.saveCandles(symbol, klines);

      const signal = generateTradingSignal(
        prices,
        volumes,
        {
          period: this.config.rsiPeriod,
          overbought: this.config.rsiOverbought,
          oversold: this.config.rsiOversold,
        },
        {
          fast: this.config.macdFastPeriod,
          slow: this.config.macdSlowPeriod,
          signal: this.config.macdSignalPeriod,
        },
        {
          period: this.config.bbPeriod,
          stdDev: this.config.bbStdDev,
        }
      );

      await this.saveIndicators(symbol, prices, volumes);

      await this.logTrade("SIGNAL_GENERATED", `Signal for ${symbol}: ${signal.recommendation}`, {
        symbol,
        signal,
      });

      if (signal.strength >= 50 && !this.positions.has(symbol)) {
        const ticker = await this.config.bybitClient.getTicker(symbol);
        const currentPrice = parseFloat(ticker.lastPrice);
        const positionSize = await this.calculatePositionSize(symbol, currentPrice);

        if (positionSize > 0) {
          await this.openPosition(symbol, "BUY", currentPrice, positionSize, prices);
        }
      } else if (signal.strength <= -50 && this.positions.has(symbol)) {
        const ticker = await this.config.bybitClient.getTicker(symbol);
        const currentPrice = parseFloat(ticker.lastPrice);
        await this.closePosition(symbol, currentPrice);
      }
    } catch (error) {
      console.error(`Error analyzing ${symbol}:`, error);
      await this.logTrade("ERROR", `Error analyzing ${symbol}: ${error}`, {
        symbol,
        error: String(error),
      });
    }
  }

  private async openPosition(
    symbol: string,
    side: "BUY" | "SELL",
    entryPrice: number,
    quantity: number,
    prices: number[]
  ): Promise<void> {
    try {
      const order = await this.config.bybitClient.placeOrder(
        symbol,
        side === "BUY" ? "Buy" : "Sell",
        "Market",
        quantity.toString()
      );

      const stopLoss = entryPrice * (1 - this.config.stopLossPercent / 100);
      const takeProfit = entryPrice * (1 + this.config.takeProfitPercent / 100);

      await this.config.bybitClient.setStopLossTakeProfit(
        symbol,
        side === "BUY" ? "Buy" : "Sell",
        stopLoss.toString(),
        takeProfit.toString()
      );

      const rsi = calculateRSI(prices, this.config.rsiPeriod);
      const macd = calculateMACD(
        prices,
        this.config.macdFastPeriod,
        this.config.macdSlowPeriod,
        this.config.macdSignalPeriod
      );
      const bb = calculateBollingerBands(prices, this.config.bbPeriod, this.config.bbStdDev);

      const trade = {
        id: nanoid(),
        userId: this.config.userId,
        configId: this.config.configId,
        symbol,
        side: side as "BUY" | "SELL",
        entryPrice: entryPrice.toString(),
        quantity: quantity.toString(),
        entryTime: new Date(),
        stopLoss: stopLoss.toString(),
        takeProfit: takeProfit.toString(),
        status: "OPEN" as const,
        rsiAtEntry: rsi.rsi.toString(),
        macdAtEntry: JSON.stringify(macd),
        bbAtEntry: JSON.stringify(bb),
        bybitOrderId: order.orderId,
      };

      await this.db.insert(trades).values(trade);

      this.positions.set(symbol, {
        symbol,
        side,
        entryPrice,
        quantity,
        entryTime: new Date(),
        stopLoss,
        takeProfit,
      });

      await this.logTrade("POSITION_OPENED", `Opened ${side} position on ${symbol}`, {
        symbol,
        side,
        entryPrice,
        quantity,
        stopLoss,
        takeProfit,
      });

      console.log(
        `✅ Opened ${side} position on ${symbol} at ${entryPrice} with quantity ${quantity}`
      );
    } catch (error) {
      console.error(`Error opening position on ${symbol}:`, error);
      await this.logTrade("ERROR", `Error opening position on ${symbol}: ${error}`, {
        symbol,
        error: String(error),
      });
    }
  }

  private async closePosition(symbol: string, exitPrice: number): Promise<void> {
    try {
      const position = this.positions.get(symbol);
      if (!position) {
        console.log(`No position found for ${symbol}`);
        return;
      }

      const closeSide = position.side === "BUY" ? "Sell" : "Buy";
      await this.config.bybitClient.placeOrder(
        symbol,
        closeSide as "Buy" | "Sell",
        "Market",
        position.quantity.toString()
      );

      const pnl =
        position.side === "BUY"
          ? (exitPrice - position.entryPrice) * position.quantity
          : (position.entryPrice - exitPrice) * position.quantity;

      const pnlPercent =
        ((exitPrice - position.entryPrice) / position.entryPrice) * 100;

      const tradeRecord = await this.db
        .select()
        .from(trades)
        .where(
          and(
            eq(trades.symbol, symbol),
            eq(trades.status, "OPEN")
          )
        )
        .limit(1);

      if (tradeRecord.length > 0) {
        await this.db
          .update(trades)
          .set({
            exitPrice: exitPrice.toString(),
            exitTime: new Date(),
            pnl: pnl.toString(),
            pnlPercent: pnlPercent.toString(),
            status: "CLOSED",
            exitReason: pnl > 0 ? "TAKE_PROFIT" : "STOP_LOSS",
          })
          .where(eq(trades.id, tradeRecord[0].id));
      }

      this.positions.delete(symbol);

      await this.logTrade("POSITION_CLOSED", `Closed position on ${symbol}`, {
        symbol,
        exitPrice,
        pnl,
        pnlPercent,
      });

      console.log(
        `✅ Closed position on ${symbol} at ${exitPrice}. P&L: ${pnl} (${pnlPercent}%)`
      );
    } catch (error) {
      console.error(`Error closing position on ${symbol}:`, error);
      await this.logTrade("ERROR", `Error closing position on ${symbol}: ${error}`, {
        symbol,
        error: String(error),
      });
    }
  }

  private async checkPositions(): Promise<void> {
    for (const [symbol, position] of this.positions) {
      try {
        const ticker = await this.config.bybitClient.getTicker(symbol);
        const currentPrice = parseFloat(ticker.lastPrice);

        if (
          (position.side === "BUY" && currentPrice <= position.stopLoss) ||
          (position.side === "SELL" && currentPrice >= position.stopLoss)
        ) {
          await this.closePosition(symbol, currentPrice);
          continue;
        }

        if (
          (position.side === "BUY" && currentPrice >= position.takeProfit) ||
          (position.side === "SELL" && currentPrice <= position.takeProfit)
        ) {
          await this.closePosition(symbol, currentPrice);
          continue;
        }
      } catch (error) {
        console.error(`Error checking position for ${symbol}:`, error);
      }
    }
  }

  private async calculatePositionSize(
    symbol: string,
    currentPrice: number
  ): Promise<number> {
    try {
      const balance = await this.config.bybitClient.getBalance();
      const usdtBalance = balance.find((b) => b.coin === "USDT");

      if (!usdtBalance) {
        console.log("USDT balance not found");
        return 0;
      }

      const availableBalance = parseFloat(usdtBalance.walletBalance);
      const maxPositionValue = availableBalance * (this.config.maxPositionSize / 100);
      const positionSize = maxPositionValue / currentPrice;

      return Math.floor(positionSize * 100) / 100;
    } catch (error) {
      console.error("Error calculating position size:", error);
      return 0;
    }
  }

  private async saveCandles(symbol: string, klines: BybitKline[]): Promise<void> {
    try {
      const candleRecords = klines.map((k) => ({
        id: nanoid(),
        symbol,
        timeframe: this.config.timeframe,
        timestamp: parseInt(k.startTime),
        open: k.openPrice,
        high: k.highPrice,
        low: k.lowPrice,
        close: k.closePrice,
        volume: k.volume,
        quoteAssetVolume: k.turnover,
      }));

      await this.db
        .delete(candles)
        .where(
          and(
            eq(candles.symbol, symbol),
            eq(candles.timeframe, this.config.timeframe)
          )
        );

      await this.db.insert(candles).values(candleRecords);
    } catch (error) {
      console.error("Error saving candles:", error);
    }
  }

  private async saveIndicators(
    symbol: string,
    prices: number[],
    volumes: number[]
  ): Promise<void> {
    try {
      const rsi = calculateRSI(prices, this.config.rsiPeriod);
      const macd = calculateMACD(
        prices,
        this.config.macdFastPeriod,
        this.config.macdSlowPeriod,
        this.config.macdSignalPeriod
      );
      const bb = calculateBollingerBands(prices, this.config.bbPeriod, this.config.bbStdDev);
      const volume = analyzeVolume(volumes);

      const indicator = {
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
        ema: "0",
        volumeMA: volume.volumeMA.toString(),
      };

      await this.db.insert(indicators).values(indicator);
    } catch (error) {
      console.error("Error saving indicators:", error);
    }
  }

  private async logTrade(
    logType: string,
    message: string,
    details: any
  ): Promise<void> {
    try {
      await this.db.insert(tradingLogs).values({
        id: nanoid(),
        userId: this.config.userId,
        configId: this.config.configId,
        symbol: details.symbol || "SYSTEM",
        logType: logType as any,
        message,
        details: JSON.stringify(details),
      });
    } catch (error) {
      console.error("Error logging trade:", error);
    }
  }

  private async updateBotStatus(updates: any): Promise<void> {
    try {
      const existingStatus = await this.db
        .select()
        .from(botStatus)
        .where(eq(botStatus.userId, this.config.userId))
        .limit(1);

      if (existingStatus.length > 0) {
        await this.db
          .update(botStatus)
          .set(updates)
          .where(eq(botStatus.userId, this.config.userId));
      } else {
        await this.db.insert(botStatus).values({
          id: nanoid(),
          userId: this.config.userId,
          configId: this.config.configId,
          ...updates,
        });
      }
    } catch (error) {
      console.error("Error updating bot status:", error);
    }
  }

  private timeframeToInterval(timeframe: string): string {
    const map: Record<string, string> = {
      "1m": "1",
      "5m": "5",
      "15m": "15",
      "30m": "30",
      "1h": "60",
      "4h": "240",
      "1d": "D",
    };
    return map[timeframe] || "60";
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getPositions(): TradePosition[] {
    return Array.from(this.positions.values());
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }
}
