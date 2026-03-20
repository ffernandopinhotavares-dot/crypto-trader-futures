import { useState } from "react";
import { trpc } from "../App";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Plus, Trash2, Edit2 } from "lucide-react";
import { toast } from "sonner";

export function ConfigurationPage() {
  const { data: configs } = trpc.tradingConfig.getAll.useQuery();
  const { mutate: createConfig, isPending: isCreating } =
    trpc.tradingConfig.create.useMutation({
      onSuccess: () => {
        toast.success("Configuração criada com sucesso!");
        setShowForm(false);
        resetForm();
      },
      onError: (error) => {
        toast.error(`Erro: ${error.message}`);
      },
    });

  const { mutate: deleteConfig } = trpc.tradingConfig.delete.useMutation({
    onSuccess: () => {
      toast.success("Configuração deletada com sucesso!");
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    tradingPairs: ["BTCUSDT", "ETHUSDT"],
    maxPositionSize: 5,
    maxDrawdown: 10,
    stopLossPercent: 2,
    takeProfitPercent: 5,
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
    timeframe: "1h" as const,
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      tradingPairs: ["BTCUSDT", "ETHUSDT"],
      maxPositionSize: 5,
      maxDrawdown: 10,
      stopLossPercent: 2,
      takeProfitPercent: 5,
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
      timeframe: "1h",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error("Por favor, preencha o nome da configuração");
      return;
    }
    createConfig(formData as any);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Configurações de Trading</h1>
          <p className="text-slate-400 mt-1">
            Crie e gerencie suas estratégias de trading
          </p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="gap-2 bg-blue-600 hover:bg-blue-700"
        >
          <Plus size={18} />
          Nova Configuração
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <Card className="bg-slate-900 border-slate-800 p-6">
          <h2 className="text-xl font-bold text-white mb-4">Nova Configuração</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Name */}
              <div>
                <Label className="text-slate-300">Nome</Label>
                <Input
                  type="text"
                  placeholder="Ex: Estratégia BTC/ETH"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>

              {/* Description */}
              <div>
                <Label className="text-slate-300">Descrição</Label>
                <Input
                  type="text"
                  placeholder="Descrição da estratégia"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>

              {/* Max Position Size */}
              <div>
                <Label className="text-slate-300">Tamanho Máximo da Posição (%)</Label>
                <Input
                  type="number"
                  value={formData.maxPositionSize}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      maxPositionSize: parseFloat(e.target.value),
                    })
                  }
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>

              {/* Stop Loss */}
              <div>
                <Label className="text-slate-300">Stop Loss (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.stopLossPercent}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      stopLossPercent: parseFloat(e.target.value),
                    })
                  }
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>

              {/* Take Profit */}
              <div>
                <Label className="text-slate-300">Take Profit (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.takeProfitPercent}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      takeProfitPercent: parseFloat(e.target.value),
                    })
                  }
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>

              {/* Timeframe */}
              <div>
                <Label className="text-slate-300">Timeframe</Label>
                <select
                  value={formData.timeframe}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      timeframe: e.target.value as any,
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded px-3 py-2"
                >
                  <option value="1m">1 Minuto</option>
                  <option value="5m">5 Minutos</option>
                  <option value="15m">15 Minutos</option>
                  <option value="30m">30 Minutos</option>
                  <option value="1h">1 Hora</option>
                  <option value="4h">4 Horas</option>
                  <option value="1d">1 Dia</option>
                </select>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-2 pt-4">
              <Button
                type="submit"
                disabled={isCreating}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isCreating ? "Salvando..." : "Salvar Configuração"}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                variant="outline"
                className="border-slate-700 text-slate-300"
              >
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Configurations List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {configs?.map((config) => (
          <Card key={config.id} className="bg-slate-900 border-slate-800 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">{config.name}</h3>
                <p className="text-sm text-slate-400">{config.description}</p>
              </div>
              <div className="flex gap-2">
                <button className="p-2 hover:bg-slate-800 rounded transition">
                  <Edit2 size={18} className="text-slate-400" />
                </button>
                <button
                  onClick={() => deleteConfig({ id: config.id })}
                  className="p-2 hover:bg-red-600/20 rounded transition"
                >
                  <Trash2 size={18} className="text-red-400" />
                </button>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Pares:</span>
                <span className="text-white">
                  {Array.isArray(config.tradingPairs)
                    ? config.tradingPairs.join(", ")
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Stop Loss:</span>
                <span className="text-white">{config.stopLossPercent}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Take Profit:</span>
                <span className="text-white">{config.takeProfitPercent}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Timeframe:</span>
                <span className="text-white">{config.timeframe}</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-800">
              <Button
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                Usar Esta Configuração
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {!configs || configs.length === 0 ? (
        <Card className="bg-slate-900 border-slate-800 p-12 text-center">
          <p className="text-slate-400">Nenhuma configuração criada ainda</p>
          <Button
            onClick={() => setShowForm(true)}
            className="mt-4 gap-2 bg-blue-600 hover:bg-blue-700"
          >
            <Plus size={18} />
            Criar Primeira Configuração
          </Button>
        </Card>
      ) : null}
    </div>
  );
}
