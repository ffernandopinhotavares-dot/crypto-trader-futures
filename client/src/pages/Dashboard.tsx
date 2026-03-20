import { trpc } from "../App";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { TrendingUp, TrendingDown, Activity, Zap } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

export function DashboardPage() {
  const { data: botStatus } = trpc.botControl.getStatus.useQuery();
  const { data: tradeStats } = trpc.trades.getStats.useQuery();
  const { data: recentTrades } = trpc.trades.getRecent.useQuery({ limit: 5 });
  const { data: configs } = trpc.tradingConfig.getAll.useQuery();
  const { mutate: startBot, isPending: isStarting } = trpc.botControl.start.useMutation();
  const { mutate: stopBot, isPending: isStopping } = trpc.botControl.stop.useMutation();

  // Mock data for charts
  const pnlData = [
    { time: "00:00", pnl: 0 },
    { time: "04:00", pnl: 150 },
    { time: "08:00", pnl: 280 },
    { time: "12:00", pnl: 420 },
    { time: "16:00", pnl: 380 },
    { time: "20:00", pnl: 520 },
    { time: "24:00", pnl: 680 },
  ];

  const tradeDistribution = [
    { name: "Ganhos", value: tradeStats?.winningTrades || 0 },
    { name: "Perdas", value: tradeStats?.losingTrades || 0 },
  ];

  const handleStartBot = () => {
    const configId = configs?.[0]?.id;
    if (!configId) {
      alert("Nenhuma configura\u00e7\u00e3o encontrada. Crie uma na aba Configura\u00e7\u00e3o.");
      return;
    }
    startBot({ configId });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 mt-1">
            Bem-vindo ao seu trading bot autom&aacute;tico
          </p>
        </div>
        <div className="flex gap-2">
          {botStatus?.isRunning ? (
            <Button
              onClick={() => stopBot()}
              disabled={isStopping}
              variant="destructive"
              className="gap-2"
            >
              <Zap size={18} />
              Parar Bot
            </Button>
          ) : (
            <Button
              onClick={handleStartBot}
              disabled={isStarting}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              <Zap size={18} />
              Iniciar Bot
            </Button>
          )}
        </div>
      </div>

      {/* Active Config Info */}
      {configs && configs.length > 0 && (
        <Card className="bg-slate-900 border-slate-800 p-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <p className="text-sm text-slate-400">
              Config ativa: <span className="text-white font-medium">{configs[0].name}</span>
              {" | "}Pares: <span className="text-white font-medium">
                {Array.isArray(configs[0].tradingPairs) ? configs[0].tradingPairs.join(", ") : "N/A"}
              </span>
              {" | "}Timeframe: <span className="text-white font-medium">{configs[0].timeframe}</span>
            </p>
          </div>
        </Card>
      )}

      {/* Status Indicator */}
      <Card className="bg-slate-900 border-slate-800 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${
                botStatus?.isRunning
                  ? "bg-green-500 animate-pulse"
                  : "bg-slate-600"
              }`}
            />
            <div>
              <p className="text-sm font-medium text-slate-400">Status do Bot</p>
              <p className="text-lg font-bold text-white">
                {botStatus?.isRunning ? "\ud83d\udfe2 Operando" : "\ud83d\udd34 Parado"}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-400">&Uacute;ltima atualiza&ccedil;&atilde;o</p>
            <p className="text-sm text-slate-200">
              {botStatus?.lastUpdateTime
                ? new Date(botStatus.lastUpdateTime).toLocaleTimeString("pt-BR")
                : "\u2014"}
            </p>
          </div>
        </div>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border-slate-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">P&amp;L Total</p>
              <p className="text-2xl font-bold text-white mt-2">
                ${tradeStats?.totalPnl?.toFixed(2) || "0.00"}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="text-blue-500" size={24} />
            </div>
          </div>
        </Card>

        <Card className="bg-slate-900 border-slate-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Taxa de Ganho</p>
              <p className="text-2xl font-bold text-white mt-2">
                {tradeStats?.winRate?.toFixed(1) || "0"}%
              </p>
            </div>
            <div className="w-12 h-12 bg-green-600/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="text-green-500" size={24} />
            </div>
          </div>
        </Card>

        <Card className="bg-slate-900 border-slate-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Opera&ccedil;&otilde;es Fechadas</p>
              <p className="text-2xl font-bold text-white mt-2">
                {tradeStats?.closedTrades || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-600/20 rounded-lg flex items-center justify-center">
              <Activity className="text-purple-500" size={24} />
            </div>
          </div>
        </Card>

        <Card className="bg-slate-900 border-slate-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Opera&ccedil;&otilde;es Abertas</p>
              <p className="text-2xl font-bold text-white mt-2">
                {tradeStats?.openTrades || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-orange-600/20 rounded-lg flex items-center justify-center">
              <Activity className="text-orange-500" size={24} />
            </div>
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* P&L Chart */}
        <Card className="bg-slate-900 border-slate-800 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">P&amp;L ao Longo do Tempo</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={pnlData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #475569",
                }}
              />
              <Line
                type="monotone"
                dataKey="pnl"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: "#3b82f6" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Trade Distribution */}
        <Card className="bg-slate-900 border-slate-800 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Distribui&ccedil;&atilde;o de Opera&ccedil;&otilde;es</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={tradeDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #475569",
                }}
              />
              <Bar dataKey="value" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Recent Trades */}
      <Card className="bg-slate-900 border-slate-800 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Opera&ccedil;&otilde;es Recentes</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left py-3 px-4 text-slate-400">Par</th>
                <th className="text-left py-3 px-4 text-slate-400">Lado</th>
                <th className="text-left py-3 px-4 text-slate-400">Pre&ccedil;o Entrada</th>
                <th className="text-left py-3 px-4 text-slate-400">Quantidade</th>
                <th className="text-left py-3 px-4 text-slate-400">P&amp;L</th>
                <th className="text-left py-3 px-4 text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentTrades?.map((trade: any) => (
                <tr key={trade.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                  <td className="py-3 px-4 font-medium text-white">{trade.symbol}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        trade.side === "BUY"
                          ? "bg-green-600/20 text-green-400"
                          : "bg-red-600/20 text-red-400"
                      }`}
                    >
                      {trade.side}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-300">
                    ${parseFloat(trade.entryPrice).toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-slate-300">
                    {parseFloat(trade.quantity).toFixed(4)}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={
                        trade.pnl && parseFloat(trade.pnl) > 0
                          ? "text-green-400"
                          : "text-red-400"
                      }
                    >
                      ${trade.pnl ? parseFloat(trade.pnl).toFixed(2) : "\u2014"}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        trade.status === "OPEN"
                          ? "bg-blue-600/20 text-blue-400"
                          : "bg-slate-600/20 text-slate-400"
                      }`}
                    >
                      {trade.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
