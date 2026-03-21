import { TradingEngine } from "./tradingEngine";

// Shared trading engines map — used by both routers.ts and _core/index.ts
export const tradingEngines = new Map<string, TradingEngine>();
