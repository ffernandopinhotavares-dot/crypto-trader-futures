/**
 * Gate.io Futures (USDT-M) Client
 * Supports DUAL MODE (hedge) — separate long/short positions per contract
 */
import GateApi from "gate-api";

export interface GateioConfig {
  apiKey: string;
  apiSecret: string;
}

export interface GateioBalance {
  totalBalance: string;
  availableBalance: string;
  unrealizedPnl: string;
  marginBalance: string;
}

export interface GateioPosition {
  symbol: string;
  side: string;
  size: string;
  entryPrice: string;
  markPrice: string;
  unrealizedPnl: string;
  leverage: string;
  marginMode: string;
}

export interface GateioCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface GateioTicker {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  volume24h: string;
  highPrice: string;
  lowPrice: string;
  fundingRate: string;
}

export interface GateioOrderResult {
  orderId: string;
  symbol: string;
  side: string;
  size: number;
  price: string;
  status: string;
}

export class GateioClient {
  private futuresApi: InstanceType<typeof GateApi.FuturesApi>;
  private settle = "usdt";
  private isDualMode: boolean | null = null; // cached after first check

  constructor(config: GateioConfig) {
    const client = new GateApi.ApiClient();
    client.setApiKeySecret(config.apiKey, config.apiSecret);
    this.futuresApi = new GateApi.FuturesApi(client);
  }

  // ========== Dual Mode Detection ==========

  private async checkDualMode(): Promise<boolean> {
    if (this.isDualMode !== null) return this.isDualMode;
    try {
      // Try to get dual mode positions — if it works, we're in dual mode
      const positions = await this.futuresApi.listPositions(this.settle, { holding: true });
      const body = positions.body as any[];
      // In dual mode, positions have mode "dual_long" or "dual_short"
      this.isDualMode = body.some((p: any) => p.mode === "dual_long" || p.mode === "dual_short");
      if (!this.isDualMode && body.length === 0) {
        // No positions — check by trying getDualModePosition on a common contract
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

  static createPublicClient(): GateioClient {
    return new GateioClient({ apiKey: "", apiSecret: "" });
  }

  async getTopPairs(limit: number = 20): Promise<GateioTicker[]> {
    const result = await this.futuresApi.listFuturesTickers(this.settle);
    const tickers = result.body;

    const sorted = tickers
      .filter((t: any) => t.volume24hQuote && parseFloat(t.volume24hQuote) > 0)
      .sort((a: any, b: any) => parseFloat(b.volume24hQuote || "0") - parseFloat(a.volume24hQuote || "0"))
      .slice(0, limit);

    return sorted.map((t: any) => ({
      symbol: t.contract || "",
      lastPrice: t.last || "0",
      priceChangePercent: t.changePercentage || "0",
      volume24h: t.volume24hQuote || "0",
      highPrice: t.high24h || "0",
      lowPrice: t.low24h || "0",
      fundingRate: t.fundingRate || "0",
    }));
  }

  async getTicker(symbol: string): Promise<GateioTicker> {
    const result = await this.futuresApi.listFuturesTickers(this.settle, {
      contract: symbol,
    });
    const tickers = result.body;
    if (!tickers || tickers.length === 0) {
      throw new Error(`Ticker not found for ${symbol}`);
    }
    const t = tickers[0] as any;
    return {
      symbol: t.contract || symbol,
      lastPrice: t.last || "0",
      priceChangePercent: t.changePercentage || "0",
      volume24h: t.volume24hQuote || "0",
      highPrice: t.high24h || "0",
      lowPrice: t.low24h || "0",
      fundingRate: t.fundingRate || "0",
    };
  }

  async getCandles(
    symbol: string,
    interval: string = "15m",
    limit: number = 100
  ): Promise<GateioCandle[]> {
    const result = await this.futuresApi.listFuturesCandlesticks(
      this.settle,
      symbol,
      { interval: interval as any, limit: limit }
    );
    const candles = result.body;

    return (candles as any[]).map((c: any) => ({
      time: c.t ? c.t * 1000 : 0,
      open: parseFloat(c.o || "0"),
      high: parseFloat(c.h || "0"),
      low: parseFloat(c.l || "0"),
      close: parseFloat(c.c || "0"),
      volume: parseFloat(c.v || "0"),
    }));
  }

  async getContractInfo(symbol: string): Promise<any> {
    const result = await this.futuresApi.getFuturesContract(this.settle, symbol);
    return result.body;
  }

  // ========== Private Methods (auth required) ==========

  async getBalance(): Promise<GateioBalance> {
    const result = await this.futuresApi.listFuturesAccounts(this.settle);
    const account = result.body as any;
    const total = parseFloat(account.total || "0");
    const unrealizedPnl = parseFloat(account.unrealisedPnl || account.unrealised_pnl || "0");
    return {
      totalBalance: account.total || "0",
      availableBalance: account.available || "0",
      unrealizedPnl: String(unrealizedPnl),
      marginBalance: String(total + unrealizedPnl),
    };
  }

  async getPositions(): Promise<GateioPosition[]> {
    const result = await this.futuresApi.listPositions(this.settle, {
      holding: true,
    });
    const positions = result.body;

    return (positions as any[]).map((p: any) => {
      const mode = p.mode || "single";
      // In dual mode: mode is "dual_long" or "dual_short"
      // size is always positive for dual_long, always negative for dual_short
      let side: string;
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
        leverage: p.leverage || p.crossLeverageLimit || "0",
        marginMode: mode,
      };
    });
  }

  async setLeverage(symbol: string, leverage: number): Promise<void> {
    const dual = await this.checkDualMode();
    try {
      if (dual) {
        // In dual mode, use the dual-specific endpoint
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
    } catch (e: any) {
      // Log but don't throw — leverage might already be set
      console.log(`[GATEIO] Leverage set note for ${symbol}: ${e?.message || String(e)}`);
    }
  }

  async placeOrder(params: {
    symbol: string;
    side: "BUY" | "SELL";
    size: number;
    price?: number;
    reduceOnly?: boolean;
    autoSize?: string; // "close_long" or "close_short" for dual mode close
  }): Promise<GateioOrderResult> {
    // Gate.io uses positive size for long, negative for short
    const sizeValue =
      params.side === "BUY" ? Math.abs(params.size) : -Math.abs(params.size);

    const order: any = {
      contract: params.symbol,
      size: sizeValue,
      price: params.price ? String(params.price) : "0", // 0 = market order
      tif: params.price ? "gtc" : "ioc", // ioc for market, gtc for limit
    };

    // In dual mode, use auto_size to close positions instead of reduce_only
    if (params.autoSize) {
      order.size = 0; // auto_size determines the size
      order.autoSize = params.autoSize;
    } else if (params.reduceOnly) {
      order.reduceOnly = true;
    }

    const result = await this.futuresApi.createFuturesOrder(this.settle, order);
    const o = result.body as any;

    return {
      orderId: String(o.id || ""),
      symbol: o.contract || params.symbol,
      side: params.side,
      size: Math.abs(o.size || params.size),
      price: o.fillPrice || o.fill_price || o.price || "0",
      status: o.status || "unknown",
    };
  }

  async closePosition(symbol: string, positionSide?: string): Promise<GateioOrderResult | null> {
    const dual = await this.checkDualMode();
    const positions = await this.getPositions();

    if (dual) {
      // In dual mode, we need to close the specific side
      // positionSide should be "LONG" or "SHORT"
      const pos = positions.find((p) => p.symbol === symbol && (!positionSide || p.side === positionSide));
      if (!pos || parseFloat(pos.size) === 0) return null;

      // Use auto_size to close: "close_long" closes long, "close_short" closes short
      const autoSize = pos.side === "LONG" ? "close_long" : "close_short";
      const closeSide = pos.side === "LONG" ? "SELL" : "BUY";

      console.log(`[GATEIO] Closing dual ${pos.side} position ${symbol}: autoSize=${autoSize}`);

      return await this.placeOrder({
        symbol,
        side: closeSide,
        size: 0, // auto_size will determine
        autoSize,
      });
    } else {
      // Single mode: use reduce_only
      const pos = positions.find((p) => p.symbol === symbol);
      if (!pos || parseFloat(pos.size) === 0) return null;

      const closeSide = pos.side === "LONG" ? "SELL" : "BUY";
      return await this.placeOrder({
        symbol,
        side: closeSide,
        size: Math.abs(parseFloat(pos.size)),
        reduceOnly: true,
      });
    }
  }

  async closeAllPositions(): Promise<{ closed: string[]; errors: string[] }> {
    const positions = await this.getPositions();
    const closed: string[] = [];
    const errors: string[] = [];

    for (const pos of positions) {
      if (parseFloat(pos.size) > 0) {
        try {
          await this.closePosition(pos.symbol, pos.side);
          closed.push(`${pos.symbol} ${pos.side}`);
          console.log(`[GATEIO] Closed ${pos.symbol} ${pos.side} (${pos.size} contracts)`);
        } catch (err: any) {
          const msg = `${pos.symbol} ${pos.side}: ${err?.message || String(err)}`;
          errors.push(msg);
          console.error(`[GATEIO] Error closing ${msg}`);
        }
      }
    }

    return { closed, errors };
  }

  async testConnection(): Promise<{ success: boolean; balance: string; message: string }> {
    try {
      const balance = await this.getBalance();
      const dual = await this.checkDualMode();
      return {
        success: true,
        balance: balance.totalBalance,
        message: `Conexão com Gate.io Futures estabelecida com sucesso (modo: ${dual ? "dual/hedge" : "single"})`,
      };
    } catch (error: any) {
      throw new Error(`Falha na conexão: ${error?.message || String(error)}`);
    }
  }
}

export function createGateioClient(config: GateioConfig): GateioClient {
  return new GateioClient(config);
}
