import { BinanceClient, BinanceKline } from "./binance";
import {
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  analyzeVolume,
  analyzeVolatility,
  calculateEMAValue,
} from "./indicators";
import { getDatabase } from "./db";
import { trades, botStatus, tradingLogs, candles, indicators } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import OpenAI from "openai";

// ============================================================================
// Types
// ============================================================================

export interface TradePosition {
  symbol: string;
  side: "BUY" | "SELL";
  entryPrice: number;
  quantity: number;
  entryTime: Date;
  leverage: number;
  confidence: number; // 0-100 confidence at entry
}

export interface TradingEngineConfig {
  userId: string;
  configId: string;
  binanceClient: BinanceClient;
  // Autonomous config — no fixed pairs, no fixed SL/TP
  maxRiskPerTrade: number;     // max % of balance per trade (default 5)
  maxDrawdown: number;         // max total drawdown % before stopping (default 15)
  maxOpenPositions: number;    // max concurrent positions (default 10)
  timeframe: string;           // analysis timeframe (default "15m")
  aggressiveness: "conservative" | "moderate" | "aggressive"; // risk profile
}

interface MarketSnapshot {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  rsi: number;
  macd: { macdLine: number; signalLine: number; histogram: number; bullish: boolean };
  bb: { upper: number; middle: number; lower: number; position: number };
  volumeAnalysis: { volumeRatio: number; highVolume: boolean };
  volatility: { volatility: number; trend: string };
  ema50: number;
  fundingRate: number;
  trend: "BULLISH" | "BEARISH" | "SIDEWAYS";
}

interface AIDecision {
  action: "OPEN_LONG" | "OPEN_SHORT" | "CLOSE" | "HOLD" | "SKIP";
  symbol: string;
  confidence: number;       // 0-100
  leverage: number;          // 1-20
  positionSizePercent: number; // % of available balance
  reasoning: string;
}

// ============================================================================
// Trading Engine — Autonomous AI-Driven
// ============================================================================

export class TradingEngine {
  private config: TradingEngineConfig;
  private isRunning: boolean = false;
  private positions: Map<string, TradePosition> = new Map();
  private openai: OpenAI;
  private cycleCount: number = 0;
  private initialBalance: number = 0;

  private get db() { return getDatabase(); }

  constructor(config: TradingEngineConfig) {
    this.config = config;
    this.openai = new OpenAI(); // uses OPENAI_API_KEY and OPENAI_BASE_URL from env
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    // Record initial balance
    try {
      const balances = await this.config.binanceClient.getBalance();
      const usdt = balances.find((b) => b.coin === "USDT");
      this.initialBalance = parseFloat(usdt?.walletBalance ?? "0");
    } catch { this.initialBalance = 0; }

    console.log(`🚀 AI Trading engine started for user ${this.config.userId}`);
    await this.updateBotStatus({ isRunning: true });
    await this.logEvent("BOT_START", "SYSTEM", `AI Trading bot started | Profile: ${this.config.aggressiveness} | Max risk/trade: ${this.config.maxRiskPerTrade}%`);
    this.mainLoop();
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;
    this.isRunning = false;
    console.log(`⛔ AI Trading engine stopped for user ${this.config.userId}`);
    await this.updateBotStatus({ isRunning: false });
    await this.logEvent("BOT_STOP", "SYSTEM", "AI Trading bot stopped");
  }

  // --------------------------------------------------------------------------
  // Main Loop
  // --------------------------------------------------------------------------

  private async mainLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        this.cycleCount++;
        await this.logEvent("CYCLE_START", "SYSTEM", `Cycle #${this.cycleCount} started`);

        // 1. Check drawdown protection
        if (await this.isDrawdownExceeded()) {
          await this.logEvent("RISK_STOP", "SYSTEM", `Max drawdown ${this.config.maxDrawdown}% exceeded. Closing all positions.`);
          await this.closeAllPositions("MAX_DRAWDOWN");
          await this.stop();
          return;
        }

        // 2. Monitor existing positions — ask AI if we should close any
        await this.monitorPositions();

        // 3. Scan market for new opportunities (only if we have room)
        if (this.positions.size < this.config.maxOpenPositions) {
          await this.scanAndTrade();
        }

        // 4. Update heartbeat
        await this.updateBotStatus({ isRunning: true });

        // Wait between cycles (2 min for aggressive, 5 min for moderate, 10 min for conservative)
        const waitMs = this.config.aggressiveness === "aggressive" ? 2 * 60 * 1000
          : this.config.aggressiveness === "moderate" ? 5 * 60 * 1000
          : 10 * 60 * 1000;
        await this.sleep(waitMs);
      } catch (error) {
        const msg = this.errStr(error);
        console.error("Error in AI trading loop:", msg);
        await this.logEvent("ERROR", "SYSTEM", `Trading loop error: ${msg}`);
        await this.sleep(60 * 1000); // wait 1 min on error
      }
    }
  }

  // --------------------------------------------------------------------------
  // Market Scanning — Discover top opportunities
  // --------------------------------------------------------------------------

  private async scanAndTrade(): Promise<void> {
    try {
      // Get top volume USDT pairs from Binance Futures
      const allInstruments = await this.config.binanceClient.getAllInstruments();
      const symbols = allInstruments
        .filter((i) => i.status === "TRADING" && i.quoteAsset === "USDT")
        .map((i) => i.symbol)
        .slice(0, 50); // top 50

      // Get 24h tickers for all to find most active
      const snapshots: MarketSnapshot[] = [];
      const batchSymbols = symbols.slice(0, 20); // analyze top 20 to save API calls

      for (const symbol of batchSymbols) {
        try {
          const snapshot = await this.getMarketSnapshot(symbol);
          if (snapshot) snapshots.push(snapshot);
        } catch { /* skip symbols with errors */ }
      }

      if (snapshots.length === 0) return;

      // Ask AI to pick the best opportunities
      const decisions = await this.askAIForOpportunities(snapshots);

      for (const decision of decisions) {
        if (!this.isRunning) break;
        if (decision.action === "SKIP" || decision.action === "HOLD") continue;
        if (decision.confidence < 60) continue; // minimum confidence threshold
        if (this.positions.has(decision.symbol)) continue; // already in position
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

  // --------------------------------------------------------------------------
  // Position Monitoring — AI decides when to close
  // --------------------------------------------------------------------------

  private async monitorPositions(): Promise<void> {
    for (const [symbol, position] of Array.from(this.positions.entries())) {
      try {
        const snapshot = await this.getMarketSnapshot(symbol);
        if (!snapshot) continue;

        const pnlPercent = position.side === "BUY"
          ? ((snapshot.price - position.entryPrice) / position.entryPrice) * 100
          : ((position.entryPrice - snapshot.price) / position.entryPrice) * 100;

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

  private async askAIForOpportunities(snapshots: MarketSnapshot[]): Promise<AIDecision[]> {
    const balances = await this.config.binanceClient.getBalance();
    const usdt = balances.find((b) => b.coin === "USDT");
    const availableBalance = parseFloat(usdt?.walletBalance ?? "0");

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
      above_ema50: s.price > s.ema50,
    }));

    const systemPrompt = `Você é um agente de trading algorítmico avançado especializado em criptoativos (futuros), com foco em maximização de retorno ajustado ao risco.

COMPORTAMENTO:
- Tome decisões dinâmicas e autônomas baseadas em probabilidade, contexto de mercado e gestão de risco.
- Corte prejuízos rapidamente quando a probabilidade piorar.
- Garanta lucros quando houver sinais de reversão.
- Ajuste capital e alavancagem dinamicamente.
- Prefira abrir MUITAS posições de valores BAIXOS alavancados para diversificar.

PERFIL DE RISCO: ${this.config.aggressiveness}
- Conservative: alavancagem 1-5x, confiança mínima 75%, posições menores
- Moderate: alavancagem 3-10x, confiança mínima 65%, posições médias
- Aggressive: alavancagem 5-20x, confiança mínima 55%, posições maiores

REGRAS:
- Máximo ${this.config.maxRiskPerTrade}% do saldo por operação
- Máximo ${this.config.maxOpenPositions} posições simultâneas (atualmente ${this.positions.size} abertas)
- Saldo disponível: ${availableBalance.toFixed(2)} USDT
- Considere funding rate (negativo favorece longs, positivo favorece shorts)
- Alta volatilidade = menor alavancagem
- Sempre considere risco de liquidação

Responda APENAS com um JSON array de decisões. Cada decisão:
{
  "action": "OPEN_LONG" | "OPEN_SHORT" | "SKIP",
  "symbol": "BTCUSDT",
  "confidence": 75,
  "leverage": 5,
  "positionSizePercent": 3,
  "reasoning": "breve explicação"
}

Retorne no máximo 5 oportunidades, ordenadas por confiança. Se não houver boas oportunidades, retorne array vazio [].`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Dados de mercado atuais:\n${JSON.stringify(marketSummary, null, 2)}` },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content ?? "[]";
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];
      return JSON.parse(jsonMatch[0]) as AIDecision[];
    } catch (error) {
      await this.logEvent("ERROR", "AI", `AI opportunity analysis failed: ${this.errStr(error)}`);
      return [];
    }
  }

  private async askAIForPositionManagement(
    position: TradePosition,
    snapshot: MarketSnapshot,
    pnlPercent: number
  ): Promise<AIDecision> {
    const holdTime = (Date.now() - position.entryTime.getTime()) / (1000 * 60); // minutes

    const prompt = `Posição aberta:
- Symbol: ${position.symbol}
- Side: ${position.side}
- Entry: ${position.entryPrice}
- Current: ${snapshot.price}
- P&L: ${pnlPercent.toFixed(2)}%
- Leverage: ${position.leverage}x
- Confiança na entrada: ${position.confidence}%
- Tempo aberta: ${holdTime.toFixed(0)} minutos

Indicadores atuais:
- RSI: ${snapshot.rsi}
- MACD bullish: ${snapshot.macd.bullish}, histogram: ${snapshot.macd.histogram}
- BB position: ${snapshot.bb.position}
- Volatilidade: ${snapshot.volatility.volatility}% (${snapshot.volatility.trend})
- Volume ratio: ${snapshot.volumeAnalysis.volumeRatio}
- Tendência: ${snapshot.trend}

Decida: CLOSE ou HOLD?
- Se P&L positivo e sinais de reversão → CLOSE (proteger lucro)
- Se P&L negativo e probabilidade de recuperação baixa → CLOSE (cortar prejuízo)
- Se tendência continua favorável → HOLD

Responda APENAS com JSON:
{"action": "CLOSE" ou "HOLD", "symbol": "${position.symbol}", "confidence": 0, "leverage": 0, "positionSizePercent": 0, "reasoning": "explicação"}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um gestor de risco de trading de futuros cripto. Seja decisivo. Priorize proteger capital e garantir lucros." },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 500,
      });

      const content = response.choices[0]?.message?.content ?? '{"action":"HOLD"}';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { action: "HOLD", symbol: position.symbol, confidence: 0, leverage: 0, positionSizePercent: 0, reasoning: "Parse error" };
      return JSON.parse(jsonMatch[0]) as AIDecision;
    } catch (error) {
      await this.logEvent("ERROR", "AI", `AI position management failed: ${this.errStr(error)}`);
      return { action: "HOLD", symbol: position.symbol, confidence: 0, leverage: 0, positionSizePercent: 0, reasoning: "AI error - holding" };
    }
  }

  // --------------------------------------------------------------------------
  // Market Data Collection
  // --------------------------------------------------------------------------

  private async getMarketSnapshot(symbol: string): Promise<MarketSnapshot | null> {
    try {
      const klines = await this.config.binanceClient.getKlines(
        symbol, this.timeframeToInterval(this.config.timeframe), 200
      );
      if (klines.length < 50) return null;

      const prices = klines.map((k) => parseFloat(k.closePrice));
      const volumes = klines.map((k) => parseFloat(k.volume));
      const currentPrice = prices[prices.length - 1];

      const rsi = calculateRSI(prices, 14);
      const macd = calculateMACD(prices, 12, 26, 9);
      const bb = calculateBollingerBands(prices, 20, 2);
      const vol = analyzeVolume(volumes);
      const volat = analyzeVolatility(prices);
      const ema50 = calculateEMAValue(prices, 50);

      // Get 24h change
      const ticker = await this.config.binanceClient.getTicker(symbol);
      const change24h = parseFloat(ticker.lowPrice) !== 0
        ? ((currentPrice - parseFloat(ticker.lowPrice)) / parseFloat(ticker.lowPrice)) * 100
        : 0;

      // Get funding rate
      let fundingRate = 0;
      try {
        const fr = await this.config.binanceClient.getFundingRate(symbol);
        fundingRate = parseFloat(fr.fundingRate);
      } catch { /* skip */ }

      // Determine trend
      let trend: "BULLISH" | "BEARISH" | "SIDEWAYS" = "SIDEWAYS";
      if (currentPrice > ema50 && macd.bullish && rsi.rsi > 50) trend = "BULLISH";
      else if (currentPrice < ema50 && macd.bearish && rsi.rsi < 50) trend = "BEARISH";

      // Save candles and indicators
      await this.saveCandles(symbol, klines);
      await this.saveIndicators(symbol, prices, volumes);

      return {
        symbol,
        price: currentPrice,
        change24h,
        volume24h: parseFloat(ticker.volume),
        rsi: rsi.rsi,
        macd: { macdLine: macd.macdLine, signalLine: macd.signalLine, histogram: macd.histogram, bullish: macd.bullish },
        bb: { upper: bb.upper, middle: bb.middle, lower: bb.lower, position: bb.position },
        volumeAnalysis: { volumeRatio: vol.volumeRatio, highVolume: vol.highVolume },
        volatility: { volatility: volat.volatility, trend: volat.trend },
        ema50,
        fundingRate,
        trend,
      };
    } catch (error) {
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // Trade Execution
  // --------------------------------------------------------------------------

  private async executeDecision(decision: AIDecision): Promise<void> {
    const side: "BUY" | "SELL" = decision.action === "OPEN_LONG" ? "BUY" : "SELL";

    try {
      // Get balance and calculate position size
      const balances = await this.config.binanceClient.getBalance();
      const usdt = balances.find((b) => b.coin === "USDT");
      const available = parseFloat(usdt?.walletBalance ?? "0");

      // Cap position size by maxRiskPerTrade
      const sizePercent = Math.min(decision.positionSizePercent, this.config.maxRiskPerTrade);
      const notionalValue = available * (sizePercent / 100) * decision.leverage;

      // Get current price
      const ticker = await this.config.binanceClient.getTicker(decision.symbol);
      const currentPrice = parseFloat(ticker.lastPrice);
      if (currentPrice <= 0) return;

      // Get instrument info for lot size
      const instruments = await this.config.binanceClient.getInstruments(decision.symbol);
      const instrument = instruments[0];
      let stepSize = 0.001;
      if (instrument?.filters) {
        const lotFilter = instrument.filters.find((f: any) => f.filterType === "LOT_SIZE");
        if (lotFilter) stepSize = parseFloat(lotFilter.stepSize);
      }

      const rawQty = notionalValue / currentPrice;
      const precision = stepSize < 1 ? Math.ceil(-Math.log10(stepSize)) : 0;
      const quantity = Math.floor(rawQty / stepSize) * stepSize;
      if (quantity <= 0) return;

      // Set leverage
      await this.config.binanceClient.setLeverage(decision.symbol, decision.leverage);

      // Place order
      const order = await this.config.binanceClient.placeOrder(
        decision.symbol, side, "MARKET", quantity.toFixed(precision)
      );

      // Record position in memory
      this.positions.set(decision.symbol, {
        symbol: decision.symbol,
        side,
        entryPrice: currentPrice,
        quantity,
        entryTime: new Date(),
        leverage: decision.leverage,
        confidence: decision.confidence,
      });

      // Record trade in DB
      const rsi = calculateRSI([currentPrice], 14).rsi.toString();
      await this.db.insert(trades).values({
        id: nanoid(),
        userId: this.config.userId,
        configId: this.config.configId,
        symbol: decision.symbol,
        side,
        entryPrice: currentPrice.toString(),
        quantity: quantity.toString(),
        entryTime: new Date(),
        stopLoss: "0", // AI manages exits dynamically
        takeProfit: "0",
        status: "OPEN",
        rsiAtEntry: String(decision.confidence),
        macdAtEntry: `lev:${decision.leverage}x`,
        bbAtEntry: decision.reasoning,
        bybitOrderId: order.orderId,
      });

      await this.logEvent(
        "POSITION_OPENED",
        decision.symbol,
        `${side} ${quantity.toFixed(precision)} @ ${currentPrice} | Lev: ${decision.leverage}x | Conf: ${decision.confidence}% | ${decision.reasoning}`
      );
    } catch (error) {
      await this.logEvent("ERROR", decision.symbol, `Execute error: ${this.errStr(error)}`);
    }
  }

  private async closePosition(symbol: string, exitPrice: number, reason: string): Promise<void> {
    try {
      const position = this.positions.get(symbol);
      if (!position) return;

      const closeSide = position.side === "BUY" ? "SELL" : "BUY";

      // Get instrument info for precision
      const instruments = await this.config.binanceClient.getInstruments(symbol);
      const instrument = instruments[0];
      let stepSize = 0.001;
      if (instrument?.filters) {
        const lotFilter = instrument.filters.find((f: any) => f.filterType === "LOT_SIZE");
        if (lotFilter) stepSize = parseFloat(lotFilter.stepSize);
      }
      const precision = stepSize < 1 ? Math.ceil(-Math.log10(stepSize)) : 0;

      await this.config.binanceClient.placeOrder(symbol, closeSide, "MARKET", position.quantity.toFixed(precision));

      const pnl = position.side === "BUY"
        ? (exitPrice - position.entryPrice) * position.quantity
        : (position.entryPrice - exitPrice) * position.quantity;
      const pnlPercent = position.side === "BUY"
        ? ((exitPrice - position.entryPrice) / position.entryPrice) * 100
        : ((position.entryPrice - exitPrice) / position.entryPrice) * 100;

      // Update trade in DB
      const tradeRecord = await this.db.select().from(trades)
        .where(and(eq(trades.symbol, symbol), eq(trades.status, "OPEN"), eq(trades.userId, this.config.userId)))
        .limit(1);

      if (tradeRecord.length > 0) {
        await this.db.update(trades).set({
          exitPrice: exitPrice.toString(),
          exitTime: new Date(),
          pnl: pnl.toString(),
          pnlPercent: pnlPercent.toString(),
          status: "CLOSED",
          exitReason: reason,
        }).where(eq(trades.id, tradeRecord[0].id));
      }

      this.positions.delete(symbol);
      await this.logEvent(
        "POSITION_CLOSED",
        symbol,
        `Closed @ ${exitPrice} | P&L: ${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} USDT (${pnlPercent >= 0 ? "+" : ""}${pnlPercent.toFixed(2)}%) | ${reason}`
      );
    } catch (error) {
      await this.logEvent("ERROR", symbol, `Close error: ${this.errStr(error)}`);
    }
  }

  private async closeAllPositions(reason: string): Promise<void> {
    for (const [symbol] of Array.from(this.positions.entries())) {
      try {
        const ticker = await this.config.binanceClient.getTicker(symbol);
        await this.closePosition(symbol, parseFloat(ticker.lastPrice), reason);
      } catch (error) {
        await this.logEvent("ERROR", symbol, `Failed to close: ${this.errStr(error)}`);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Risk Management
  // --------------------------------------------------------------------------

  private async isDrawdownExceeded(): Promise<boolean> {
    if (this.initialBalance <= 0) return false;
    try {
      const balances = await this.config.binanceClient.getBalance();
      const usdt = balances.find((b) => b.coin === "USDT");
      const currentBalance = parseFloat(usdt?.walletBalance ?? "0");
      const drawdown = ((this.initialBalance - currentBalance) / this.initialBalance) * 100;
      return drawdown >= this.config.maxDrawdown;
    } catch { return false; }
  }

  // --------------------------------------------------------------------------
  // Data Persistence
  // --------------------------------------------------------------------------

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

  // --------------------------------------------------------------------------
  // Utilities
  // --------------------------------------------------------------------------

  private timeframeToInterval(timeframe: string): string {
    return ({ "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m", "1h": "1h", "4h": "4h", "1d": "1d" } as Record<string, string>)[timeframe] || "15m";
  }

  private sleep(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }
  private errStr(e: unknown): string { return e instanceof Error ? e.message : typeof e === "object" && e !== null ? JSON.stringify(e) : String(e); }

  getPositions(): TradePosition[] { return Array.from(this.positions.values()); }
  getIsRunning(): boolean { return this.isRunning; }
}
