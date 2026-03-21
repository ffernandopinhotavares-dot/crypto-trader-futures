import { BinanceClient, BinanceKline } from "./binance";
import {
  generateTradingSignal,
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  analyzeVolume,
} from "./indicators";
import { getDatabase } from "./db";
import { trades, botStatus, tradingLogs, candles, indicators } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

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
  binanceClient: BinanceClient;
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

export class TradingEngine {
  private config: TradingEngineConfig;
  private isRunning: boolean = false;
  private positions: Map<string, TradePosition> = new Map();

  private get db() { return getDatabase(); }

  constructor(config: TradingEngineConfig) {
    this.config = config;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`🚀 Trading engine started for user ${this.config.userId}`);
    await this.updateBotStatus({ isRunning: true });
    await this.logEvent("BOT_START", "SYSTEM", "Trading bot started");
    this.mainLoop();
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;
    this.isRunning = false;
    console.log(`⛔ Trading engine stopped for user ${this.config.userId}`);
    await this.updateBotStatus({ isRunning: false });
    await this.logEvent("BOT_STOP", "SYSTEM", "Trading bot stopped");
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
        const msg = this.errStr(error);
        console.error("Error in trading loop:", msg);
        await this.logEvent("ERROR", "SYSTEM", `Trading loop error: ${msg}`);
      }
    }
  }

  private async analyzeAndTrade(symbol: string): Promise<void> {
    try {
      const klines = await this.config.binanceClient.getKlines(
        symbol, this.timeframeToInterval(this.config.timeframe), 200
      );
      if (klines.length < 50) return;

      const prices = klines.map((k) => parseFloat(k.closePrice));
      const volumes = klines.map((k) => parseFloat(k.volume));

      await this.saveCandles(symbol, klines);

      const signal = generateTradingSignal(
        prices, volumes,
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

  private async openPosition(symbol: string, side: "BUY" | "SELL", entryPrice: number, quantity: number, prices: number[]): Promise<void> {
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
        entryTime: new Date(),
        stopLoss: stopLoss.toString(),
        takeProfit: takeProfit.toString(),
        status: "OPEN",
        rsiAtEntry: rsi.rsi.toString(),
        macdAtEntry: macd,
        bbAtEntry: bb,
        bybitOrderId: order.orderId,
      });

      this.positions.set(symbol, { symbol, side, entryPrice, quantity, entryTime: new Date(), stopLoss, takeProfit });
      await this.logEvent("POSITION_OPENED", symbol, `Opened ${side} at ${entryPrice}`);
    } catch (error) {
      await this.logEvent("ERROR", symbol, `Error opening position: ${this.errStr(error)}`);
    }
  }

  private async closePosition(symbol: string, exitPrice: number): Promise<void> {
    try {
      const position = this.positions.get(symbol);
      if (!position) return;

      const closeSide = position.side === "BUY" ? "SELL" : "BUY";
      await this.config.binanceClient.placeOrder(symbol, closeSide, "MARKET", position.quantity.toFixed(3));

      const pnl = position.side === "BUY"
        ? (exitPrice - position.entryPrice) * position.quantity
        : (position.entryPrice - exitPrice) * position.quantity;
      const pnlPercent = ((exitPrice - position.entryPrice) / position.entryPrice) * 100;

      const tradeRecord = await this.db.select().from(trades)
        .where(and(eq(trades.symbol, symbol), eq(trades.status, "OPEN"))).limit(1);

      if (tradeRecord.length > 0) {
        await this.db.update(trades).set({
          exitPrice: exitPrice.toString(),
          exitTime: new Date(),
          pnl: pnl.toString(),
          pnlPercent: pnlPercent.toString(),
          status: "CLOSED",
          exitReason: pnl > 0 ? "TAKE_PROFIT" : "STOP_LOSS",
        }).where(eq(trades.id, tradeRecord[0].id));
      }

      this.positions.delete(symbol);
      await this.logEvent("POSITION_CLOSED", symbol, `Closed at ${exitPrice}. PnL: ${pnl.toFixed(2)}`);
    } catch (error) {
      await this.logEvent("ERROR", symbol, `Error closing position: ${this.errStr(error)}`);
    }
  }

  private async checkPositions(): Promise<void> {
    for (const [symbol, position] of Array.from(this.positions.entries())) {
      try {
        const ticker = await this.config.binanceClient.getTicker(symbol);
        const currentPrice = parseFloat(ticker.lastPrice);
        const slTriggered = (position.side === "BUY" && currentPrice <= position.stopLoss) || (position.side === "SELL" && currentPrice >= position.stopLoss);
        const tpTriggered = (position.side === "BUY" && currentPrice >= position.takeProfit) || (position.side === "SELL" && currentPrice <= position.takeProfit);
        if (slTriggered || tpTriggered) await this.closePosition(symbol, currentPrice);
      } catch (error) {
        console.error(`Error checking position ${symbol}:`, this.errStr(error));
      }
    }
  }

  private async calculatePositionSize(currentPrice: number): Promise<number> {
    try {
      const balances = await this.config.binanceClient.getBalance();
      const usdtBalance = balances.find((b) => b.coin === "USDT");
      if (!usdtBalance) return 0;
      const available = parseFloat(usdtBalance.walletBalance);
      return Math.max(0, (available * (this.config.maxPositionSize / 100)) / currentPrice);
    } catch { return 0; }
  }

  private async saveCandles(symbol: string, klines: BinanceKline[]): Promise<void> {
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
          quoteAssetVolume: kline.turnover,
        }).onConflictDoNothing();
      }
    } catch (_) {}
  }

  private async saveIndicators(symbol: string, prices: number[], volumes: number[]): Promise<void> {
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
        volumeMA: vol.volumeMA.toString(),
      });
    } catch (_) {}
  }

  private async logEvent(type: string, symbol: string, message: string): Promise<void> {
    try {
      await this.db.insert(tradingLogs).values({
        id: nanoid(),
        userId: this.config.userId,
        configId: this.config.configId,
        symbol,
        logType: type as any,
        message,
        details: null,
        createdAt: new Date(),
      });
      console.log(`[${type}] ${message}`);
    } catch (error) {
      console.error("Error logging event:", error);
    }
  }

  private async updateBotStatus(update: { isRunning?: boolean }): Promise<void> {
    try {
      const existing = await this.db.select().from(botStatus).where(eq(botStatus.userId, this.config.userId)).limit(1);
      if (existing.length === 0) {
        await this.db.insert(botStatus).values({
          id: nanoid(),
          userId: this.config.userId,
          configId: this.config.configId,
          isRunning: update.isRunning ?? false,
          startedAt: update.isRunning ? new Date() : null,
          lastHeartbeat: new Date(),
        });
      } else {
        await this.db.update(botStatus).set({
          isRunning: update.isRunning ?? existing[0].isRunning,
          startedAt: update.isRunning ? new Date() : existing[0].startedAt,
          lastHeartbeat: new Date(),
        }).where(eq(botStatus.userId, this.config.userId));
      }
    } catch (error) {
      console.error("Error updating bot status:", error);
    }
  }

  private timeframeToInterval(timeframe: string): string {
    return ({ "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m", "1h": "1h", "4h": "4h", "1d": "1d" } as Record<string,string>)[timeframe] || "1h";
  }

  private sleep(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }
  private errStr(e: unknown): string { return e instanceof Error ? e.message : typeof e === "object" && e !== null ? JSON.stringify(e) : String(e); }

  getPositions(): TradePosition[] { return Array.from(this.positions.values()); }
  getIsRunning(): boolean { return this.isRunning; }
}
