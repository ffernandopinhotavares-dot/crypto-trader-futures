/**
 * Technical Indicators for Trading
 * Implements RSI, MACD, Bollinger Bands, EMA, and Volume analysis
 */

// ============================================================================
// RSI (Relative Strength Index)
// ============================================================================

export interface RSIResult {
  rsi: number;
  overbought: boolean;
  oversold: boolean;
}

export function calculateRSI(
  prices: number[],
  period: number = 14
): RSIResult {
  if (prices.length < period + 1) {
    throw new Error(
      `Not enough data for RSI calculation. Need at least ${period + 1} prices.`
    );
  }

  const changes = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }

  let gains = 0;
  let losses = 0;

  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) {
      gains += changes[i];
    } else {
      losses += Math.abs(changes[i]);
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period; i < changes.length; i++) {
    if (changes[i] > 0) {
      avgGain = (avgGain * (period - 1) + changes[i]) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(changes[i])) / period;
    }
  }

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);

  return {
    rsi: Math.round(rsi * 100) / 100,
    overbought: rsi > 70,
    oversold: rsi < 30,
  };
}

// ============================================================================
// MACD (Moving Average Convergence Divergence)
// ============================================================================

export interface MACDResult {
  macdLine: number;
  signalLine: number;
  histogram: number;
  bullish: boolean;
  bearish: boolean;
}

function calculateEMA(prices: number[], period: number): number[] {
  const ema: number[] = [];
  const multiplier = 2 / (period + 1);

  // First EMA is SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += prices[i];
  }
  ema[period - 1] = sum / period;

  // Calculate rest of EMA
  for (let i = period; i < prices.length; i++) {
    ema[i] = prices[i] * multiplier + ema[i - 1] * (1 - multiplier);
  }

  return ema;
}

export function calculateMACD(
  prices: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDResult {
  if (prices.length < slowPeriod) {
    throw new Error(
      `Not enough data for MACD calculation. Need at least ${slowPeriod} prices.`
    );
  }

  const fastEMA = calculateEMA(prices, fastPeriod);
  const slowEMA = calculateEMA(prices, slowPeriod);

  const macdLine: number[] = [];
  for (let i = slowPeriod - 1; i < prices.length; i++) {
    macdLine.push(fastEMA[i] - slowEMA[i]);
  }

  const signalEMA = calculateEMA(macdLine, signalPeriod);
  const lastSignalLine =
    signalEMA[signalEMA.length - 1] || macdLine[macdLine.length - 1];
  const lastMACDLine = macdLine[macdLine.length - 1];
  const histogram = lastMACDLine - lastSignalLine;

  return {
    macdLine: Math.round(lastMACDLine * 10000) / 10000,
    signalLine: Math.round(lastSignalLine * 10000) / 10000,
    histogram: Math.round(histogram * 10000) / 10000,
    bullish: lastMACDLine > lastSignalLine,
    bearish: lastMACDLine < lastSignalLine,
  };
}

// ============================================================================
// Bollinger Bands
// ============================================================================

export interface BollingerBandsResult {
  upper: number;
  middle: number;
  lower: number;
  width: number;
  position: number; // 0-100, where 0 is lower band, 100 is upper band
}

export function calculateBollingerBands(
  prices: number[],
  period: number = 20,
  stdDev: number = 2
): BollingerBandsResult {
  if (prices.length < period) {
    throw new Error(
      `Not enough data for Bollinger Bands calculation. Need at least ${period} prices.`
    );
  }

  const lastPrices = prices.slice(-period);

  // Calculate SMA (middle band)
  const sum = lastPrices.reduce((a, b) => a + b, 0);
  const middle = sum / period;

  // Calculate standard deviation
  const squaredDiffs = lastPrices.map((price) => Math.pow(price - middle, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
  const std = Math.sqrt(variance);

  const upper = middle + std * stdDev;
  const lower = middle - std * stdDev;
  const width = upper - lower;

  const currentPrice = prices[prices.length - 1];
  const position =
    width === 0 ? 50 : ((currentPrice - lower) / width) * 100;

  return {
    upper: Math.round(upper * 100) / 100,
    middle: Math.round(middle * 100) / 100,
    lower: Math.round(lower * 100) / 100,
    width: Math.round(width * 100) / 100,
    position: Math.min(100, Math.max(0, Math.round(position * 100) / 100)),
  };
}

// ============================================================================
// EMA (Exponential Moving Average)
// ============================================================================

export function calculateEMAValue(
  prices: number[],
  period: number = 50
): number {
  if (prices.length < period) {
    throw new Error(
      `Not enough data for EMA calculation. Need at least ${period} prices.`
    );
  }

  const ema = calculateEMA(prices, period);
  return Math.round(ema[ema.length - 1] * 100) / 100;
}

// ============================================================================
// Volume Analysis
// ============================================================================

export interface VolumeAnalysis {
  volumeMA: number;
  currentVolume: number;
  volumeRatio: number;
  highVolume: boolean;
}

export function analyzeVolume(
  volumes: number[],
  period: number = 20
): VolumeAnalysis {
  if (volumes.length < period) {
    throw new Error(
      `Not enough data for volume analysis. Need at least ${period} volumes.`
    );
  }

  const lastVolumes = volumes.slice(-period);
  const volumeMA = lastVolumes.reduce((a, b) => a + b, 0) / period;
  const currentVolume = volumes[volumes.length - 1];
  const volumeRatio = currentVolume / volumeMA;

  return {
    volumeMA: Math.round(volumeMA * 100) / 100,
    currentVolume: Math.round(currentVolume * 100) / 100,
    volumeRatio: Math.round(volumeRatio * 100) / 100,
    highVolume: volumeRatio > 1.5,
  };
}

// ============================================================================
// Combined Signal Analysis
// ============================================================================

export interface TradingSignal {
  strength: number; // -100 to 100, negative = sell, positive = buy
  signals: {
    rsi: number; // -1, 0, 1
    macd: number; // -1, 0, 1
    bollinger: number; // -1, 0, 1
    volume: number; // -1, 0, 1
  };
  recommendation: "STRONG_BUY" | "BUY" | "NEUTRAL" | "SELL" | "STRONG_SELL";
}

export function generateTradingSignal(
  prices: number[],
  volumes: number[],
  rsiConfig: { period: number; overbought: number; oversold: number },
  macdConfig: { fast: number; slow: number; signal: number },
  bbConfig: { period: number; stdDev: number }
): TradingSignal {
  let signalScore = 0;
  const signals = {
    rsi: 0,
    macd: 0,
    bollinger: 0,
    volume: 0,
  };

  // RSI Signal
  try {
    const rsi = calculateRSI(prices, rsiConfig.period);
    if (rsi.oversold) {
      signals.rsi = 1; // Buy signal
      signalScore += 25;
    } else if (rsi.overbought) {
      signals.rsi = -1; // Sell signal
      signalScore -= 25;
    }
  } catch (e) {
    // Not enough data
  }

  // MACD Signal
  try {
    const macd = calculateMACD(
      prices,
      macdConfig.fast,
      macdConfig.slow,
      macdConfig.signal
    );
    if (macd.bullish && macd.histogram > 0) {
      signals.macd = 1;
      signalScore += 25;
    } else if (macd.bearish && macd.histogram < 0) {
      signals.macd = -1;
      signalScore -= 25;
    }
  } catch (e) {
    // Not enough data
  }

  // Bollinger Bands Signal
  try {
    const bb = calculateBollingerBands(
      prices,
      bbConfig.period,
      bbConfig.stdDev
    );
    if (bb.position < 20) {
      signals.bollinger = 1; // Near lower band, buy signal
      signalScore += 25;
    } else if (bb.position > 80) {
      signals.bollinger = -1; // Near upper band, sell signal
      signalScore -= 25;
    }
  } catch (e) {
    // Not enough data
  }

  // Volume Signal
  try {
    const volume = analyzeVolume(volumes);
    if (volume.highVolume) {
      // High volume confirms the trend
      if (signalScore > 0) {
        signals.volume = 1;
        signalScore += 25;
      } else if (signalScore < 0) {
        signals.volume = -1;
        signalScore -= 25;
      }
    }
  } catch (e) {
    // Not enough data
  }

  // Normalize signal score to -100 to 100
  const strength = Math.max(-100, Math.min(100, signalScore));

  let recommendation: TradingSignal["recommendation"];
  if (strength >= 75) {
    recommendation = "STRONG_BUY";
  } else if (strength >= 25) {
    recommendation = "BUY";
  } else if (strength <= -75) {
    recommendation = "STRONG_SELL";
  } else if (strength <= -25) {
    recommendation = "SELL";
  } else {
    recommendation = "NEUTRAL";
  }

  return {
    strength,
    signals,
    recommendation,
  };
}

// ============================================================================
// Volatility Analysis
// ============================================================================

export interface VolatilityAnalysis {
  volatility: number; // Percentage
  trend: "HIGH" | "NORMAL" | "LOW";
}

export function analyzeVolatility(
  prices: number[],
  period: number = 20
): VolatilityAnalysis {
  if (prices.length < period) {
    throw new Error(
      `Not enough data for volatility analysis. Need at least ${period} prices.`
    );
  }

  const lastPrices = prices.slice(-period);
  const returns: number[] = [];

  for (let i = 1; i < lastPrices.length; i++) {
    const ret = (lastPrices[i] - lastPrices[i - 1]) / lastPrices[i - 1];
    returns.push(ret);
  }

  const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((sum, ret) => sum + Math.pow(ret - meanReturn, 2), 0) /
    returns.length;
  const volatility = Math.sqrt(variance) * 100;

  let trend: VolatilityAnalysis["trend"];
  if (volatility > 5) {
    trend = "HIGH";
  } else if (volatility > 2) {
    trend = "NORMAL";
  } else {
    trend = "LOW";
  }

  return {
    volatility: Math.round(volatility * 100) / 100,
    trend,
  };
}
