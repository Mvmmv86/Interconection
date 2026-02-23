// Test DeFiLlama matching with Zerion positions
const ZERION_API_KEY = 'zk_dev_cada2a7b670f44288ce0bd4b2669ad8a';
const TEST_WALLET = process.argv[2] || '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';

async function testMatching() {
  console.log('='.repeat(80));
  console.log('DEFI LLAMA MATCHING TEST');
  console.log('='.repeat(80));

  // 1. Fetch DeFiLlama pools
  console.log('\n1. Fetching DeFiLlama pools...');
  const llamaResponse = await fetch('https://yields.llama.fi/pools');
  const llamaData = await llamaResponse.json();

  console.log('   Total pools: ' + llamaData.data.length);

  // Create index
  const poolIndex = new Map();
  for (const pool of llamaData.data) {
    const key = pool.project.toLowerCase() + '-' + pool.chain.toLowerCase();
    if (!poolIndex.has(key)) {
      poolIndex.set(key, []);
    }
    poolIndex.get(key).push(pool);
  }
  console.log('   Unique protocol-chain combos: ' + poolIndex.size);

  // 2. Fetch Zerion positions
  console.log('\n2. Fetching Zerion positions...');
  const authHeader = 'Basic ' + Buffer.from(ZERION_API_KEY + ':').toString('base64');
  const zerionUrl = 'https://api.zerion.io/v1/wallets/' + TEST_WALLET + '/positions/?filter[positions]=only_complex&filter[trash]=only_non_trash&currency=usd&sort=value';

  const zerionResponse = await fetch(zerionUrl, {
    headers: { 'Accept': 'application/json', 'Authorization': authHeader },
  });
  const zerionData = await zerionResponse.json();

  console.log('   Total positions: ' + zerionData.data.length);

  // 3. Try to match
  console.log('\n3. Matching positions to DeFiLlama pools...\n');

  const chainMap = {
    'ethereum': 'Ethereum',
    'base': 'Base',
    'arbitrum': 'Arbitrum',
    'arbitrum-one': 'Arbitrum',
    'optimism': 'Optimism',
    'polygon': 'Polygon',
    'avalanche': 'Avalanche',
    'binance-smart-chain': 'BSC',
    'bsc': 'BSC',
  };

  let matched = 0;
  let unmatched = 0;
  const matchedPositions = [];
  const unmatchedProtocols = new Set();

  for (const position of zerionData.data.slice(0, 30)) { // Test first 30
    const protocol = position.attributes.protocol || 'Unknown';
    const chainId = position.relationships.chain.data.id;
    const symbol = position.attributes.fungible_info.symbol;
    const value = position.attributes.value || 0;

    const normalizedProtocol = protocol.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const normalizedChain = chainMap[chainId] || chainId;

    // Try exact match
    let key = normalizedProtocol + '-' + normalizedChain.toLowerCase();
    let candidates = poolIndex.get(key);

    // Try partial match
    if (!candidates) {
      for (const [indexKey, pools] of poolIndex.entries()) {
        if (indexKey.includes(normalizedProtocol.split('-')[0]) &&
            indexKey.includes(normalizedChain.toLowerCase())) {
          candidates = pools;
          break;
        }
      }
    }

    if (candidates && candidates.length > 0) {
      // Try symbol match
      const symbolMatch = candidates.find(p =>
        p.symbol.toUpperCase().includes(symbol.toUpperCase()) ||
        symbol.toUpperCase().includes(p.symbol.split('-')[0].toUpperCase())
      );

      const pool = symbolMatch || candidates[0];
      matched++;
      matchedPositions.push({
        protocol,
        chainId,
        symbol,
        value,
        pool: {
          project: pool.project,
          chain: pool.chain,
          symbol: pool.symbol,
          apy: pool.apy,
          apyBase: pool.apyBase,
          apyReward: pool.apyReward,
          tvlUsd: pool.tvlUsd,
          ltv: pool.ltv,
        }
      });
    } else {
      unmatched++;
      unmatchedProtocols.add(protocol);
    }
  }

  console.log('   Matched: ' + matched + '/' + zerionData.data.slice(0, 30).length);
  console.log('   Unmatched: ' + unmatched);

  console.log('\n--- MATCHED POSITIONS WITH APY ---');
  for (const m of matchedPositions.slice(0, 10)) {
    console.log('\n  ' + m.protocol + ' (' + m.chainId + ')');
    console.log('    Asset: ' + m.symbol);
    console.log('    Value: $' + (m.value ? m.value.toLocaleString() : '0'));
    console.log('    DeFiLlama Match: ' + m.pool.project + ' / ' + m.pool.symbol);
    console.log('    APY: ' + (m.pool.apy ? m.pool.apy.toFixed(2) : 'N/A') + '%');
    console.log('      - Base APY: ' + (m.pool.apyBase ? m.pool.apyBase.toFixed(2) : 'N/A') + '%');
    console.log('      - Reward APY: ' + (m.pool.apyReward ? m.pool.apyReward.toFixed(2) : 'N/A') + '%');
    console.log('    TVL: $' + (m.pool.tvlUsd ? m.pool.tvlUsd.toLocaleString() : 'N/A'));
    if (m.pool.ltv) console.log('    LTV: ' + (m.pool.ltv * 100).toFixed(0) + '%');
  }

  console.log('\n--- UNMATCHED PROTOCOLS ---');
  for (const p of Array.from(unmatchedProtocols).slice(0, 15)) {
    console.log('  - ' + p);
  }

  // 4. Show what frontend should display
  console.log('\n' + '='.repeat(80));
  console.log('FRONTEND DISPLAY ANALYSIS');
  console.log('='.repeat(80));

  console.log('\nWhat we CAN show (from Zerion):');
  console.log('  - Protocol name + icon');
  console.log('  - Chain name + icon');
  console.log('  - Position type (Deposit, Stake, LP, Loan, Reward)');
  console.log('  - Asset symbol + name + icon');
  console.log('  - Value in USD');
  console.log('  - Quantity');
  console.log('  - 24h change (% and $)');

  console.log('\nWhat we CAN show (from DeFiLlama when matched):');
  console.log('  - APY (available for ' + matched + ' positions)');
  console.log('  - Base APY vs Reward APY breakdown');
  console.log('  - Pool TVL');
  console.log('  - LTV for lending positions');
  console.log('  - Borrow APY');

  console.log('\nLimitations:');
  console.log('  - ' + unmatched + ' positions could not be matched to DeFiLlama');
  console.log('  - Some newer protocols not in DeFiLlama yet');
  console.log('  - Health Factor must be calculated from LTV');
  console.log('  - IL (Impermanent Loss) data is sparse');
}

testMatching().catch(console.error);
