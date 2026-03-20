# 🚀 Guia de Configuração - CryptoTrader Bot

Siga este guia passo a passo para configurar e executar o CryptoTrader Bot.

## Pré-requisitos

- Node.js 18+ instalado
- pnpm 10+ instalado
- MySQL 8+ rodando localmente ou em um servidor
- Conta Bybit com API keys

## Passo 1: Preparar o Banco de Dados

### Opção A: MySQL Local

```bash
# Criar banco de dados
mysql -u root -p

# No MySQL:
CREATE DATABASE cryptotrader;
CREATE USER 'cryptobot'@'localhost' IDENTIFIED BY 'cryptobot123';
GRANT ALL PRIVILEGES ON cryptotrader.* TO 'cryptobot'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### Opção B: MySQL Remoto

Substitua as credenciais no `.env` com suas credenciais do servidor remoto.

## Passo 2: Configurar Variáveis de Ambiente

```bash
# Copiar arquivo de exemplo
cp .env.example .env

# Editar .env com seus dados
nano .env
```

Certifique-se de que `.env` contém:

```env
# Banco de Dados
DATABASE_URL=mysql://cryptobot:cryptobot123@localhost:3306/cryptotrader

# Segurança
JWT_SECRET=691cef1c56c3c720e600ccee74175b1f319b0c084f7df31607e6ea954754891f

# Servidor
NODE_ENV=production
PORT=3000

# Aplicação
VITE_APP_ID=cryptotrader
OWNER_OPEN_ID=local-owner
```

## Passo 3: Instalar Dependências

```bash
# Limpar instalações anteriores (se houver)
rm -rf node_modules pnpm-lock.yaml

# Instalar com pnpm
pnpm install
```

Espere a instalação completar. Deve levar alguns minutos.

## Passo 4: Inicializar Banco de Dados

```bash
# Gerar e executar migrations
pnpm run db:push
```

Isso criará todas as tabelas necessárias no banco de dados.

## Passo 5: Obter Chaves de API Bybit

1. Acesse https://www.bybit.com/app/user/api-management
2. Clique em "Create New Key"
3. Selecione "API Key Type" = "Unified Trading"
4. Configure as permissões:
   - ✅ Account Access
   - ✅ Position
   - ✅ Order
   - ✅ Wallet
5. Copie a **API Key** e **Secret Key**
6. Salve em um local seguro

## Passo 6: Build do Projeto

```bash
# Compilar TypeScript e Vite
pnpm run build
```

Isso criará a pasta `dist/` com os arquivos compilados.

## Passo 7: Iniciar o Servidor

### Desenvolvimento (com hot reload)

```bash
pnpm run dev
```

Acesse http://localhost:5173

### Produção

```bash
pnpm run start
```

Acesse http://localhost:3000

## Passo 8: Configurar Chaves de API na Interface

1. Abra o navegador em http://localhost:3000 (ou 5173 em dev)
2. Você verá a tela "Configurar Bybit API"
3. Cole a **API Key** no campo "API Key"
4. Cole a **API Secret** no campo "API Secret"
5. Selecione **"Usar Testnet"** para testes iniciais
6. Clique em "Salvar Chaves"

## Passo 9: Criar Primeira Configuração

1. Vá para "Configuração" no menu lateral
2. Clique em "Nova Configuração"
3. Preencha os dados:

```
Nome: Estratégia BTC/ETH
Descrição: Estratégia inicial para teste
Pares: BTCUSDT, ETHUSDT
Tamanho Máximo da Posição: 5%
Stop Loss: 2%
Take Profit: 5%
Timeframe: 1h
```

4. Clique em "Salvar Configuração"

## Passo 10: Iniciar o Bot

1. Vá para "Dashboard"
2. Você verá o status do bot como "🔴 Parado"
3. Clique em "Iniciar Bot"
4. O status mudará para "🟢 Operando"

## 📊 Monitorar o Bot

### Dashboard
- Visualize P&L em tempo real
- Veja operações abertas e fechadas
- Acompanhe a taxa de ganho

### Operações
- Histórico completo de trades
- Detalhes de entrada e saída
- P&L individual

### Configurações
- Gerencie chaves de API
- Ajuste parâmetros do bot
- Visualize logs

## 🧪 Testar em Testnet

Para testes seguros:

1. Selecione "Usar Testnet" ao configurar as chaves
2. Comece com posições pequenas
3. Monitore por 24-48 horas
4. Analise os resultados
5. Ajuste a estratégia se necessário
6. Mude para Mainnet apenas quando confiante

## 🔧 Troubleshooting

### Erro: "Cannot connect to database"

```bash
# Verificar se MySQL está rodando
mysql -u cryptobot -p

# Se não funcionar, reiniciar MySQL
sudo systemctl restart mysql

# Ou verificar credenciais em .env
cat .env | grep DATABASE_URL
```

### Erro: "Bybit API Error"

- Verificar se as chaves estão corretas
- Verificar se as permissões estão ativas
- Testar com Testnet primeiro
- Verificar se há saldo disponível

### Bot não inicia

- Verificar se há configuração ativa
- Verificar logs em "Configurações"
- Reiniciar o servidor

### Interface não carrega

- Limpar cache do navegador (Ctrl+Shift+Delete)
- Verificar console do navegador (F12)
- Verificar se o servidor está rodando

## 📝 Comandos Úteis

```bash
# Verificar tipos TypeScript
pnpm run check

# Formatar código
pnpm run format

# Executar testes
pnpm run test

# Limpar build
rm -rf dist

# Reiniciar tudo
rm -rf node_modules pnpm-lock.yaml dist
pnpm install
pnpm run build
```

## 🚀 Próximos Passos

1. **Estudar a Estratégia**: Entenda como os indicadores funcionam
2. **Testar em Testnet**: Execute por 7-14 dias
3. **Analisar Resultados**: Verifique P&L e taxa de ganho
4. **Otimizar Parâmetros**: Ajuste RSI, MACD, Bollinger Bands
5. **Ir para Mainnet**: Comece com pequenas posições

## ⚠️ Avisos Importantes

- **Risco**: Trading envolve risco de perda total
- **Testnet Primeiro**: Sempre teste antes de usar dinheiro real
- **Monitoramento**: Monitore o bot regularmente
- **Backup**: Salve suas configurações
- **Segurança**: Nunca compartilhe suas chaves de API

## 📞 Suporte

Se encontrar problemas:

1. Verifique os logs em "Configurações" > "Logs"
2. Consulte o README.md para mais informações
3. Verifique a documentação da Bybit API

## ✅ Checklist Final

- [ ] Node.js 18+ instalado
- [ ] MySQL rodando e banco criado
- [ ] `.env` configurado corretamente
- [ ] Dependências instaladas (`pnpm install`)
- [ ] Banco de dados inicializado (`pnpm run db:push`)
- [ ] Projeto compilado (`pnpm run build`)
- [ ] Servidor iniciado (`pnpm run start`)
- [ ] Chaves de API Bybit configuradas
- [ ] Primeira configuração criada
- [ ] Bot testado em Testnet

Parabéns! Você está pronto para começar! 🎉

---

**Versão**: 1.0.0  
**Data**: 20 de Março de 2026
