import { useState, useEffect } from "react";
import { trpc } from "../App";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area,
} from "recharts";
import { DollarSign, TrendingUp, BarChart2, Activity, Zap } from "lucide-react";

interface DashboardPageProps {
  onStartBot?: () => void;
}

// Neon card component
function NeonCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "#0d1117",
      border: "1px solid #00ff8820",
      borderRadius: "8px",
      padding: "20px",
      ...style,
    }}>
      {children}
    </div>
  );
}

// Balance bar at the top
function BalanceBar({ balance }: { balance: any }) {
  const total = balance?.total ?? "—";
  const available = balance?.available ?? "—";
  const margin = balance?.margin ?? "—";
  const unrealizedPnl = balance?.unrealizedPnl ?? "—";
  const openPositions = balance?.openPositions ?? 0;

  const pnlNum = typeof unrealizedPnl === "number" ? unrealizedPnl : parseFloat(unrealizedPnl);
  const pnlColor = !isNaN(pnlNum) && pnlNum < 0 ? "#ff4466" : "#00ff88";

  return (
    <NeonCard style={{ padding: "16px 20px", marginBottom: "20px" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px",
      }}>
        <DollarSign size={14} style={{ color: "#00ff88" }} />
        <span style={{
          fontSize: "11px", color: "#00ff8888", fontFamily: "Courier New, monospace",
          letterSpacing: "1px", textTransform: "uppercase",
        }}>
          SALDO BYBIT (AO VIVO)
        </span>
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: "16px",
      }}>
        <BalanceItem label="Total" value={`$${typeof total === "number" ? total.toFixed(2) : total} USDT`} color="#00ff88" />
        <BalanceItem label="Disponível" value={`$${typeof available === "number" ? available.toFixed(2) : available} USDT`} color="#00ff88" />
        <BalanceItem label="Saldo de Margem" value={`$${typeof margin === "number" ? margin.toFixed(2) : margin} USDT`} color="#00ff88" />
        <BalanceItem
          label="P&L não realizado"
          value={`${!isNaN(pnlNum) && pnlNum >= 0 ? "+" : ""}${typeof unrealizedPnl === "number" ? unrealizedPnl.toFixed(4) : unrealizedPnl} USDT`}
          color={pnlColor}
        />
        <BalanceItem label="Posições abertas" value={String(openPositions)} color="#ffffff" />
      </div>
    </NeonCard>
  );
}

function BalanceItem({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <p style={{ fontSize: "11px", color: "#00ff8855", fontFamily: "Courier New, monospace", marginBottom: "4px" }}>
        {label}
      </p>
      <p style={{ fontSize: "15px", fontWeight: "700", color, fontFamily: "Courier New, monospace" }}>
        {value}
      </p>
    </div>
  );
}

// Metric card
function MetricCard({
  icon: Icon,
  label,
  value,
  color = "#00ff88",
}: {
  icon: any;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <NeonCard style={{ padding: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
        <Icon size={14} style={{ color: "#00ff8866" }} />
        <span style={{ fontSize: "11px", color: "#00ff8866", fontFamily: "Courier New, monospace", letterSpacing: "0.5px" }}>
          {label}
        </span>
      </div>
      <p style={{ fontSize: "26px", fontWeight: "700", color, fontFamily: "Courier New, monospace" }}>
        {value}
      </p>
    </NeonCard>
  );
}

// Custom tooltip for recharts
function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: "#0d1117", border: "1px solid #00ff8833",
        borderRadius: "6px", padding: "8px 12px",
        fontFamily: "Courier New, monospace", fontSize: "12px",
      }}>
        <p style={{ color: "#00ff8866", marginBottom: "4px" }}>{label}</p>
        <p style={{ color: payload[0].value >= 0 ? "#00ff88" : "#ff4466" }}>
          {payload[0].value >= 0 ? "+" : ""}{payload[0].value.toFixed(2)} USDT
        </p>
      </div>
    );
  }
  return null;
}

export function DashboardPage({ onStartBot }: DashboardPageProps) {
  const { data: botStatus, refetch: refetchStatus } = trpc.botControl.getStatus.useQuery(undefined, {
    refetchInterval: 5000,
  });
  const { data: tradeStats, refetch: refetchStats } = trpc.trades.getStats.useQuery(undefined, {
    refetchInterval: 10000,
  });
  const { data: recentTrades } = trpc.trades.getRecent.useQuery({ limit: 10 }, {
    refetchInterval: 10000,
  });
  const { data: configs } = trpc.tradingConfig.getAll.useQuery();
  const { mutate: startBot, isPending: isStarting } = trpc.botControl.start.useMutation({
    onSuccess: () => refetchStatus(),
  });

  const isRunning = botStatus?.isRunning ?? false;
  const activeConfig = configs?.[0];

  // Generate P&L chart data from recent trades
  const pnlChartData = (() => {
    if (!recentTrades || recentTrades.length === 0) {
      // Generate flat placeholder data
      return Array.from({ length: 10 }, (_, i) => ({
        label: `${i * 3}d`,
        pnl: 0,
      }));
    }
    let cumulative = 0;
    const points = recentTrades
      .filter((t: any) => t.status === "CLOSED" && t.pnl)
      .slice()
      .reverse()
      .map((t: any) => {
        cumulative += parseFloat(t.pnl || "0");
        return {
          label: new Date(t.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
          pnl: parseFloat(cumulative.toFixed(2)),
        };
      });
    if (points.length === 0) {
      return Array.from({ length: 7 }, (_, i) => ({ label: `${i + 1}d`, pnl: 0 }));
    }
    return points;
  })();

  const handleStartBot = () => {
    const configId = activeConfig?.id;
    if (!configId) {
      alert("Nenhuma configuração encontrada. Crie uma na aba Configuração.");
      return;
    }
    startBot({ configId });
  };

  const totalPnl = tradeStats?.totalPnl ?? 0;
  const todayPnl = tradeStats?.todayPnl ?? 0;
  const winRate = tradeStats?.winRate ?? 0;
  const totalTrades = (tradeStats?.closedTrades ?? 0) + (tradeStats?.openTrades ?? 0);

  const pnlColor = totalPnl >= 0 ? "#00ff88" : "#ff4466";
  const todayPnlColor = todayPnl >= 0 ? "#00ff88" : "#ff4466";

  return (
    <div style={{ fontFamily: "Courier New, monospace" }}>
      {/* Balance bar */}
      <BalanceBar balance={null} />

      {/* Metric cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "16px",
        marginBottom: "20px",
      }}>
        <MetricCard
          icon={DollarSign}
          label="$ P&L Hoje"
          value={`${todayPnl >= 0 ? "+" : ""}${todayPnl.toFixed(2)} USDT`}
          color={todayPnlColor}
        />
        <MetricCard
          icon={TrendingUp}
          label="~ P&L Total"
          value={`${totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)} USDT`}
          color={pnlColor}
        />
        <MetricCard
          icon={BarChart2}
          label="| Total Trades"
          value={totalTrades.toFixed(2)}
          color="#00ff88"
        />
        <MetricCard
          icon={Activity}
          label="~ Win Rate"
          value={`${winRate.toFixed(1)}%`}
          color="#ffffff"
        />
      </div>

      {/* Start bot button (only when stopped) */}
      {!isRunning && (
        <div style={{ marginBottom: "20px" }}>
          <button
            onClick={handleStartBot}
            disabled={isStarting}
            style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "10px 20px", borderRadius: "6px",
              background: "#00ff8815", border: "1px solid #00ff8840",
              color: "#00ff88", fontSize: "13px",
              fontFamily: "Courier New, monospace", fontWeight: "600",
              cursor: isStarting ? "not-allowed" : "pointer",
              opacity: isStarting ? 0.6 : 1,
            }}
          >
            <Zap size={15} />
            {isStarting ? "Iniciando..." : "Iniciar Bot"}
          </button>
        </div>
      )}

      {/* Active config info */}
      {activeConfig && (
        <div style={{
          marginBottom: "20px", padding: "10px 16px",
          background: "#0d1117", border: "1px solid #00ff8815",
          borderRadius: "6px", fontSize: "12px", color: "#00ff8866",
        }}>
          Config ativa: <span style={{ color: "#00ff88" }}>{activeConfig.name}</span>
          {" | "}Pares: <span style={{ color: "#00ff88" }}>
            {Array.isArray(activeConfig.tradingPairs)
              ? activeConfig.tradingPairs.join(", ")
              : "N/A"}
          </span>
          {" | "}Timeframe: <span style={{ color: "#00ff88" }}>{activeConfig.timeframe}</span>
          {" | "}Status:{" "}
          <span style={{ color: isRunning ? "#00ff88" : "#ff4466" }}>
            {isRunning ? "● ATIVO" : "○ PARADO"}
          </span>
        </div>
      )}

      {/* P&L Chart */}
      <NeonCard style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
          <TrendingUp size={14} style={{ color: "#00ff8866" }} />
          <span style={{ fontSize: "12px", color: "#00ff8888", letterSpacing: "0.5px" }}>
            P&L — últimos 30 dias
          </span>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={pnlChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00ff88" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#00ff88" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#00ff8810" />
            <XAxis
              dataKey="label"
              stroke="#00ff8830"
              tick={{ fill: "#00ff8855", fontSize: 10, fontFamily: "Courier New" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              stroke="#00ff8830"
              tick={{ fill: "#00ff8855", fontSize: 10, fontFamily: "Courier New" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="pnl"
              stroke="#00ff88"
              strokeWidth={2}
              fill="url(#pnlGradient)"
              dot={{ fill: "#00ff88", r: 3, strokeWidth: 0 }}
              activeDot={{ fill: "#00ff88", r: 5, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </NeonCard>

      {/* Recent trades table */}
      <NeonCard>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
          <BarChart2 size={14} style={{ color: "#00ff8866" }} />
          <span style={{ fontSize: "12px", color: "#00ff8888", letterSpacing: "0.5px" }}>
            Operações Recentes
          </span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #00ff8815" }}>
                {["Par", "Lado", "Entrada", "Qtd", "P&L", "Status"].map((h) => (
                  <th key={h} style={{
                    padding: "8px 12px", textAlign: "left",
                    color: "#00ff8855", fontWeight: "600",
                    fontFamily: "Courier New, monospace",
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentTrades && recentTrades.length > 0 ? (
                recentTrades.map((trade: any) => {
                  const pnl = trade.pnl ? parseFloat(trade.pnl) : null;
                  const pnlColor = pnl !== null ? (pnl >= 0 ? "#00ff88" : "#ff4466") : "#4a7a5a";
                  return (
                    <tr
                      key={trade.id}
                      style={{ borderBottom: "1px solid #00ff8808" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#00ff8806")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "8px 12px", color: "#00ff88", fontWeight: "600" }}>{trade.symbol}</td>
                      <td style={{ padding: "8px 12px" }}>
                        <span style={{
                          padding: "2px 8px", borderRadius: "3px", fontSize: "11px",
                          background: trade.side === "BUY" ? "#00ff8815" : "#ff446615",
                          color: trade.side === "BUY" ? "#00ff88" : "#ff4466",
                          border: `1px solid ${trade.side === "BUY" ? "#00ff8830" : "#ff446630"}`,
                        }}>
                          {trade.side}
                        </span>
                      </td>
                      <td style={{ padding: "8px 12px", color: "#00ff8888" }}>
                        ${parseFloat(trade.entryPrice).toFixed(2)}
                      </td>
                      <td style={{ padding: "8px 12px", color: "#00ff8888" }}>
                        {parseFloat(trade.quantity).toFixed(4)}
                      </td>
                      <td style={{ padding: "8px 12px", color: pnlColor, fontWeight: "600" }}>
                        {pnl !== null ? `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}` : "—"}
                      </td>
                      <td style={{ padding: "8px 12px" }}>
                        <span style={{
                          padding: "2px 8px", borderRadius: "3px", fontSize: "11px",
                          background: trade.status === "OPEN" ? "#00ff8815" : "#ffffff10",
                          color: trade.status === "OPEN" ? "#00ff88" : "#ffffff55",
                          border: `1px solid ${trade.status === "OPEN" ? "#00ff8830" : "#ffffff15"}`,
                        }}>
                          {trade.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} style={{
                    padding: "32px", textAlign: "center",
                    color: "#00ff8833", fontFamily: "Courier New, monospace",
                  }}>
                    Nenhuma operação registrada ainda
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </NeonCard>
    </div>
  );
}
