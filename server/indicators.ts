/**
 * Technical Indicators for Trading
 * Implements RSI, MACD, Bollinger Bands, EMA, ADX, and Volume analysis
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

  const changes: number[] = [];
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

  let rsi: number;
  if (avgLoss === 0 && avgGain === 0) {
    rsi = 50;
  } else if (avgLoss === 0) {
    rsi = 100;
  } else if (avgGain === 0) {
    rsi = 0;
  } else {
    const rs = avgGain / avgLoss;
    rsi = 100 - 100 / (1 + rs);
  }

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
  if (prices.length === 0) return [];

  const ema: number[] = [];
  const seedPeriod = Math.max(1, Math.min(period, prices.length));
  const multiplier = 2 / (period + 1);

  // Seed EMA with available SMA to avoid NaN on short arrays
  const seed = prices.slice(0, seedPeriod).reduce((sum, price) => sum + price, 0) / seedPeriod;
  ema[seedPeriod - 1] = seed;

  for (let i = seedPeriod; i < prices.length; i++) {
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
// ADX (Average Directional Index)
// ============================================================================

export interface ADXResult {
  adx: number;
  plusDI: number;
  minusDI: number;
  trendStrength: "WEAK" | "MODERATE" | "STRONG";
  bullish: boolean;
  bearish: boolean;
}

export function calculateADX(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): ADXResult {
  if (highs.length !== lows.length || lows.length !== closes.length) {
    throw new Error("High, low and close arrays must have the same length.");
  }

  if (closes.length < period + 1) {
    throw new Error(
      `Not enough data for ADX calculation. Need at least ${period + 1} candles.`
    );
  }

  const trueRanges: number[] = [];
  const plusDMs: number[] = [];
  const minusDMs: number[] = [];

  for (let i = 1; i < closes.length; i++) {
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];

    plusDMs.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDMs.push(downMove > upMove && downMove > 0 ? downMove : 0);

    const range1 = highs[i] - lows[i];
    const range2 = Math.abs(highs[i] - closes[i - 1]);
    const range3 = Math.abs(lows[i] - closes[i - 1]);
    trueRanges.push(Math.max(range1, range2, range3));
  }

  const smooth = (values: number[]): number[] => {
    const output: number[] = [];
    let rolling = values.slice(0, period).reduce((sum, value) => sum + value, 0);
    output[period - 1] = rolling;

    for (let i = period; i < values.length; i++) {
      rolling = rolling - rolling / period + values[i];
      output[i] = rolling;
    }

    return output;
  };

  const smoothedTR = smooth(trueRanges);
  const smoothedPlusDM = smooth(plusDMs);
  const smoothedMinusDM = smooth(minusDMs);

  const dxValues: number[] = [];
  for (let i = period - 1; i < trueRanges.length; i++) {
    const tr = smoothedTR[i];
    const plusDI = tr > 0 ? (smoothedPlusDM[i] / tr) * 100 : 0;
    const minusDI = tr > 0 ? (smoothedMinusDM[i] / tr) * 100 : 0;
    const sum = plusDI + minusDI;
    const dx = sum === 0 ? 0 : (Math.abs(plusDI - minusDI) / sum) * 100;
    dxValues.push(dx);
  }

  if (dxValues.length === 0) {
    return {
      adx: 0,
      plusDI: 0,
      minusDI: 0,
      trendStrength: "WEAK",
      bullish: false,
      bearish: false,
    };
  }

  const adxPeriod = Math.min(period, dxValues.length);
  let adx = dxValues.slice(0, adxPeriod).reduce((sum, value) => sum + value, 0) / adxPeriod;
  for (let i = adxPeriod; i < dxValues.length; i++) {
    adx = ((adx * (period - 1)) + dxValues[i]) / period;
  }

  const lastSmoothedIndex = trueRanges.length - 1;
  const lastTR = smoothedTR[lastSmoothedIndex];
  const plusDI = lastTR > 0 ? (smoothedPlusDM[lastSmoothedIndex] / lastTR) * 100 : 0;
  const minusDI = lastTR > 0 ? (smoothedMinusDM[lastSmoothedIndex] / lastTR) * 100 : 0;

  let trendStrength: ADXResult["trendStrength"] = "WEAK";
  if (adx >= 25) {
    trendStrength = "STRONG";
  } else if (adx >= 18) {
    trendStrength = "MODERATE";
  }

  return {
    adx: Math.round(adx * 100) / 100,
    plusDI: Math.round(plusDI * 100) / 100,
    minusDI: Math.round(minusDI * 100) / 100,
    trendStrength,
    bullish: plusDI > minusDI,
    bearish: minusDI > plusDI,
  };
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
  const volumeRatio = volumeMA > 0 ? currentVolume / volumeMA : 1;

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
