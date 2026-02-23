// Test script to analyze Zerion API response
const ZERION_API_KEY = 'zk_dev_cada2a7b670f44288ce0bd4b2669ad8a';

// Example wallet with DeFi positions (Vitalik's wallet for testing)
// Replace with your actual wallet address
const TEST_WALLET = process.argv[2] || '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';

async function testZerionAPI() {
  console.log('='.repeat(80));
  console.log('ZERION API ANALYSIS');
  console.log('='.repeat(80));
  console.log(`\nWallet: ${TEST_WALLET}\n`);

  const authHeader = `Basic ${Buffer.from(ZERION_API_KEY + ':').toString('base64')}`;

  // 1. Fetch DeFi positions (only_complex)
  console.log('\n--- DEFI POSITIONS (only_complex) ---\n');
  
  const defiUrl = `https://api.zerion.io/v1/wallets/${TEST_WALLET}/positions/?filter[positions]=only_complex&filter[trash]=only_non_trash&currency=usd&sort=value`;
  
  try {
    const defiResponse = await fetch(defiUrl, {
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader,
      },
    });

    if (!defiResponse.ok) {
      console.log(`Error: ${defiResponse.status} - ${await defiResponse.text()}`);
      return;
    }

    const defiData = await defiResponse.json();
    
    console.log(`Total DeFi positions: ${defiData.data.length}`);
    console.log(`Total value: $${defiData.data.reduce((sum, p) => sum + (p.attributes.value || 0), 0).toLocaleString()}`);
    
    // Analyze position types
    const positionTypes = {};
    const protocols = {};
    const chains = {};
    
    for (const position of defiData.data) {
      const type = position.attributes.position_type;
      const protocol = position.attributes.protocol || 'Unknown';
      const chainId = position.relationships.chain.data.id;
      
      positionTypes[type] = (positionTypes[type] || 0) + 1;
      protocols[protocol] = (protocols[protocol] || 0) + 1;
      chains[chainId] = (chains[chainId] || 0) + 1;
    }
    
    console.log('\n--- Position Types ---');
    for (const [type, count] of Object.entries(positionTypes)) {
      console.log(`  ${type}: ${count}`);
    }
    
    console.log('\n--- Protocols ---');
    for (const [protocol, count] of Object.entries(protocols).sort((a, b) => b[1] - a[1]).slice(0, 15)) {
      console.log(`  ${protocol}: ${count}`);
    }
    
    console.log('\n--- Chains ---');
    for (const [chain, count] of Object.entries(chains).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${chain}: ${count}`);
    }
    
    // Show top 5 positions by value
    console.log('\n--- Top 10 Positions by Value ---');
    const sortedPositions = defiData.data
      .filter(p => p.attributes.value > 0)
      .sort((a, b) => b.attributes.value - a.attributes.value)
      .slice(0, 10);
    
    for (const pos of sortedPositions) {
      const attr = pos.attributes;
      console.log(`\n  Protocol: ${attr.protocol || 'Unknown'}`);
      console.log(`  Type: ${attr.position_type}`);
      console.log(`  Asset: ${attr.fungible_info.symbol} (${attr.fungible_info.name})`);
      console.log(`  Chain: ${pos.relationships.chain.data.id}`);
      console.log(`  Value: $${attr.value?.toLocaleString() || 0}`);
      console.log(`  Quantity: ${attr.quantity.float}`);
      if (attr.price) console.log(`  Price: $${attr.price}`);
      if (attr.changes?.percent_1d) console.log(`  24h Change: ${(attr.changes.percent_1d * 100).toFixed(2)}%`);
    }
    
    // Show raw sample position
    console.log('\n--- RAW SAMPLE POSITION ---');
    if (defiData.data[0]) {
      console.log(JSON.stringify(defiData.data[0], null, 2));
    }
    
    // Check included data (chains, dapps)
    console.log('\n--- INCLUDED DATA (chains, dapps) ---');
    if (defiData.included) {
      const includedChains = defiData.included.filter(i => i.type === 'chains');
      const includedDapps = defiData.included.filter(i => i.type === 'dapps');
      
      console.log(`\nChains: ${includedChains.length}`);
      for (const chain of includedChains.slice(0, 5)) {
        console.log(`  - ${chain.id}: ${chain.attributes.name}`);
      }
      
      console.log(`\nDapps/Protocols: ${includedDapps.length}`);
      for (const dapp of includedDapps.slice(0, 10)) {
        console.log(`  - ${dapp.id}: ${dapp.attributes.name} (${dapp.attributes.url || 'no url'})`);
      }
    }
    
    // Identify what data we have vs what we're missing
    console.log('\n' + '='.repeat(80));
    console.log('DATA AVAILABILITY ANALYSIS');
    console.log('='.repeat(80));
    
    const samplePos = defiData.data[0]?.attributes;
    if (samplePos) {
      console.log('\n✅ Available in Zerion API:');
      console.log('  - position_type (deposit, stake, liquidity, loan, etc.)');
      console.log('  - protocol name');
      console.log('  - chain info');
      console.log('  - asset info (name, symbol, icon)');
      console.log('  - value in USD');
      console.log('  - quantity');
      console.log('  - price');
      console.log('  - 24h changes (absolute and percent)');
      console.log('  - verified status');
      console.log('  - updated_at timestamp');
      
      console.log('\n❌ NOT in Zerion API (need DeFiLlama):');
      console.log('  - APY/APR');
      console.log('  - Health Factor (for lending)');
      console.log('  - LTV (Loan-to-Value)');
      console.log('  - Borrow APY');
      console.log('  - Impermanent Loss');
      console.log('  - LP token composition');
      console.log('  - Pool TVL');
      console.log('  - Reward token emissions');
    }
    
  } catch (error) {
    console.error('Error fetching DeFi positions:', error);
  }
}

testZerionAPI();
