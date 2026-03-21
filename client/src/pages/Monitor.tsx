import { useState } from "react";
import { trpc } from "../App";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import {
  Activity, DollarSign, TrendingUp, TrendingDown, Zap,
  AlertTriangle, RefreshCw, Wrench, BarChart2, Radio,
} from "lucide-react";
import { toast } from "sonner";

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

function KpiCard({ label, value, sub, color = "#00ff88", icon: Icon }: {
  label: string; value: string; sub?: string; color?: string; icon?: any;
}) {
  return (
    <NeonCard style={{ padding: "16px 20px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: "10px", color: "#00ff8855", letterSpacing: "1px", textTransform: "uppercase", fontFamily: "Courier New, monospace", marginBottom: "6px" }}>
            {label}
          </p>
          <p style={{ fontSize: "22px", fontWeight: "700", color, fontFamily: "Courier New, monospace" }}>
            {value}
          </p>
          {sub && (
            <p style={{ fontSize: "11px", color: "#00ff8844", fontFamily: "Courier New, monospace", marginTop: "4px" }}>
              {sub}
            </p>
          )}
        </div>
        {Icon && <Icon size={20} style={{ color: `${color}44` }} />}
      </div>
    </NeonCard>
  );
}

export function MonitorPage() {
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Dados do bot
  const { data: status, refetch: refetchStatus } = trpc.botControl.getStatus.useQuery(undefined, {
    refetchInterval: 10000,
  });
  const { data: balance, refetch: refetchBalance } = trpc.marketData.getBalance.useQuery(undefined, {
    refetchInterval: 10000,
  });
  const { data: positions, refetch: refetchPositions } = trpc.marketData.getPositions.useQuery(undefined, {
    refetchInterval: 10000,
  });
  const { data: recentTrades } = trpc.trades.getRecent.useQuery({ limit: 100 }, {
    refetchInterval: 15000,
  });
  const { data: logs } = trpc.logs.getRecent.useQuery({ limit: 50 }, {
    refetchInterval: 8000,
  });
  // stats vem do status do bot
  const statsMode = status?.cycleCount ? "aggressive" : "—";

  // Mutations de manutenção
  const fixPnl = trpc.maintenance.fixHistoricalPnl.useMutation({
    onSuccess: (data: any) => toast.success(`PnL corrigido: ${data?.fixed ?? 0} trades atualizados`),
    onError: () => toast.error("Erro ao corrigir PnL"),
  });
  const recalcStats = trpc.maintenance.recalculateStats.useMutation({
    onSuccess: () => toast.success("Estatísticas recalculadas com sucesso"),
    onError: () => toast.error("Erro ao recalcular estatísticas"),
  });

  // Calcular métricas
  const closedTrades = recentTrades?.filter((t: any) => t.status === "CLOSED") ?? [];
  const openTrades = recentTrades?.filter((t: any) => t.status === "OPEN") ?? [];
  const totalPnl = closedTrades.reduce((acc: number, t: any) => acc + (parseFloat(t.pnl ?? "0") || 0), 0);
  const winners = closedTrades.filter((t: any) => parseFloat(t.pnl ?? "0") > 0).length;
  const losers = closedTrades.filter((t: any) => parseFloat(t.pnl ?? "0") <= 0).length;
  const winRate = closedTrades.length > 0 ? (winners / closedTrades.length) * 100 : 0;

  // Dados para o gráfico de PnL acumulado
  const pnlChartData = closedTrades
    .slice()
    .reverse()
    .reduce((acc: any[], trade: any, idx: number) => {
      const prev = acc[idx - 1]?.cumPnl ?? 0;
      const pnl = parseFloat(trade.pnl ?? "0") || 0;
      acc.push({
        label: `#${idx + 1}`,
        pnl: parseFloat(pnl.toFixed(4)),
        cumPnl: parseFloat((prev + pnl).toFixed(4)),
        symbol: trade.symbol,
      });
      return acc;
    }, []);

  // Dados para o donut chart
  const pieData = [
    { name: "Ganhos", value: winners, color: "#00ff88" },
    { name: "Perdas", value: losers, color: "#ff4466" },
  ];

  // Heartbeat lag
  const heartbeatLag = status?.lastHeartbeat
    ? Math.floor((Date.now() - new Date(status.lastHeartbeat).getTime()) / 1000)
    : null;
  const heartbeatOk = heartbeatLag !== null && heartbeatLag < 600;

  // Drawdown
  const initialBalance = 48.52;
  const currentBalance = parseFloat(String(balance?.balance ?? initialBalance));
  const drawdown = ((initialBalance - currentBalance) / initialBalance) * 100;

  // Refresh manual
  const handleRefresh = () => {
    refetchStatus();
    refetchBalance();
    refetchPositions();
    setLastRefresh(new Date());
    toast.success("Dados atualizados");
  };

  const fmt = (v: any, dec = 2) => {
    const n = parseFloat(String(v ?? 0));
    return isNaN(n) ? "—" : n.toFixed(dec);
  };

  return (
    <div style={{ fontFamily: "Courier New, monospace" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Radio size={18} style={{ color: "#00ff88" }} />
          <h1 style={{ fontSize: "18px", fontWeight: "700", color: "#00ff88" }}>Monitor em Tempo Real</h1>
          <span style={{
            padding: "2px 8px", borderRadius: "4px", fontSize: "11px",
            background: heartbeatOk ? "#00ff8815" : "#ff446615",
            color: heartbeatOk ? "#00ff88" : "#ff4466",
            border: `1px solid ${heartbeatOk ? "#00ff8830" : "#ff446630"}`,
          }}>
            {heartbeatOk ? `● AO VIVO (${heartbeatLag}s)` : "○ OFFLINE"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "10px", color: "#00ff8844" }}>
            Atualizado: {lastRefresh.toLocaleTimeString("pt-BR")}
          </span>
          <button
            onClick={handleRefresh}
            style={{
              background: "#00ff8810", border: "1px solid #00ff8830",
              color: "#00ff88", padding: "5px 10px", borderRadius: "4px",
              cursor: "pointer", display: "flex", alignItems: "center", gap: "5px",
              fontSize: "11px",
            }}
          >
            <RefreshCw size={12} /> Atualizar
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px", marginBottom: "20px" }}>
        <KpiCard
          label="Saldo Total"
          value={`$${fmt(balance?.balance)} USDT`}
          sub={`Disponível: $${fmt(balance?.available)}`}
          icon={DollarSign}
        />
        <KpiCard
          label="P&L Realizado"
          value={`${totalPnl >= 0 ? "+" : ""}${fmt(totalPnl, 4)} USDT`}
          sub={`${closedTrades.length} trades fechados`}
          color={totalPnl >= 0 ? "#00ff88" : "#ff4466"}
          icon={totalPnl >= 0 ? TrendingUp : TrendingDown}
        />
        <KpiCard
          label="Win Rate"
          value={`${fmt(winRate, 1)}%`}
          sub={`${winners}W / ${losers}L`}
          color={winRate >= 50 ? "#00ff88" : "#ffaa00"}
          icon={BarChart2}
        />
        <KpiCard
          label="Posições Abertas"
          value={`${openTrades.length}`}
          sub={`P&L não realizado: ${fmt(balance?.unrealizedPnl, 4)}`}
          icon={Activity}
        />
        <KpiCard
          label="Ciclo Atual"
          value={`#${status?.cycleCount ?? "—"}`}
          sub={`Modo: ${statsMode}`}
          icon={Zap}
        />
        <KpiCard
          label="Drawdown"
          value={`${fmt(Math.max(0, drawdown), 2)}%`}
          sub={`Limite: 15%`}
          color={drawdown > 10 ? "#ff4466" : drawdown > 5 ? "#ffaa00" : "#00ff88"}
          icon={AlertTriangle}
        />
      </div>

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px", marginBottom: "20px" }}>
        {/* PnL Chart */}
        <NeonCard>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <TrendingUp size={14} style={{ color: "#00ff8866" }} />
            <span style={{ fontSize: "12px", color: "#00ff8888", letterSpacing: "0.5px" }}>
              P&L Acumulado por Trade
            </span>
          </div>
          {pnlChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={pnlChartData}>
                <defs>
                  <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00ff88" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00ff88" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#00ff8810" />
                <XAxis dataKey="label" stroke="#00ff8830" tick={{ fill: "#00ff8855", fontSize: 9 }} />
                <YAxis stroke="#00ff8830" tick={{ fill: "#00ff8855", fontSize: 9 }} />
                <Tooltip
                  contentStyle={{ background: "#0d1117", border: "1px solid #00ff8830", borderRadius: "4px", fontSize: "11px" }}
                  labelStyle={{ color: "#00ff88" }}
                  itemStyle={{ color: "#00ff88" }}
                  formatter={(v: any) => [`${parseFloat(v).toFixed(4)} USDT`, "P&L Acum."]}
                />
                <Area type="monotone" dataKey="cumPnl" stroke="#00ff88" strokeWidth={2} fill="url(#pnlGrad)" dot={{ fill: "#00ff88", r: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: "180px", display: "flex", alignItems: "center", justifyContent: "center", color: "#00ff8833", fontSize: "12px" }}>
              Aguardando trades fechados...
            </div>
          )}
        </NeonCard>

        {/* Win/Loss Donut */}
        <NeonCard>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <BarChart2 size={14} style={{ color: "#00ff8866" }} />
            <span style={{ fontSize: "12px", color: "#00ff8888", letterSpacing: "0.5px" }}>
              Distribuição de Resultados
            </span>
          </div>
          {closedTrades.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value" paddingAngle={3}>
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#0d1117", border: "1px solid #00ff8830", fontSize: "11px" }}
                    formatter={(v: any, name: any) => [v, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", gap: "16px", marginTop: "8px" }}>
                {pieData.map((d) => (
                  <div key={d.name} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px" }}>
                    <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: d.color, display: "inline-block" }} />
                    <span style={{ color: "#00ff8888" }}>{d.name}: {d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ height: "140px", display: "flex", alignItems: "center", justifyContent: "center", color: "#00ff8833", fontSize: "12px" }}>
              Sem dados ainda
            </div>
          )}
        </NeonCard>
      </div>

      {/* Posições abertas (Gate.io ao vivo) */}
      <NeonCard style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
          <Activity size={14} style={{ color: "#00ff8866" }} />
          <span style={{ fontSize: "12px", color: "#00ff8888", letterSpacing: "0.5px" }}>
            Posições Abertas — Gate.io ao Vivo
          </span>
          <span style={{
            marginLeft: "auto", padding: "2px 8px", borderRadius: "3px", fontSize: "10px",
            background: "#00ff8815", color: "#00ff88", border: "1px solid #00ff8830",
          }}>
            {positions?.length ?? 0} posições
          </span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #00ff8815" }}>
                {["Par", "Lado", "Contratos", "Entrada", "Mark", "P&L Não Real.", "Leverage"].map((h) => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#00ff8855", fontWeight: "600" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {positions && positions.length > 0 ? (
                positions.map((pos: any, i: number) => {
                  const pnl = parseFloat(pos.unrealised_pnl ?? pos.unrealizedPnl ?? "0");
                  const pnlColor = pnl >= 0 ? "#00ff88" : "#ff4466";
                  return (
                    <tr key={i} style={{ borderBottom: "1px solid #00ff8808" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#00ff8806")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "8px 12px", color: "#00ff88", fontWeight: "700" }}>{pos.contract ?? pos.symbol}</td>
                      <td style={{ padding: "8px 12px" }}>
                        <span style={{
                          padding: "2px 8px", borderRadius: "3px", fontSize: "11px",
                          background: (pos.mode === "dual_long" || pos.size > 0) ? "#00ff8815" : "#ff446615",
                          color: (pos.mode === "dual_long" || pos.size > 0) ? "#00ff88" : "#ff4466",
                          border: `1px solid ${(pos.mode === "dual_long" || pos.size > 0) ? "#00ff8830" : "#ff446630"}`,
                        }}>
                          {pos.mode === "dual_long" ? "LONG" : pos.mode === "dual_short" ? "SHORT" : pos.size > 0 ? "LONG" : "SHORT"}
                        </span>
                      </td>
                      <td style={{ padding: "8px 12px", color: "#00ff8888" }}>{Math.abs(pos.size ?? 0)}</td>
                      <td style={{ padding: "8px 12px", color: "#00ff8888" }}>{fmt(pos.entry_price ?? pos.entryPrice, 4)}</td>
                      <td style={{ padding: "8px 12px", color: "#00ff8888" }}>{fmt(pos.mark_price ?? pos.markPrice, 4)}</td>
                      <td style={{ padding: "8px 12px", color: pnlColor, fontWeight: "600" }}>
                        {pnl >= 0 ? "+" : ""}{fmt(pnl, 4)} USDT
                      </td>
                      <td style={{ padding: "8px 12px", color: "#00ff8888" }}>{pos.leverage ?? "—"}x</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} style={{ padding: "32px", textAlign: "center", color: "#00ff8833" }}>
                    Nenhuma posição aberta no momento
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </NeonCard>

      {/* Logs em tempo real */}
      <NeonCard style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
          <Zap size={14} style={{ color: "#00ff8866" }} />
          <span style={{ fontSize: "12px", color: "#00ff8888", letterSpacing: "0.5px" }}>
            Log de Eventos — Últimos 50
          </span>
          <span style={{ marginLeft: "auto", fontSize: "10px", color: "#00ff8844" }}>Atualiza a cada 8s</span>
        </div>
        <div style={{ maxHeight: "220px", overflowY: "auto", fontSize: "11px" }}>
          {logs && logs.length > 0 ? (
            logs.map((log: any) => {
              const lvl = log.level?.toUpperCase() ?? "INFO";
              const lvlColor = lvl === "ERROR" ? "#ff4466" : lvl === "WARN" ? "#ffaa00" : "#00ff88";
              return (
                <div key={log.id} style={{
                  display: "flex", gap: "10px", padding: "4px 0",
                  borderBottom: "1px solid #00ff8806", alignItems: "flex-start",
                }}>
                  <span style={{ color: "#00ff8844", whiteSpace: "nowrap", flexShrink: 0 }}>
                    {new Date(log.createdAt).toLocaleTimeString("pt-BR")}
                  </span>
                  <span style={{ color: lvlColor, fontWeight: "600", flexShrink: 0, minWidth: "40px" }}>
                    {lvl}
                  </span>
                  <span style={{ color: "#00ff88aa", wordBreak: "break-word" }}>{log.message}</span>
                </div>
              );
            })
          ) : (
            <p style={{ color: "#00ff8833", textAlign: "center", padding: "20px" }}>Nenhum log disponível</p>
          )}
        </div>
      </NeonCard>

      {/* Painel de manutenção */}
      <NeonCard>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
          <Wrench size={14} style={{ color: "#ffaa0066" }} />
          <span style={{ fontSize: "12px", color: "#ffaa0088", letterSpacing: "0.5px" }}>
            Painel de Manutenção
          </span>
        </div>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button
            onClick={() => fixPnl.mutate()}
            disabled={fixPnl.isPending}
            style={{
              padding: "8px 16px", borderRadius: "4px", cursor: fixPnl.isPending ? "not-allowed" : "pointer",
              background: "#00ff8810", border: "1px solid #00ff8830", color: "#00ff88",
              fontSize: "12px", display: "flex", alignItems: "center", gap: "6px",
              opacity: fixPnl.isPending ? 0.6 : 1,
            }}
          >
            <Wrench size={12} />
            {fixPnl.isPending ? "Corrigindo..." : "Corrigir PnL Histórico"}
          </button>
          <button
            onClick={() => recalcStats.mutate()}
            disabled={recalcStats.isPending}
            style={{
              padding: "8px 16px", borderRadius: "4px", cursor: recalcStats.isPending ? "not-allowed" : "pointer",
              background: "#00aaff10", border: "1px solid #00aaff30", color: "#00aaff",
              fontSize: "12px", display: "flex", alignItems: "center", gap: "6px",
              opacity: recalcStats.isPending ? 0.6 : 1,
            }}
          >
            <RefreshCw size={12} />
            {recalcStats.isPending ? "Recalculando..." : "Recalcular Estatísticas"}
          </button>
        </div>
        <p style={{ fontSize: "10px", color: "#00ff8833", marginTop: "10px" }}>
          Use "Corrigir PnL Histórico" para recalcular trades com PnL incorreto ou nulo no banco de dados.
        </p>
      </NeonCard>
    </div>
  );
}
