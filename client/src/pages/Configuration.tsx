import { useState } from "react";
import { trpc } from "../App";
import { Settings, Plus, Trash2, ChevronUp, Brain, Shield, Zap, TrendingUp } from "lucide-react";
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

function NeonInput({ label, value, onChange, type = "text", step, min, max, hint }: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  step?: string;
  min?: string;
  max?: string;
  hint?: string;
}) {
  return (
    <div style={{ marginBottom: "14px" }}>
      <label style={{ display: "block", fontSize: "11px", color: "#00ff8866", marginBottom: "6px", fontFamily: "Courier New, monospace" }}>
        {label}
      </label>
      <input
        type={type}
        step={step}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%", padding: "8px 12px",
          background: "#080b10", border: "1px solid #00ff8820",
          borderRadius: "5px", color: "#00ff88",
          fontFamily: "Courier New, monospace", fontSize: "13px",
          outline: "none",
        }}
        onFocus={(e) => (e.target.style.borderColor = "#00ff8850")}
        onBlur={(e) => (e.target.style.borderColor = "#00ff8820")}
      />
      {hint && <p style={{ fontSize: "10px", color: "#00ff8833", marginTop: "4px" }}>{hint}</p>}
    </div>
  );
}

type Aggressiveness = "conservative" | "moderate" | "aggressive";

const aggressivenessProfiles: Record<Aggressiveness, { label: string; icon: any; color: string; desc: string }> = {
  conservative: { label: "Conservador", icon: Shield, color: "#00aaff", desc: "Alavancagem 1-5x | Confiança mínima 75% | Posições menores" },
  moderate: { label: "Moderado", icon: TrendingUp, color: "#00ff88", desc: "Alavancagem 3-10x | Confiança mínima 65% | Posições médias" },
  aggressive: { label: "Agressivo", icon: Zap, color: "#ff8800", desc: "Alavancagem 5-20x | Confiança mínima 55% | Posições maiores" },
};

const defaultForm = {
  name: "AI Trader Autônomo",
  aggressiveness: "moderate" as Aggressiveness,
  maxRiskPerTrade: 5,
  maxDrawdown: 15,
  maxOpenPositions: 10,
  timeframe: "15m",
};

export function ConfigurationPage() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(defaultForm);

  const { data: configs, refetch } = trpc.tradingConfig.getAll.useQuery();
  const { mutate: createConfig, isPending: isCreating } = trpc.tradingConfig.create.useMutation({
    onSuccess: () => {
      toast.success("Estratégia AI criada com sucesso!");
      setShowForm(false);
      setForm(defaultForm);
      refetch();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
  const { mutate: deleteConfig } = trpc.tradingConfig.delete.useMutation({
    onSuccess: () => { toast.success("Estratégia removida"); refetch(); },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const handleCreate = () => {
    if (!form.name) { toast.error("Preencha o nome da estratégia"); return; }
    createConfig({
      name: form.name,
      aggressiveness: form.aggressiveness,
      maxRiskPerTrade: Number(form.maxRiskPerTrade),
      maxDrawdown: Number(form.maxDrawdown),
      maxOpenPositions: Number(form.maxOpenPositions),
      timeframe: form.timeframe as any,
    });
  };

  const set = (key: string) => (val: string) => setForm((f) => ({ ...f, [key]: val }));

  return (
    <div style={{ fontFamily: "Courier New, monospace" }}>
      <div style={{ marginBottom: "20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Brain size={18} style={{ color: "#00ff88" }} />
          <h1 style={{ fontSize: "18px", fontWeight: "700", color: "#00ff88" }}>Estratégia AI Autônoma</h1>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            display: "flex", alignItems: "center", gap: "6px",
            padding: "8px 16px", borderRadius: "5px",
            background: "#00ff8815", border: "1px solid #00ff8840",
            color: "#00ff88", fontSize: "12px",
            fontFamily: "Courier New, monospace", fontWeight: "600",
            cursor: "pointer",
          }}
        >
          {showForm ? <ChevronUp size={14} /> : <Plus size={14} />}
          {showForm ? "Fechar" : "Nova Estratégia"}
        </button>
      </div>

      {/* Info Banner */}
      <NeonCard style={{ marginBottom: "20px", borderColor: "#00ff8830" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
          <Brain size={20} style={{ color: "#00ff88", flexShrink: 0, marginTop: "2px" }} />
          <div>
            <p style={{ fontSize: "12px", color: "#00ff88cc", marginBottom: "8px", fontWeight: "600" }}>
              Como funciona a estratégia autônoma
            </p>
            <p style={{ fontSize: "11px", color: "#00ff8866", lineHeight: "1.6" }}>
              A IA analisa continuamente os top 20 pares de futuros da Binance usando RSI, MACD, Bollinger Bands,
              volume, volatilidade, funding rate e tendência. Com base nesses dados, ela decide de forma autônoma:
              quais pares operar, quando abrir/fechar posições, qual alavancagem usar e quanto capital alocar.
              Não há stop-loss ou take-profit fixos — a IA gerencia saídas dinamicamente baseada em probabilidade.
            </p>
          </div>
        </div>
      </NeonCard>

      {showForm && (
        <NeonCard style={{ marginBottom: "20px" }}>
          <h2 style={{ fontSize: "14px", color: "#00ff88", marginBottom: "20px", fontWeight: "600" }}>
            Nova Estratégia AI
          </h2>

          <NeonInput label="Nome da Estratégia" value={form.name} onChange={set("name")} />

          {/* Aggressiveness Selector */}
          <div style={{ marginBottom: "18px" }}>
            <label style={{ display: "block", fontSize: "11px", color: "#00ff8866", marginBottom: "10px" }}>
              Perfil de Risco
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
              {(Object.entries(aggressivenessProfiles) as [Aggressiveness, typeof aggressivenessProfiles["conservative"]][]).map(([key, profile]) => {
                const Icon = profile.icon;
                const isSelected = form.aggressiveness === key;
                return (
                  <button
                    key={key}
                    onClick={() => setForm((f) => ({ ...f, aggressiveness: key }))}
                    style={{
                      padding: "12px",
                      borderRadius: "6px",
                      background: isSelected ? `${profile.color}15` : "#080b10",
                      border: `1px solid ${isSelected ? profile.color + "60" : "#00ff8815"}`,
                      cursor: "pointer",
                      textAlign: "center",
                      transition: "all 0.2s",
                    }}
                  >
                    <Icon size={20} style={{ color: isSelected ? profile.color : "#00ff8833", marginBottom: "6px" }} />
                    <p style={{ fontSize: "12px", fontWeight: "600", color: isSelected ? profile.color : "#00ff8855", fontFamily: "Courier New, monospace" }}>
                      {profile.label}
                    </p>
                    <p style={{ fontSize: "9px", color: isSelected ? profile.color + "88" : "#00ff8833", marginTop: "4px", fontFamily: "Courier New, monospace" }}>
                      {profile.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0 20px" }}>
            <NeonInput
              label="Risco Máx. por Trade (%)"
              value={form.maxRiskPerTrade}
              onChange={set("maxRiskPerTrade")}
              type="number"
              step="1"
              min="1"
              max="20"
              hint="% do saldo alocado por operação"
            />
            <NeonInput
              label="Drawdown Máximo (%)"
              value={form.maxDrawdown}
              onChange={set("maxDrawdown")}
              type="number"
              step="1"
              min="5"
              max="50"
              hint="Bot para se perda total atingir este %"
            />
            <NeonInput
              label="Máx. Posições Simultâneas"
              value={form.maxOpenPositions}
              onChange={set("maxOpenPositions")}
              type="number"
              step="1"
              min="1"
              max="30"
              hint="Diversificação: mais posições = menor risco por trade"
            />
            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", fontSize: "11px", color: "#00ff8866", marginBottom: "6px" }}>
                Timeframe de Análise
              </label>
              <select
                value={form.timeframe}
                onChange={(e) => set("timeframe")(e.target.value)}
                style={{
                  width: "100%", padding: "8px 12px",
                  background: "#080b10", border: "1px solid #00ff8820",
                  borderRadius: "5px", color: "#00ff88",
                  fontFamily: "Courier New, monospace", fontSize: "13px",
                  outline: "none",
                }}
              >
                {["1m", "5m", "15m", "30m", "1h", "4h", "1d"].map((tf) => (
                  <option key={tf} value={tf}>{tf}</option>
                ))}
              </select>
              <p style={{ fontSize: "10px", color: "#00ff8833", marginTop: "4px" }}>
                Menor = mais trades, maior = sinais mais fortes
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
            <button
              onClick={handleCreate}
              disabled={isCreating}
              style={{
                padding: "9px 20px", borderRadius: "5px",
                background: "#00ff8820", border: "1px solid #00ff8840",
                color: "#00ff88", fontSize: "12px",
                fontFamily: "Courier New, monospace", fontWeight: "600",
                cursor: isCreating ? "not-allowed" : "pointer",
                opacity: isCreating ? 0.6 : 1,
              }}
            >
              {isCreating ? "Criando..." : "Criar Estratégia AI"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              style={{
                padding: "9px 16px", borderRadius: "5px",
                background: "transparent", border: "1px solid #00ff8820",
                color: "#00ff8866", fontSize: "12px",
                fontFamily: "Courier New, monospace",
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
          </div>
        </NeonCard>
      )}

      {configs && configs.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
          {configs.map((config: any) => {
            const profile = aggressivenessProfiles[config.aggressiveness as Aggressiveness] ?? aggressivenessProfiles.moderate;
            const Icon = profile.icon;
            return (
              <NeonCard key={config.id}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Icon size={16} style={{ color: profile.color }} />
                    <div>
                      <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#00ff88" }}>{config.name}</h3>
                      <p style={{ fontSize: "11px", color: profile.color + "88", marginTop: "2px" }}>
                        {profile.label}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteConfig({ id: config.id })}
                    style={{
                      background: "transparent", border: "none",
                      color: "#ff446655", cursor: "pointer", padding: "4px",
                    }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#ff4466")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#ff446655")}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {[
                    ["Risco/Trade", `${config.maxRiskPerTrade}%`],
                    ["Drawdown Máx.", `${config.maxDrawdown}%`],
                    ["Posições Máx.", config.maxOpenPositions],
                    ["Timeframe", config.timeframe],
                    ["Pares", "Auto (AI)"],
                    ["SL/TP", "Dinâmico (AI)"],
                  ].map(([label, value]) => (
                    <div key={label as string}>
                      <p style={{ fontSize: "10px", color: "#00ff8844" }}>{label}</p>
                      <p style={{ fontSize: "12px", color: "#00ff88aa" }}>{value}</p>
                    </div>
                  ))}
                </div>
              </NeonCard>
            );
          })}
        </div>
      ) : !showForm ? (
        <NeonCard style={{ textAlign: "center", padding: "40px" }}>
          <Brain size={32} style={{ color: "#00ff8822", marginBottom: "12px" }} />
          <p style={{ color: "#00ff8855", fontSize: "13px" }}>
            Nenhuma estratégia criada. Clique em "Nova Estratégia" para configurar o AI Trader.
          </p>
          <p style={{ color: "#00ff8833", fontSize: "11px", marginTop: "6px" }}>
            A IA escolhe automaticamente os melhores pares e gerencia todas as operações.
          </p>
        </NeonCard>
      ) : null}
    </div>
  );
}
