import { GateioClient, GateioCandle } from "./gateio";
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
  gateioClient: GateioClient;
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
// Trading Engine — Autonomous AI-Driven (Gate.io Futures)
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
      const balance = await this.config.gateioClient.getBalance();
      this.initialBalance = parseFloat(balance.totalBalance);
    } catch { this.initialBalance = 0; }

    console.log(`AI Trading engine started for user ${this.config.userId}`);
    await this.updateBotStatus({ isRunning: true });
    await this.logEvent("BOT_START", "SYSTEM", `AI Trading bot started | Profile: ${this.config.aggressiveness} | Max risk/trade: ${this.config.maxRiskPerTrade}%`);
    this.mainLoop();
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;
    this.isRunning = false;
    console.log(`AI Trading engine stopped for user ${this.config.userId}`);
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
      // Get top volume USDT pairs from Gate.io Futures
      const topPairs = await this.config.gateioClient.getTopPairs(20);
      console.log(`[SCAN] Found ${topPairs.length} top pairs: ${topPairs.slice(0, 5).map(p => p.symbol).join(', ')}...`);

      const snapshots: MarketSnapshot[] = [];
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
        console.log(`[SCAN] No valid snapshots — skipping AI analysis`);
        await this.logEvent("ERROR", "SYSTEM", `Scan: 0 valid snapshots from ${topPairs.length} pairs (${snapshotErrors} errors)`);
        return;
      }

      // Ask AI to pick the best opportunities
      const decisions = await this.askAIForOpportunities(snapshots);

      for (const decision of decisions) {
        if (!this.isRunning) break;
        if (decision.action === "SKIP" || decision.action === "HOLD") continue;
        if (decision.confidence < this.getMinConfidence()) continue;
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

  private getMinConfidence(): number {
    return this.config.aggressiveness === "conservative" ? 75
      : this.config.aggressiveness === "moderate" ? 65
      : 55;
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
      above_ema50: s.price > s.ema50,
    }));

    const systemPrompt = `Você é um agente de trading algorítmico avançado especializado em criptoativos (futuros), com foco em maximização de retorno ajustado ao risco.

COMPORTAMENTO:
- Tome decisões dinâmicas e autônomas baseadas em probabilidade, contexto de mercado e gestão de risco.
- Corte prejuízos rapidamente quando a probabilidade piorar.
- Garanta lucros quando houver sinais de reversão.
- Ajuste capital e alavancagem dinamicamente.
- Prefira abrir MUITAS posições de valores BAIXOS alavancados para diversificar.

EXCHANGE: Gate.io Futures (USDT-M)
- Símbolos usam formato: BTC_USDT, ETH_USDT (com underscore)

PERFIL DE RISCO: ${this.config.aggressiveness}
- Conservative: alavancagem 1-5x, confiança mínima 75%, posições menores
- Moderate: alavancagem 3-10x, confiança mínima 65%, posições médias
- Aggressive: alavancagem 5-20x, confiança mínima 55%, posições maiores

REGRAS OBRIGATÓRIAS:
- CADA posição deve ter valor nocional de no MÁXIMO $10 USDT (antes da alavancagem)
- Abra MUITAS posições pequenas para diversificar (até ${this.config.maxOpenPositions} simultâneas, atualmente ${this.positions.size} abertas)
- Saldo disponível: ${availableBalance.toFixed(2)} USDT
- positionSizePercent deve resultar em ~$5-10 USDT por trade (calcule: ${availableBalance.toFixed(2)} * percent/100 = valor base)
- Considere funding rate (negativo favorece longs, positivo favorece shorts)
- Sempre considere risco de liquidação
- PRIORIZE abrir várias posições diferentes em vez de poucas grandes

Responda APENAS com um JSON array de decisões. Cada decisão:
{
  "action": "OPEN_LONG" | "OPEN_SHORT" | "SKIP",
  "symbol": "BTC_USDT",
  "confidence": 75,
  "leverage": 5,
  "positionSizePercent": 3,
  "reasoning": "breve explicação"
}

Retorne no máximo 10 oportunidades, ordenadas por confiança. Se não houver boas oportunidades, retorne array vazio []. PRIORIZE diversificação: escolha pares DIFERENTES.`;

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
      console.log(`[AI] Raw response: ${content.substring(0, 300)}`);
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.log(`[AI] No JSON array found in response`);
        return [];
      }
      const decisions = JSON.parse(jsonMatch[0]) as AIDecision[];
      console.log(`[AI] Got ${decisions.length} decisions: ${decisions.map(d => `${d.action} ${d.symbol} conf:${d.confidence}`).join(', ')}`);
      return decisions;
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
      const gateCandles = await this.config.gateioClient.getCandles(
        symbol, this.config.timeframe, 200
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

      // Get ticker for 24h change and funding rate
      const ticker = await this.config.gateioClient.getTicker(symbol);
      const change24h = parseFloat(ticker.priceChangePercent);
      const fundingRate = parseFloat(ticker.fundingRate);
      const volume24h = parseFloat(ticker.volume24h);

      // Determine trend
      let trend: "BULLISH" | "BEARISH" | "SIDEWAYS" = "SIDEWAYS";
      if (currentPrice > ema50 && macd.bullish && rsi.rsi > 50) trend = "BULLISH";
      else if (currentPrice < ema50 && !macd.bullish && rsi.rsi < 50) trend = "BEARISH";

      // Save candles and indicators to DB
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
        trend,
      };
    } catch (error) {
      console.error(`[SNAPSHOT] Error for ${symbol}: ${this.errStr(error)}`);
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // Trade Execution (Gate.io Futures)
  // --------------------------------------------------------------------------

  private async executeDecision(decision: AIDecision): Promise<void> {
    const side: "BUY" | "SELL" = decision.action === "OPEN_LONG" ? "BUY" : "SELL";

    try {
      // Get balance and calculate position size
      const balance = await this.config.gateioClient.getBalance();
      const available = parseFloat(balance.availableBalance);

      // Cap position size: max $10 USDT per position (before leverage)
      const sizePercent = Math.min(decision.positionSizePercent, this.config.maxRiskPerTrade);
      const baseValue = Math.min(available * (sizePercent / 100), 10); // hard cap at $10
      const notionalValue = baseValue * decision.leverage;

      // Get current price
      const ticker = await this.config.gateioClient.getTicker(decision.symbol);
      const currentPrice = parseFloat(ticker.lastPrice);
      if (currentPrice <= 0) return;

      // Get contract info for quantity calculation
      // Gate.io uses contract size (quanto_multiplier) — size is in number of contracts
      const contractInfo = await this.config.gateioClient.getContractInfo(decision.symbol);
      const quantoMultiplier = parseFloat(contractInfo.quanto_multiplier || "0.001");
      const contractValue = currentPrice * quantoMultiplier; // value of 1 contract in USDT
      const rawContracts = notionalValue / contractValue;
      const contracts = Math.floor(rawContracts);
      if (contracts <= 0) return;

      // Set leverage
      try {
        await this.config.gateioClient.setLeverage(decision.symbol, decision.leverage);
      } catch (e) {
        // Leverage may already be set or not supported at that level
        console.log(`Leverage set warning for ${decision.symbol}:`, this.errStr(e));
      }

      // Place market order
      const order = await this.config.gateioClient.placeOrder({
        symbol: decision.symbol,
        side,
        size: contracts,
      });

      // Record position in memory
      this.positions.set(decision.symbol, {
        symbol: decision.symbol,
        side,
        entryPrice: currentPrice,
        quantity: contracts,
        entryTime: new Date(),
        leverage: decision.leverage,
        confidence: decision.confidence,
      });

      // Record trade in DB
      await this.db.insert(trades).values({
        id: nanoid(),
        userId: this.config.userId,
        configId: this.config.configId,
        symbol: decision.symbol,
        side,
        entryPrice: currentPrice.toString(),
        quantity: contracts.toString(),
        entryTime: new Date(),
        stopLoss: "0", // AI manages exits dynamically
        takeProfit: "0",
        status: "OPEN",
        rsiAtEntry: String(decision.confidence),
        macdAtEntry: JSON.stringify({ leverage: decision.leverage }),
        bbAtEntry: JSON.stringify({ reasoning: decision.reasoning }),
        bybitOrderId: order.orderId,
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

  private async closePosition(symbol: string, exitPrice: number, reason: string): Promise<void> {
    try {
      const position = this.positions.get(symbol);
      if (!position) return;

      // Close position via Gate.io
      await this.config.gateioClient.closePosition(symbol);

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

  private async isDrawdownExceeded(): Promise<boolean> {
    if (this.initialBalance <= 0) return false;
    try {
      const balance = await this.config.gateioClient.getBalance();
      const currentBalance = parseFloat(balance.totalBalance);
      const drawdown = ((this.initialBalance - currentBalance) / this.initialBalance) * 100;
      return drawdown >= this.config.maxDrawdown;
    } catch { return false; }
  }

  // --------------------------------------------------------------------------
  // Data Persistence
  // --------------------------------------------------------------------------

  private async saveCandles(symbol: string, gateCandles: GateioCandle[]): Promise<void> {
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
          quoteAssetVolume: "0",
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

  // Map engine log types to DB enum values
  private mapLogType(type: string): string {
    const mapping: Record<string, string> = {
      "BOT_START": "BOT_START",
      "BOT_STOP": "BOT_STOP",
      "CYCLE_START": "INFO",
      "RISK_STOP": "ERROR",
      "POSITION_OPENED": "POSITION_OPENED",
      "POSITION_CLOSED": "POSITION_CLOSED",
      "ERROR": "ERROR",
      "SIGNAL_GENERATED": "SIGNAL_GENERATED",
      "ORDER_PLACED": "ORDER_PLACED",
      "ORDER_FILLED": "ORDER_FILLED",
    };
    return mapping[type] || "INFO";
  }

  private async logEvent(type: string, symbol: string, message: string): Promise<void> {
    try {
      await this.db.insert(tradingLogs).values({
        id: nanoid(),
        userId: this.config.userId,
        configId: this.config.configId,
        symbol,
        logType: this.mapLogType(type) as any,
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

  private sleep(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }
  private errStr(e: unknown): string { return e instanceof Error ? e.message : typeof e === "object" && e !== null ? JSON.stringify(e) : String(e); }

  getPositions(): TradePosition[] { return Array.from(this.positions.values()); }
  getIsRunning(): boolean { return this.isRunning; }
}
