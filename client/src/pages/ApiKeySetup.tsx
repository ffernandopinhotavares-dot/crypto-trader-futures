import { useState } from "react";
import { trpc } from "../App";
import { Zap, Key, Eye, EyeOff, ExternalLink, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export function ApiKeySetup() {
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);

  const { mutate: saveKeys, isPending } = trpc.gateioKeys.saveKeys.useMutation({
    onSuccess: () => {
      toast.success("Chaves salvas com sucesso!");
      setTimeout(() => window.location.reload(), 800);
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim() || !apiSecret.trim()) {
      toast.error("Preencha a API Key e o API Secret");
      return;
    }
    saveKeys({ apiKey: apiKey.trim(), apiSecret: apiSecret.trim(), testnet: false });
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px",
    background: "#080b10", border: "1px solid #00ff8820",
    borderRadius: "6px", color: "#00ff88",
    fontFamily: "Courier New, monospace", fontSize: "13px",
    outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0a0f",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "Courier New, monospace", padding: "20px",
    }}>
      <div style={{ width: "100%", maxWidth: "440px" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "8px" }}>
            <Zap size={24} style={{ color: "#00ff88" }} />
            <span style={{ fontSize: "24px", fontWeight: "700", color: "#00ff88", letterSpacing: "1px" }}>
              CryptoTrader
            </span>
          </div>
          <p style={{ fontSize: "12px", color: "#00ff8844" }}>
            Configure sua API Gate.io Futures para começar a operar
          </p>
        </div>

        {/* Card */}
        <form
          onSubmit={handleSave}
          style={{
            background: "#0d1117",
            border: "1px solid #00ff8820",
            borderRadius: "10px",
            padding: "28px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "24px" }}>
            <Key size={16} style={{ color: "#00ff8866" }} />
            <h2 style={{ fontSize: "14px", fontWeight: "600", color: "#00ff88" }}>
              Configurar API Gate.io Futures
            </h2>
          </div>

          {/* Exchange badge */}
          <div style={{
            display: "flex", alignItems: "center", gap: "6px",
            marginBottom: "20px", padding: "8px 12px",
            background: "#17B89710", border: "1px solid #17B89730",
            borderRadius: "6px",
          }}>
            <CheckCircle size={13} style={{ color: "#17B897" }} />
            <span style={{ fontSize: "11px", color: "#17B89799" }}>
              Gate.io Futures (USDT-M) — sem bloqueio geográfico
            </span>
          </div>

          {/* API Key */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "11px", color: "#00ff8866", marginBottom: "6px" }}>
              API KEY
            </label>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Cole sua Gate.io API Key aqui"
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = "#00ff8850")}
              onBlur={(e) => (e.target.style.borderColor = "#00ff8820")}
              disabled={isPending}
            />
          </div>

          {/* API Secret */}
          <div style={{ marginBottom: "24px" }}>
            <label style={{ display: "block", fontSize: "11px", color: "#00ff8866", marginBottom: "6px" }}>
              API SECRET
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showSecret ? "text" : "password"}
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder="Cole seu Gate.io API Secret aqui"
                style={{ ...inputStyle, paddingRight: "40px" }}
                onFocus={(e) => (e.target.style.borderColor = "#00ff8850")}
                onBlur={(e) => (e.target.style.borderColor = "#00ff8820")}
                disabled={isPending}
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                style={{
                  position: "absolute", right: "10px", top: "50%",
                  transform: "translateY(-50%)",
                  background: "none", border: "none",
                  color: "#00ff8855", cursor: "pointer",
                }}
              >
                {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Save button */}
          <button
            type="submit"
            disabled={isPending}
            style={{
              width: "100%", padding: "11px",
              background: "#00ff8820", border: "1px solid #00ff8840",
              borderRadius: "6px", color: "#00ff88",
              fontSize: "13px", fontFamily: "Courier New, monospace",
              fontWeight: "700", cursor: isPending ? "not-allowed" : "pointer",
              opacity: isPending ? 0.6 : 1,
              letterSpacing: "0.5px",
            }}
          >
            {isPending ? "Salvando..." : "Salvar Chaves Gate.io"}
          </button>

          {/* Link to Gate.io */}
          <div style={{ marginTop: "16px", textAlign: "center" }}>
            <a
              href="https://www.gate.io/myaccount/api_key_manage"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex", alignItems: "center", gap: "4px",
                fontSize: "11px", color: "#00ff8844",
                textDecoration: "none",
              }}
            >
              <ExternalLink size={11} />
              Criar API Key na Gate.io
            </a>
          </div>
        </form>

        {/* Permissions */}
        <div style={{
          marginTop: "16px", padding: "12px 16px",
          background: "#00ff8806", border: "1px solid #00ff8815",
          borderRadius: "6px",
        }}>
          <p style={{ fontSize: "10px", color: "#00ff8855", marginBottom: "6px", letterSpacing: "0.5px" }}>
            PERMISSÕES RECOMENDADAS NA GATE.IO
          </p>
          {[
            "Leitura de conta (Spot/Margin/Futures Account Read)",
            "Negociação de Futuros (Futures Trade)",
            "NÃO habilitar: Saques (Withdraw)",
          ].map((p, i) => (
            <p key={p} style={{ fontSize: "11px", color: i === 2 ? "#ff444466" : "#00ff8866", marginBottom: "2px" }}>
              {i === 2 ? "✗" : "✓"} {p}
            </p>
          ))}
          <p style={{ fontSize: "10px", color: "#00ff8833", marginTop: "8px" }}>
            Recomendado: restrinja o IP ao servidor do bot
          </p>
        </div>
      </div>
    </div>
  );
}
