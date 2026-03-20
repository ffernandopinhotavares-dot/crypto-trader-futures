import { useState } from "react";
import { trpc } from "../App";
import { Settings, Plus, Trash2, ChevronUp } from "lucide-react";
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

function NeonInput({ label, value, onChange, type = "text", step }: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  step?: string;
}) {
  return (
    <div style={{ marginBottom: "14px" }}>
      <label style={{ display: "block", fontSize: "11px", color: "#00ff8866", marginBottom: "6px", fontFamily: "Courier New, monospace" }}>
        {label}
      </label>
      <input
        type={type}
        step={step}
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
    </div>
  );
}

const defaultForm = {
  name: "Estratégia Principal",
  tradingPairs: "BTCUSDT,ETHUSDT",
  timeframe: "1h",
  stopLossPercent: 2,
  takeProfitPercent: 5,
  maxPositionSize: 100,
  maxDrawdown: 10,
  rsiPeriod: 14,
  rsiOverbought: 70,
  rsiOversold: 30,
  macdFastPeriod: 12,
  macdSlowPeriod: 26,
  macdSignalPeriod: 9,
  bbPeriod: 20,
  bbStdDev: 2,
  emaPeriod: 50,
  minVolume: 0,
};

export function ConfigurationPage() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(defaultForm);

  const { data: configs, refetch } = trpc.tradingConfig.getAll.useQuery();
  const { mutate: createConfig, isPending: isCreating } = trpc.tradingConfig.create.useMutation({
    onSuccess: () => {
      toast.success("Configuração criada com sucesso!");
      setShowForm(false);
      setForm(defaultForm);
      refetch();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
  const { mutate: deleteConfig } = trpc.tradingConfig.delete.useMutation({
    onSuccess: () => { toast.success("Configuração removida"); refetch(); },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const handleCreate = () => {
    if (!form.name) { toast.error("Preencha o nome da estratégia"); return; }
    createConfig({
      name: form.name,
      tradingPairs: form.tradingPairs.split(",").map((s) => s.trim()),
      timeframe: form.timeframe as any,
      stopLossPercent: Number(form.stopLossPercent),
      takeProfitPercent: Number(form.takeProfitPercent),
      maxPositionSize: Number(form.maxPositionSize),
      maxDrawdown: Number(form.maxDrawdown),
      rsiPeriod: Number(form.rsiPeriod),
      rsiOverbought: Number(form.rsiOverbought),
      rsiOversold: Number(form.rsiOversold),
      macdFastPeriod: Number(form.macdFastPeriod),
      macdSlowPeriod: Number(form.macdSlowPeriod),
      macdSignalPeriod: Number(form.macdSignalPeriod),
      bbPeriod: Number(form.bbPeriod),
      bbStdDev: Number(form.bbStdDev),
      emaPeriod: Number(form.emaPeriod),
      minVolume: Number(form.minVolume),
    });
  };

  const set = (key: string) => (val: string) => setForm((f) => ({ ...f, [key]: val }));

  return (
    <div style={{ fontFamily: "Courier New, monospace" }}>
      <div style={{ marginBottom: "20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Settings size={18} style={{ color: "#00ff88" }} />
          <h1 style={{ fontSize: "18px", fontWeight: "700", color: "#00ff88" }}>Configuração de Estratégia</h1>
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

      {showForm && (
        <NeonCard style={{ marginBottom: "20px" }}>
          <h2 style={{ fontSize: "14px", color: "#00ff88", marginBottom: "20px", fontWeight: "600" }}>
            Nova Configuração
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0 20px" }}>
            <NeonInput label="Nome da Estratégia" value={form.name} onChange={set("name")} />
            <NeonInput label="Pares (separados por vírgula)" value={form.tradingPairs} onChange={set("tradingPairs")} />
            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", fontSize: "11px", color: "#00ff8866", marginBottom: "6px" }}>
                Timeframe
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
                {["1m","5m","15m","30m","1h","4h","1d"].map((tf) => (
                  <option key={tf} value={tf}>{tf}</option>
                ))}
              </select>
            </div>
            <NeonInput label="Stop Loss (%)" value={form.stopLossPercent} onChange={set("stopLossPercent")} type="number" step="0.1" />
            <NeonInput label="Take Profit (%)" value={form.takeProfitPercent} onChange={set("takeProfitPercent")} type="number" step="0.1" />
            <NeonInput label="Tamanho Máx. Posição (USDT)" value={form.maxPositionSize} onChange={set("maxPositionSize")} type="number" />
            <NeonInput label="Drawdown Máximo (%)" value={form.maxDrawdown} onChange={set("maxDrawdown")} type="number" step="0.1" />
          </div>
          <p style={{ fontSize: "11px", color: "#00ff8844", marginBottom: "14px", marginTop: "4px" }}>
            Parâmetros de Indicadores Técnicos
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0 20px" }}>
            <NeonInput label="RSI Período" value={form.rsiPeriod} onChange={set("rsiPeriod")} type="number" />
            <NeonInput label="RSI Sobrecomprado" value={form.rsiOverbought} onChange={set("rsiOverbought")} type="number" />
            <NeonInput label="RSI Sobrevendido" value={form.rsiOversold} onChange={set("rsiOversold")} type="number" />
            <NeonInput label="MACD Rápido" value={form.macdFastPeriod} onChange={set("macdFastPeriod")} type="number" />
            <NeonInput label="MACD Lento" value={form.macdSlowPeriod} onChange={set("macdSlowPeriod")} type="number" />
            <NeonInput label="MACD Sinal" value={form.macdSignalPeriod} onChange={set("macdSignalPeriod")} type="number" />
            <NeonInput label="Bollinger Período" value={form.bbPeriod} onChange={set("bbPeriod")} type="number" />
            <NeonInput label="Bollinger Desvio Padrão" value={form.bbStdDev} onChange={set("bbStdDev")} type="number" step="0.1" />
            <NeonInput label="EMA Período" value={form.emaPeriod} onChange={set("emaPeriod")} type="number" />
            <NeonInput label="Volume Mínimo" value={form.minVolume} onChange={set("minVolume")} type="number" />
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
              {isCreating ? "Salvando..." : "Salvar Configuração"}
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
          {configs.map((config: any) => (
            <NeonCard key={config.id}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "14px" }}>
                <div>
                  <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#00ff88" }}>{config.name}</h3>
                  <p style={{ fontSize: "11px", color: "#00ff8855", marginTop: "2px" }}>
                    {Array.isArray(config.tradingPairs) ? config.tradingPairs.join(", ") : config.tradingPairs}
                  </p>
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
                  ["Timeframe", config.timeframe],
                  ["Stop Loss", `${config.stopLossPercent}%`],
                  ["Take Profit", `${config.takeProfitPercent}%`],
                  ["Pos. Máxima", `${config.maxPositionSize} USDT`],
                  ["Drawdown Máx.", `${config.maxDrawdown}%`],
                  ["RSI", `${config.rsiPeriod} (${config.rsiOversold}/${config.rsiOverbought})`],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p style={{ fontSize: "10px", color: "#00ff8844" }}>{label}</p>
                    <p style={{ fontSize: "12px", color: "#00ff88aa" }}>{value}</p>
                  </div>
                ))}
              </div>
            </NeonCard>
          ))}
        </div>
      ) : !showForm ? (
        <NeonCard style={{ textAlign: "center", padding: "40px" }}>
          <p style={{ color: "#00ff8833", fontSize: "13px" }}>
            Nenhuma configuração criada. Clique em "Nova Estratégia" para começar.
          </p>
        </NeonCard>
      ) : null}
    </div>
  );
}
