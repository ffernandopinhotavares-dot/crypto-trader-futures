import { useState, useEffect } from "react";
import { trpc } from "../App";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area,
} from "recharts";
import { DollarSign, TrendingUp, BarChart2, Activity, Zap, AlertTriangle, Square, XCircle } from "lucide-react";

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

// Balance bar at the top — LIVE from Gate.io
function BalanceBar() {
  const { data: balance } = trpc.marketData.getBalance.useQuery(undefined, {
    refetchInterval: 5000, // refresh every 5s
  });
  const { data: positions } = trpc.marketData.getPositions.useQuery(undefined, {
    refetchInterval: 5000,
  });

  const total = balance?.balance ?? "—";
  const available = balance?.available ?? "—";
  const margin = balance?.marginBalance ?? "—";
  const unrealizedPnl = balance?.unrealizedPnl ?? "—";
  const openPositions = positions?.length ?? 0;

  const pnlNum = typeof unrealizedPnl === "string" ? parseFloat(unrealizedPnl) : unrealizedPnl;
  const pnlColor = !isNaN(pnlNum) && pnlNum < 0 ? "#ff4466" : "#00ff88";

  const formatUsd = (val: string | number) => {
    const n = typeof val === "string" ? parseFloat(val) : val;
    return isNaN(n) ? "—" : n.toFixed(2);
  };

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
          SALDO GATE.IO FUTURES (AO VIVO)
        </span>
        <span style={{
          marginLeft: "auto", fontSize: "10px", color: "#00ff8844",
          fontFamily: "Courier New, monospace",
        }}>
          Atualiza a cada 5s
        </span>
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: "16px",
      }}>
        <BalanceItem label="Total" value={`$${formatUsd(total)} USDT`} color="#00ff88" />
        <BalanceItem label="Disponivel" value={`$${formatUsd(available)} USDT`} color="#00ff88" />
        <BalanceItem label="Saldo de Margem" value={`$${formatUsd(margin)} USDT`} color="#00ff88" />
        <BalanceItem
          label="P&L nao realizado"
          value={`${!isNaN(pnlNum) && pnlNum >= 0 ? "+" : ""}${formatUsd(unrealizedPnl)} USDT`}
          color={pnlColor}
        />
        <BalanceItem label="Posicoes abertas" value={String(openPositions)} color="#ffffff" />
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

// Live positions table
function LivePositions() {
  const { data: positions } = trpc.marketData.getPositions.useQuery(undefined, {
    refetchInterval: 5000,
  });

  if (!positions || positions.length === 0) return null;

  return (
    <NeonCard style={{ marginBottom: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
        <Activity size={14} style={{ color: "#00ff8866" }} />
        <span style={{ fontSize: "12px", color: "#00ff8888", letterSpacing: "0.5px" }}>
          Posicoes Abertas (Tempo Real)
        </span>
        <span style={{
          marginLeft: "auto", fontSize: "11px", padding: "2px 8px",
          borderRadius: "3px", background: "#00ff8815", color: "#00ff88",
          border: "1px solid #00ff8830",
        }}>
          {positions.length} ativas
        </span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #00ff8815" }}>
              {["Par", "Lado", "Tamanho", "Entrada", "Marca", "P&L", "Alavancagem"].map((h) => (
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
            {positions.map((pos: any, i: number) => {
              const pnl = parseFloat(pos.unrealizedPnl || "0");
              const pnlColor = pnl >= 0 ? "#00ff88" : "#ff4466";
              return (
                <tr
                  key={`${pos.symbol}-${pos.side}-${i}`}
                  style={{ borderBottom: "1px solid #00ff8808" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#00ff8806")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: "8px 12px", color: "#00ff88", fontWeight: "600" }}>{pos.symbol}</td>
                  <td style={{ padding: "8px 12px" }}>
                    <span style={{
                      padding: "2px 8px", borderRadius: "3px", fontSize: "11px",
                      background: pos.side === "LONG" ? "#00ff8815" : "#ff446615",
                      color: pos.side === "LONG" ? "#00ff88" : "#ff4466",
                      border: `1px solid ${pos.side === "LONG" ? "#00ff8830" : "#ff446630"}`,
                    }}>
                      {pos.side}
                    </span>
                  </td>
                  <td style={{ padding: "8px 12px", color: "#00ff8888" }}>{pos.size}</td>
                  <td style={{ padding: "8px 12px", color: "#00ff8888" }}>
                    ${parseFloat(pos.entryPrice).toFixed(4)}
                  </td>
                  <td style={{ padding: "8px 12px", color: "#00ff8888" }}>
                    ${parseFloat(pos.markPrice).toFixed(4)}
                  </td>
                  <td style={{ padding: "8px 12px", color: pnlColor, fontWeight: "600" }}>
                    {pnl >= 0 ? "+" : ""}{pnl.toFixed(4)} USDT
                  </td>
                  <td style={{ padding: "8px 12px", color: "#00ff8888" }}>{pos.leverage}x</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </NeonCard>
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
  const { data: tradeStats } = trpc.trades.getStats.useQuery(undefined, {
    refetchInterval: 10000,
  });
  const { data: recentTrades } = trpc.trades.getRecent.useQuery({ limit: 10 }, {
    refetchInterval: 10000,
  });
  const { data: configs } = trpc.tradingConfig.getAll.useQuery();
  const { mutate: startBot, isPending: isStarting } = trpc.botControl.start.useMutation({
    onSuccess: () => refetchStatus(),
  });
  const { mutate: stopBot, isPending: isStopping } = trpc.botControl.stop.useMutation({
    onSuccess: () => refetchStatus(),
  });
  const { mutate: emergencyClose, isPending: isClosing } = trpc.botControl.emergencyCloseAll.useMutation({
    onSuccess: (data) => {
      refetchStatus();
      const msg = data.closed.length > 0
        ? `Fechadas ${data.closed.length} posicoes: ${data.closed.join(", ")}`
        : "Nenhuma posicao aberta para fechar.";
      const errMsg = data.errors.length > 0
        ? `\nErros: ${data.errors.join(", ")}`
        : "";
      alert(msg + errMsg);
    },
    onError: (err) => {
      alert(`Erro ao fechar posicoes: ${err.message}`);
    },
  });

  const [showEmergencyConfirm, setShowEmergencyConfirm] = useState(false);

  const isRunning = botStatus?.isRunning ?? false;
  const activeConfig = configs?.[0];

  // Generate P&L chart data from recent trades
  const pnlChartData = (() => {
    if (!recentTrades || recentTrades.length === 0) {
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
      alert("Nenhuma configuracao encontrada. Crie uma na aba Configuracao.");
      return;
    }
    startBot({ configId });
  };

  const handleStopBot = () => {
    if (confirm("Deseja parar o bot? Todas as posicoes abertas serao fechadas automaticamente.")) {
      stopBot(undefined as any);
    }
  };

  const handleEmergencyClose = () => {
    setShowEmergencyConfirm(false);
    emergencyClose(undefined as any);
  };

  const totalPnl = tradeStats?.totalPnl ?? 0;
  const todayPnl = 0;
  const winRate = tradeStats?.winRate ?? 0;
  const totalTrades = (tradeStats?.closedTrades ?? 0) + (tradeStats?.openTrades ?? 0);

  const pnlColor = totalPnl >= 0 ? "#00ff88" : "#ff4466";
  const todayPnlColor = todayPnl >= 0 ? "#00ff88" : "#ff4466";

  return (
    <div style={{ fontFamily: "Courier New, monospace" }}>
      {/* Balance bar — LIVE */}
      <BalanceBar />

      {/* Control buttons */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
        {/* Start / Stop bot button */}
        {!isRunning ? (
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
        ) : (
          <button
            onClick={handleStopBot}
            disabled={isStopping}
            style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "10px 20px", borderRadius: "6px",
              background: "#ff446615", border: "1px solid #ff446640",
              color: "#ff4466", fontSize: "13px",
              fontFamily: "Courier New, monospace", fontWeight: "600",
              cursor: isStopping ? "not-allowed" : "pointer",
              opacity: isStopping ? 0.6 : 1,
            }}
          >
            <Square size={15} />
            {isStopping ? "Parando..." : "Parar Bot"}
          </button>
        )}

        {/* Emergency close button — ALWAYS visible */}
        <button
          onClick={() => setShowEmergencyConfirm(true)}
          disabled={isClosing}
          style={{
            display: "flex", alignItems: "center", gap: "8px",
            padding: "10px 20px", borderRadius: "6px",
            background: "#ff220015", border: "1px solid #ff220040",
            color: "#ff6633", fontSize: "13px",
            fontFamily: "Courier New, monospace", fontWeight: "600",
            cursor: isClosing ? "not-allowed" : "pointer",
            opacity: isClosing ? 0.6 : 1,
          }}
        >
          <AlertTriangle size={15} />
          {isClosing ? "Fechando..." : "Fechar Tudo (Emergencia)"}
        </button>
      </div>

      {/* Emergency confirmation modal */}
      {showEmergencyConfirm && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.8)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 9999,
        }}>
          <div style={{
            background: "#0d1117", border: "2px solid #ff4466",
            borderRadius: "12px", padding: "32px", maxWidth: "440px",
            textAlign: "center",
          }}>
            <AlertTriangle size={48} style={{ color: "#ff4466", marginBottom: "16px" }} />
            <h3 style={{ color: "#ff4466", fontSize: "18px", marginBottom: "12px" }}>
              Fechamento de Emergencia
            </h3>
            <p style={{ color: "#ffffff88", fontSize: "13px", marginBottom: "24px", lineHeight: "1.6" }}>
              Isso vai <strong style={{ color: "#ff4466" }}>fechar TODAS as posicoes abertas</strong> na Gate.io
              imediatamente a preco de mercado e parar o bot.
              <br /><br />
              Esta acao nao pode ser desfeita.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button
                onClick={() => setShowEmergencyConfirm(false)}
                style={{
                  padding: "10px 24px", borderRadius: "6px",
                  background: "#ffffff10", border: "1px solid #ffffff20",
                  color: "#ffffff88", fontSize: "13px",
                  fontFamily: "Courier New, monospace", cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleEmergencyClose}
                style={{
                  padding: "10px 24px", borderRadius: "6px",
                  background: "#ff446630", border: "1px solid #ff4466",
                  color: "#ff4466", fontSize: "13px", fontWeight: "700",
                  fontFamily: "Courier New, monospace", cursor: "pointer",
                }}
              >
                CONFIRMAR FECHAMENTO
              </button>
            </div>
          </div>
        </div>
      )}

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
          value={String(totalTrades)}
          color="#00ff88"
        />
        <MetricCard
          icon={Activity}
          label="~ Win Rate"
          value={`${winRate.toFixed(1)}%`}
          color="#ffffff"
        />
      </div>

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
              : "AI Auto-Select"}
          </span>
          {" | "}Timeframe: <span style={{ color: "#00ff88" }}>{activeConfig.timeframe}</span>
          {" | "}Status:{" "}
          <span style={{ color: isRunning ? "#00ff88" : "#ff4466" }}>
            {isRunning ? "● ATIVO" : "○ PARADO"}
          </span>
        </div>
      )}

      {/* Live positions table */}
      <LivePositions />

      {/* P&L Chart */}
      <NeonCard style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
          <TrendingUp size={14} style={{ color: "#00ff8866" }} />
          <span style={{ fontSize: "12px", color: "#00ff8888", letterSpacing: "0.5px" }}>
            P&L — ultimos 30 dias
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
            Operacoes Recentes
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
                        {pnl !== null ? `${pnl >= 0 ? "+" : ""}${pnl.toFixed(4)}` : "—"}
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
                    Nenhuma operacao registrada ainda
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
