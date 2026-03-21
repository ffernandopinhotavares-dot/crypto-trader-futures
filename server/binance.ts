import { USDMClient } from "binance";

// ============================================================================
// Binance Futures (USD-M) API Client
// ============================================================================

export interface BinanceConfig {
  apiKey: string;
  apiSecret: string;
  testnet?: boolean;
}

export interface BinanceOrder {
  orderId: string;
  symbol: string;
  side: "BUY" | "SELL";
  type: string;
  price: string;
  origQty: string;
  status: string;
  time: number;
  updateTime: number;
}

export interface BinancePosition {
  symbol: string;
  positionSide: string;
  positionAmt: string;
  entryPrice: string;
  markPrice: string;
  unrealizedProfit: string;
  leverage: string;
  notional: string;
}

export interface BinanceKline {
  startTime: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  closePrice: string;
  volume: string;
  turnover: string;
}

export interface BinanceTicker {
  symbol: string;
  lastPrice: string;
  highPrice: string;
  lowPrice: string;
  prevClosePrice: string;
  volume: string;
  quoteVolume: string;
  bidPrice: string;
  askPrice: string;
}

export interface BinanceInstrument {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  filters: any[];
  status: string;
}

export class BinanceClient {
  private client: USDMClient;

  constructor(config: BinanceConfig) {
    this.client = new USDMClient({
      api_key: config.apiKey,
      api_secret: config.apiSecret,
      ...(config.testnet ? { baseUrl: 'https://testnet.binancefuture.com' } : {}),
    });
  }

  /**
   * Get account balance (USDT futures)
   */
  async getBalance(): Promise<{ coin: string; walletBalance: string }[]> {
    const balances = await this.client.getBalance();
    return (balances as any[]).map((b: any) => ({
      coin: b.asset,
      walletBalance: b.balance,
    }));
  }

  /**
   * Get account info (includes balance, unrealized PnL, positions count)
   */
  async getAccountInfo(): Promise<{
    totalWalletBalance: string;
    availableBalance: string;
    totalMarginBalance: string;
    totalUnrealizedProfit: string;
    positions: BinancePosition[];
  }> {
    const account = await this.client.getAccountInformation();
    const positions = (account.positions as any[])
      .filter((p: any) => parseFloat(p.positionAmt) !== 0)
      .map((p: any) => ({
        symbol: p.symbol,
        positionSide: p.positionSide,
        positionAmt: p.positionAmt,
        entryPrice: p.entryPrice,
        markPrice: p.markPrice ?? "0",
        unrealizedProfit: p.unrealizedProfit,
        leverage: p.leverage,
        notional: p.notional ?? "0",
      }));

    return {
      totalWalletBalance: (account as any).totalWalletBalance,
      availableBalance: (account as any).availableBalance,
      totalMarginBalance: (account as any).totalMarginBalance,
      totalUnrealizedProfit: (account as any).totalUnrealizedProfit,
      positions,
    };
  }

  /**
   * Get open positions
   */
  async getPositions(symbol?: string): Promise<BinancePosition[]> {
    const positions = await this.client.getPositions(symbol ? { symbol } : undefined);
    return (positions as any[])
      .filter((p: any) => parseFloat(p.positionAmt) !== 0)
      .map((p: any) => ({
        symbol: p.symbol,
        positionSide: p.positionSide,
        positionAmt: p.positionAmt,
        entryPrice: p.entryPrice,
        markPrice: p.markPrice ?? "0",
        unrealizedProfit: p.unrealizedProfit,
        leverage: p.leverage,
        notional: p.notional ?? "0",
      }));
  }

  /**
   * Place order
   */
  async placeOrder(
    symbol: string,
    side: "BUY" | "SELL",
    orderType: "LIMIT" | "MARKET",
    qty: string,
    price?: string
  ): Promise<{ orderId: string }> {
    const params: any = {
      symbol,
      side,
      type: orderType,
      quantity: qty,
    };

    if (orderType === "LIMIT" && price) {
      params.price = price;
      params.timeInForce = "GTC";
    }

    const response = await this.client.submitNewOrder(params);
    return { orderId: String((response as any).orderId) };
  }

  /**
   * Cancel order
   */
  async cancelOrder(symbol: string, orderId: string): Promise<void> {
    await this.client.cancelOrder({
      symbol,
      orderId: parseInt(orderId),
    });
  }

  /**
   * Get order history
   */
  async getOrderHistory(symbol?: string, limit: number = 50): Promise<BinanceOrder[]> {
    const params: any = { limit };
    if (symbol) params.symbol = symbol;

    const orders = await this.client.getAllOrders(params);
    return (orders as any[]).map((o: any) => ({
      orderId: String(o.orderId),
      symbol: o.symbol,
      side: o.side,
      type: o.type,
      price: o.price,
      origQty: o.origQty,
      status: o.status,
      time: o.time,
      updateTime: o.updateTime,
    }));
  }

  /**
   * Get klines (candlestick data)
   */
  async getKlines(
    symbol: string,
    interval: string,
    limit: number = 200,
    startTime?: number
  ): Promise<BinanceKline[]> {
    const params: any = {
      symbol,
      interval: interval as any,
      limit,
    };
    if (startTime) params.startTime = startTime;

    const klines = await this.client.getKlines(params);

    // Binance returns array of arrays: [openTime, open, high, low, close, volume, closeTime, quoteAssetVolume, ...]
    return (klines as any[]).map((k: any) => ({
      startTime: String(k[0]),
      openPrice: String(k[1]),
      highPrice: String(k[2]),
      lowPrice: String(k[3]),
      closePrice: String(k[4]),
      volume: String(k[5]),
      turnover: String(k[7]), // quoteAssetVolume
    }));
  }

  /**
   * Get ticker (current price and stats)
   */
  async getTicker(symbol: string): Promise<BinanceTicker> {
    const ticker = await this.client.get24hrChangeStatistics({ symbol });
    const t = Array.isArray(ticker) ? ticker[0] : ticker;
    return {
      symbol: (t as any).symbol,
      lastPrice: (t as any).lastPrice,
      highPrice: (t as any).highPrice,
      lowPrice: (t as any).lowPrice,
      prevClosePrice: (t as any).prevClosePrice,
      volume: (t as any).volume,
      quoteVolume: (t as any).quoteVolume,
      bidPrice: (t as any).bidPrice ?? (t as any).lastPrice,
      askPrice: (t as any).askPrice ?? (t as any).lastPrice,
    };
  }

  /**
   * Get exchange info (instruments)
   */
  async getInstruments(symbol?: string): Promise<BinanceInstrument[]> {
    const info = await this.client.getExchangeInfo();
    let symbols = (info as any).symbols as any[];
    if (symbol) {
      symbols = symbols.filter((s: any) => s.symbol === symbol);
    }
    return symbols.map((s: any) => ({
      symbol: s.symbol,
      baseAsset: s.baseAsset,
      quoteAsset: s.quoteAsset,
      filters: s.filters,
      status: s.status,
    }));
  }

  /**
   * Get all USDT perpetual trading pairs
   */
  async getAllInstruments(): Promise<BinanceInstrument[]> {
    const info = await this.client.getExchangeInfo();
    return ((info as any).symbols as any[])
      .filter((s: any) => s.quoteAsset === "USDT" && s.status === "TRADING")
      .map((s: any) => ({
        symbol: s.symbol,
        baseAsset: s.baseAsset,
        quoteAsset: s.quoteAsset,
        filters: s.filters,
        status: s.status,
      }));
  }

  /**
   * Set leverage
   */
  async setLeverage(symbol: string, leverage: number): Promise<void> {
    await this.client.setLeverage({ symbol, leverage });
  }

  /**
   * Place order with stop loss and take profit (using STOP_MARKET and TAKE_PROFIT_MARKET)
   */
  async setStopLossTakeProfit(
    symbol: string,
    side: "BUY" | "SELL",
    stopLoss?: string,
    takeProfit?: string
  ): Promise<void> {
    const closeSide = side === "BUY" ? "SELL" : "BUY";

    if (stopLoss) {
      await this.client.submitNewOrder({
        symbol,
        side: closeSide,
        type: "STOP_MARKET" as any,
        stopPrice: stopLoss,
        closePosition: "true",
      } as any);
    }

    if (takeProfit) {
      await this.client.submitNewOrder({
        symbol,
        side: closeSide,
        type: "TAKE_PROFIT_MARKET" as any,
        stopPrice: takeProfit,
        closePosition: "true",
      } as any);
    }
  }

  /**
   * Get funding rate
   */
  async getFundingRate(symbol: string): Promise<{ fundingRate: string }> {
    const rates = await this.client.getFundingRateHistory({ symbol, limit: 1 });
    const r = Array.isArray(rates) ? rates[0] : rates;
    return { fundingRate: String((r as any)?.fundingRate ?? "0") };
  }

  /**
   * Get current mark price
   */
  async getMarkPrice(symbol: string): Promise<string> {
    const price = await this.client.getMarkPrice({ symbol });
    const p = Array.isArray(price) ? price[0] : price;
    return String((p as any).markPrice ?? "0");
  }
}

/**
 * Create Binance client instance
 */
export function createBinanceClient(config: BinanceConfig): BinanceClient {
  return new BinanceClient(config);
}
