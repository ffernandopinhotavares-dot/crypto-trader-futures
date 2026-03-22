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
  quantoMultiplier: number; // [FIX 5.1] cached at entry for correct PnL calculation
}

export interface TradingEngineConfig {
  userId: string;
  configId: string;
  gateioClient: GateioClient;
  // Autonomous config — no fixed pairs, no fixed SL/TP
  maxRiskPerTrade: number;     // max % of balance per trade (default 5)
  maxDrawdown: number;         // max total drawdown % before stopping (default 10)
  maxOpenPositions: number;    // kept for compatibility but no longer enforced — capital is the only limit
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

  // [CREDIT GUARD] Track consecutive AI 402/credit errors
  private consecutiveAIErrors: number = 0;
  private static readonly MAX_CONSECUTIVE_AI_ERRORS = 3; // Close all after 3 consecutive failures

  // [FIX 5.8] Cache for contract info and tickers
  private contractInfoCache: Map<string, { data: any; cachedAt: number }> = new Map();
  private allTickersCache: { data: any[] | null; cachedAt: number } = { data: null, cachedAt: 0 };
  private static readonly CONTRACT_CACHE_TTL = 60 * 60 * 1000; // 1 hour
  private static readonly ALL_TICKERS_CACHE_TTL = 3 * 60 * 1000; // 3 minutes (full market scan)
  private static readonly API_DELAY_MS = 100; // 100ms between API calls
  private static readonly SNAPSHOT_BATCH_SIZE = 15; // parallel candle fetches per batch
  private static readonly AI_BATCH_SIZE = 50; // pairs per AI call
  // [FIX 5.9] Reserve 10% of total balance as buffer (emergency + opportunity reserve)
  // This prevents full capital lock-up and ensures liquidity for SHORT opportunities
  private static readonly CAPITAL_RESERVE_PCT = 0.10;

  // [FIX 6.0] Win Rate monitoring — alert if win rate drops below threshold
  private static readonly WIN_RATE_ALERT_THRESHOLD = 35; // alert if WR < 35%
  private static readonly WIN_RATE_CHECK_INTERVAL = 10;  // check every 10 cycles
  private static readonly WIN_RATE_MIN_SAMPLE = 20;      // need at least 20 trades to alert

  // [FIX 6.0] Isolated margin threshold — switch to isolated when balance > $200
  private static readonly ISOLATED_MARGIN_THRESHOLD = 200; // USD
  private static readonly ISOLATED_MARGIN_MODE = "isolated";
  private static readonly CROSS_MARGIN_MODE = "cross";

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

    // [FIX 5.7] Sync existing exchange positions into memory
    await this.syncPositionsFromExchange();

    console.log(`AI Trading engine started for user ${this.config.userId}`);
    await this.updateBotStatus({ isRunning: true });
    await this.logEvent("BOT_START", "SYSTEM", `AI Trading bot started | Profile: ${this.config.aggressiveness} | Max risk/trade: ${this.config.maxRiskPerTrade}% | Synced ${this.positions.size} positions from exchange`);
    this.mainLoop();
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;
    this.isRunning = false;
    console.log(`AI Trading engine stopping for user ${this.config.userId}...`);

    // CRITICAL: Close ALL open positions on the exchange before stopping
    try {
      await this.logEvent("BOT_STOP", "SYSTEM", "Closing all positions before stopping...");
      const result = await this.config.gateioClient.closeAllPositions();
      if (result.closed.length > 0) {
        await this.logEvent("BOT_STOP", "SYSTEM", `Closed ${result.closed.length} positions: ${result.closed.join(", ")}`);
      }
      if (result.errors.length > 0) {
        await this.logEvent("ERROR", "SYSTEM", `Failed to close ${result.errors.length} positions: ${result.errors.join("; ")}`);
      }
      // [FIX 5.9] Update in-memory positions and DB trades with better fallback
      for (const [symbol, position] of Array.from(this.positions.entries())) {
        try {
          let exitPrice: number;
          try {
            const ticker = await this.config.gateioClient.getTicker(symbol);
            exitPrice = parseFloat(ticker.lastPrice);
          } catch {
            // [FIX 5.9] Fallback: use markPrice from exchange positions or entryPrice
            try {
              const exchangePositions = await this.config.gateioClient.getPositions();
              const pos = exchangePositions.find(p => p.symbol === symbol);
              exitPrice = pos ? parseFloat(pos.markPrice) : position.entryPrice;
            } catch {
              exitPrice = position.entryPrice; // last resort
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
    await this.logEvent("BOT_STOP", "SYSTEM", "AI Trading bot stopped. All positions closed.");
    console.log(`AI Trading engine stopped for user ${this.config.userId}`);
  }

  // --------------------------------------------------------------------------
  // [FIX 5.7] Sync positions from exchange into memory on start/restart
  // --------------------------------------------------------------------------

  // [FIX 7.0] CRITICAL: Sync positions from exchange AND restore entryTime from DB.
  // Previously used new Date() as entryTime, causing all restored positions to appear
  // as freshly opened — they would immediately pass the cooldown check and be re-evaluated
  // by AI, or worse, have their hold-time reset to 0 causing premature exits.
  // Now we cross-reference the DB trades table (status=OPEN) to restore the real entryTime.
  private async syncPositionsFromExchange(): Promise<void> {
    try {
      const exchangePositions = await this.config.gateioClient.getPositions();

      // [FIX 7.0] Pre-fetch all OPEN trades from DB for this user to restore real entryTime
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
        console.log(`[SYNC] Found ${openDbTrades.length} OPEN trades in DB to cross-reference`);
      } catch (dbErr) {
        console.error("[SYNC] Could not fetch open trades from DB:", this.errStr(dbErr));
      }

      let syncedCount = 0;
      for (const pos of exchangePositions) {
        const absSize = Math.abs(parseFloat(pos.size));
        if (absSize > 0 && !this.positions.has(pos.symbol)) {
          const side: "BUY" | "SELL" = pos.side === "LONG" ? "BUY" : "SELL";
          const leverage = parseFloat(pos.leverage) || 10;
          const entryPrice = parseFloat(pos.entryPrice) || 0;

          // [FIX 7.0] Restore real entryTime from DB — avoids cooldown reset on restart
          const dbTrade = openDbTrades.find(t => t.symbol === pos.symbol && t.side === side);
          const entryTime = dbTrade?.entryTime ?? new Date();
          const restoredFrom = dbTrade ? `DB (${entryTime.toISOString()})` : "approximate (new Date)";

          // Try to get quantoMultiplier from cache/API
          const qm = await this.getCachedContractMultiplier(pos.symbol);

          this.positions.set(pos.symbol, {
            symbol: pos.symbol,
            side,
            entryPrice: dbTrade ? parseFloat(dbTrade.entryPrice ?? "0") || entryPrice : entryPrice,
            quantity: absSize,
            entryTime,
            leverage,
            confidence: 50, // unknown for restored positions
            quantoMultiplier: qm,
          });

          syncedCount++;
          console.log(`[SYNC] Restored position: ${pos.symbol} ${side} qty=${absSize} entry=${entryPrice} lev=${leverage}x qm=${qm} entryTime=${restoredFrom}`);
        }
      }
      console.log(`[SYNC] Sync complete: ${syncedCount} positions restored from exchange (${openDbTrades.length} DB trades available)`);
    } catch (error) {
      console.error("[SYNC] Error syncing positions from exchange:", this.errStr(error));
    }
  }

  // --------------------------------------------------------------------------
  // Main Loop
  // --------------------------------------------------------------------------

  private async mainLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        this.cycleCount++;
        await this.logEvent("CYCLE_START", "SYSTEM", `Cycle #${this.cycleCount} started | Positions: ${this.positions.size}`);

        // 1. Check drawdown protection
        if (await this.isDrawdownExceeded()) {
          await this.logEvent("RISK_STOP", "SYSTEM", `Max drawdown ${this.config.maxDrawdown}% exceeded. Closing all positions.`);
          await this.closeAllPositions("MAX_DRAWDOWN");
          
          // [AUTO-RESTART] Instead of stopping, reset balance baseline and continue
          // This allows the bot to close losing positions and immediately look for new opportunities
          await this.logEvent("AUTO_RESTART", "SYSTEM", "Drawdown limit hit. All positions closed. Resetting balance baseline and resuming scan for new opportunities.");
          
          // Reset the initial balance to current balance so drawdown is calculated fresh
          try {
            const freshBalance = await this.config.gateioClient.getBalance();
            this.initialBalance = parseFloat(freshBalance.totalBalance);
            await this.logEvent("AUTO_RESTART", "SYSTEM", `New balance baseline: $${this.initialBalance.toFixed(2)} USDT. Resuming trading.`);
          } catch (e) {
            await this.logEvent("ERROR", "SYSTEM", `Failed to reset balance: ${this.errStr(e)}. Stopping bot.`);
            await this.stop();
            return;
          }
          
          // Wait 2 minutes cooldown before resuming to let the market settle
          await this.logEvent("AUTO_RESTART", "SYSTEM", "Cooldown: waiting 2 minutes before resuming scan...");
          await this.sleep(2 * 60 * 1000);
          continue; // Skip the rest of this cycle and start fresh
        }

        // 2. Monitor existing positions — ask AI if we should close any
        // [FIX 5.3+] Monitor every cycle, but scanAndTrade only every 2 cycles
        // This gives positions more time to develop while still checking for exits
        await this.monitorPositions();

        // 3. Scan market for new opportunities every cycle when there is capital available
        // No fixed position limit — bot opens as many positions as capital allows ($10 each)
        await this.scanAndTrade();

        // 4. [FIX 6.0] Win Rate monitoring — check every WIN_RATE_CHECK_INTERVAL cycles
        if (this.cycleCount % TradingEngine.WIN_RATE_CHECK_INTERVAL === 0) {
          await this.checkWinRateAlert();
        }

        // 5. Update heartbeat
        await this.updateBotStatus({ isRunning: true });

        // [FIX 5.3] Increased cycle intervals: 5 min aggressive, 10 min moderate, 15 min conservative
        const waitMs = this.config.aggressiveness === "aggressive" ? 5 * 60 * 1000
          : this.config.aggressiveness === "moderate" ? 10 * 60 * 1000
          : 15 * 60 * 1000;
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
      // ================================================================
      // STAGE 1: Fetch ALL tickers in a single API call, pre-filter by volume
      // ================================================================
      const allTickers = await this.getCachedAllTickers();
      // Exclude pairs already in position
      const candidateTickers = allTickers.filter(t => !this.positions.has(t.symbol));
      await this.logEvent("INFO", "SYSTEM",
        `[SCAN] Stage 1: ${allTickers.length} tickers (vol>$50k) | ${candidateTickers.length} candidates (excl. open positions)`);

      if (candidateTickers.length === 0) {
        await this.logEvent("INFO", "SYSTEM", `[SCAN] No candidates — all pairs already in position or below volume threshold`);
        return;
      }

      // ================================================================
      // STAGE 2: Fetch candles in parallel batches, build market snapshots
      // ================================================================
      const snapshots: MarketSnapshot[] = [];
      let snapshotErrors = 0;
      const batchSize = TradingEngine.SNAPSHOT_BATCH_SIZE;

      for (let i = 0; i < candidateTickers.length; i += batchSize) {
        if (!this.isRunning) break;
        const batch = candidateTickers.slice(i, i + batchSize);

        // Fetch candles for this batch in parallel
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

        // Small delay between batches to respect rate limits
        if (i + batchSize < candidateTickers.length) {
          await this.sleep(TradingEngine.API_DELAY_MS * 3);
        }
      }

      await this.logEvent("INFO", "SYSTEM",
        `[SCAN] Stage 2: ${snapshots.length} snapshots built | ${snapshotErrors} errors | from ${candidateTickers.length} candidates`);

      if (snapshots.length === 0) {
        await this.logEvent("ERROR", "SYSTEM", `[SCAN] 0 valid snapshots — skipping AI analysis`);
        return;
      }

      // ================================================================
      // STAGE 3: Send snapshots to AI in batches of AI_BATCH_SIZE
      // Collect ALL recommendations across all batches, then execute
      // ================================================================
      const allDecisions: AIDecision[] = [];
      const aiBatchSize = TradingEngine.AI_BATCH_SIZE;

      for (let i = 0; i < snapshots.length; i += aiBatchSize) {
        if (!this.isRunning) break;
        const snapshotBatch = snapshots.slice(i, i + aiBatchSize);
        const batchDecisions = await this.askAIForOpportunities(snapshotBatch);
        allDecisions.push(...batchDecisions);
        await this.logEvent("INFO", "SYSTEM",
          `[SCAN] Stage 3 AI batch ${Math.floor(i/aiBatchSize)+1}/${Math.ceil(snapshots.length/aiBatchSize)}: ${batchDecisions.length} recommendations`);
      }

      // Sort all decisions by confidence (highest first)
      allDecisions.sort((a, b) => b.confidence - a.confidence);
      await this.logEvent("INFO", "SYSTEM",
        `[SCAN] Stage 3 complete: ${allDecisions.length} total recommendations from ${Math.ceil(snapshots.length/aiBatchSize)} AI calls`);

      // ================================================================
      // EXECUTE: Open all viable positions
      // ================================================================
      let openedCount = 0;
      for (const decision of allDecisions) {
        if (!this.isRunning) break;
        if (decision.action === "SKIP" || decision.action === "HOLD") continue;
        if (decision.confidence < this.getMinConfidence()) continue;
        if (this.positions.has(decision.symbol)) continue; // already in position

        // [FIX 5.9] Check capital availability with 10% reserve
        const balance = await this.config.gateioClient.getBalance();
        const totalBalance = parseFloat(balance.totalBalance);
        const available = parseFloat(balance.availableBalance);
        // Reserve 10% of total balance as buffer — never allocate below this floor
        const reserveFloor = totalBalance * TradingEngine.CAPITAL_RESERVE_PCT;
        const deployable = available - reserveFloor;
        if (deployable < 1.0) {
          await this.logEvent("INFO", "SYSTEM", `[SCAN] Stopping: deployable balance too low ($${deployable.toFixed(2)} USDT after ${(TradingEngine.CAPITAL_RESERVE_PCT * 100).toFixed(0)}% reserve of $${reserveFloor.toFixed(2)})`);
          break;
        }
        // No fixed position limit — only capital constrains new positions

        // [FIX 5.6] Cap leverage at 10x regardless of AI decision
        decision.leverage = Math.min(decision.leverage, this.getMaxLeverage());

        try {
          await this.executeDecision(decision);
          openedCount++;
          await this.sleep(TradingEngine.API_DELAY_MS * 2);
        } catch (error) {
          await this.logEvent("ERROR", decision.symbol, `Failed to execute: ${this.errStr(error)}`);
        }
      }

      await this.logEvent("INFO", "SYSTEM",
        `[SCAN] Cycle complete: opened ${openedCount} positions | Total open: ${this.positions.size} | Capital used: ~$${(this.positions.size * 10).toFixed(0)} USDT`);

    } catch (error) {
      await this.logEvent("ERROR", "SYSTEM", `Scan error: ${this.errStr(error)}`);
    }
  }

  // [FIX 5.5] Increased minimum confidence thresholds
  private getMinConfidence(): number {
    return this.config.aggressiveness === "conservative" ? 80
      : this.config.aggressiveness === "moderate" ? 75
      : 70;
  }

  // [FIX 5.6] Maximum leverage limits
  private getMaxLeverage(): number {
    return this.config.aggressiveness === "conservative" ? 5
      : this.config.aggressiveness === "moderate" ? 8
      : 10;
  }

  // --------------------------------------------------------------------------
  // Position Monitoring — AI decides when to close
  // --------------------------------------------------------------------------

  private async monitorPositions(): Promise<void> {
    for (const [symbol, position] of Array.from(this.positions.entries())) {
      try {
        // [FIX 5.4] Cooldown: skip positions opened less than 1 candle ago
        const holdTimeMinutes = (Date.now() - position.entryTime.getTime()) / (1000 * 60);
        const minHoldMinutes = this.getMinHoldMinutes();

        // [FIX 7.0] CRITICAL: Always get market snapshot to check hard stop-loss,
        // REGARDLESS of cooldown. Cooldown only blocks AI-based decisions.
        const snapshot = await this.getMarketSnapshot(symbol);
        if (!snapshot) continue;

        const pnlPercent = position.side === "BUY"
          ? ((snapshot.price - position.entryPrice) / position.entryPrice) * 100
          : ((position.entryPrice - snapshot.price) / position.entryPrice) * 100;

        // [FIX 7.0] Hard stop-loss: always enforced, bypasses cooldown completely.
        // Uses config.maxRiskPerTrade (default -3%) as the hard floor.
        const hardStopLoss = -(this.config.maxRiskPerTrade ?? 3);
        if (pnlPercent <= hardStopLoss) {
          const reason = `[HARD_STOP] P&L ${pnlPercent.toFixed(2)}% <= stop-loss ${hardStopLoss}% — closing immediately (bypassing cooldown of ${minHoldMinutes}m)`;
          await this.logEvent("RISK_STOP", symbol, reason);
          await this.closePosition(symbol, snapshot.price, reason);
          continue;
        }

        // Cooldown check: skip AI-based decisions for positions held less than minHoldMinutes
        if (holdTimeMinutes < minHoldMinutes) {
          console.log(`[MONITOR] ${symbol}: skipping AI (hold ${holdTimeMinutes.toFixed(0)}m < cooldown ${minHoldMinutes}m)`);
          continue;
        }

        const decision = await this.askAIForPositionManagement(position, snapshot, pnlPercent);

        if (decision.action === "CLOSE") {
          await this.closePosition(symbol, snapshot.price, decision.reasoning);
        }

        // [FIX 5.8] Rate limiting delay
        await this.sleep(TradingEngine.API_DELAY_MS);
      } catch (error) {
        console.error(`Error monitoring ${symbol}:`, this.errStr(error));
      }
    }
  }

  // [FIX 6.0] Minimum hold time — doubled to reduce premature exits
  // Analysis showed 56.8% of trades were closed in < 5 min, cutting profits short.
  // New minimums give positions time to develop before AI can decide to close.
  private getMinHoldMinutes(): number {
    const tfMinutes: Record<string, number> = {
      "1m": 5,   // was 2  — minimum 5 min for 1m timeframe
      "5m": 20,  // was 10 — minimum 20 min for 5m timeframe
      "15m": 30, // was 15 — minimum 30 min for 15m timeframe (main timeframe)
      "30m": 60, // was 30 — minimum 60 min for 30m timeframe
      "1h": 90,  // was 60 — minimum 90 min for 1h timeframe
      "4h": 360, // was 240 — minimum 6h for 4h timeframe
      "1d": 1440,
    };
    return tfMinutes[this.config.timeframe] || 30; // default 30 min (was 15)
  }

  // --------------------------------------------------------------------------
  // [FIX 6.0] Win Rate Monitoring
  // --------------------------------------------------------------------------

  /**
   * Checks current win rate and logs an alert if it drops below the threshold.
   * Also logs a comparative snapshot vs the FIX 5.9 baseline for 48h tracking.
   */
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

      if (total < TradingEngine.WIN_RATE_MIN_SAMPLE) {
        await this.logEvent("INFO", "SYSTEM",
          `[WIN_RATE] Insufficient sample (${total} trades < ${TradingEngine.WIN_RATE_MIN_SAMPLE} min). Monitoring started.`);
        return;
      }

      const winRate = (wins / total) * 100;
      const profitFactor = losses > 0 ? (wins / losses) : wins; // simplified

      if (winRate < TradingEngine.WIN_RATE_ALERT_THRESHOLD) {
        await this.logEvent("ERROR", "SYSTEM",
          `[WIN_RATE] ⚠️ ALERT: Win Rate ${winRate.toFixed(1)}% is below ${TradingEngine.WIN_RATE_ALERT_THRESHOLD}% threshold! ` +
          `Trades: ${total} | W: ${wins} | L: ${losses} | PnL: ${pnl >= 0 ? "+" : ""}${pnl.toFixed(4)} USDT. ` +
          `Consider reviewing AI parameters or pausing the bot.`);
      } else {
        await this.logEvent("INFO", "SYSTEM",
          `[WIN_RATE] Status OK: ${winRate.toFixed(1)}% (${wins}W/${losses}L) | PnL: ${pnl >= 0 ? "+" : ""}${pnl.toFixed(4)} USDT | Cycle #${this.cycleCount}`);
      }
    } catch (e) {
      console.error("[WIN_RATE] Error checking win rate:", this.errStr(e));
    }
  }

  // --------------------------------------------------------------------------
  // AI Decision Engine
  // --------------------------------------------------------------------------

  private async askAIForOpportunities(snapshots: MarketSnapshot[]): Promise<AIDecision[]> {
    const balance = await this.config.gateioClient.getBalance();
    const totalBalance = parseFloat(balance.totalBalance);
    const availableBalance = parseFloat(balance.availableBalance);
    // [FIX 5.9] Deployable = available minus 10% reserve floor
    const reserveFloor = totalBalance * TradingEngine.CAPITAL_RESERVE_PCT;
    const deployableBalance = Math.max(0, availableBalance - reserveFloor);

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

    // [FIX 5.5] Updated minimum confidence in prompt
    const minConf = this.getMinConfidence();
    // [FIX 5.6] Updated max leverage in prompt
    const maxLev = this.getMaxLeverage();

    // Calculate how many more positions we can open
    // No fixed position limit — calculate slots purely from available capital
    // [FIX 5.9] Use deployable balance (after 10% reserve) for position count
    const maxNewPositions = Math.max(1, Math.floor(deployableBalance / 10)); // each position uses ~$10

    const systemPrompt = `Você é um agente de trading algorítmico avançado especializado em criptoativos (futuros), com foco em MAXIMIZAR o número de posições abertas usando TODO o capital disponível.

OBJETIVO PRINCIPAL: Identificar TODOS os trades viáveis nos dados fornecidos e recomendar TODOS eles. Não filtre demais — se um trade tem evidência técnica suficiente, recomende-o.

COMPORTAMENTO:
- Tome decisões baseadas em EVIDÊNCIA TÉCNICA CLARA, não em intuição.
- Abra posição quando houver CONFLUÊNCIA de pelo menos 2 indicadores.
- MAXIMIZE o número de posições: prefira recomendar mais trades com confiança moderada do que poucos com confiança alta.
- Cada posição usa EXATAMENTE $10 USDT de capital base (o sistema aplica isso automaticamente).
- NÃO calcule positionSizePercent — use sempre 100 (o sistema ignora esse campo e usa $10 fixo).

CRITÉRIOS QUANTITATIVOS:
- LONG: RSI < 45 OU (RSI 45-55 + MACD bullish + acima EMA50) OU (volume_ratio > 1.5 + tendência BULLISH)
- SHORT: RSI > 55 OU (RSI 45-55 + MACD bearish + abaixo EMA50) OU (volume_ratio > 1.5 + tendência BEARISH)
- Volatilidade mínima: 0.3% (pares muito estáveis não geram lucro)
- Volume ratio mínimo: 0.7 (liquidez insuficiente = risco de slippage)
- Funding rate: negativo favorece longs, positivo favorece shorts

EXCHANGE: Gate.io Futures (USDT-M)
- Símbolos usam formato: BTC_USDT, ETH_USDT (com underscore)

PERFIL DE RISCO: ${this.config.aggressiveness}
- Alavancagem máxima: ${maxLev}x
- Confiança mínima: ${minConf}%

CAPITAL DISPONÍVEL:
- Saldo deployável: ${deployableBalance.toFixed(2)} USDT (reserva 10% = ${reserveFloor.toFixed(2)} USDT bloqueada)
- Posições abertas atualmente: ${this.positions.size} (sem limite fixo)
- Posições que podem ser abertas agora: até ${maxNewPositions} (baseado no saldo disponível)
- CADA posição usa $10 USDT fixo (o sistema calcula os contratos automaticamente)

REGRAS:
- Retorne TODOS os trades viáveis que encontrar, até ${maxNewPositions} oportunidades (use TODO o capital disponível)
- Ordene por confiança (maior primeiro)
- NUNCA repita o mesmo símbolo
- Só inclua trades com confiança >= ${minConf}%
- Se não houver boas oportunidades, retorne array vazio []

Responda APENAS com um JSON array:
[
  {
    "action": "OPEN_LONG" | "OPEN_SHORT" | "SKIP",
    "symbol": "BTC_USDT",
    "confidence": 75,
    "leverage": ${maxLev},
    "positionSizePercent": 100,
    "reasoning": "RSI=38 oversold + MACD bullish + acima EMA50 + volume_ratio=1.8"
  }
]`;

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

      // [CREDIT GUARD] Reset error counter on success
      this.consecutiveAIErrors = 0;

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
      const errMsg = this.errStr(error);
      await this.logEvent("ERROR", "AI", `AI opportunity analysis failed: ${errMsg}`);

      // [CREDIT GUARD] Detect 402 / credit exhaustion errors
      await this.handleAIError(errMsg);
      return [];
    }
  }

  // [FIX 5.2] Completely rewritten position management prompt
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
- Tempo aberta: ${holdTime.toFixed(0)} minutos

Indicadores atuais:
- RSI: ${snapshot.rsi}
- MACD bullish: ${snapshot.macd.bullish}, histogram: ${snapshot.macd.histogram}
- BB position: ${snapshot.bb.position}
- Volatilidade: ${snapshot.volatility.volatility}% (${snapshot.volatility.trend})
- Volume ratio: ${snapshot.volumeAnalysis.volumeRatio}
- Tendência: ${snapshot.trend}

REGRAS DE DECISÃO (siga rigorosamente):

1. ZONA DE TOLERÂNCIA AO RUÍDO:
   - Se |P&L| < 1.0%, a posição está na zona de ruído normal de mercado.
   - Na zona de ruído, SÓ feche se houver REVERSÃO CLARA de tendência (RSI inverteu + MACD cruzou contra a posição).
   - NÃO feche apenas porque o P&L é levemente negativo.

2. POSIÇÃO LUCRATIVA (P&L > +1%):
   - HOLD se a tendência continua favorável (LONG + BULLISH, ou SHORT + BEARISH).
   - CLOSE apenas se houver sinais CLAROS de reversão: RSI extremo (>75 para LONG, <25 para SHORT) + MACD cruzando contra + BB position extrema.

3. POSIÇÃO COM PREJUÍZO (P&L < -1%):
   - CLOSE se a tendência virou contra a posição (LONG + BEARISH, ou SHORT + BULLISH).
   - HOLD se a tendência ainda é favorável e o RSI sugere recuperação.

4. STOP LOSS AUTOMÁTICO:
   - CLOSE imediatamente se P&L < -3% (proteção de capital).

5. NUNCA use a "confiança na entrada" como razão para fechar. Foque APENAS nos indicadores ATUAIS.

Decida: CLOSE ou HOLD?
Responda APENAS com JSON:
{"action": "CLOSE" ou "HOLD", "symbol": "${position.symbol}", "confidence": 0, "leverage": 0, "positionSizePercent": 0, "reasoning": "explicação baseada nos indicadores atuais"}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um gestor de risco de trading de futuros cripto. Siga as REGRAS DE DECISÃO fornecidas rigorosamente. Não feche posições por ruído de mercado. Deixe os trades se desenvolverem." },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 500,
      });

      // [CREDIT GUARD] Reset error counter on success
      this.consecutiveAIErrors = 0;

      const content = response.choices[0]?.message?.content ?? '{"action":"HOLD"}';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { action: "HOLD", symbol: position.symbol, confidence: 0, leverage: 0, positionSizePercent: 0, reasoning: "Parse error" };
      return JSON.parse(jsonMatch[0]) as AIDecision;
    } catch (error) {
      const errMsg = this.errStr(error);
      await this.logEvent("ERROR", "AI", `AI position management failed: ${errMsg}`);

      // [CREDIT GUARD] Detect 402 / credit exhaustion errors
      await this.handleAIError(errMsg);
      return { action: "HOLD", symbol: position.symbol, confidence: 0, leverage: 0, positionSizePercent: 0, reasoning: "AI error - holding" };
    }
  }

  // --------------------------------------------------------------------------
  // [CREDIT GUARD] Detect AI credit exhaustion and trigger emergency close
  // --------------------------------------------------------------------------

  private async handleAIError(errMsg: string): Promise<void> {
    const isCreditError = errMsg.includes("402") ||
      errMsg.toLowerCase().includes("insufficient credits") ||
      errMsg.toLowerCase().includes("credit") ||
      errMsg.toLowerCase().includes("quota") ||
      errMsg.toLowerCase().includes("billing");

    if (isCreditError) {
      this.consecutiveAIErrors++;
      await this.logEvent("WARNING", "AI",
        `[CREDIT GUARD] AI credit error #${this.consecutiveAIErrors}/${TradingEngine.MAX_CONSECUTIVE_AI_ERRORS}: ${errMsg}`);

      if (this.consecutiveAIErrors >= TradingEngine.MAX_CONSECUTIVE_AI_ERRORS) {
        await this.logEvent("CRITICAL", "SYSTEM",
          `[CREDIT GUARD] 🚨 AI credits EXHAUSTED after ${this.consecutiveAIErrors} consecutive errors. ` +
          `EMERGENCY CLOSING ALL ${this.positions.size} POSITIONS to prevent unmanaged exposure.`);

        // Close all positions immediately
        await this.closeAllPositions("AI_CREDITS_EXHAUSTED");

        // Stop the bot — it cannot operate safely without AI
        await this.logEvent("CRITICAL", "SYSTEM",
          `[CREDIT GUARD] Bot STOPPED. Recarregue os créditos da API de IA e reinicie o bot manualmente.`);
        await this.stop();
      }
    } else {
      // Non-credit error: reset counter (transient failure)
      this.consecutiveAIErrors = 0;
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
  // [FIX 5.8] Cached API calls
  // --------------------------------------------------------------------------

  private async getCachedContractMultiplier(symbol: string): Promise<number> {
    const cached = this.contractInfoCache.get(symbol);
    if (cached && (Date.now() - cached.cachedAt) < TradingEngine.CONTRACT_CACHE_TTL) {
      const qm = parseFloat(cached.data.quantoMultiplier || cached.data.quanto_multiplier || "1");
      return qm;
    }

    try {
      const contractInfo = await this.config.gateioClient.getContractInfo(symbol);
      this.contractInfoCache.set(symbol, { data: contractInfo, cachedAt: Date.now() });
      return parseFloat(contractInfo.quantoMultiplier || contractInfo.quanto_multiplier || "1");
    } catch (error) {
      console.error(`[CACHE] Failed to get contract info for ${symbol}: ${this.errStr(error)}`);
      // Return cached value even if expired, or default to 1
      if (cached) {
        return parseFloat(cached.data.quantoMultiplier || cached.data.quanto_multiplier || "1");
      }
      return 1; // Safe default — better than 1/entryPrice
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

  /**
   * Returns all tickers with volume > $50k, cached for 3 minutes.
   * Single API call covers all 650+ Gate.io futures pairs.
   */
  private async getCachedAllTickers(): Promise<any[]> {
    if (this.allTickersCache.data && (Date.now() - this.allTickersCache.cachedAt) < TradingEngine.ALL_TICKERS_CACHE_TTL) {
      return this.allTickersCache.data;
    }

    const tickers = await this.config.gateioClient.getAllTickers(50000);
    this.allTickersCache = { data: tickers, cachedAt: Date.now() };
    return tickers;
  }

  // --------------------------------------------------------------------------
  // Trade Execution (Gate.io Futures)
  // --------------------------------------------------------------------------

  private async executeDecision(decision: AIDecision): Promise<void> {
    const side: "BUY" | "SELL" = decision.action === "OPEN_LONG" ? "BUY" : "SELL";

    // [FIX 5.6] Enforce max leverage
    decision.leverage = Math.min(decision.leverage, this.getMaxLeverage());

    try {
      // [FIX 5.9] Get balance and calculate position size respecting 10% reserve
      const balance = await this.config.gateioClient.getBalance();
      const totalBalance = parseFloat(balance.totalBalance);
      const available = parseFloat(balance.availableBalance);
      // Deployable = available minus 10% reserve floor
      const reserveFloor = totalBalance * TradingEngine.CAPITAL_RESERVE_PCT;
      const deployable = Math.max(0, available - reserveFloor);

      // Always use exactly $10 per position (or deployable balance if less)
      // This maximises capital deployment while respecting the 10% reserve
      const baseValue = Math.min(deployable, 10); // hard cap at $10, use deployable if < $10
      const notionalValue = baseValue * decision.leverage;

      // Get current price
      const ticker = await this.config.gateioClient.getTicker(decision.symbol);
      const currentPrice = parseFloat(ticker.lastPrice);
      if (currentPrice <= 0) return;

      // [FIX 5.1 + 5.8] Get contract info from cache for quantity calculation
      const contractInfo = await this.getCachedContractInfo(decision.symbol);
      const quantoMultiplier = parseFloat(contractInfo.quantoMultiplier || contractInfo.quanto_multiplier || "0.001");
      console.log(`[EXEC] ${decision.symbol}: base=$${baseValue.toFixed(2)}, notional=$${notionalValue.toFixed(2)}, price=${currentPrice}, qm=${quantoMultiplier}`);
      const contractValue = currentPrice * quantoMultiplier; // value of 1 contract in USDT
      const rawContracts = notionalValue / contractValue;
      const contracts = Math.floor(rawContracts);
      if (contracts <= 0) return;

      // [FIX 6.0] Auto margin mode: use isolated when balance > $200, cross otherwise
      // Isolated margin prevents cascading liquidation with larger portfolios.
      // Cross margin is safer with small balances (<$200) due to shared buffer.
      const targetMarginMode = totalBalance >= TradingEngine.ISOLATED_MARGIN_THRESHOLD
        ? TradingEngine.ISOLATED_MARGIN_MODE
        : TradingEngine.CROSS_MARGIN_MODE;
      try {
        await this.config.gateioClient.setMarginMode(
          decision.symbol,
          targetMarginMode as "cross" | "isolated",
          decision.leverage
        );
        console.log(`[EXEC] ${decision.symbol}: margin mode=${targetMarginMode} (balance=$${totalBalance.toFixed(2)}, threshold=$${TradingEngine.ISOLATED_MARGIN_THRESHOLD})`);
      } catch (e) {
        console.log(`Margin mode warning for ${decision.symbol}:`, this.errStr(e));
      }

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

      // [FIX 5.1] Record position in memory WITH quantoMultiplier
      this.positions.set(decision.symbol, {
        symbol: decision.symbol,
        side,
        entryPrice: currentPrice,
        quantity: contracts,
        entryTime: new Date(),
        leverage: decision.leverage,
        confidence: decision.confidence,
        quantoMultiplier, // [FIX 5.1] cached for correct PnL calculation
      });

      // [FIX 5.1] Record trade in DB — store quantoMultiplier in stopLoss field (repurposed)
      await this.db.insert(trades).values({
        id: nanoid(),
        userId: this.config.userId,
        configId: this.config.configId,
        symbol: decision.symbol,
        side,
        entryPrice: currentPrice.toString(),
        quantity: contracts.toString(),
        entryTime: new Date(),
        stopLoss: quantoMultiplier.toString(), // [FIX 5.1] Store quantoMultiplier here
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
        `${side} ${contracts} contracts @ ${currentPrice} | Lev: ${decision.leverage}x | Conf: ${decision.confidence}% | QM: ${quantoMultiplier} | ${decision.reasoning}`
      );
    } catch (error) {
      await this.logEvent("ERROR", decision.symbol, `Execute error: ${this.errStr(error)}`);
    }
  }

  /**
   * Close position on exchange AND update DB record
   */
  private async closePosition(symbol: string, exitPrice: number, reason: string): Promise<void> {
    try {
      const position = this.positions.get(symbol);
      if (!position) return;

      // Close position via Gate.io (pass side for dual mode)
      const positionSide = position.side === "BUY" ? "LONG" : "SHORT";
      await this.config.gateioClient.closePosition(symbol, positionSide);

      // Update DB record
      await this.closePositionRecord(symbol, exitPrice, reason);
    } catch (error) {
      await this.logEvent("ERROR", symbol, `Close error: ${this.errStr(error)}`);
    }
  }

  /**
   * [FIX 5.1] Update DB trade record and in-memory position
   * Uses cached quantoMultiplier from position for correct PnL calculation
   */
  private async closePositionRecord(symbol: string, exitPrice: number, reason: string): Promise<void> {
    try {
      const position = this.positions.get(symbol);
      if (!position) return;

      // [FIX 5.1] Use quantoMultiplier from position (cached at entry)
      // Fallback: try to get from DB trade record, then from API cache, then default to 1
      let quantoMultiplier = position.quantoMultiplier;
      if (!quantoMultiplier || quantoMultiplier <= 0) {
        // Try to read from DB trade record (stored in stopLoss field)
        try {
          const tradeRecord = await this.db.select().from(trades)
            .where(and(eq(trades.symbol, symbol), eq(trades.status, "OPEN"), eq(trades.userId, this.config.userId)))
            .limit(1);
          if (tradeRecord.length > 0 && tradeRecord[0].stopLoss) {
            const dbQm = parseFloat(tradeRecord[0].stopLoss);
            if (dbQm > 0 && dbQm !== 0) {
              quantoMultiplier = dbQm;
            }
          }
        } catch { /* ignore */ }

        // Still no good value? Try API cache
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

      // Update trade in DB
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
        `Closed @ ${exitPrice} | P&L: ${pnl >= 0 ? "+" : ""}${pnl.toFixed(4)} USDT (${pnlPercent >= 0 ? "+" : ""}${pnlPercent.toFixed(2)}%) | QM: ${quantoMultiplier} | ${reason}`
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
        // [FIX 5.8] Rate limiting delay
        await this.sleep(TradingEngine.API_DELAY_MS);
      } catch (error) {
        await this.logEvent("ERROR", symbol, `Failed to close: ${this.errStr(error)}`);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Risk Management
  // --------------------------------------------------------------------------

  // [FIX 7.0] CRITICAL: Use realized balance (account.total) NOT totalBalance which
  // includes unrealizedPnL. With cross margin and many open positions, unrealizedPnL
  // fluctuations were triggering false drawdown alerts, closing profitable positions.
  // The drawdown check now uses the raw 'available' balance from the exchange account,
  // which represents settled/realized funds only.
  private async isDrawdownExceeded(): Promise<boolean> {
    if (this.initialBalance <= 0) return false;
    try {
      const balance = await this.config.gateioClient.getBalance();
      // Use availableBalance (realized, settled funds) to avoid unrealizedPnL noise.
      // Falls back to totalBalance if availableBalance is not available.
      const realizedBalance = parseFloat(balance.availableBalance || balance.totalBalance);
      const drawdown = ((this.initialBalance - realizedBalance) / this.initialBalance) * 100;
      if (drawdown >= this.config.maxDrawdown * 0.8) {
        // Log a warning when approaching 80% of the drawdown limit
        await this.logEvent("RISK_WARN", "SYSTEM",
          `Drawdown warning: ${drawdown.toFixed(2)}% (limit: ${this.config.maxDrawdown}%) | realized=$${realizedBalance.toFixed(2)} initial=$${this.initialBalance.toFixed(2)}`);
      }
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
          // [FIX 5.9] Preserve original startedAt — only set on first start, never overwrite
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
