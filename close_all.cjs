const GateApi = require('gate-api');

const client = new GateApi.ApiClient();
client.setApiKeySecret(
  'a4f42d8858aece6cc5e5fb624ff97f67',
  'abcb060db540421e6e451c3d61bbf65034d7c3a884dc876492541b1034ae06f2'
);
const api = new GateApi.FuturesApi(client);
const settle = 'usdt';

async function main() {
  // Get all open positions
  const posResult = await api.listPositions(settle, { holding: true });
  const positions = posResult.body;
  
  console.log(`Found ${positions.length} open positions:`);
  for (const p of positions) {
    console.log(`  ${p.contract} mode=${p.mode} size=${p.size} entry=${p.entryPrice} pnl=${p.unrealisedPnl}`);
  }
  
  if (positions.length === 0) {
    console.log('No positions to close!');
    return;
  }
  
  // Close each position
  for (const p of positions) {
    const symbol = p.contract;
    const mode = p.mode; // dual_long or dual_short
    const size = p.size; // positive for dual_long, negative for dual_short
    
    try {
      if (mode === 'dual_long' || mode === 'dual_short') {
        // Dual mode: use auto_size
        const autoSize = mode === 'dual_long' ? 'close_long' : 'close_short';
        const closeSide = mode === 'dual_long' ? -1 : 1; // opposite: sell for long, buy for short
        
        const order = {
          contract: symbol,
          size: 0,
          price: '0',
          tif: 'ioc',
          autoSize: autoSize,
        };
        
        console.log(`Closing ${symbol} ${mode} with autoSize=${autoSize}...`);
        const result = await api.createFuturesOrder(settle, order);
        console.log(`  OK: orderId=${result.body.id} status=${result.body.status} fillPrice=${result.body.fillPrice}`);
      } else {
        // Single mode: use reduce_only with opposite size
        const closeSize = -size; // opposite
        const order = {
          contract: symbol,
          size: closeSize,
          price: '0',
          tif: 'ioc',
          reduceOnly: true,
        };
        
        console.log(`Closing ${symbol} single mode size=${closeSize}...`);
        const result = await api.createFuturesOrder(settle, order);
        console.log(`  OK: orderId=${result.body.id} status=${result.body.status} fillPrice=${result.body.fillPrice}`);
      }
    } catch (err) {
      console.error(`  ERROR closing ${symbol}:`, err.body || err.message || err);
    }
  }
  
  // Verify
  console.log('\n=== Verifying remaining positions ===');
  const verifyResult = await api.listPositions(settle, { holding: true });
  console.log(`Remaining positions: ${verifyResult.body.length}`);
  for (const p of verifyResult.body) {
    console.log(`  ${p.contract} mode=${p.mode} size=${p.size}`);
  }
  
  // Check balance
  const balResult = await api.listFuturesAccounts(settle);
  const bal = balResult.body;
  console.log(`\nBalance: ${bal.total} USDT (available: ${bal.available})`);
}

main().catch(console.error);
