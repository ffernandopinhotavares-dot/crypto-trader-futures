# CryptoTrader - Trading Bot Automático para Bybit

Um sistema completo de trading bot automático para a plataforma Bybit, com dashboard dark theme, integração com API Bybit v5, indicadores técnicos avançados e gerenciamento de risco.

## 🚀 Características

### Backend
- **Integração Bybit API v5**: Suporte completo para REST e WebSocket
- **Engine de Trading**: Loop principal com análise em tempo real
- **Indicadores Técnicos**: RSI, MACD, Bollinger Bands, EMA, Volume
- **Gerenciamento de Risco**: Stop-loss, take-profit, position sizing
- **Banco de Dados**: MySQL com Drizzle ORM
- **API tRPC**: Comunicação tipo-segura entre frontend e backend

### Frontend
- **Dashboard Dark Theme**: Interface moderna e responsiva
- **Métricas em Tempo Real**: P&L, taxa de ganho, operações abertas
- **Gráficos Interativos**: Recharts para visualização de dados
- **Configuração de API Keys**: Interface segura para credenciais
- **Histórico de Operações**: Tabelas detalhadas com filtros
- **Controles do Bot**: Start/stop com status em tempo real

## 📋 Pré-requisitos

- Node.js 18+
- pnpm 10+
- MySQL 8+
- Conta Bybit com API keys

## 🔧 Instalação

### 1. Clonar o repositório
```bash
git clone <repo-url>
cd crypto-trader
```

### 2. Instalar dependências
```bash
pnpm install
```

### 3. Configurar variáveis de ambiente
```bash
cp .env.example .env
```

Editar `.env` com suas configurações:
```env
DATABASE_URL=mysql://user:password@localhost:3306/cryptotrader
JWT_SECRET=sua-chave-secreta-aqui
NODE_ENV=production
PORT=3000
VITE_APP_ID=cryptotrader
OWNER_OPEN_ID=local-owner
```

### 4. Inicializar banco de dados
```bash
pnpm run db:push
```

### 5. Build do projeto
```bash
pnpm run build
```

### 6. Iniciar o servidor
```bash
pnpm run start
```

O aplicativo estará disponível em `http://localhost:3000`

## 🎯 Como Usar

### 1. Configurar Chaves de API Bybit

1. Acesse https://www.bybit.com/app/user/api-management
2. Crie uma nova API key com as seguintes permissões:
   - Leitura de conta
   - Leitura de posições
   - Leitura de ordens
   - Criação de ordens
   - Cancelamento de ordens
3. Copie a API key e secret
4. Na interface do CryptoTrader, vá para "Configurações" e cole as chaves
5. Selecione Testnet para testes iniciais

### 2. Criar Configuração de Trading

1. Vá para "Configuração"
2. Clique em "Nova Configuração"
3. Preencha os parâmetros:
   - **Nome**: Nome descritivo da estratégia
   - **Pares**: Selecione os pares a tradear (ex: BTCUSDT, ETHUSDT)
   - **Stop Loss**: Percentual de perda máxima (ex: 2%)
   - **Take Profit**: Percentual de lucro alvo (ex: 5%)
   - **Timeframe**: Intervalo de análise (1m a 1d)
   - **Indicadores**: Configure RSI, MACD, Bollinger Bands

### 3. Iniciar o Bot

1. Vá para "Dashboard"
2. Selecione a configuração desejada
3. Clique em "Iniciar Bot"
4. Monitore as operações em tempo real

### 4. Analisar Resultados

1. Vá para "Operações" para ver o histórico completo
2. Analise P&L, taxa de ganho e estatísticas
3. Ajuste as configurações conforme necessário

## 📊 Indicadores Técnicos

### RSI (Relative Strength Index)
- **Período**: 14 (configurável)
- **Overbought**: > 70
- **Oversold**: < 30
- **Uso**: Identificar reversões de tendência

### MACD (Moving Average Convergence Divergence)
- **Períodos**: 12, 26, 9 (configuráveis)
- **Sinais**: Cruzamento de linhas
- **Uso**: Confirmar tendências

### Bollinger Bands
- **Período**: 20 (configurável)
- **Desvio Padrão**: 2 (configurável)
- **Sinais**: Toque nas bandas
- **Uso**: Identificar níveis de suporte/resistência

### EMA (Exponential Moving Average)
- **Período**: 50 (configurável)
- **Uso**: Confirmar direção da tendência

### Volume
- **Análise**: Comparação com média móvel
- **Uso**: Confirmar força dos sinais

## 🛡️ Gerenciamento de Risco

### Stop Loss
- Define o nível máximo de perda por operação
- Executado automaticamente ao atingir o preço

### Take Profit
- Define o nível de lucro alvo
- Executado automaticamente ao atingir o preço

### Position Sizing
- Calcula tamanho da posição baseado em:
  - Saldo disponível
  - Percentual máximo de risco
  - Volatilidade do ativo

### Max Drawdown
- Limite máximo de queda acumulada
- Para o bot se ultrapassado

## 📁 Estrutura do Projeto

```
crypto-trader/
├── client/                 # Frontend React
│   ├── src/
│   │   ├── App.tsx        # Componente principal
│   │   ├── pages/         # Páginas da aplicação
│   │   ├── components/    # Componentes reutilizáveis
│   │   └── lib/           # Utilitários
│   └── index.html
├── server/                # Backend Node.js
│   ├── _core/            # Configuração tRPC
│   ├── index.ts          # Entrada do servidor
│   ├── bybit.ts          # Cliente Bybit API
│   ├── db.ts             # Conexão banco de dados
│   ├── indicators.ts     # Indicadores técnicos
│   ├── tradingEngine.ts  # Engine de trading
│   └── routers.ts        # Rotas tRPC
├── drizzle/              # Schema do banco de dados
├── shared/               # Código compartilhado
└── package.json
```

## 🔌 API Endpoints

### Bybit Keys
- `POST /trpc/bybitKeys.saveKeys` - Salvar chaves de API
- `GET /trpc/bybitKeys.getKeys` - Obter chaves (mascaradas)
- `DELETE /trpc/bybitKeys.deleteKeys` - Deletar chaves

### Trading Config
- `POST /trpc/tradingConfig.create` - Criar configuração
- `GET /trpc/tradingConfig.getAll` - Listar configurações
- `GET /trpc/tradingConfig.getById` - Obter configuração
- `PUT /trpc/tradingConfig.update` - Atualizar configuração
- `DELETE /trpc/tradingConfig.delete` - Deletar configuração

### Bot Control
- `POST /trpc/botControl.start` - Iniciar bot
- `POST /trpc/botControl.stop` - Parar bot
- `GET /trpc/botControl.getStatus` - Status do bot

### Trades
- `GET /trpc/trades.getRecent` - Operações recentes
- `GET /trpc/trades.getBySymbol` - Operações por símbolo
- `GET /trpc/trades.getStats` - Estatísticas

### Logs
- `GET /trpc/logs.getRecent` - Logs recentes

## 🧪 Testes

```bash
# Executar testes unitários
pnpm run test

# Verificar tipos TypeScript
pnpm run check

# Formatar código
pnpm run format
```

## 🚨 Segurança

- **Chaves de API**: Criptografadas no banco de dados
- **Autenticação**: JWT (implementar conforme necessário)
- **HTTPS**: Usar em produção
- **Rate Limiting**: Implementar para proteger API
- **Validação**: Todas as entradas validadas com Zod

## ⚠️ Avisos Importantes

1. **Testnet Primeiro**: Sempre teste a estratégia no testnet antes de usar mainnet
2. **Pequenas Posições**: Comece com posições pequenas
3. **Monitoramento**: Monitore o bot regularmente
4. **Backup**: Faça backup das configurações
5. **Risco**: Trading envolve risco de perda total

## 🐛 Troubleshooting

### Erro de Conexão com Banco de Dados
```bash
# Verificar se MySQL está rodando
mysql -u user -p -h localhost

# Recriar banco de dados
pnpm run db:push
```

### Erro de Autenticação Bybit
- Verificar se as chaves estão corretas
- Verificar se as permissões estão ativas
- Testar com Testnet primeiro

### Bot não inicia
- Verificar logs em "Configurações" > "Logs"
- Verificar se há configuração ativa
- Verificar saldo disponível

## 📝 Logs

Os logs são armazenados no banco de dados e podem ser visualizados em:
- Dashboard: Últimas operações
- Configurações: Histórico completo

## 🔄 Atualizações

Para atualizar o projeto:
```bash
git pull origin main
pnpm install
pnpm run db:push
pnpm run build
```

## 📞 Suporte

Para reportar bugs ou sugerir melhorias, abra uma issue no repositório.

## 📄 Licença

MIT License - veja LICENSE para detalhes

## 🙏 Agradecimentos

- Bybit API Documentation
- Drizzle ORM
- tRPC
- React Query
- Tailwind CSS

---

**Desenvolvido com ❤️ para traders automáticos**

**Versão**: 1.0.0  
**Última atualização**: 20 de Março de 2026
