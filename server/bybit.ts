import axios, { AxiosInstance } from "axios";
import crypto from "crypto";

// ============================================================================
// Bybit API Client
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
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;
  private client: AxiosInstance;

  constructor(config: BybitConfig) {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.baseUrl = config.testnet
      ? "https://api-testnet.bybit.com"
      : "https://api.bybit.com";

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
    });
  }

  /**
   * Generate signature for request
   */
  private generateSignature(
    timestamp: string,
    method: string,
    path: string,
    body: string
  ): string {
    const message = `${timestamp}${method}${path}${body}`;
    return crypto
      .createHmac("sha256", this.apiSecret)
      .update(message)
      .digest("hex");
  }

  /**
   * Make authenticated request
   */
  private async request<T>(
    method: "GET" | "POST",
    path: string,
    data?: Record<string, any>
  ): Promise<T> {
    const timestamp = Date.now().toString();
    const body = method === "GET" ? "" : JSON.stringify(data || {});

    const signature = this.generateSignature(timestamp, method, path, body);

    const headers: Record<string, string> = {
      "X-BAPI-SIGN": signature,
      "X-BAPI-API-KEY": this.apiKey,
      "X-BAPI-TIMESTAMP": timestamp,
      "Content-Type": "application/json",
    };

    try {
      const response = await this.client({
        method,
        url: path,
        data: method === "POST" ? data : undefined,
        headers,
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `Bybit API Error: ${error.response?.status} - ${JSON.stringify(
            error.response?.data
          )}`
        );
      }
      throw error;
    }
  }

  /**
   * Get account balance
   */
  async getBalance(): Promise<{ coin: string; walletBalance: string }[]> {
    const response = await this.request<any>("GET", "/v5/account/wallet-balance");
    return response.result.list[0].coin;
  }

  /**
   * Get open positions
   */
  async getPositions(symbol?: string): Promise<BybitPosition[]> {
    const params = new URLSearchParams();
    params.append("settleCoin", "USDT");
    if (symbol) {
      params.append("symbol", symbol);
    }

    const response = await this.request<any>(
      "GET",
      `/v5/position/list?${params.toString()}`
    );
    return response.result.list;
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
    const data = {
      category: "linear",
      symbol,
      side,
      orderType,
      qty,
      price: orderType === "Limit" ? price : undefined,
      timeInForce: "GTC",
    };

    const response = await this.request<any>("POST", "/v5/order/create", data);
    return response.result;
  }

  /**
   * Cancel order
   */
  async cancelOrder(symbol: string, orderId: string): Promise<void> {
    await this.request("POST", "/v5/order/cancel", {
      category: "linear",
      symbol,
      orderId,
    });
  }

  /**
   * Get order history
   */
  async getOrderHistory(symbol?: string, limit: number = 50): Promise<BybitOrder[]> {
    const params = new URLSearchParams();
    params.append("category", "linear");
    params.append("limit", limit.toString());
    if (symbol) {
      params.append("symbol", symbol);
    }

    const response = await this.request<any>(
      "GET",
      `/v5/order/history?${params.toString()}`
    );
    return response.result.list;
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
    const params = new URLSearchParams();
    params.append("category", "linear");
    params.append("symbol", symbol);
    params.append("interval", interval);
    params.append("limit", limit.toString());
    if (startTime) {
      params.append("start", startTime.toString());
    }

    const response = await this.request<any>(
      "GET",
      `/v5/market/kline?${params.toString()}`
    );
    return response.result.list;
  }

  /**
   * Get ticker (current price and stats)
   */
  async getTicker(symbol: string): Promise<BybitTicker> {
    const params = new URLSearchParams();
    params.append("category", "linear");
    params.append("symbol", symbol);

    const response = await this.request<any>(
      "GET",
      `/v5/market/tickers?${params.toString()}`
    );
    return response.result.list[0];
  }

  /**
   * Get instrument info
   */
  async getInstruments(symbol?: string): Promise<BybitInstrument[]> {
    const params = new URLSearchParams();
    params.append("category", "linear");
    if (symbol) {
      params.append("symbol", symbol);
    }

    const response = await this.request<any>(
      "GET",
      `/v5/market/instruments-info?${params.toString()}`
    );
    return response.result.list;
  }

  /**
   * Get all trading pairs
   */
  async getAllInstruments(): Promise<BybitInstrument[]> {
    const params = new URLSearchParams();
    params.append("category", "linear");

    const response = await this.request<any>(
      "GET",
      `/v5/market/instruments-info?${params.toString()}`
    );
    return response.result.list;
  }

  /**
   * Set leverage
   */
  async setLeverage(symbol: string, leverage: number): Promise<void> {
    await this.request("POST", "/v5/position/set-leverage", {
      category: "linear",
      symbol,
      buyLeverage: leverage.toString(),
      sellLeverage: leverage.toString(),
    });
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
    const data: Record<string, any> = {
      category: "linear",
      symbol,
      side,
    };

    if (stopLoss) {
      data.stopLoss = stopLoss;
    }
    if (takeProfit) {
      data.takeProfit = takeProfit;
    }

    await this.request("POST", "/v5/position/trading-stop", data);
  }

  /**
   * Get funding rate
   */
  async getFundingRate(symbol: string): Promise<{ fundingRate: string }> {
    const params = new URLSearchParams();
    params.append("category", "linear");
    params.append("symbol", symbol);

    const response = await this.request<any>(
      "GET",
      `/v5/market/funding/history?${params.toString()}`
    );
    return response.result.list[0];
  }
}

/**
 * Create Bybit client instance
 */
export function createBybitClient(config: BybitConfig): BybitClient {
  return new BybitClient(config);
}
