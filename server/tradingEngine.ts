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
  confidence: number;
  quantoMultiplier: number;
  highWaterMarkPct: number;
  trailingStopPct: number;
}

export interface TradingEngineConfig {
  userId: string;
  configId: string;
  gateioClient: GateioClient;
  maxRiskPerTrade: number;     // max % of balance per trade (default 3)
  maxDrawdown: number;         // max total drawdown % before stopping (default 12)
  maxOpenPositions: number;    // kept for compatibility
  timeframe: string;           // analysis timeframe (default "15m")
  aggressiveness: "conservative" | "moderate" | "aggressive";
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
  ema200: number;
  fundingRate: number;
  trend: "BULLISH" | "BEARISH" | "SIDEWAYS";
  // Multi-timeframe confirmation
  htfTrend?: "BULLISH" | "BEARISH" | "SIDEWAYS"; // higher timeframe trend (1h)
}

interface AIDecision {
  action: "OPEN_LONG" | "OPEN_SHORT" | "CLOSE" | "HOLD" | "SKIP";
  symbol: string;
  confidence: number;
  leverage: number;
  positionSizePercent: number;
  reasoning: string;
}

// BTC macro trend context
interface MacroContext {
  btcTrend: "BULLISH" | "BEARISH" | "SIDEWAYS";
  btcRsi: number;
  btcChange24h: number;
  btcVolatility: number;
  marketSentiment: "RISK_ON" | "RISK_OFF" | "NEUTRAL";
  timestamp: number;
}

// ============================================================================
// Trading Engine v2.0 — Optimized AI-Driven (Gate.io Futures)
// ============================================================================

export class TradingEngine {
  private config: TradingEngineConfig;
  private isRunning: boolean = false;
  private positions: Map<string, TradePosition> = new Map();
  private openai: OpenAI;
  private cycleCount: number = 0;
  private initialBalance: number = 0;
  private highWaterMarkBalance: number = 0; // [FIX 13.0] Melhor baseline para drawdown

  // [CREDIT GUARD] Track consecutive AI 402/credit errors
  private consecutiveAIErrors: number = 0;
  private static readonly MAX_CONSECUTIVE_AI_ERRORS = 3;

  // Cache
  private contractInfoCache: Map<string, { data: any; cachedAt: number }> = new Map();
  private allTickersCache: { data: any[] | null; cachedAt: number } = { data: null, cachedAt: 0 };
  private macroContext: MacroContext | null = null;
  private static readonly CONTRACT_CACHE_TTL = 60 * 60 * 1000;
  private static readonly ALL_TICKERS_CACHE_TTL = 3 * 60 * 1000;
  private static readonly MACRO_CACHE_TTL = 5 * 60 * 1000; // BTC macro refreshes every 5 min
  private static readonly API_DELAY_MS = 100;
  private static readonly SNAPSHOT_BATCH_SIZE = 15;
  private static readonly AI_BATCH_SIZE = 50;

  // Capital management
  private static readonly CAPITAL_RESERVE_PCT = 0.25; // [FIX 17.0] 25% reserve — blindagem contra liquidação em cascata
  // Análise: drawdown P95 de -$48.72 com 12 posições. Com 20% reserva ($37), o drawdown ultrapassa a margem.
  // Com 25% ($46), há folga suficiente para absorver o pior cenário histórico sem liquidação.
  private static readonly MIN_VOLUME_24H = 1_000_000; // [FIX 17.0] $1M min volume (up from $500k) — anti-slippage: evita NAORIS_USDT-style -$16 losses por falta de liquidez no order book

  // Win rate monitoring
  private static readonly WIN_RATE_ALERT_THRESHOLD = 40;
  private static readonly WIN_RATE_CHECK_INTERVAL = 10;
  private static readonly WIN_RATE_MIN_SAMPLE = 15;

  // Margin mode
  private static readonly ISOLATED_MARGIN_THRESHOLD = 200;
  private static readonly ISOLATED_MARGIN_MODE = "isolated";
  private static readonly CROSS_MARGIN_MODE = "cross";

  // [FIX 17.0] Symbol blacklist — pares com histórico de perdas consistentes
  // Atualizado em 24/03/2026 19:09 BRT — Learning Engine delta desde baseline 12:21 BRT
  private static readonly SYMBOL_BLACKLIST = new Set([
    // === BANIDOS ANTERIORES (FIX 14.0) ===
    "RDNT_USDT",    // WR 0%, PnL total -$4.59 (histórico)
    "FOLKS_USDT",   // PnL negativo, duração longa (histórico) | delta: -$1.06
    "HUMA_USDT",    // WR 0%, -$2.34 total
    "龙虾_USDT",    // WR 0%, -$1.27 total
    "C_USDT",       // HARD_STOP slippage extremo (-$2.88 histórico) | delta: -$2.875
    "NAORIS_USDT",  // PnL crítico -$15.46
    "DEGO_USDT",    // 25 trades, WR 40%, -$12.33
    "TURBO_USDT",   // Duração 376min, -$8.07
    "CFG_USDT",     // Duração 599min (baixa liquidez), -$7.23
    "POWER_USDT",   // PnL severo -$4.97
    "DASH_USDT",    // WR 33%, -$4.04
    "OPEN_USDT",    // WR 0%, -$3.78
    "LYN_USDT",     // Perda consistente
    "SAHARA_USDT",  // Perda consistente
    "OP_USDT",      // Perda consistente
    "FLOW_USDT",    // Perda consistente (delta: -$0.46 em 1 trade)
    "ORDER_USDT",   // Perda consistente
    "MON_USDT",     // Perda consistente
    // === NOVOS BANIDOS (FIX 17.0) — delta 24/03/2026 12:21→19:09 BRT ===
    "FORTH_USDT",   // WR 50%, PnL delta -$1.158 (HARD_STOP -$1.458 em 1 trade)
    "BTR_USDT",     // WR 0%, PnL delta -$0.9095
    "AIA_USDT",     // WR 50%, PnL delta -$0.5644 (2 trades, avg -$0.28)
    "PLAY_USDT",    // WR 0%, PnL delta -$0.456
    "UAI_USDT",     // WR 0%, PnL delta -$0.33
    "PHA_USDT",     // WR 0%, PnL delta -$0.307
    "DEXE_USDT",    // WR 0%, PnL delta -$0.260
  ]);

  private get db() { return getDatabase(); }

  constructor(config: TradingEngineConfig) {
    this.config = config;
    this.openai = new OpenAI();
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const balance = await this.config.gateioClient.getBalance();
      this.initialBalance = parseFloat(balance.totalBalance);
      // [FIX 13.0] highWaterMark começa no saldo inicial e só sobe, nunca desce
      this.highWaterMarkBalance = Math.max(this.highWaterMarkBalance, this.initialBalance);
    } catch { this.initialBalance = 0; }

    await this.syncPositionsFromExchange();

    console.log(`[ENGINE v2.0] Started for user ${this.config.userId}`);
    await this.updateBotStatus({ isRunning: true });
    await this.logEvent("BOT_START", "SYSTEM",
      `AI Trading bot v2.0 started | Profile: ${this.config.aggressiveness} | Max risk/trade: ${this.config.maxRiskPerTrade}% | Synced ${this.positions.size} positions | Balance: $${this.initialBalance.toFixed(2)}`);
    this.mainLoop();
  }

  async stop(): Promise<void> {
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
          let exitPrice: number;
          try {
            const ticker = await this.config.gateioClient.getTicker(symbol);
            exitPrice = parseFloat(ticker.lastPrice);
          } catch {
            try {
              const exchangePositions = await this.config.gateioClient.getPositions();
              const pos = exchangePositions.find(p => p.symbol === symbol);
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

  private async syncPositionsFromExchange(): Promise<void> {
    try {
      const exchangePositions = await this.config.gateioClient.getPositions();

      let openDbTrades: Array<{ symbol: string; entryTime: Date; entryPrice: string | null; side: "BUY" | "SELL"; quantity: string | null }> = [];
      try {
        openDbTrades = await this.db.select({
          symbol: trades.symbol,
          entryTime: trades.entryTime,
          entryPrice: trades.entryPrice,
          side: trades.side,
          quantity: trades.quantity,
        }).from(trades)
          .where(and(eq(trades.status, "OPEN"), eq(trades.userId, this.config.userId)));
      } catch (dbErr) {
        console.error("[SYNC] Could not fetch open trades from DB:", this.errStr(dbErr));
      }

      // [FIX 17.0] ORPHAN_CLEANUP: Fechar trades OPEN no DB que não existem mais na exchange
      // Causa: posições liquidadas ou fechadas na Gate.io não eram detectadas, gerando 22 trades fantasmas
      // com perda média de -$1.57/trade e total de -$34.59 (maior avg_loss do sistema)
      const exchangeSymbols = new Set(exchangePositions.filter(p => Math.abs(parseFloat(p.size)) > 0).map(p => p.symbol));
      let orphansClosed = 0;
      for (const dbTrade of openDbTrades) {
        if (!exchangeSymbols.has(dbTrade.symbol)) {
          try {
            const ticker = await this.config.gateioClient.getTicker(dbTrade.symbol).catch(() => null);
            const exitPrice = ticker ? parseFloat(ticker.lastPrice) : parseFloat(dbTrade.entryPrice ?? "0");
            await this.closePositionRecord(dbTrade.symbol, exitPrice, "ORPHAN_CLEANUP");
            orphansClosed++;
            await this.logEvent("INFO", dbTrade.symbol, `[FIX 17.0] ORPHAN_CLEANUP: trade OPEN no DB mas inexistente na exchange. Fechado @ ${exitPrice}`);
          } catch (orphanErr) {
            console.error(`[SYNC] ORPHAN_CLEANUP error for ${dbTrade.symbol}:`, this.errStr(orphanErr));
          }
        }
      }
      if (orphansClosed > 0) {
        await this.logEvent("INFO", "SYSTEM", `[FIX 17.0] ORPHAN_CLEANUP: ${orphansClosed} trades órfãos fechados no DB`);
      }

      let syncedCount = 0;
      for (const pos of exchangePositions) {
        const absSize = Math.abs(parseFloat(pos.size));
        if (absSize > 0 && !this.positions.has(pos.symbol)) {
          const side: "BUY" | "SELL" = pos.side === "LONG" ? "BUY" : "SELL";
          const leverage = Math.min(parseFloat(pos.leverage) || 5, this.getMaxLeverage()); // FIX MAX_LEVERAGE: cap 5x no sync
          const entryPrice = parseFloat(pos.entryPrice) || 0;

          const dbTrade = openDbTrades.find(t => t.symbol === pos.symbol && t.side === side);
          const entryTime = dbTrade?.entryTime ?? new Date();

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
            trailingStopPct: -(this.config.maxRiskPerTrade ?? 3),
          });

          syncedCount++;
          console.log(`[SYNC] Restored: ${pos.symbol} ${side} qty=${absSize} entry=${entryPrice} lev=${leverage}x`);
        }
      }
      console.log(`[SYNC] Complete: ${syncedCount} positions restored | ${orphansClosed} orphans cleaned`);
    } catch (error) {
      console.error("[SYNC] Error:", this.errStr(error));
    }
  }

  // --------------------------------------------------------------------------
  // Main Loop
  // --------------------------------------------------------------------------

  private async mainLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        this.cycleCount++;
        await this.logEvent("CYCLE_START", "SYSTEM",
          `Cycle #${this.cycleCount} | Positions: ${this.positions.size}`);

        // 1. Check drawdown protection
        if (await this.isDrawdownExceeded()) {
          await this.logEvent("RISK_STOP", "SYSTEM",
            `Max drawdown ${this.config.maxDrawdown}% exceeded. Closing all positions.`);
          await this.closeAllPositions("MAX_DRAWDOWN");
          
          await this.logEvent("AUTO_RESTART", "SYSTEM",
            "Drawdown limit hit. All positions closed. Resetting baseline.");
          
          try {
            const freshBalance = await this.config.gateioClient.getBalance();
            this.initialBalance = parseFloat(freshBalance.totalBalance);
            // [FIX 13.0] Resetar highWaterMark para o novo saldo após drawdown real
            this.highWaterMarkBalance = this.initialBalance;
            await this.logEvent("AUTO_RESTART", "SYSTEM",
              `New baseline: $${this.initialBalance.toFixed(2)}. HWM reset. Cooldown 3 min.`);
          } catch (e) {
            await this.logEvent("ERROR", "SYSTEM", `Failed to reset balance: ${this.errStr(e)}`);
            await this.stop();
            return;
          }
          
          await this.sleep(3 * 60 * 1000); // 3 min cooldown
          continue;
        }

        // 2. Update BTC macro context (every cycle, cached for 5 min)
        await this.updateMacroContext();

        // 3. Monitor existing positions — hard stop + AI decisions
        await this.monitorPositions();

        // 4. Scan market for new opportunities
        await this.scanAndTrade();

        // 5. Win rate check
        if (this.cycleCount % TradingEngine.WIN_RATE_CHECK_INTERVAL === 0) {
          await this.checkWinRateAlert();
        }

        // 6. Heartbeat
        await this.updateBotStatus({ isRunning: true });

        // Cycle intervals: 10 min aggressive, 15 min moderate, 20 min conservative
        const waitMs = this.config.aggressiveness === "aggressive" ? 10 * 60 * 1000
          : this.config.aggressiveness === "moderate" ? 15 * 60 * 1000
          : 20 * 60 * 1000;
        await this.sleep(waitMs);
      } catch (error) {
        const msg = this.errStr(error);
        console.error("Error in trading loop:", msg);
        await this.logEvent("ERROR", "SYSTEM", `Loop error: ${msg}`);
        await this.sleep(60 * 1000);
      }
    }
  }

  // --------------------------------------------------------------------------
  // BTC Macro Trend Filter
  // --------------------------------------------------------------------------

  private async updateMacroContext(): Promise<void> {
    if (this.macroContext && (Date.now() - this.macroContext.timestamp) < TradingEngine.MACRO_CACHE_TTL) {
      return; // Still fresh
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
          timestamp: Date.now(),
        };
        return;
      }

      // Determine market sentiment from BTC
      let sentiment: "RISK_ON" | "RISK_OFF" | "NEUTRAL" = "NEUTRAL";
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
        timestamp: Date.now(),
      };

      await this.logEvent("INFO", "BTC",
        `[MACRO] BTC: ${btcSnapshot.trend} | RSI: ${btcSnapshot.rsi.toFixed(1)} | 24h: ${btcSnapshot.change24h.toFixed(2)}% | Sentiment: ${sentiment}`);
    } catch (error) {
      console.error("[MACRO] Error updating BTC context:", this.errStr(error));
    }
  }

  // --------------------------------------------------------------------------
  // Market Scanning — Discover top opportunities with macro filter
  // --------------------------------------------------------------------------

  private async scanAndTrade(): Promise<void> {
    try {
      // MACRO GATE: OTIMIZADO PARA LUCRO - NUNCA BLOQUEIA TOTALMENTE, APENAS APLICA VIÉS
      // Em RISK_OFF, a IA já recebe a instrução para priorizar SHORTs, não precisamos bloquear LONGs excepcionais
      const isRiskOff = this.macroContext?.marketSentiment === "RISK_OFF";
      if (isRiskOff) {
        await this.logEvent("INFO", "SYSTEM",
          `[SCAN] RISK_OFF (BTC: ${this.macroContext!.btcTrend}, RSI: ${this.macroContext!.btcRsi.toFixed(1)}, 24h: ${this.macroContext!.btcChange24h.toFixed(2)}%) — IA instruída a priorizar SHORTs`);
      }

      // STAGE 1: Fetch ALL tickers, filter by higher volume threshold
      const allTickers = await this.getCachedAllTickers();
      const candidateTickers = allTickers.filter(t =>
        !this.positions.has(t.symbol) &&
        !TradingEngine.SYMBOL_BLACKLIST.has(t.symbol)  // [FIX 14.0] Excluir pares da blacklist
      );
      const blacklistFiltered = allTickers.filter(t => TradingEngine.SYMBOL_BLACKLIST.has(t.symbol)).length;
      await this.logEvent("INFO", "SYSTEM",
        `[SCAN] Stage 1: ${allTickers.length} tickers (vol>$${(TradingEngine.MIN_VOLUME_24H/1000).toFixed(0)}k) | ${candidateTickers.length} candidates | ${blacklistFiltered} blacklisted`);

      if (candidateTickers.length === 0) return;

      // STAGE 2: Build market snapshots in parallel batches
      const snapshots: MarketSnapshot[] = [];
      let snapshotErrors = 0;
      const batchSize = TradingEngine.SNAPSHOT_BATCH_SIZE;

      for (let i = 0; i < candidateTickers.length; i += batchSize) {
        if (!this.isRunning) break;
        const batch = candidateTickers.slice(i, i + batchSize);

        const batchResults = await Promise.allSettled(
          batch.map(ticker => this.getMarketSnapshot(ticker.symbol))
        );

        for (const result of batchResults) {
          if (result.status === "fulfilled" && result.value) {
            snapshots.push(result.value);
          } else {
            snapshotErrors++;
          }
        }

        if (i + batchSize < candidateTickers.length) {
          await this.sleep(TradingEngine.API_DELAY_MS * 3);
        }
      }

      await this.logEvent("INFO", "SYSTEM",
        `[SCAN] Stage 2: ${snapshots.length} snapshots | ${snapshotErrors} errors`);

      if (snapshots.length === 0) return;

      // PRE-FILTER: Apply quantitative filters BEFORE sending to AI
      // This reduces AI load and prevents low-quality signals
      const filteredSnapshots = snapshots.filter(s => {
        // Minimum volatility — too stable pairs don't generate profit
        if (s.volatility.volatility < 0.4) return false;
        // Minimum volume ratio — need decent liquidity
        if (s.volumeAnalysis.volumeRatio < 0.5) return false;
        // [FIX 17.0] HARD BLOCK: LONG com RSI >= 70 — dados de 418 trades mostram WR=34% e PnL=-$110.83
        // 291 dos 418 trades (69%) foram abertos com RSI>=70, causando quase 100% das perdas totais
        // SHORTs com RSI < 70 são PERMITIDOS (WR=48.8%, PnL=+$4.84 — rentáveis)
        if (s.rsi >= 70 && s.trend === 'BULLISH') return false; // Bloqueia candidatos a LONG exaustos
        // [FIX 15.0] Manter apenas o filtro de RSI<15 (oversold extremo não é candidato a SHORT)
        if (s.rsi < 15) return false;
        // Skip if 24h change is extreme (>15% or <-15%) — likely exhausted
        if (Math.abs(s.change24h) > 15) return false;
        return true;
      });

      await this.logEvent("INFO", "SYSTEM",
        `[SCAN] Pre-filter: ${filteredSnapshots.length}/${snapshots.length} passed quantitative filters`);

      if (filteredSnapshots.length === 0) return;

      // STAGE 3: Send to AI in batches
      const allDecisions: AIDecision[] = [];
      const aiBatchSize = TradingEngine.AI_BATCH_SIZE;

      for (let i = 0; i < filteredSnapshots.length; i += aiBatchSize) {
        if (!this.isRunning) break;
        const snapshotBatch = filteredSnapshots.slice(i, i + aiBatchSize);
        const batchDecisions = await this.askAIForOpportunities(snapshotBatch);
        allDecisions.push(...batchDecisions);
      }

      // Sort by confidence (highest first)
      allDecisions.sort((a, b) => b.confidence - a.confidence);
      await this.logEvent("INFO", "SYSTEM",
        `[SCAN] AI returned ${allDecisions.length} recommendations`);

      // EXECUTE: Open viable positions
      let openedCount = 0;
      for (const decision of allDecisions) {
        if (!this.isRunning) break;
        if (decision.action === "SKIP" || decision.action === "HOLD") continue;
        if (decision.confidence < this.getMinConfidence()) continue;
        if (this.positions.has(decision.symbol)) continue;
        // MACRO GATE: Exigir mais confiança para LONGs em RISK_OFF
        if (isRiskOff && decision.action === "OPEN_LONG" && decision.confidence < this.getMinConfidence() + 5) {
          await this.logEvent("INFO", decision.symbol, `[MACRO] LONG rejeitado em RISK_OFF (confiança ${decision.confidence}% insuficiente)`);
          continue;
        }

        // Check capital availability with reserve
        const balance = await this.config.gateioClient.getBalance();
        const totalBalance = parseFloat(balance.totalBalance);
        const available = parseFloat(balance.availableBalance);
        const reserveFloor = totalBalance * TradingEngine.CAPITAL_RESERVE_PCT;
        const deployable = available - reserveFloor;
        if (deployable < 2.0) {
          await this.logEvent("INFO", "SYSTEM",
            `[SCAN] Capital limit: deployable $${deployable.toFixed(2)} (reserve $${reserveFloor.toFixed(2)})`);
          break;
        }

        // Cap leverage
        decision.leverage = Math.min(decision.leverage, this.getMaxLeverage());

        // Macro-adjusted leverage: reduce by 1x if sentiment is NEUTRAL (not RISK_ON)
        if (this.macroContext?.marketSentiment === "NEUTRAL") {
          decision.leverage = Math.max(1, decision.leverage - 1);
        }

        try {
          await this.executeDecision(decision);
          openedCount++;
          await this.sleep(TradingEngine.API_DELAY_MS * 2);
        } catch (error) {
          await this.logEvent("ERROR", decision.symbol, `Execute failed: ${this.errStr(error)}`);
        }
      }

      await this.logEvent("INFO", "SYSTEM",
        `[SCAN] Opened ${openedCount} positions | Total: ${this.positions.size} | ~$${(this.positions.size * 10).toFixed(0)} deployed`);

    } catch (error) {
      await this.logEvent("ERROR", "SYSTEM", `Scan error: ${this.errStr(error)}`);
    }
  }

  // Confidence thresholds — OTIMIZADO PARA MAIS TRADES
  private getMinConfidence(): number {
    return this.config.aggressiveness === "conservative" ? 80
      : this.config.aggressiveness === "moderate" ? 75
      : 70; // 70% permite mais oportunidades com alavancagem adaptativa
  }

  // Leverage limits — MAX 5x por configuração do usuário (FIX MAX_LEVERAGE)
  private getMaxLeverage(): number {
    return 5; // Limite máximo fixo em 5x conforme configuração do usuário
  }

  // --------------------------------------------------------------------------
  // Position Monitoring — Hard stops + Trailing + AI decisions
  // --------------------------------------------------------------------------

  private async monitorPositions(): Promise<void> {
    for (const [symbol, position] of Array.from(this.positions.entries())) {
      try {
        const holdTimeMinutes = (Date.now() - position.entryTime.getTime()) / (1000 * 60);
        const minHoldMinutes = this.getMinHoldMinutes();

        const snapshot = await this.getMarketSnapshot(symbol);
        if (!snapshot) continue;

        const pnlPercent = position.side === "BUY"
          ? ((snapshot.price - position.entryPrice) / position.entryPrice) * 100
          : ((position.entryPrice - snapshot.price) / position.entryPrice) * 100;

        // Update trailing stop high-water mark (OTIMIZADO PARA R:R ≥ 1.5x)
        // [FIX 16.0] Trailing stop redesenhado para garantir ratio R:R mínimo de 1.5x
        // Diagnóstico 24/03/2026: avg_win=+$0.65 vs avg_loss=-$0.88 → R:R=0.74 (precisa ser ≥1.5)
        // Causa raiz: trailing stop ativava muito cedo, cortando ganhos antes de atingir 1.5x o risco
        // Hard stop: leverage>8 → -2.0%, leverage<=8 → -3.0%
        // Para R:R=1.5x: leverage>8 → TP alvo = +3.0%, leverage<=8 → TP alvo = +4.5%
        // Nova lógica:
        //   +1.5% → breakeven (+0.1%) — só protege capital, não corta lucro ainda
        //   +3.0% → stop move para +1.5% (garante R:R=1.5x para leverage>8)
        //   +4.5% → stop move para +3.0% (garante R:R=1.5x para leverage<=8)
        //   +7.0% → stop move para +5.0%
        //   +12.0% → stop move para +9.0%
        //   The floor never moves down
        if (pnlPercent > position.highWaterMarkPct) {
          position.highWaterMarkPct = pnlPercent;
          // [FIX 17.0] Trailing stop diferenciado por side:
          // SELL (SHORT): breakeven em +2.0% (vs +1.5% para BUY) — dados mostram que shorts fecham cedo
          // demais com medo de repiques. Avg win SHORT = $0.34 (75% dos wins < 1.0%). Dar mais espaço.
          const isSell = position.side === "SELL";
          const breakevenLevel = isSell ? 2.0 : 1.5;   // SHORT: +2.0% | LONG: +1.5%
          const firstTargetIn = isSell ? 4.0 : 3.0;    // SHORT: +4.0% | LONG: +3.0%
          const firstTargetOut = isSell ? 2.0 : 1.5;   // SHORT: stop → +2.0% | LONG: +1.5%
          const secondTargetIn = isSell ? 5.5 : 4.5;   // SHORT: +5.5% | LONG: +4.5%
          const secondTargetOut = isSell ? 3.5 : 3.0;  // SHORT: stop → +3.5% | LONG: +3.0%
          if (pnlPercent >= 12.0) {
            position.trailingStopPct = Math.max(position.trailingStopPct, 9.0);
          } else if (pnlPercent >= 7.0) {
            position.trailingStopPct = Math.max(position.trailingStopPct, 5.0);
          } else if (pnlPercent >= secondTargetIn) {
            position.trailingStopPct = Math.max(position.trailingStopPct, secondTargetOut);
          } else if (pnlPercent >= firstTargetIn) {
            position.trailingStopPct = Math.max(position.trailingStopPct, firstTargetOut);
          } else if (pnlPercent >= breakevenLevel) {
            position.trailingStopPct = Math.max(position.trailingStopPct, 0.1); // Breakeven + taxas
          }
          // Abaixo do breakevenLevel: não mover stop — deixar o HARD_STOP inicial atuar
        }

        // Hard stop-loss / trailing stop — ALWAYS enforced, bypasses cooldown
        const stopLevel = position.trailingStopPct;
        if (pnlPercent <= stopLevel) {
          const stopType = stopLevel >= 0 ? "TRAIL_STOP" : "HARD_STOP";
          const reason = `[${stopType}] P&L ${pnlPercent.toFixed(2)}% <= stop ${stopLevel.toFixed(2)}% (HWM: ${position.highWaterMarkPct.toFixed(2)}%)`;
          await this.logEvent("RISK_STOP", symbol, reason);
          await this.closePosition(symbol, snapshot.price, reason);
          continue;
        }

        // Max hold time protection — close positions held too long with small P&L
        // [FIX 17.0] Mantido 120min mas threshold P&L reduzido de 0.5% para 0.3%
        // Motivo: TIME_STOP com WR=50% e avg -$0.016 — neutro, mas libera capital para trades melhores
        // Trades de 1-2h com P&L < 0.3% estão estagnados — fechar e realocar
        if (holdTimeMinutes > 120 && Math.abs(pnlPercent) < 0.3) {
          const reason = `[TIME_STOP] Held ${holdTimeMinutes.toFixed(0)}m with only ${pnlPercent.toFixed(2)}% P&L — freeing capital`;
          await this.logEvent("INFO", symbol, reason);
          await this.closePosition(symbol, snapshot.price, reason);
          continue;
        }

        // [FIX 17.0] Cooldown de Pânico: IA bloqueada de fechar posições antes de 60 minutos
        // Dados: 26 trades fechados por AI_CLOSE nos primeiros 60min causaram -$15.05 (WR=0%)
        // O HARD_STOP já protege o capital — a IA não precisa intervir antes de 60 minutos
        const panicCooldownMinutes = 60;
        if (holdTimeMinutes < Math.max(minHoldMinutes, panicCooldownMinutes)) {
          continue;
        }

        // AI position management
        const decision = await this.askAIForPositionManagement(position, snapshot, pnlPercent);
        if (decision.action === "CLOSE") {
          await this.closePosition(symbol, snapshot.price, decision.reasoning);
        }

        await this.sleep(TradingEngine.API_DELAY_MS);
      } catch (error) {
        console.error(`Error monitoring ${symbol}:`, this.errStr(error));
      }
    }
  }

  // Minimum hold time — gives positions time to develop
  private getMinHoldMinutes(): number {
    const tfMinutes: Record<string, number> = {
      "1m": 5,
      "5m": 20,
      "15m": 30,
      "30m": 60,
      "1h": 90,
      "4h": 360,
      "1d": 1440,
    };
    return tfMinutes[this.config.timeframe] || 30;
  }

  // --------------------------------------------------------------------------
  // Win Rate Monitoring
  // --------------------------------------------------------------------------

  private async checkWinRateAlert(): Promise<void> {
    try {
      const statusRows = await this.db.select().from(botStatus)
        .where(eq(botStatus.userId, this.config.userId)).limit(1);
      if (statusRows.length === 0) return;

      const s = statusRows[0];
      const total = s.totalTrades || 0;
      const wins = s.winningTrades || 0;
      const losses = s.losingTrades || 0;
      const pnl = parseFloat(s.totalPnl || "0");

      if (total < TradingEngine.WIN_RATE_MIN_SAMPLE) return;

      const winRate = (wins / total) * 100;

      if (winRate < TradingEngine.WIN_RATE_ALERT_THRESHOLD) {
        await this.logEvent("ERROR", "SYSTEM",
          `[WIN_RATE] ALERT: ${winRate.toFixed(1)}% < ${TradingEngine.WIN_RATE_ALERT_THRESHOLD}% | ` +
          `W:${wins} L:${losses} | PnL: ${pnl >= 0 ? "+" : ""}${pnl.toFixed(4)} USDT`);
      } else {
        await this.logEvent("INFO", "SYSTEM",
          `[WIN_RATE] OK: ${winRate.toFixed(1)}% (${wins}W/${losses}L) | PnL: ${pnl >= 0 ? "+" : ""}${pnl.toFixed(4)} USDT`);
      }
    } catch (e) {
      console.error("[WIN_RATE] Error:", this.errStr(e));
    }
  }

  // --------------------------------------------------------------------------
  // AI Decision Engine — Optimized Prompts
  // --------------------------------------------------------------------------

  private async askAIForOpportunities(snapshots: MarketSnapshot[]): Promise<AIDecision[]> {
    const balance = await this.config.gateioClient.getBalance();
    const totalBalance = parseFloat(balance.totalBalance);
    const availableBalance = parseFloat(balance.availableBalance);
    const reserveFloor = totalBalance * TradingEngine.CAPITAL_RESERVE_PCT;
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
      above_ema200: s.price > s.ema200,
    }));

    const minConf = this.getMinConfidence();
    const maxLev = this.getMaxLeverage();
    const maxNewPositions = Math.max(1, Math.floor(deployableBalance / 5)); // [FIX 17.0] $5/trade

    // Macro context for AI
    const macroInfo = this.macroContext
      ? `\nCONTEXTO MACRO (BTC): Tendência=${this.macroContext.btcTrend} | RSI=${this.macroContext.btcRsi.toFixed(1)} | 24h=${this.macroContext.btcChange24h.toFixed(2)}% | Sentimento=${this.macroContext.marketSentiment}`
      : "";

    const systemPrompt = `Você é um gestor quantitativo de futuros cripto com foco em QUALIDADE sobre QUANTIDADE de trades.

OBJETIVO: Identificar APENAS trades de ALTA PROBABILIDADE com confluência técnica clara. Prefira NÃO operar a operar mal.

FILOSOFIA:
- MAXIMIZAR LUCRO: Identifique as tendências mais fortes. Se o mercado está volátil, capture os rompimentos.
- CONFLUÊNCIA OBRIGATÓRIA: Mínimo 3 indicadores alinhados para abrir posição.
- NÃO HESITE EM SHORTAR: Se o mercado está caindo, abra shorts agressivamente nas moedas mais fracas.
- ALAVANCAGEM ADAPTATIVA: Use alavancagem máxima permitida apenas quando houver rompimento claro de resistência/suporte com alto volume.
- RESPEITE O MACRO: Se BTC está bearish, priorize SHORTS. Se bullish, priorize LONGS.
${macroInfo}

CRITÉRIOS DE ENTRADA (TODOS devem ser atendidos):

LONG requer pelo menos 3 de:
  1. RSI < 40 (oversold) OU RSI entre 40-55 com tendência de alta
  2. MACD bullish (histogram positivo e crescente)
  3. Preço acima da EMA50
  4. BB position < 30 (perto da banda inferior = desconto)
  5. Volume ratio > 1.2 (confirmação de volume)
  6. Tendência geral BULLISH
  7. Funding rate negativo (shorts pagando longs = pressão de alta)

SHORT requer TODOS os 3 obrigatórios + pelo menos 1 adicional:
  OBRIGATÓRIOS (todos devem estar presentes):
  1. RSI > 80 (sobrecomprado extremo) — NÃO abra SHORT com RSI < 80, mesmo que BTC esteja caindo
  2. MACD bearish OU perdendo força (histograma decrescente ou negativo)
  3. BB position > 90 (preço na Banda de Bollinger Superior — sobrevalorizado extremo)
  ADICIONAIS (pelo menos 1):
  4. Tendência geral BEARISH ou SIDEWAYS (NUNCA SHORT em tendência BULLISH forte)
  5. Funding rate positivo (longs pagando shorts = pressão de queda)
  6. Volume ratio > 1.2 (confirmação de volume na queda)
  7. Mudança 24h > +5% (ativo sobrecomprado no dia — candidato a reversão)
  PROIBIÇÕES ABSOLUTAS PARA SHORT:
  - NUNCA abra SHORT em ativo com alta relativa > +8% no dia (momentum forte)
  - NUNCA abra SHORT com RSI < 70 baseando-se apenas no contexto bearish do BTC
  - NUNCA abra SHORT em ativo com tendência BULLISH confirmada (EMA50 subindo + MACD positivo)

FILTROS DE REJEIÇÃO (NÃO abra posição se):
  - Volatilidade > 8% (risco de whipsaw)
  - Volume ratio < 0.5 (sem liquidez)
  - RSI entre 45-55 SEM confirmação de MACD e tendência (zona neutra)
  - Mudança 24h > 10% (movimento já exausto)

[FIX 17.0] REGRAS CRÍTICAS BASEADAS EM DADOS (24/03/2026 19:09 BRT — atualizado):
  - Ratio R:R mínimo 1.5x: só abra se o potencial de ganho for pelo menos 1.5x o risco
  - Prefira pares com tendência clara e volume acima da média (volume_ratio > 1.3)
  - EVITE pares com baixa liquidez ou movimentos erráticos recentes
  - Para SHORTs: RSI DEVE ser > 80 E BB position > 90. Análise de dados mostrou WR de apenas 28% com RSI 60-79.
  - Para SHORTs: NÃO use contexto bearish do BTC como justificativa única. Exija exaustão técnica do ativo.
  - NOVOS ALVOS R:R (FIX 17.0): leverage>8 → alvo mínimo +2.25% (SL=-1.5%) | leverage<=8 → alvo mínimo +3.0% (SL=-2.0%)
  - ATENÇÃO HORÁRIO: Análise de dados mostra WR=22-25% entre 13h-14h BRT. Nesse período, exija confluência EXTRA (4+ indicadores) ou prefira NÃO operar.
  - Profit Factor atual: 0.186 (crítico). Priorize QUALIDADE sobre QUANTIDADE. Prefira 1 trade excelente a 3 trades mediocres.

EXCHANGE: Gate.io Futures (USDT-M) — Símbolos: BTC_USDT, ETH_USDT

PERFIL: ${this.config.aggressiveness}
- Alavancagem: 1-${maxLev}x (use MENOR alavancagem para menor confiança)
- Confiança mínima: ${minConf}%

CAPITAL:
- Deployável: ${deployableBalance.toFixed(2)} USDT
- Posições abertas: ${this.positions.size}
- Máx novas posições: ${maxNewPositions} ($10 cada)

REGRAS:
- Retorne APENAS trades com confiança >= ${minConf}%
- Ordene por confiança (maior primeiro)
- NUNCA repita símbolo
- Se nenhum trade atende os critérios, retorne []
- Na dúvida, NÃO opere (retorne [])
- Alavancagem deve ser proporcional à confiança: 75-80% → ${Math.max(1, maxLev-2)}x, 80-90% → ${Math.max(1, maxLev-1)}x, 90%+ → ${maxLev}x

Responda APENAS com JSON array:
[{"action":"OPEN_LONG"|"OPEN_SHORT","symbol":"BTC_USDT","confidence":80,"leverage":${maxLev},"positionSizePercent":100,"reasoning":"3+ indicadores: RSI=35 oversold + MACD bullish + acima EMA50 + volume_ratio=1.8"}]`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Dados de mercado:\n${JSON.stringify(marketSummary, null, 2)}` },
        ],
        temperature: 0.2, // Lower temperature for more conservative decisions
        max_tokens: 2000,
      });

      this.consecutiveAIErrors = 0;

      const content = response.choices[0]?.message?.content ?? "[]";
      console.log(`[AI] Response: ${content.substring(0, 300)}`);
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];
      const decisions = JSON.parse(jsonMatch[0]) as AIDecision[];
      console.log(`[AI] ${decisions.length} decisions: ${decisions.map(d => `${d.action} ${d.symbol} conf:${d.confidence}`).join(', ')}`);
      return decisions;
    } catch (error) {
      const errMsg = this.errStr(error);
      await this.logEvent("ERROR", "AI", `AI analysis failed: ${errMsg}`);
      await this.handleAIError(errMsg);
      return [];
    }
  }

  private async askAIForPositionManagement(
    position: TradePosition,
    snapshot: MarketSnapshot,
    pnlPercent: number
  ): Promise<AIDecision> {
    const holdTime = (Date.now() - position.entryTime.getTime()) / (1000 * 60);

    const prompt = `Posição aberta:
- Symbol: ${position.symbol}
- Side: ${position.side}
- Entry: ${position.entryPrice}
- Current: ${snapshot.price}
- P&L: ${pnlPercent.toFixed(2)}%
- Leverage: ${position.leverage}x
- Tempo: ${holdTime.toFixed(0)} min
- Trailing stop: ${position.trailingStopPct.toFixed(2)}% (HWM: ${position.highWaterMarkPct.toFixed(2)}%) | Alvo R:R 1.5x: ${position.leverage > 8 ? '+2.25%' : '+3.0%'} [FIX 17.0]

Indicadores:
- RSI: ${snapshot.rsi.toFixed(1)}
- MACD: bullish=${snapshot.macd.bullish}, histogram=${snapshot.macd.histogram.toFixed(6)}
- BB position: ${snapshot.bb.position.toFixed(1)}
- Volatilidade: ${snapshot.volatility.volatility.toFixed(2)}% (${snapshot.volatility.trend})
- Volume ratio: ${snapshot.volumeAnalysis.volumeRatio.toFixed(2)}
- Tendência: ${snapshot.trend}
- Acima EMA50: ${snapshot.price > snapshot.ema50}
- Acima EMA200: ${snapshot.price > snapshot.ema200}

CONTEXTO MACRO: BTC ${this.macroContext?.btcTrend ?? "N/A"} | Sentimento: ${this.macroContext?.marketSentiment ?? "N/A"}

REGRAS (siga rigorosamente):

1. ZONA DE RUÍDO (|P&L| < 1%):
   - NÃO feche por ruído. Dê espaço para o trade respirar.
   
2. POSIÇÃO LUCRATIVA (P&L > +1.5%):
   - HOLD absoluto se a tendência continuar a seu favor (RSI subindo para LONGs, caindo para SHORTs).
   - [FIX 17.0] OBJETIVO R:R ≥1.5x: leverage>8 → alvo mínimo +2.25% | leverage<=8 → alvo mínimo +3.0%
   - NÃO feche antes de atingir o alvo mínimo de R:R, a menos que haja PICO CLIMÁTICO (volume explosivo + RSI > 85 ou < 15).
   - O trailing stop do sistema já protege os lucros após atingir o alvo. SUA MISSÃO: deixar o trade correr até o alvo.
   
3. POSIÇÃO COM PREJUÍZO (P&L entre -1.0% e -3.0%):
   - [FIX 17.0] NÃO feche posições com prejuízo entre -0.1% e -2.0% apenas porque a tendência parece contra.
     Análise de dados: categoria 'OTHER' gerou -$5.47 em 11 trades — fechamentos prematuros são a maior fonte de perda.
   - SÓ ordene CLOSE se DOIS dos seguintes ocorrerem simultaneamente:
     a) RSI caiu abaixo de 40 (ativo reverteu para oversold — SHORT perdeu tese)
     b) MACD cruzou de negativo para positivo (reversão confirmada)
     c) Preço rompeu EMA50 para CIMA com volume > 1.5x
   - Se apenas 1 sinal está presente → HOLD. Deixe o stop-loss automático do sistema atuar.
   - Para P&L < -2.0% com estrutura claramente rompida (2+ sinais) → CLOSE permitido.
   - NUNCA feche baseado apenas em 'sinto que vai cair mais' sem confirmação técnica.

4. O sistema já tem stop-loss automático e trailing stop — você foca apenas em ler a estrutura de mercado.

5. MAXIMIZE GANHOS: Deixe os trades vencedores correrem o máximo possível.

6. CORTE PERDAS: Seja impiedoso com trades que perderam a estrutura técnica.

Decida: CLOSE ou HOLD?
JSON: {"action":"CLOSE"|"HOLD","symbol":"${position.symbol}","confidence":0,"leverage":0,"positionSizePercent":0,"reasoning":"..."}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um gestor de risco quantitativo. Siga as REGRAS rigorosamente. [FIX 15.0] Para posições SHORT com P&L entre -0.1% e -3.0%, a resposta padrão é HOLD. Só feche se 2+ sinais de reversão confirmados. Na dúvida, HOLD." },
          { role: "user", content: prompt },
        ],
        temperature: 0.15,
        max_tokens: 500,
      });

      this.consecutiveAIErrors = 0;

      const content = response.choices[0]?.message?.content ?? '{"action":"HOLD"}';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { action: "HOLD", symbol: position.symbol, confidence: 0, leverage: 0, positionSizePercent: 0, reasoning: "Parse error" };
      return JSON.parse(jsonMatch[0]) as AIDecision;
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

  private async handleAIError(errMsg: string): Promise<void> {
    const isCreditError = errMsg.includes("402") ||
      errMsg.toLowerCase().includes("insufficient credits") ||
      errMsg.toLowerCase().includes("credit") ||
      errMsg.toLowerCase().includes("quota") ||
      errMsg.toLowerCase().includes("billing");

    if (isCreditError) {
      this.consecutiveAIErrors++;
      await this.logEvent("ERROR", "AI",
        `[CREDIT GUARD] Error #${this.consecutiveAIErrors}/${TradingEngine.MAX_CONSECUTIVE_AI_ERRORS}: ${errMsg}`);

      if (this.consecutiveAIErrors >= TradingEngine.MAX_CONSECUTIVE_AI_ERRORS) {
        await this.logEvent("ERROR", "SYSTEM",
          `[CREDIT GUARD] AI credits EXHAUSTED. EMERGENCY CLOSING ${this.positions.size} positions.`);
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
      
      // EMA200 — use available data, fallback to EMA50 if not enough
      let ema200 = ema50;
      if (prices.length >= 200) {
        ema200 = calculateEMAValue(prices, 200);
      }

      const ticker = await this.config.gateioClient.getTicker(symbol);
      const change24h = parseFloat(ticker.priceChangePercent);
      const fundingRate = parseFloat(ticker.fundingRate);
      const volume24h = parseFloat(ticker.volume24h);

      // Trend determination — more robust with EMA200
      let trend: "BULLISH" | "BEARISH" | "SIDEWAYS" = "SIDEWAYS";
      const bullishSignals = [
        currentPrice > ema50,
        macd.bullish,
        rsi.rsi > 45,
        currentPrice > ema200,
      ].filter(Boolean).length;
      const bearishSignals = [
        currentPrice < ema50,
        !macd.bullish,
        rsi.rsi < 55,
        currentPrice < ema200,
      ].filter(Boolean).length;

      if (bullishSignals >= 3) trend = "BULLISH";
      else if (bearishSignals >= 3) trend = "BEARISH";

      // Save to DB (last 10 candles only)
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
        trend,
      };
    } catch (error) {
      console.error(`[SNAPSHOT] Error for ${symbol}: ${this.errStr(error)}`);
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // Cached API calls
  // --------------------------------------------------------------------------

  private async getCachedContractMultiplier(symbol: string): Promise<number> {
    const cached = this.contractInfoCache.get(symbol);
    if (cached && (Date.now() - cached.cachedAt) < TradingEngine.CONTRACT_CACHE_TTL) {
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

  private async getCachedContractInfo(symbol: string): Promise<any> {
    const cached = this.contractInfoCache.get(symbol);
    if (cached && (Date.now() - cached.cachedAt) < TradingEngine.CONTRACT_CACHE_TTL) {
      return cached.data;
    }
    const contractInfo = await this.config.gateioClient.getContractInfo(symbol);
    this.contractInfoCache.set(symbol, { data: contractInfo, cachedAt: Date.now() });
    return contractInfo;
  }

  private async getCachedAllTickers(): Promise<any[]> {
    if (this.allTickersCache.data && (Date.now() - this.allTickersCache.cachedAt) < TradingEngine.ALL_TICKERS_CACHE_TTL) {
      return this.allTickersCache.data;
    }
    const tickers = await this.config.gateioClient.getAllTickers(TradingEngine.MIN_VOLUME_24H);
    this.allTickersCache = { data: tickers, cachedAt: Date.now() };
    return tickers;
  }

  // --------------------------------------------------------------------------
  // Trade Execution
  // --------------------------------------------------------------------------

  private async executeDecision(decision: AIDecision): Promise<void> {
    const side: "BUY" | "SELL" = decision.action === "OPEN_LONG" ? "BUY" : "SELL";

    decision.leverage = Math.min(decision.leverage, this.getMaxLeverage());

    try {
      const balance = await this.config.gateioClient.getBalance();
      const totalBalance = parseFloat(balance.totalBalance);
      const available = parseFloat(balance.availableBalance);
      const reserveFloor = totalBalance * TradingEngine.CAPITAL_RESERVE_PCT;
      const deployable = Math.max(0, available - reserveFloor);

      // [FIX 17.0] Tamanho fixo de $5 por trade (era $10-$20 dinâmico)
      // Motivo: reduz impacto de qualquer trade individual de -$16 (pior caso) para no máximo -$8
      // Permite o dobro de posições simultâneas com o mesmo capital, melhorando diversificação
      const targetSize = 5.0; // $5 fixo — independente da confiança da IA
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

      // Margin mode
      const targetMarginMode = totalBalance >= TradingEngine.ISOLATED_MARGIN_THRESHOLD
        ? TradingEngine.ISOLATED_MARGIN_MODE
        : TradingEngine.CROSS_MARGIN_MODE;
      try {
        await this.config.gateioClient.setMarginMode(
          decision.symbol,
          targetMarginMode as "cross" | "isolated",
          decision.leverage
        );
      } catch (e) {
        console.log(`Margin mode note for ${decision.symbol}:`, this.errStr(e));
      }

      // Set leverage
      try {
        await this.config.gateioClient.setLeverage(decision.symbol, decision.leverage);
      } catch (e) {
        console.log(`Leverage note for ${decision.symbol}:`, this.errStr(e));
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
        quantoMultiplier,
        highWaterMarkPct: 0,
        // [FIX 17.0] Stop-loss inicial calibrado para R:R ≥1.5x
        // Reduzido: leverage>8: SL=-1.5% → TP alvo=+2.25% (R:R=1.5x)
        //           leverage<=8: SL=-2.0% → TP alvo=+3.0% (R:R=1.5x)
        // Motivo: HARD_STOP avg -$2.17/trade com SL=-3.0%. Reduzindo exposição.
        trailingStopPct: decision.leverage > 8 ? -1.5 : -2.0,
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
        stopLoss: quantoMultiplier.toString(),
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
        `${side} ${contracts}ct @ ${currentPrice} | Lev:${decision.leverage}x | Conf:${decision.confidence}% | Base:$${baseValue.toFixed(2)} | ${decision.reasoning}`
      );
    } catch (error) {
      await this.logEvent("ERROR", decision.symbol, `Execute error: ${this.errStr(error)}`);
    }
  }

  private async closePosition(symbol: string, exitPrice: number, reason: string): Promise<void> {
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

  private async closePositionRecord(symbol: string, exitPrice: number, reason: string): Promise<void> {
    try {
      const position = this.positions.get(symbol);
      if (!position) return;

      let quantoMultiplier = position.quantoMultiplier;
      if (!quantoMultiplier || quantoMultiplier <= 0) {
        try {
          const tradeRecord = await this.db.select().from(trades)
            .where(and(eq(trades.symbol, symbol), eq(trades.status, "OPEN"), eq(trades.userId, this.config.userId)))
            .limit(1);
          if (tradeRecord.length > 0 && tradeRecord[0].stopLoss) {
            const dbQm = parseFloat(tradeRecord[0].stopLoss);
            if (dbQm > 0) quantoMultiplier = dbQm;
          }
        } catch { /* ignore */ }

        if (!quantoMultiplier || quantoMultiplier <= 0) {
          quantoMultiplier = await this.getCachedContractMultiplier(symbol);
        }
      }

      const pnl = position.side === "BUY"
        ? (exitPrice - position.entryPrice) * position.quantity * quantoMultiplier
        : (position.entryPrice - exitPrice) * position.quantity * quantoMultiplier;
      const pnlPercent = position.side === "BUY"
        ? ((exitPrice - position.entryPrice) / position.entryPrice) * 100
        : ((position.entryPrice - exitPrice) / position.entryPrice) * 100;

      const tradeRecord = await this.db.select().from(trades)
        .where(and(eq(trades.symbol, symbol), eq(trades.status, "OPEN"), eq(trades.userId, this.config.userId)))
        .limit(1);

      if (tradeRecord.length > 0) {
        const truncatedReason = reason.substring(0, 50);
        const clampedPnlPercent = Math.max(-999.99, Math.min(999.99, pnlPercent));
        await this.db.update(trades).set({
          exitPrice: exitPrice.toString(),
          exitTime: new Date(),
          pnl: pnl.toString(),
          pnlPercent: clampedPnlPercent.toFixed(2),
          status: "CLOSED",
          exitReason: truncatedReason,
        }).where(eq(trades.id, tradeRecord[0].id));
      }

      // Update bot_status counters
      try {
        const statusRows = await this.db.select().from(botStatus)
          .where(eq(botStatus.userId, this.config.userId)).limit(1);
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
            totalPnl: newPnl.toFixed(8),
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

  private async closeAllPositions(reason: string): Promise<void> {
    for (const [symbol] of Array.from(this.positions.entries())) {
      try {
        const ticker = await this.config.gateioClient.getTicker(symbol);
        await this.closePosition(symbol, parseFloat(ticker.lastPrice), reason);
        await this.sleep(TradingEngine.API_DELAY_MS);
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
      const total = parseFloat(balance.totalBalance);
      const unrealized = parseFloat(balance.unrealizedPnl || "0");
      // [FIX 13.0] Equity real = saldo total + PnL não realizado
      const equity = total + unrealized;

      // [FIX 13.0] Atualizar highWaterMark se o equity subiu
      if (equity > this.highWaterMarkBalance) {
        this.highWaterMarkBalance = equity;
      }

      // [FIX 13.0] Drawdown calculado a partir do MAIOR saldo já atingido (highWaterMark)
      // Isso evita que o bot pare por drawdown quando o saldo já cresceu e depois recuou
      const baseline = Math.max(this.highWaterMarkBalance, this.initialBalance);
      const drawdown = ((baseline - equity) / baseline) * 100;

      // [FIX 13.0] Limite aumentado para 20% (era 15%) para dar mais espaço ao bot
      // Aviso a partir de 15% (era 80% do limite)
      const effectiveLimit = Math.max(this.config.maxDrawdown, 20);
      if (drawdown >= effectiveLimit * 0.75) {
        await this.logEvent("ERROR", "SYSTEM",
          `[DRAWDOWN] Warning: ${drawdown.toFixed(2)}% (limit: ${effectiveLimit}%) | equity=$${equity.toFixed(2)} hwm=$${baseline.toFixed(2)}`);
      }

      // [FIX 13.0] Só aciona se o drawdown for REAL e SUSTENTADO (não por volatilidade temporária)
      // Requer que o equity esteja abaixo do limite E que não haja posições com lucro potencial
      if (drawdown >= effectiveLimit) {
        const hasWinningPositions = Array.from(this.positions.values()).some(p => {
          // Não temos preço atual aqui, mas se unrealized > 0, há posições lucrativas
          return unrealized > 0;
        });
        if (hasWinningPositions && drawdown < effectiveLimit + 5) {
          // Se há posições lucrativas e o drawdown está apenas marginalmente acima do limite, aguardar
          await this.logEvent("ERROR", "SYSTEM",
            `[DRAWDOWN] ${drawdown.toFixed(2)}% >= ${effectiveLimit}% mas há posições lucrativas — aguardando`);
          return false;
        }
        return true;
      }
      return false;
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
          startedAt: (update.isRunning && !existing[0].startedAt) ? new Date() : existing[0].startedAt,
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
