import { trpc } from "../App";
import { List } from "lucide-react";

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

export function TradesPage() {
  const { data: trades } = trpc.trades.getRecent.useQuery({ limit: 100 }, {
    refetchInterval: 10000,
  });
  const { data: stats } = trpc.trades.getStats.useQuery(undefined, {
    refetchInterval: 10000,
  });

  const totalPnl = stats?.totalPnl ?? 0;
  const pnlColor = totalPnl >= 0 ? "#00ff88" : "#ff4466";

  return (
    <div style={{ fontFamily: "Courier New, monospace" }}>
      <div style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
        <List size={18} style={{ color: "#00ff88" }} />
        <h1 style={{ fontSize: "18px", fontWeight: "700", color: "#00ff88" }}>Histórico de Trades</h1>
      </div>

      {/* Stats cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: "14px",
        marginBottom: "20px",
      }}>
        <NeonCard style={{ padding: "16px" }}>
          <p style={{ fontSize: "10px", color: "#00ff8855", marginBottom: "8px" }}>P&L TOTAL</p>
          <p style={{ fontSize: "22px", fontWeight: "700", color: pnlColor }}>
            {totalPnl >= 0 ? "+" : ""}{totalPnl.toFixed(2)} USDT
          </p>
        </NeonCard>
        <NeonCard style={{ padding: "16px" }}>
          <p style={{ fontSize: "10px", color: "#00ff8855", marginBottom: "8px" }}>GANHOS</p>
          <p style={{ fontSize: "22px", fontWeight: "700", color: "#00ff88" }}>
            {stats?.winningTrades ?? 0}
          </p>
        </NeonCard>
        <NeonCard style={{ padding: "16px" }}>
          <p style={{ fontSize: "10px", color: "#00ff8855", marginBottom: "8px" }}>PERDAS</p>
          <p style={{ fontSize: "22px", fontWeight: "700", color: "#ff4466" }}>
            {stats?.losingTrades ?? 0}
          </p>
        </NeonCard>
        <NeonCard style={{ padding: "16px" }}>
          <p style={{ fontSize: "10px", color: "#00ff8855", marginBottom: "8px" }}>WIN RATE</p>
          <p style={{ fontSize: "22px", fontWeight: "700", color: "#ffffff" }}>
            {(stats?.winRate ?? 0).toFixed(1)}%
          </p>
        </NeonCard>
      </div>

      {/* Trades table */}
      <NeonCard>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #00ff8815" }}>
                {["Data", "Par", "Lado", "Entrada", "Saída", "Qtd", "P&L", "P&L %", "Status"].map((h) => (
                  <th key={h} style={{
                    padding: "8px 12px", textAlign: "left",
                    color: "#00ff8855", fontWeight: "600",
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trades && trades.length > 0 ? (
                trades.map((trade: any) => {
                  const pnl = trade.pnl ? parseFloat(trade.pnl) : null;
                  const pnlPct = trade.pnlPercent ? parseFloat(trade.pnlPercent) : null;
                  const pnlColor = pnl !== null ? (pnl >= 0 ? "#00ff88" : "#ff4466") : "#4a7a5a";
                  return (
                    <tr
                      key={trade.id}
                      style={{ borderBottom: "1px solid #00ff8806" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#00ff8806")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "8px 12px", color: "#00ff8855", whiteSpace: "nowrap" }}>
                        {new Date(trade.createdAt || trade.entryTime).toLocaleDateString("pt-BR")}
                      </td>
                      <td style={{ padding: "8px 12px", color: "#00ff88", fontWeight: "700" }}>{trade.symbol}</td>
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
                        {trade.exitPrice ? `$${parseFloat(trade.exitPrice).toFixed(2)}` : "—"}
                      </td>
                      <td style={{ padding: "8px 12px", color: "#00ff8888" }}>
                        {parseFloat(trade.quantity).toFixed(4)}
                      </td>
                      <td style={{ padding: "8px 12px", color: pnlColor, fontWeight: "600" }}>
                        {pnl !== null ? `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}` : "—"}
                      </td>
                      <td style={{ padding: "8px 12px", color: pnlColor }}>
                        {pnlPct !== null ? `${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%` : "—"}
                      </td>
                      <td style={{ padding: "8px 12px" }}>
                        <span style={{
                          padding: "2px 8px", borderRadius: "3px", fontSize: "11px",
                          background: trade.status === "OPEN" ? "#00ff8815" : "#ffffff08",
                          color: trade.status === "OPEN" ? "#00ff88" : "#ffffff44",
                          border: `1px solid ${trade.status === "OPEN" ? "#00ff8830" : "#ffffff12"}`,
                        }}>
                          {trade.status === "OPEN" ? "Aberta" : trade.status === "CLOSED" ? "Fechada" : "Cancelada"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} style={{
                    padding: "40px", textAlign: "center",
                    color: "#00ff8833",
                  }}>
                    Nenhuma operação registrada
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
