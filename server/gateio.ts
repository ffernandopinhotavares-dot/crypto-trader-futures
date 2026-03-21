/**
 * Gate.io Futures (USDT-M) Client
 * Replaces Binance client due to Binance geo-blocking datacenter IPs
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

  constructor(config: GateioConfig) {
    const client = new GateApi.ApiClient();
    client.setApiKeySecret(config.apiKey, config.apiSecret);
    this.futuresApi = new GateApi.FuturesApi(client);
  }

  // ========== Public Methods (no auth needed) ==========

  static createPublicClient(): GateioClient {
    // Create a client without auth for public endpoints
    return new GateioClient({ apiKey: "", apiSecret: "" });
  }

  async getTopPairs(limit: number = 20): Promise<GateioTicker[]> {
    const result = await this.futuresApi.listFuturesTickers(this.settle);
    const tickers = result.body;

    // SDK returns camelCase: volume24hQuote, changePercentage, high24h, low24h, fundingRate
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
    // Gate.io interval format: 10s, 1m, 5m, 15m, 30m, 1h, 4h, 8h, 1d, 7d, 30d
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
    return {
      totalBalance: account.total || "0",
      availableBalance: account.available || "0",
      unrealizedPnl: account.unrealisedPnl || account.unrealised_pnl || "0",
      marginBalance: String(
        parseFloat(account.total || "0") +
          parseFloat(account.unrealised_pnl || "0")
      ),
    };
  }

  async getPositions(): Promise<GateioPosition[]> {
    const result = await this.futuresApi.listPositions(this.settle, {
      holding: true,
    });
    const positions = result.body;

    return (positions as any[]).map((p: any) => ({
      symbol: p.contract || "",
      side: p.size > 0 ? "LONG" : "SHORT",
      size: String(Math.abs(p.size || 0)),
      entryPrice: p.entryPrice || p.entry_price || "0",
      markPrice: p.markPrice || p.mark_price || "0",
      unrealizedPnl: p.unrealisedPnl || p.unrealised_pnl || "0",
      leverage: p.leverage || "0",
      marginMode: p.mode || "single",
    }));
  }

  async setLeverage(symbol: string, leverage: number): Promise<void> {
    await this.futuresApi.updatePositionLeverage(this.settle, symbol, String(leverage), {
      crossLeverageLimit: String(leverage),
    });
  }

  async placeOrder(params: {
    symbol: string;
    side: "BUY" | "SELL";
    size: number;
    price?: number;
    reduceOnly?: boolean;
  }): Promise<GateioOrderResult> {
    // Gate.io uses positive size for long, negative for short
    const sizeValue =
      params.side === "BUY" ? Math.abs(params.size) : -Math.abs(params.size);

    const order: any = {
      contract: params.symbol,
      size: sizeValue,
      price: params.price ? String(params.price) : "0", // 0 = market order
      tif: params.price ? "gtc" : "ioc", // ioc for market, gtc for limit
      reduceOnly: params.reduceOnly || false,
    };

    const result = await this.futuresApi.createFuturesOrder(this.settle, order);
    const o = result.body as any;

    return {
      orderId: String(o.id || ""),
      symbol: o.contract || params.symbol,
      side: params.side,
      size: Math.abs(o.size || params.size),
      price: o.fill_price || o.price || "0",
      status: o.status || "unknown",
    };
  }

  async closePosition(symbol: string): Promise<GateioOrderResult | null> {
    // Get current position to know the size
    const positions = await this.getPositions();
    const pos = positions.find((p) => p.symbol === symbol);
    if (!pos || parseFloat(pos.size) === 0) return null;

    // Close by placing opposite order
    const closeSide = pos.side === "LONG" ? "SELL" : "BUY";
    return await this.placeOrder({
      symbol,
      side: closeSide,
      size: Math.abs(parseFloat(pos.size)),
      reduceOnly: true,
    });
  }

  async closeAllPositions(): Promise<void> {
    const positions = await this.getPositions();
    for (const pos of positions) {
      if (parseFloat(pos.size) > 0) {
        try {
          await this.closePosition(pos.symbol);
        } catch (err) {
          console.error(`Error closing position ${pos.symbol}:`, err);
        }
      }
    }
  }

  async testConnection(): Promise<{ success: boolean; balance: string; message: string }> {
    try {
      const balance = await this.getBalance();
      return {
        success: true,
        balance: balance.totalBalance,
        message: "Conexão com Gate.io Futures estabelecida com sucesso",
      };
    } catch (error: any) {
      throw new Error(`Falha na conexão: ${error?.message || String(error)}`);
    }
  }
}

export function createGateioClient(config: GateioConfig): GateioClient {
  return new GateioClient(config);
}
