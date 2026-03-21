import { useState } from "react";
import { trpc } from "../App";
import { Zap, Key, Eye, EyeOff, ExternalLink, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export function ApiKeySetup() {
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [testnet, setTestnet] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const { mutate: saveKeys, isPending } = trpc.binanceKeys.saveKeys.useMutation({
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
    saveKeys({ apiKey: apiKey.trim(), apiSecret: apiSecret.trim(), testnet });
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
            Configure sua API Binance Futures para começar a operar
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
              Configurar API Binance Futures
            </h2>
          </div>

          {/* Exchange badge */}
          <div style={{
            display: "flex", alignItems: "center", gap: "6px",
            marginBottom: "20px", padding: "8px 12px",
            background: "#F0B90B10", border: "1px solid #F0B90B30",
            borderRadius: "6px",
          }}>
            <CheckCircle size={13} style={{ color: "#F0B90B" }} />
            <span style={{ fontSize: "11px", color: "#F0B90B99" }}>
              Binance Futures (USD-M) — disponível no Brasil
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
              placeholder="Cole sua Binance API Key aqui"
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = "#00ff8850")}
              onBlur={(e) => (e.target.style.borderColor = "#00ff8820")}
              disabled={isPending}
            />
          </div>

          {/* API Secret */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "11px", color: "#00ff8866", marginBottom: "6px" }}>
              API SECRET
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showSecret ? "text" : "password"}
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder="Cole seu Binance API Secret aqui"
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

          {/* Testnet toggle */}
          <div style={{ marginBottom: "24px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
              <div
                onClick={() => setTestnet(!testnet)}
                style={{
                  width: "36px", height: "20px", borderRadius: "10px",
                  background: testnet ? "#00ff8830" : "#ffffff10",
                  border: `1px solid ${testnet ? "#00ff8850" : "#ffffff15"}`,
                  position: "relative", transition: "all 0.2s",
                  cursor: "pointer", flexShrink: 0,
                }}
              >
                <div style={{
                  width: "14px", height: "14px", borderRadius: "50%",
                  background: testnet ? "#00ff88" : "#ffffff44",
                  position: "absolute", top: "2px",
                  left: testnet ? "18px" : "2px",
                  transition: "left 0.2s",
                }} />
              </div>
              <div>
                <p style={{ fontSize: "12px", color: "#00ff8877" }}>Usar Testnet</p>
                <p style={{ fontSize: "10px", color: "#00ff8833" }}>Recomendado para testes iniciais</p>
              </div>
            </label>
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
            {isPending ? "Salvando..." : "Salvar Chaves Binance"}
          </button>

          {/* Link to Binance */}
          <div style={{ marginTop: "16px", textAlign: "center" }}>
            <a
              href="https://www.binance.com/pt-BR/my/settings/api-management"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex", alignItems: "center", gap: "4px",
                fontSize: "11px", color: "#00ff8844",
                textDecoration: "none",
              }}
            >
              <ExternalLink size={11} />
              Criar API Key na Binance
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
            PERMISSÕES RECOMENDADAS NA BINANCE
          </p>
          {[
            "Leitura de conta (Read)",
            "Negociação de Futuros (Futures Trading)",
            "NÃO habilitar: Saques ou Transferências",
          ].map((p, i) => (
            <p key={p} style={{ fontSize: "11px", color: i === 2 ? "#ff444466" : "#00ff8866", marginBottom: "2px" }}>
              {i === 2 ? "✗" : "✓"} {p}
            </p>
          ))}
          <p style={{ fontSize: "10px", color: "#00ff8833", marginTop: "8px" }}>
            Restrinja o IP ao servidor: 50.31.196.137
          </p>
        </div>
      </div>
    </div>
  );
}
