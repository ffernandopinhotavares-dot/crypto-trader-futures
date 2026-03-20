import { useState } from "react";
import { trpc } from "../App";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Eye, EyeOff, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export function SettingsPage() {
  const { data: apiKeys } = trpc.bybitKeys.getKeys.useQuery();
  const { mutate: deleteKeys, isPending: isDeleting } =
    trpc.bybitKeys.deleteKeys.useMutation({
      onSuccess: () => {
        toast.success("Chaves API removidas com sucesso!");
      },
      onError: (error) => {
        toast.error(`Erro: ${error.message}`);
      },
    });

  const [showSecret, setShowSecret] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Configurações</h1>
        <p className="text-slate-400 mt-1">
          Gerencie suas preferências e credenciais
        </p>
      </div>

      {/* API Keys Section */}
      <Card className="bg-slate-900 border-slate-800 p-6">
        <h2 className="text-xl font-bold text-white mb-4">Chaves de API Bybit</h2>

        {apiKeys ? (
          <div className="space-y-4">
            <div>
              <Label className="text-slate-300 mb-2 block">API Key</Label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={apiKeys.apiKey}
                  readOnly
                  className="bg-slate-800 border-slate-700 text-white"
                />
                <Button
                  variant="outline"
                  className="border-slate-700"
                  onClick={() => {
                    navigator.clipboard.writeText(apiKeys.apiKey);
                    toast.success("Copiado!");
                  }}
                >
                  Copiar
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-slate-300 mb-2 block">Rede</Label>
              <div className="flex items-center gap-2 p-3 bg-slate-800 rounded">
                <div
                  className={`w-2 h-2 rounded-full ${
                    apiKeys.testnet ? "bg-orange-500" : "bg-green-500"
                  }`}
                />
                <span className="text-white">
                  {apiKeys.testnet ? "Testnet" : "Mainnet"}
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                onClick={() => deleteKeys()}
                disabled={isDeleting}
                variant="destructive"
                className="gap-2"
              >
                <Trash2 size={18} />
                Remover Chaves
              </Button>
              <Button
                variant="outline"
                className="gap-2 border-slate-700 text-slate-300"
              >
                <RefreshCw size={18} />
                Atualizar Chaves
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-slate-400 mb-4">Nenhuma chave de API configurada</p>
            <Button className="bg-blue-600 hover:bg-blue-700">
              Configurar Chaves
            </Button>
          </div>
        )}
      </Card>

      {/* Bot Settings */}
      <Card className="bg-slate-900 border-slate-800 p-6">
        <h2 className="text-xl font-bold text-white mb-4">Configurações do Bot</h2>

        <div className="space-y-4">
          <div>
            <Label className="text-slate-300 mb-2 block">
              Intervalo de Verificação (minutos)
            </Label>
            <Input
              type="number"
              defaultValue="5"
              min="1"
              max="60"
              className="bg-slate-800 border-slate-700 text-white"
            />
          </div>

          <div>
            <Label className="text-slate-300 mb-2 block">
              Notificações
            </Label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  defaultChecked
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700"
                />
                <span className="text-white">Notificar ao abrir posição</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  defaultChecked
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700"
                />
                <span className="text-white">Notificar ao fechar posição</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700"
                />
                <span className="text-white">Notificar erros</span>
              </label>
            </div>
          </div>

          <div className="pt-4">
            <Button className="bg-blue-600 hover:bg-blue-700">
              Salvar Configurações
            </Button>
          </div>
        </div>
      </Card>

      {/* Danger Zone */}
      <Card className="bg-red-950/20 border-red-900/30 p-6">
        <h2 className="text-xl font-bold text-red-400 mb-4">Zona de Perigo</h2>

        <div className="space-y-4">
          <p className="text-slate-300">
            Essas ações são irreversíveis. Por favor, tenha cuidado.
          </p>

          <Button
            variant="destructive"
            className="gap-2"
          >
            <Trash2 size={18} />
            Limpar Histórico de Operações
          </Button>

          <Button
            variant="destructive"
            className="gap-2"
          >
            <Trash2 size={18} />
            Resetar Todas as Configurações
          </Button>
        </div>
      </Card>

      {/* About */}
      <Card className="bg-slate-900 border-slate-800 p-6">
        <h2 className="text-xl font-bold text-white mb-4">Sobre</h2>

        <div className="space-y-2 text-slate-400">
          <p>
            <span className="text-slate-300">Versão:</span> 1.0.0
          </p>
          <p>
            <span className="text-slate-300">Última atualização:</span> 20 de
            Março de 2026
          </p>
          <p>
            <span className="text-slate-300">Desenvolvido por:</span> CryptoTrader
            Team
          </p>
        </div>
      </Card>
    </div>
  );
}
