import { trpc } from "../App";
import { TrendingUp } from "lucide-react";

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

export function FuturesPage() {
  const { data: openTrades } = trpc.trades.getRecent.useQuery({ limit: 50 }, {
    refetchInterval: 10000,
  });

  const openPositions = openTrades?.filter((t: any) => t.status === "OPEN") ?? [];

  return (
    <div style={{ fontFamily: "Courier New, monospace" }}>
      <div style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
        <TrendingUp size={18} style={{ color: "#00ff88" }} />
        <h1 style={{ fontSize: "18px", fontWeight: "700", color: "#00ff88" }}>Futuros — Posições Abertas</h1>
        <span style={{
          padding: "2px 8px", borderRadius: "4px", fontSize: "11px",
          background: "#00ff8815", color: "#00ff88", border: "1px solid #00ff8830",
        }}>
          {openPositions.length} abertas
        </span>
      </div>

      <NeonCard>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #00ff8815" }}>
                {["Par", "Lado", "Preço Entrada", "Quantidade", "P&L", "Data Abertura"].map((h) => (
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
              {openPositions.length > 0 ? (
                openPositions.map((trade: any) => {
                  const pnl = trade.pnl ? parseFloat(trade.pnl) : null;
                  const pnlColor = pnl !== null ? (pnl >= 0 ? "#00ff88" : "#ff4466") : "#4a7a5a";
                  return (
                    <tr
                      key={trade.id}
                      style={{ borderBottom: "1px solid #00ff8808" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#00ff8806")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "10px 12px", color: "#00ff88", fontWeight: "700" }}>{trade.symbol}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{
                          padding: "2px 8px", borderRadius: "3px", fontSize: "11px",
                          background: trade.side === "BUY" ? "#00ff8815" : "#ff446615",
                          color: trade.side === "BUY" ? "#00ff88" : "#ff4466",
                          border: `1px solid ${trade.side === "BUY" ? "#00ff8830" : "#ff446630"}`,
                        }}>
                          {trade.side}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", color: "#00ff8888" }}>
                        ${parseFloat(trade.entryPrice).toFixed(2)}
                      </td>
                      <td style={{ padding: "10px 12px", color: "#00ff8888" }}>
                        {parseFloat(trade.quantity).toFixed(4)}
                      </td>
                      <td style={{ padding: "10px 12px", color: pnlColor, fontWeight: "600" }}>
                        {pnl !== null ? `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} USDT` : "—"}
                      </td>
                      <td style={{ padding: "10px 12px", color: "#00ff8855" }}>
                        {new Date(trade.createdAt).toLocaleString("pt-BR")}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} style={{
                    padding: "40px", textAlign: "center",
                    color: "#00ff8833",
                  }}>
                    Nenhuma posição aberta no momento
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
