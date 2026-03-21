import { trpc } from "../App";
import { Settings, Key, Trash2 } from "lucide-react";
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

export function SettingsPage() {
  const { data: apiKeys, refetch } = trpc.gateioKeys.getKeys.useQuery();
  const { mutate: deleteKeys } = trpc.gateioKeys.deleteKeys.useMutation({
    onSuccess: () => {
      toast.success("Chaves removidas. Recarregue a página para configurar novas chaves.");
      refetch();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  return (
    <div style={{ fontFamily: "Courier New, monospace" }}>
      <div style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
        <Settings size={18} style={{ color: "#00ff88" }} />
        <h1 style={{ fontSize: "18px", fontWeight: "700", color: "#00ff88" }}>Configurações</h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
        {/* API Keys */}
        <NeonCard>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <Key size={15} style={{ color: "#00ff8866" }} />
            <h2 style={{ fontSize: "14px", fontWeight: "600", color: "#00ff88" }}>Chaves API Gate.io Futures</h2>
          </div>

          {apiKeys ? (
            <div>
              <div style={{ marginBottom: "12px" }}>
                <p style={{ fontSize: "10px", color: "#00ff8855", marginBottom: "4px" }}>API KEY</p>
                <p style={{ fontSize: "13px", color: "#00ff88aa" }}>{apiKeys.apiKey}</p>
              </div>
              <div style={{ marginBottom: "16px" }}>
                <p style={{ fontSize: "10px", color: "#00ff8855", marginBottom: "4px" }}>STATUS</p>
                <span style={{
                  padding: "2px 10px", borderRadius: "4px", fontSize: "11px",
                  background: "#00ff8815",
                  color: "#00ff88",
                  border: "1px solid #00ff8830",
                }}>
                  MAINNET (AO VIVO)
                </span>
              </div>
              <button
                onClick={() => {
                  if (confirm("Remover as chaves API?")) deleteKeys();
                }}
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "7px 14px", borderRadius: "5px",
                  background: "#ff446610", border: "1px solid #ff446630",
                  color: "#ff4466", fontSize: "12px",
                  fontFamily: "Courier New, monospace",
                  cursor: "pointer",
                }}
              >
                <Trash2 size={13} />
                Remover Chaves
              </button>
            </div>
          ) : (
            <p style={{ color: "#00ff8833", fontSize: "13px" }}>Nenhuma chave configurada.</p>
          )}
        </NeonCard>

        {/* About */}
        <NeonCard>
          <h2 style={{ fontSize: "14px", fontWeight: "600", color: "#00ff88", marginBottom: "16px" }}>Sobre</h2>
          {[
            ["Versão", "2.0.0"],
            ["Exchange", "Gate.io Futures (USDT-M)"],
            ["Motor", "AI Autônomo (Gemini 2.5 Flash)"],
            ["Indicadores", "RSI, MACD, BB, EMA, Volume, Volatilidade"],
            ["Atualizado em", "21 de Março de 2026"],
          ].map(([label, value]) => (
            <div key={label} style={{ marginBottom: "10px" }}>
              <p style={{ fontSize: "10px", color: "#00ff8844" }}>{label}</p>
              <p style={{ fontSize: "12px", color: "#00ff8888" }}>{value}</p>
            </div>
          ))}
        </NeonCard>
      </div>
    </div>
  );
}
