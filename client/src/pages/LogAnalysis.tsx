import { useState } from "react";
import { trpc } from "../App";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Wrench,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart2,
  Clock,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";

// ─── Helpers de estilo ──────────────────────────────────────────────────────

const C = {
  bg:       "#0a0a0f",
  card:     "#0d1117",
  border:   "#00ff8815",
  border2:  "#00ff8830",
  green:    "#00ff88",
  greenDim: "#00ff8866",
  greenFaint:"#00ff8820",
  red:      "#ff4466",
  redDim:   "#ff446666",
  redFaint: "#ff446620",
  yellow:   "#ffaa00",
  yellowFaint:"#ffaa0020",
  blue:     "#38bdf8",
  purple:   "#818cf8",
  text:     "#e2e8f0",
  muted:    "#64748b",
  font:     "Courier New, monospace",
};

function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: "8px",
        padding: "20px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontSize: "11px",
        fontWeight: "600",
        color: C.muted,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        marginBottom: "14px",
        fontFamily: C.font,
      }}
    >
      {children}
    </h2>
  );
}

function KpiCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: "8px",
        padding: "16px",
      }}
    >
      <div
        style={{
          fontSize: "11px",
          color: C.muted,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "6px",
          fontFamily: C.font,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "1.5rem",
          fontWeight: "700",
          color: color || C.text,
          fontFamily: C.font,
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: "0.78rem", color: C.muted, marginTop: "4px", fontFamily: C.font }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    CRÍTICO: { color: C.red,    bg: C.redFaint },
    ALERTA:  { color: C.yellow, bg: C.yellowFaint },
    AVISO:   { color: C.purple, bg: "#818cf820" },
    OK:      { color: C.green,  bg: C.greenFaint },
  };
  const s = map[severity] || map["OK"];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "4px",
        fontSize: "11px",
        fontWeight: "700",
        color: s.color,
        background: s.bg,
        fontFamily: C.font,
      }}
    >
      {severity}
    </span>
  );
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "melhorando") return <TrendingUp size={14} color={C.green} />;
  if (trend === "piorando")   return <TrendingDown size={14} color={C.red} />;
  return <Minus size={14} color={C.muted} />;
}

// ─── Componente principal ────────────────────────────────────────────────────

export function LogAnalysisPage() {
  const [lastHours, setLastHours] = useState<number | undefined>(undefined);
  const [activeChart, setActiveChart] = useState<"cumPnl" | "pnl" | "symbols">("cumPnl");

  // Queries
  const { data, isLoading, refetch, isFetching } = trpc.logAnalysis.getMetrics.useQuery(
    { lastHours },
    { refetchInterval: 60_000 }
  );

  // Mutations de correção
  const recalcStats = trpc.maintenance.recalculateStats.useMutation({
    onSuccess: (r) => {
      toast.success(
        `Estatísticas recalculadas — Win Rate: ${r.winRate.toFixed(1)}% | PnL: ${r.totalPnl.toFixed(4)} USDT`
      );
      refetch();
    },
    onError: (e) => toast.error(`Erro ao recalcular: ${e.message}`),
  });

  const fixPnl = trpc.maintenance.fixHistoricalPnl.useMutation({
    onSuccess: (r) => {
      toast.success(`PnL corrigido: ${r.fixed} trades ajustados (${r.errors} erros)`);
      refetch();
    },
    onError: (e) => toast.error(`Erro ao corrigir PnL: ${e.message}`),
  });

  // ─── KPIs ────────────────────────────────────────────────────────────────

  const winRateColor =
    !data ? C.text
    : data.winRate >= 50 ? C.green
    : data.winRate >= 40 ? C.yellow
    : C.red;

  const pnlColor = !data ? C.text : data.totalPnl >= 0 ? C.green : C.red;

  // ─── Dados dos gráficos ──────────────────────────────────────────────────

  const cumPnlData = (data?.cumPnlSeries || []).map((p: any, i: number) => ({
    idx: i + 1,
    cumPnl: parseFloat(p.cumPnl?.toFixed(4) || "0"),
  }));

  const pnlBarData = (data?.pnlSeries || []).map((p: any, i: number) => ({
    idx: i + 1,
    pnl: parseFloat(p.pnl?.toFixed(4) || "0"),
    symbol: p.symbol,
  }));

  const symbolData = Object.entries(data?.bySymbol || {})
    .map(([sym, v]: any) => ({
      symbol: sym.replace("_USDT", ""),
      pnl: parseFloat(v.pnl.toFixed(4)),
      wins: v.wins,
      losses: v.losses,
    }))
    .sort((a, b) => b.pnl - a.pnl)
    .slice(0, 12);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: C.font, color: C.text }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "20px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Activity size={18} style={{ color: C.green }} />
          <h1 style={{ fontSize: "18px", fontWeight: "700", color: C.green }}>
            Análise de Logs
          </h1>
          {isFetching && (
            <RefreshCw size={14} style={{ color: C.greenDim, animation: "spin 1s linear infinite" }} />
          )}
        </div>

        {/* Filtro de período */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "12px", color: C.muted }}>Período:</span>
          {([undefined, 6, 12, 24, 48, 168] as (number | undefined)[]).map((h) => (
            <button
              key={String(h)}
              onClick={() => setLastHours(h)}
              style={{
                padding: "4px 10px",
                borderRadius: "4px",
                fontSize: "11px",
                cursor: "pointer",
                fontFamily: C.font,
                background: lastHours === h ? C.greenFaint : "transparent",
                border: `1px solid ${lastHours === h ? C.green : C.border2}`,
                color: lastHours === h ? C.green : C.muted,
              }}
            >
              {h === undefined ? "Tudo" : h < 24 ? `${h}h` : h === 168 ? "7d" : `${h / 24}d`}
            </button>
          ))}
          <button
            onClick={() => refetch()}
            style={{
              padding: "4px 10px",
              borderRadius: "4px",
              fontSize: "11px",
              cursor: "pointer",
              fontFamily: C.font,
              background: "transparent",
              border: `1px solid ${C.border2}`,
              color: C.muted,
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <RefreshCw size={11} /> Atualizar
          </button>
        </div>
      </div>

      {isLoading ? (
        <div style={{ textAlign: "center", padding: "60px", color: C.greenDim }}>
          Carregando métricas...
        </div>
      ) : !data ? (
        <div style={{ textAlign: "center", padding: "60px", color: C.red }}>
          Erro ao carregar dados.
        </div>
      ) : (
        <>
          {/* ── KPI Grid ── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "12px",
              marginBottom: "20px",
            }}
          >
            <KpiCard
              label="Win Rate"
              value={`${data.winRate.toFixed(1)}%`}
              sub={`W:${data.wins} / L:${data.losses}`}
              color={winRateColor}
            />
            <KpiCard
              label="PnL Total"
              value={`${data.totalPnl >= 0 ? "+" : ""}${data.totalPnl.toFixed(4)}`}
              sub={`Tendência: ${data.pnlTrend}`}
              color={pnlColor}
            />
            <KpiCard
              label="Trades Fechados"
              value={String(data.period.totalTrades)}
              sub={`${data.period.openTrades} abertos`}
              color={C.text}
            />
            <KpiCard
              label="Heartbeat"
              value={
                data.heartbeatLagMin !== null
                  ? `${data.heartbeatLagMin.toFixed(1)} min`
                  : "—"
              }
              sub={data.isRunning ? "● Bot ativo" : "○ Bot parado"}
              color={
                data.heartbeatLagMin === null ? C.muted
                : data.heartbeatLagMin > 15 ? C.red
                : data.heartbeatLagMin > 10 ? C.yellow
                : C.green
              }
            />
            <KpiCard
              label="Erros no Período"
              value={String(data.errorCount)}
              sub={data.errorCount > 10 ? "Atenção necessária" : "Normal"}
              color={data.errorCount > 10 ? C.yellow : C.green}
            />
            <KpiCard
              label="Últ. 10 Trades"
              value={`${data.last10Pnl >= 0 ? "+" : ""}${data.last10Pnl.toFixed(4)}`}
              sub="PnL acumulado"
              color={data.last10Pnl >= 0 ? C.green : C.red}
            />
          </div>

          {/* ── Diagnóstico Automático ── */}
          <Card style={{ marginBottom: "20px" }}>
            <SectionTitle>Diagnóstico Automático</SectionTitle>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    {["Severidade", "Categoria", "Problema", "Ação Recomendada"].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "8px 12px",
                          textAlign: "left",
                          color: C.muted,
                          fontWeight: "600",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.diagnoses.map((d: any, i: number) => (
                    <tr
                      key={i}
                      style={{ borderBottom: `1px solid ${C.border}` }}
                    >
                      <td style={{ padding: "8px 12px" }}>
                        <SeverityBadge severity={d.severity} />
                      </td>
                      <td style={{ padding: "8px 12px", color: C.text }}>{d.category}</td>
                      <td style={{ padding: "8px 12px", color: C.muted, display: "flex", alignItems: "center", gap: "6px" }}>
                        <TrendIcon trend={d.severity === "ALERTA" || d.severity === "CRÍTICO" ? "piorando" : d.severity === "OK" ? "melhorando" : "estável"} />
                        {d.message}
                      </td>
                      <td style={{ padding: "8px 12px", color: C.muted, fontSize: "11px" }}>
                        {d.action || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* ── Ações de Correção ── */}
          <Card style={{ marginBottom: "20px" }}>
            <SectionTitle>Ações de Correção</SectionTitle>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
              {/* Recalcular Estatísticas */}
              <div
                style={{
                  background: C.bg,
                  border: `1px solid ${C.border2}`,
                  borderRadius: "8px",
                  padding: "16px",
                  minWidth: "260px",
                  flex: "1",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <BarChart2 size={15} color={C.blue} />
                  <span style={{ fontWeight: "600", color: C.text, fontSize: "13px" }}>
                    Recalcular Estatísticas
                  </span>
                </div>
                <p style={{ fontSize: "11px", color: C.muted, marginBottom: "12px", lineHeight: "1.5" }}>
                  Recalcula Win Rate, contagem de trades e PnL total diretamente dos registros do banco.
                  Use quando os números estiverem inconsistentes.
                </p>
                <button
                  onClick={() => recalcStats.mutate()}
                  disabled={recalcStats.isPending}
                  style={{
                    padding: "7px 16px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    cursor: recalcStats.isPending ? "not-allowed" : "pointer",
                    fontFamily: C.font,
                    fontWeight: "600",
                    background: recalcStats.isPending ? C.greenFaint : C.greenFaint,
                    border: `1px solid ${C.green}40`,
                    color: recalcStats.isPending ? C.greenDim : C.green,
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  {recalcStats.isPending ? (
                    <><RefreshCw size={12} /> Recalculando...</>
                  ) : (
                    <><Wrench size={12} /> Recalcular Agora</>
                  )}
                </button>
              </div>

              {/* Corrigir PnL Histórico */}
              <div
                style={{
                  background: C.bg,
                  border: `1px solid ${C.border2}`,
                  borderRadius: "8px",
                  padding: "16px",
                  minWidth: "260px",
                  flex: "1",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <Zap size={15} color={C.yellow} />
                  <span style={{ fontWeight: "600", color: C.text, fontSize: "13px" }}>
                    Corrigir PnL Histórico
                  </span>
                </div>
                <p style={{ fontSize: "11px", color: C.muted, marginBottom: "12px", lineHeight: "1.5" }}>
                  Recalcula o PnL de todos os trades fechados usando o multiplicador correto da Gate.io.
                  Corrige valores zerados ou incorretos.
                </p>
                <button
                  onClick={() => fixPnl.mutate()}
                  disabled={fixPnl.isPending}
                  style={{
                    padding: "7px 16px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    cursor: fixPnl.isPending ? "not-allowed" : "pointer",
                    fontFamily: C.font,
                    fontWeight: "600",
                    background: fixPnl.isPending ? C.yellowFaint : C.yellowFaint,
                    border: `1px solid ${C.yellow}40`,
                    color: fixPnl.isPending ? `${C.yellow}88` : C.yellow,
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  {fixPnl.isPending ? (
                    <><RefreshCw size={12} /> Corrigindo...</>
                  ) : (
                    <><Zap size={12} /> Corrigir PnL</>
                  )}
                </button>
              </div>
            </div>
          </Card>

          {/* ── Gráficos ── */}
          <Card style={{ marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <SectionTitle>Gráficos</SectionTitle>
              <div style={{ display: "flex", gap: "6px" }}>
                {(["cumPnl", "pnl", "symbols"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveChart(tab)}
                    style={{
                      padding: "4px 12px",
                      borderRadius: "4px",
                      fontSize: "11px",
                      cursor: "pointer",
                      fontFamily: C.font,
                      background: activeChart === tab ? C.greenFaint : "transparent",
                      border: `1px solid ${activeChart === tab ? C.green : C.border2}`,
                      color: activeChart === tab ? C.green : C.muted,
                    }}
                  >
                    {tab === "cumPnl" ? "PnL Acumulado" : tab === "pnl" ? "PnL por Trade" : "Por Símbolo"}
                  </button>
                ))}
              </div>
            </div>

            {activeChart === "cumPnl" && (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={cumPnlData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="idx" tick={{ fill: C.muted, fontSize: 10 }} />
                  <YAxis tick={{ fill: C.muted, fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ background: C.card, border: `1px solid ${C.border2}`, color: C.text, fontFamily: C.font, fontSize: "12px" }}
                    formatter={(v: any) => [`${v.toFixed(4)} USDT`, "PnL Acumulado"]}
                  />
                  <ReferenceLine y={0} stroke={C.muted} strokeDasharray="4 4" />
                  <Line
                    type="monotone"
                    dataKey="cumPnl"
                    stroke={cumPnlData.length > 0 && cumPnlData[cumPnlData.length - 1]?.cumPnl >= 0 ? C.green : C.red}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}

            {activeChart === "pnl" && (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={pnlBarData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="idx" tick={{ fill: C.muted, fontSize: 10 }} />
                  <YAxis tick={{ fill: C.muted, fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ background: C.card, border: `1px solid ${C.border2}`, color: C.text, fontFamily: C.font, fontSize: "12px" }}
                    formatter={(v: any, _: any, props: any) => [`${v.toFixed(4)} USDT`, props?.payload?.symbol || "Trade"]}
                  />
                  <ReferenceLine y={0} stroke={C.muted} />
                  <Bar dataKey="pnl" radius={[2, 2, 0, 0]}>
                    {pnlBarData.map((entry: { pnl: number }, index: number) => (
                      <Cell key={index} fill={entry.pnl >= 0 ? C.green : C.red} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}

            {activeChart === "symbols" && (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={symbolData} layout="vertical" margin={{ top: 5, right: 20, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis type="number" tick={{ fill: C.muted, fontSize: 10 }} />
                  <YAxis type="category" dataKey="symbol" tick={{ fill: C.muted, fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ background: C.card, border: `1px solid ${C.border2}`, color: C.text, fontFamily: C.font, fontSize: "12px" }}
                    formatter={(v: any) => [`${v.toFixed(4)} USDT`, "PnL"]}
                  />
                  <ReferenceLine x={0} stroke={C.muted} />
                  <Bar dataKey="pnl" radius={[0, 2, 2, 0]}>
                    {symbolData.map((entry: { pnl: number }, index: number) => (
                      <Cell key={index} fill={entry.pnl >= 0 ? C.green : C.red} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* ── Erros Recentes ── */}
          {data.recentErrors.length > 0 && (
            <Card style={{ marginBottom: "20px" }}>
              <SectionTitle>Erros Recentes ({data.recentErrors.length})</SectionTitle>
              <div style={{ maxHeight: "240px", overflowY: "auto" }}>
                {data.recentErrors.map((e: any, i: number) => (
                  <div
                    key={i}
                    style={{
                      padding: "8px 0",
                      borderBottom: `1px solid ${C.border}`,
                      display: "flex",
                      gap: "12px",
                      alignItems: "flex-start",
                    }}
                  >
                    <XCircle size={13} color={C.red} style={{ flexShrink: 0, marginTop: "2px" }} />
                    <div>
                      <div style={{ fontSize: "11px", color: C.muted, marginBottom: "2px" }}>
                        {e.time ? new Date(e.time).toLocaleString("pt-BR") : "—"}
                      </div>
                      <div style={{ fontSize: "12px", color: C.text }}>{e.message}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* ── Distribuição de Erros por Tipo ── */}
          {Object.keys(data.errorsByType).length > 0 && (
            <Card>
              <SectionTitle>Distribuição de Erros por Tipo</SectionTitle>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {Object.entries(data.errorsByType)
                  .sort((a, b) => (b[1] as number) - (a[1] as number))
                  .map(([type, count]) => (
                    <div
                      key={type}
                      style={{
                        background: C.redFaint,
                        border: `1px solid ${C.red}30`,
                        borderRadius: "4px",
                        padding: "4px 10px",
                        fontSize: "11px",
                        color: C.red,
                        fontFamily: C.font,
                      }}
                    >
                      {type} <strong>×{count as number}</strong>
                    </div>
                  ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
