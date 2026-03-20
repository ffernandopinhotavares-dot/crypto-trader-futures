import { trpc } from "../App";
import { FileText } from "lucide-react";

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

export function LogsPage() {
  const { data: logs } = trpc.logs.getRecent.useQuery({ limit: 100 }, {
    refetchInterval: 5000,
  });

  const levelColor = (level: string) => {
    switch (level?.toUpperCase()) {
      case "ERROR": return "#ff4466";
      case "WARN": return "#ffaa00";
      case "INFO": return "#00ff88";
      default: return "#00ff8866";
    }
  };

  return (
    <div style={{ fontFamily: "Courier New, monospace" }}>
      <div style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
        <FileText size={18} style={{ color: "#00ff88" }} />
        <h1 style={{ fontSize: "18px", fontWeight: "700", color: "#00ff88" }}>Logs do Sistema</h1>
      </div>

      <NeonCard>
        <div style={{ overflowX: "auto", maxHeight: "600px", overflowY: "auto" }}>
          {logs && logs.length > 0 ? (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #00ff8815" }}>
                  {["Hora", "Nível", "Mensagem"].map((h) => (
                    <th key={h} style={{
                      padding: "8px 12px", textAlign: "left",
                      color: "#00ff8855", fontWeight: "600",
                      position: "sticky", top: 0, background: "#0d1117",
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log: any) => (
                  <tr
                    key={log.id}
                    style={{ borderBottom: "1px solid #00ff8806" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#00ff8806")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "6px 12px", color: "#00ff8855", whiteSpace: "nowrap" }}>
                      {new Date(log.createdAt).toLocaleTimeString("pt-BR")}
                    </td>
                    <td style={{ padding: "6px 12px" }}>
                      <span style={{
                        padding: "1px 6px", borderRadius: "3px", fontSize: "10px",
                        color: levelColor(log.level),
                        border: `1px solid ${levelColor(log.level)}40`,
                        background: `${levelColor(log.level)}10`,
                      }}>
                        {log.level?.toUpperCase() || "INFO"}
                      </span>
                    </td>
                    <td style={{ padding: "6px 12px", color: "#00ff8899" }}>
                      {log.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: "40px", textAlign: "center", color: "#00ff8833" }}>
              Nenhum log disponível
            </div>
          )}
        </div>
      </NeonCard>
    </div>
  );
}
