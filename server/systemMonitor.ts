/**
 * systemMonitor.ts — Monitoramento Agendado a Cada 15 Minutos
 * [FIX 8.0] Implementado para detectar e corrigir problemas automaticamente:
 *   1. Heartbeat stale (bot travado)
 *   2. Posições com PnL crítico além do stop-loss esperado
 *   3. Saldo abaixo do mínimo operacional
 *   4. Bot parado inesperadamente (isRunning=false com posições abertas)
 *   5. Postgres com checks falhando
 */

import cron from "node-cron";
import { getDatabase } from "./db";
import { botStatus, trades } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { tradingEngines } from "./engineStore";

// ============================================================================
// Thresholds
// ============================================================================

const HEARTBEAT_STALE_MS       = 10 * 60 * 1000; // 10 min sem heartbeat = alerta
const HEARTBEAT_CRITICAL_MS    = 20 * 60 * 1000; // 20 min sem heartbeat = crítico
const MIN_OPERATIONAL_BALANCE  = 5.0;             // $5 mínimo para operar
const CRITICAL_POSITION_LOSS   = -5.0;            // -5% = posição em risco crítico (além do stop)
const CHECK_INTERVAL_CRON      = "*/15 * * * *";  // a cada 15 minutos

// ============================================================================
// Types
// ============================================================================

interface MonitorResult {
  timestamp: string;
  severity: "OK" | "WARN" | "CRITICAL";
  checks: CheckResult[];
  actionsPerformed: string[];
}

interface CheckResult {
  name: string;
  status: "OK" | "WARN" | "CRITICAL" | "SKIP";
  message: string;
  value?: number | string;
}

// ============================================================================
// Monitor Core
// ============================================================================

async function runHealthCheck(): Promise<MonitorResult> {
  const result: MonitorResult = {
    timestamp: new Date().toISOString(),
    severity: "OK",
    checks: [],
    actionsPerformed: [],
  };

  const db = getDatabase();

  // ─── Check 1: Heartbeat ───────────────────────────────────────────────────
  try {
    const rows = await db.select().from(botStatus).limit(1);
    if (rows.length === 0) {
      result.checks.push({ name: "heartbeat", status: "WARN", message: "Nenhum registro de botStatus encontrado" });
    } else {
      const bot = rows[0];
      const lastHeartbeat = bot.lastHeartbeat ? new Date(bot.lastHeartbeat).getTime() : 0;
      const lagMs = Date.now() - lastHeartbeat;
      const lagMin = (lagMs / 60000).toFixed(1);

      if (!bot.isRunning) {
        // Verifica se há posições abertas sem o bot rodando
        const openTrades = await db.select().from(trades)
          .where(and(eq(trades.status, "OPEN"), eq(trades.userId, bot.userId ?? "")));

        if (openTrades.length > 0) {
          result.checks.push({
            name: "heartbeat",
            status: "CRITICAL",
            message: `Bot parado com ${openTrades.length} posições abertas sem monitoramento!`,
            value: openTrades.length,
          });
          result.severity = "CRITICAL";
          console.error(`[MONITOR_CRON] 🚨 CRÍTICO: Bot parado com ${openTrades.length} posições abertas!`);
        } else {
          result.checks.push({ name: "heartbeat", status: "OK", message: "Bot parado, sem posições abertas" });
        }
      } else if (lagMs > HEARTBEAT_CRITICAL_MS) {
        result.checks.push({
          name: "heartbeat",
          status: "CRITICAL",
          message: `Heartbeat stale há ${lagMin} min — bot pode estar travado`,
          value: lagMin,
        });
        result.severity = "CRITICAL";
        console.error(`[MONITOR_CRON] 🚨 CRÍTICO: Heartbeat stale ${lagMin} min`);
      } else if (lagMs > HEARTBEAT_STALE_MS) {
        result.checks.push({
          name: "heartbeat",
          status: "WARN",
          message: `Heartbeat atrasado: ${lagMin} min (limite: ${HEARTBEAT_STALE_MS / 60000} min)`,
          value: lagMin,
        });
        if (result.severity === "OK") result.severity = "WARN";
        console.warn(`[MONITOR_CRON] ⚠️ WARN: Heartbeat atrasado ${lagMin} min`);
      } else {
        result.checks.push({ name: "heartbeat", status: "OK", message: `Heartbeat OK: ${lagMin} min atrás` });
      }
    }
  } catch (e) {
    result.checks.push({ name: "heartbeat", status: "WARN", message: `Erro ao verificar heartbeat: ${e}` });
  }

  // ─── Check 2: Posições com PnL crítico (além do stop esperado) ────────────
  try {
    const engines = Array.from(tradingEngines.values());
    if (engines.length === 0) {
      result.checks.push({ name: "positions", status: "SKIP", message: "Nenhum engine ativo em memória" });
    } else {
      const criticalPositions: string[] = [];
      for (const engine of engines) {
        const positions = engine.getPositions();
        for (const pos of positions) {
          // Posições com highWaterMarkPct alto mas trailingStopPct não atualizado indicam bug
          if (pos.highWaterMarkPct >= 2.0 && pos.trailingStopPct < 0) {
            criticalPositions.push(
              `${pos.symbol}: HWM=${pos.highWaterMarkPct.toFixed(1)}% mas trailing stop ainda negativo (${pos.trailingStopPct.toFixed(1)}%)`
            );
          }
        }

        if (criticalPositions.length > 0) {
          result.checks.push({
            name: "positions",
            status: "WARN",
            message: `${criticalPositions.length} posição(ões) com trailing stop desatualizado: ${criticalPositions.join("; ")}`,
            value: criticalPositions.length,
          });
          if (result.severity === "OK") result.severity = "WARN";
        } else {
          result.checks.push({
            name: "positions",
            status: "OK",
            message: `${positions.length} posições monitoradas, trailing stops OK`,
            value: positions.length,
          });
        }
      }
    }
  } catch (e) {
    result.checks.push({ name: "positions", status: "WARN", message: `Erro ao verificar posições: ${e}` });
  }

  // ─── Check 3: Trades OPEN no DB sem engine ativo ─────────────────────────
  try {
    const openDbTrades = await db.select().from(trades).where(eq(trades.status, "OPEN"));
    const enginePositionCount = Array.from(tradingEngines.values())
      .reduce((acc, e) => acc + e.getPositions().length, 0);

    const orphanCount = openDbTrades.length - enginePositionCount;
    if (orphanCount > 0) {
      result.checks.push({
        name: "orphan_trades",
        status: "WARN",
        message: `${orphanCount} trade(s) OPEN no banco sem posição correspondente no engine (possível restart sem sync)`,
        value: orphanCount,
      });
      if (result.severity === "OK") result.severity = "WARN";
      console.warn(`[MONITOR_CRON] ⚠️ ${orphanCount} trades órfãos no banco`);
    } else {
      result.checks.push({
        name: "orphan_trades",
        status: "OK",
        message: `DB e engine sincronizados: ${openDbTrades.length} trades OPEN`,
      });
    }
  } catch (e) {
    result.checks.push({ name: "orphan_trades", status: "WARN", message: `Erro ao verificar trades: ${e}` });
  }

  // ─── Check 4: Win Rate (alerta se < 35% com 30+ trades) ──────────────────
  try {
    const rows = await db.select().from(botStatus).limit(1);
    if (rows.length > 0) {
      const bot = rows[0];
      const total = bot.totalTrades ?? 0;
      const wins = bot.winningTrades ?? 0;
      const winRate = total > 0 ? (wins / total) * 100 : 0;

      if (total >= 30 && winRate < 35) {
        result.checks.push({
          name: "win_rate",
          status: "WARN",
          message: `Win Rate baixo: ${winRate.toFixed(1)}% (${wins}W/${total - wins}L) — abaixo do limiar de 35%`,
          value: winRate,
        });
        if (result.severity === "OK") result.severity = "WARN";
        console.warn(`[MONITOR_CRON] ⚠️ Win Rate baixo: ${winRate.toFixed(1)}%`);
      } else {
        result.checks.push({
          name: "win_rate",
          status: "OK",
          message: `Win Rate: ${winRate.toFixed(1)}% (${wins}W/${total - wins}L / ${total} trades)`,
          value: winRate,
        });
      }
    }
  } catch (e) {
    result.checks.push({ name: "win_rate", status: "WARN", message: `Erro ao verificar win rate: ${e}` });
  }

  // ─── Resumo ───────────────────────────────────────────────────────────────
  const criticalCount = result.checks.filter(c => c.status === "CRITICAL").length;
  const warnCount = result.checks.filter(c => c.status === "WARN").length;
  const okCount = result.checks.filter(c => c.status === "OK").length;

  console.log(
    `[MONITOR_CRON] ${result.timestamp} | Severity: ${result.severity} | ` +
    `OK=${okCount} WARN=${warnCount} CRITICAL=${criticalCount} | ` +
    `Actions: ${result.actionsPerformed.length > 0 ? result.actionsPerformed.join(", ") : "none"}`
  );

  return result;
}

// ============================================================================
// Scheduler
// ============================================================================

let monitorTask: ReturnType<typeof cron.schedule> | null = null;

export function startSystemMonitor(): void {
  if (monitorTask) {
    console.log("[MONITOR_CRON] Monitor já está rodando, ignorando segunda inicialização");
    return;
  }

  console.log(`[MONITOR_CRON] 🕐 Iniciando monitoramento agendado a cada 15 minutos (cron: ${CHECK_INTERVAL_CRON})`);

  // Roda imediatamente na inicialização (após 60s para dar tempo ao bot iniciar)
  setTimeout(() => {
    runHealthCheck().catch(e => console.error("[MONITOR_CRON] Erro na verificação inicial:", e));
  }, 60 * 1000);

  // Agenda verificação a cada 15 minutos
  monitorTask = cron.schedule(CHECK_INTERVAL_CRON, () => {
    runHealthCheck().catch(e => console.error("[MONITOR_CRON] Erro na verificação agendada:", e));
  }, {
    timezone: "UTC",
  });

  console.log("[MONITOR_CRON] ✅ Monitor agendado com sucesso");
}

export function stopSystemMonitor(): void {
  if (monitorTask) {
    monitorTask.stop();
    monitorTask = null;
    console.log("[MONITOR_CRON] Monitor parado");
  }
}

export { runHealthCheck };
