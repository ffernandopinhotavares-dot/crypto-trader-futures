import { RestClientV5 } from "bybit-api";

// ============================================================================
// Bybit API Client - Using official bybit-api SDK v4 (handles region routing)
// ============================================================================

export interface BybitConfig {
  apiKey: string;
  apiSecret: string;
  testnet?: boolean;
}

export interface BybitOrder {
  orderId: string;
  symbol: string;
  side: "Buy" | "Sell";
  orderType: "Limit" | "Market";
  price: string;
  qty: string;
  status: string;
  createdTime: string;
  updatedTime: string;
}

export interface BybitPosition {
  symbol: string;
  side: "Buy" | "Sell";
  size: string;
  entryPrice: string;
  markPrice: string;
  unrealisedPnl: string;
  unrealisedPnlPcnt: string;
  leverage: string;
}

export interface BybitKline {
  startTime: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  closePrice: string;
  volume: string;
  turnover: string;
}

export interface BybitTicker {
  symbol: string;
  lastPrice: string;
  highPrice24h: string;
  lowPrice24h: string;
  prevPrice24h: string;
  volume24h: string;
  turnover24h: string;
  bid1Price: string;
  ask1Price: string;
}

export interface BybitInstrument {
  symbol: string;
  baseCoin: string;
  quoteCoin: string;
  minOrderQty: string;
  maxOrderQty: string;
  minOrderAmt: string;
  maxOrderAmt: string;
  priceScale: string;
  qtyScale: string;
  status: string;
}

export class BybitClient {
  private client: RestClientV5;

  constructor(config: BybitConfig) {
    this.client = new RestClientV5({
      key: config.apiKey,
      secret: config.apiSecret,
      testnet: config.testnet ?? false,
      // Use the NL/EU endpoint which avoids CloudFront geo-blocking on US servers
      // This is the recommended approach for servers hosted in regions that face 403 errors
      baseUrl: config.testnet
        ? "https://api-testnet.bybit.com"
        : "https://api.bytick.com",
      recv_window: 10000,
    });
  }

  /**
   * Get account balance
   */
  async getBalance(): Promise<{ coin: string; walletBalance: string }[]> {
    const response = await this.client.getWalletBalance({
      accountType: "UNIFIED",
    });
    if (response.retCode !== 0) {
      throw new Error(`Bybit API Error: ${response.retMsg}`);
    }
    return response.result.list[0]?.coin ?? [];
  }

  /**
   * Get open positions
   */
  async getPositions(symbol?: string): Promise<BybitPosition[]> {
    const params: any = {
      category: "linear",
      settleCoin: "USDT",
    };
    if (symbol) params.symbol = symbol;

    const response = await this.client.getPositionInfo(params);
    if (response.retCode !== 0) {
      throw new Error(`Bybit API Error: ${response.retMsg}`);
    }
    return response.result.list as BybitPosition[];
  }

  /**
   * Place order
   */
  async placeOrder(
    symbol: string,
    side: "Buy" | "Sell",
    orderType: "Limit" | "Market",
    qty: string,
    price?: string
  ): Promise<{ orderId: string }> {
    const params: any = {
      category: "linear",
      symbol,
      side,
      orderType,
      qty,
      timeInForce: "GTC",
    };
    if (orderType === "Limit" && price) {
      params.price = price;
    }

    const response = await this.client.submitOrder(params);
    if (response.retCode !== 0) {
      throw new Error(`Bybit API Error: ${response.retMsg}`);
    }
    return response.result as { orderId: string };
  }

  /**
   * Cancel order
   */
  async cancelOrder(symbol: string, orderId: string): Promise<void> {
    const response = await this.client.cancelOrder({
      category: "linear",
      symbol,
      orderId,
    });
    if (response.retCode !== 0) {
      throw new Error(`Bybit API Error: ${response.retMsg}`);
    }
  }

  /**
   * Get order history
   */
  async getOrderHistory(symbol?: string, limit: number = 50): Promise<BybitOrder[]> {
    const params: any = {
      category: "linear",
      limit,
    };
    if (symbol) params.symbol = symbol;

    const response = await this.client.getHistoricOrders(params);
    if (response.retCode !== 0) {
      throw new Error(`Bybit API Error: ${response.retMsg}`);
    }
    return response.result.list as BybitOrder[];
  }

  /**
   * Get klines (candlestick data)
   */
  async getKlines(
    symbol: string,
    interval: string,
    limit: number = 200,
    startTime?: number
  ): Promise<BybitKline[]> {
    const params: any = {
      category: "linear",
      symbol,
      interval: interval as any,
      limit,
    };
    if (startTime) params.start = startTime;

    const response = await this.client.getKline(params);
    if (response.retCode !== 0) {
      throw new Error(`Bybit API Error: ${response.retMsg}`);
    }

    // SDK returns array of arrays: [startTime, open, high, low, close, volume, turnover]
    return (response.result.list as string[][]).map((k) => ({
      startTime: k[0],
      openPrice: k[1],
      highPrice: k[2],
      lowPrice: k[3],
      closePrice: k[4],
      volume: k[5],
      turnover: k[6],
    }));
  }

  /**
   * Get ticker (current price and stats)
   */
  async getTicker(symbol: string): Promise<BybitTicker> {
    const response = await this.client.getTickers({
      category: "linear",
      symbol,
    });
    if (response.retCode !== 0) {
      throw new Error(`Bybit API Error: ${response.retMsg}`);
    }
    return response.result.list[0] as BybitTicker;
  }

  /**
   * Get instrument info
   */
  async getInstruments(symbol?: string): Promise<BybitInstrument[]> {
    const params: any = { category: "linear" };
    if (symbol) params.symbol = symbol;

    const response = await this.client.getInstrumentsInfo(params);
    if (response.retCode !== 0) {
      throw new Error(`Bybit API Error: ${response.retMsg}`);
    }
    return response.result.list as BybitInstrument[];
  }

  /**
   * Get all trading pairs
   */
  async getAllInstruments(): Promise<BybitInstrument[]> {
    const response = await this.client.getInstrumentsInfo({ category: "linear" });
    if (response.retCode !== 0) {
      throw new Error(`Bybit API Error: ${response.retMsg}`);
    }
    return response.result.list as BybitInstrument[];
  }

  /**
   * Set leverage
   */
  async setLeverage(symbol: string, leverage: number): Promise<void> {
    const response = await this.client.setLeverage({
      category: "linear",
      symbol,
      buyLeverage: leverage.toString(),
      sellLeverage: leverage.toString(),
    });
    if (response.retCode !== 0 && response.retCode !== 110043) {
      // 110043 = leverage not modified (already set)
      throw new Error(`Bybit API Error: ${response.retMsg}`);
    }
  }

  /**
   * Set stop loss and take profit
   */
  async setStopLossTakeProfit(
    symbol: string,
    side: "Buy" | "Sell",
    stopLoss?: string,
    takeProfit?: string
  ): Promise<void> {
    const params: any = {
      category: "linear",
      symbol,
      side,
    };
    if (stopLoss) params.stopLoss = stopLoss;
    if (takeProfit) params.takeProfit = takeProfit;

    const response = await this.client.setTPSLMode(params);
    if (response.retCode !== 0) {
      throw new Error(`Bybit API Error: ${response.retMsg}`);
    }
  }

  /**
   * Get funding rate
   */
  async getFundingRate(symbol: string): Promise<{ fundingRate: string }> {
    const response = await this.client.getFundingRateHistory({
      category: "linear",
      symbol,
      limit: 1,
    });
    if (response.retCode !== 0) {
      throw new Error(`Bybit API Error: ${response.retMsg}`);
    }
    return response.result.list[0] as { fundingRate: string };
  }
}

/**
 * Create Bybit client instance
 */
export function createBybitClient(config: BybitConfig): BybitClient {
  return new BybitClient(config);
}
