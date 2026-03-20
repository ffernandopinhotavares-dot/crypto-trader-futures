import { trpc } from "../App";
import { Card } from "../components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";

export function TradesPage() {
  const { data: trades } = trpc.trades.getRecent.useQuery({ limit: 100 });
  const { data: stats } = trpc.trades.getStats.useQuery();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Histórico de Operações</h1>
        <p className="text-slate-400 mt-1">
          Visualize todas as suas operações de trading
        </p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border-slate-800 p-6">
          <p className="text-sm text-slate-400">Total de Operações</p>
          <p className="text-2xl font-bold text-white mt-2">{stats?.totalTrades || 0}</p>
        </Card>

        <Card className="bg-slate-900 border-slate-800 p-6">
          <p className="text-sm text-slate-400">Operações Ganhadoras</p>
          <p className="text-2xl font-bold text-green-400 mt-2">
            {stats?.winningTrades || 0}
          </p>
        </Card>

        <Card className="bg-slate-900 border-slate-800 p-6">
          <p className="text-sm text-slate-400">Operações Perdedoras</p>
          <p className="text-2xl font-bold text-red-400 mt-2">
            {stats?.losingTrades || 0}
          </p>
        </Card>

        <Card className="bg-slate-900 border-slate-800 p-6">
          <p className="text-sm text-slate-400">Taxa de Ganho</p>
          <p className="text-2xl font-bold text-blue-400 mt-2">
            {stats?.winRate?.toFixed(1) || 0}%
          </p>
        </Card>
      </div>

      {/* Trades Table */}
      <Card className="bg-slate-900 border-slate-800 p-6">
        <h2 className="text-xl font-bold text-white mb-4">Todas as Operações</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left py-3 px-4 text-slate-400">Data</th>
                <th className="text-left py-3 px-4 text-slate-400">Par</th>
                <th className="text-left py-3 px-4 text-slate-400">Lado</th>
                <th className="text-left py-3 px-4 text-slate-400">Preço Entrada</th>
                <th className="text-left py-3 px-4 text-slate-400">Preço Saída</th>
                <th className="text-left py-3 px-4 text-slate-400">Quantidade</th>
                <th className="text-left py-3 px-4 text-slate-400">P&L</th>
                <th className="text-left py-3 px-4 text-slate-400">%</th>
                <th className="text-left py-3 px-4 text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {trades?.map((trade) => (
                <tr
                  key={trade.id}
                  className="border-b border-slate-800 hover:bg-slate-800/50 transition"
                >
                  <td className="py-3 px-4 text-slate-300">
                    {new Date(trade.entryTime).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="py-3 px-4 font-medium text-white">
                    {trade.symbol}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 w-fit ${
                        trade.side === "BUY"
                          ? "bg-green-600/20 text-green-400"
                          : "bg-red-600/20 text-red-400"
                      }`}
                    >
                      {trade.side === "BUY" ? (
                        <TrendingUp size={14} />
                      ) : (
                        <TrendingDown size={14} />
                      )}
                      {trade.side}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-300">
                    ${parseFloat(trade.entryPrice).toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-slate-300">
                    {trade.exitPrice
                      ? `$${parseFloat(trade.exitPrice).toFixed(2)}`
                      : "—"}
                  </td>
                  <td className="py-3 px-4 text-slate-300">
                    {parseFloat(trade.quantity).toFixed(4)}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={
                        trade.pnl && parseFloat(trade.pnl) > 0
                          ? "text-green-400 font-medium"
                          : trade.pnl && parseFloat(trade.pnl) < 0
                          ? "text-red-400 font-medium"
                          : "text-slate-400"
                      }
                    >
                      {trade.pnl ? `$${parseFloat(trade.pnl).toFixed(2)}` : "—"}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={
                        trade.pnlPercent && parseFloat(trade.pnlPercent) > 0
                          ? "text-green-400 font-medium"
                          : trade.pnlPercent && parseFloat(trade.pnlPercent) < 0
                          ? "text-red-400 font-medium"
                          : "text-slate-400"
                      }
                    >
                      {trade.pnlPercent
                        ? `${parseFloat(trade.pnlPercent).toFixed(2)}%`
                        : "—"}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        trade.status === "OPEN"
                          ? "bg-blue-600/20 text-blue-400"
                          : trade.status === "CLOSED"
                          ? "bg-slate-600/20 text-slate-400"
                          : "bg-red-600/20 text-red-400"
                      }`}
                    >
                      {trade.status === "OPEN"
                        ? "Aberta"
                        : trade.status === "CLOSED"
                        ? "Fechada"
                        : "Cancelada"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!trades || trades.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-400">Nenhuma operação registrada ainda</p>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
