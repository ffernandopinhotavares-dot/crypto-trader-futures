import { useState } from "react";
import { trpc } from "../App";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export function ApiKeySetup() {
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [testnet, setTestnet] = useState(true);
  const [showSecret, setShowSecret] = useState(false);
  const { mutate: saveKeys, isPending } = trpc.bybitKeys.saveKeys.useMutation({
    onSuccess: () => {
      toast.success("Chaves API salvas com sucesso!");
      setApiKey("");
      setApiSecret("");
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey || !apiSecret) {
      toast.error("Por favor, preencha todos os campos");
      return;
    }
    saveKeys({ apiKey, apiSecret, testnet });
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <Card className="bg-slate-900 border-slate-800 w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🔐</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Configurar Bybit API</h1>
          <p className="text-slate-400 mt-2">
            Configure suas chaves de API para começar a operar
          </p>
        </div>

        {/* Warning */}
        <div className="bg-amber-600/10 border border-amber-600/30 rounded-lg p-4 mb-6 flex gap-3">
          <AlertCircle className="text-amber-500 flex-shrink-0" size={20} />
          <div className="text-sm text-amber-200">
            <p className="font-medium mb-1">Segurança</p>
            <p>
              Suas chaves são criptografadas e nunca são compartilhadas. Use
              chaves com permissões limitadas de trading.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* API Key */}
          <div>
            <Label className="text-slate-300 mb-2 block">API Key</Label>
            <Input
              type="text"
              placeholder="Sua chave API Bybit"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              disabled={isPending}
            />
            <p className="text-xs text-slate-500 mt-1">
              Obtenha em: https://www.bybit.com/app/user/api-management
            </p>
          </div>

          {/* API Secret */}
          <div>
            <Label className="text-slate-300 mb-2 block">API Secret</Label>
            <div className="relative">
              <Input
                type={showSecret ? "text" : "password"}
                placeholder="Sua chave secreta Bybit"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 pr-10"
                disabled={isPending}
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showSecret ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Testnet Toggle */}
          <div className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg">
            <input
              type="checkbox"
              id="testnet"
              checked={testnet}
              onChange={(e) => setTestnet(e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 bg-slate-700 cursor-pointer"
              disabled={isPending}
            />
            <label htmlFor="testnet" className="flex-1 cursor-pointer">
              <p className="text-sm font-medium text-white">Usar Testnet</p>
              <p className="text-xs text-slate-400">
                Recomendado para testes iniciais
              </p>
            </label>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isPending}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2"
          >
            {isPending ? "Salvando..." : "Salvar Chaves"}
          </Button>
        </form>

        {/* Help Text */}
        <div className="mt-6 pt-6 border-t border-slate-800">
          <p className="text-xs text-slate-500 mb-2 font-medium">Permissões Recomendadas:</p>
          <ul className="text-xs text-slate-400 space-y-1">
            <li>✓ Leitura de conta</li>
            <li>✓ Leitura de posições</li>
            <li>✓ Leitura de ordens</li>
            <li>✓ Criação de ordens</li>
            <li>✓ Cancelamento de ordens</li>
          </ul>
        </div>
      </Card>
    </div>
  );
}
