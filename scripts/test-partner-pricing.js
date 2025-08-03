import { createClient } from '@libsql/client';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

// Create database client
const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function testPartnerPricing() {
  console.log('Testing Partner Pricing Management...');
  console.log('Database URL:', process.env.TURSO_DATABASE_URL ? 'Set' : 'Not set');
  console.log('Auth Token:', process.env.TURSO_AUTH_TOKEN ? 'Set' : 'Not set');

  try {
    // Test 1: Check if tblPartnerPrices table exists
    console.log('\n1. Checking tblPartnerPrices table...');
    const tableCheck = await client.execute(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='tblPartnerPrices'
    `);
    
    if (tableCheck.rows.length > 0) {
      console.log('✅ tblPartnerPrices table exists');
    } else {
      console.log('❌ tblPartnerPrices table does not exist');
      return;
    }

    // Test 2: Check partner prices data
    console.log('\n2. Checking partner prices data...');
    const partnerPrices = await client.execute('SELECT COUNT(*) as count FROM tblPartnerPrices WHERE bIsActive = 1');
    console.log(`Found ${partnerPrices.rows[0].count} active partner price records`);

    // Test 3: Show sample partner prices
    console.log('\n3. Sample partner prices:');
    const samplePrices = await client.execute(`
      SELECT 
        pp.strPartnerId,
        pp.strProductId,
        pp.decPartnerPrice,
        p.strPartnerName,
        pr.strProductName
      FROM tblPartnerPrices pp
      JOIN tblPartners p ON pp.strPartnerId = p.strPartnerId
      JOIN tblProducts pr ON pp.strProductId = pr.strProductId
      WHERE pp.bIsActive = 1
      LIMIT 5
    `);

    samplePrices.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.strPartnerName} - ${row.strProductName}: $${row.decPartnerPrice}`);
    });

    // Test 4: Check products without partner prices
    console.log('\n4. Products without partner prices:');
    const productsWithoutPrices = await client.execute(`
      SELECT 
        p.strProductName,
        p.decBasePrice
      FROM tblProducts p
      WHERE p.bIsActive = 1
      AND NOT EXISTS (
        SELECT 1 FROM tblPartnerPrices pp 
        WHERE pp.strProductId = p.strProductId 
        AND pp.bIsActive = 1
      )
    `);

    if (productsWithoutPrices.rows.length > 0) {
      console.log(`Found ${productsWithoutPrices.rows.length} products without partner prices:`);
      productsWithoutPrices.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. ${row.strProductName} (Base: $${row.decBasePrice})`);
      });
    } else {
      console.log('✅ All products have partner prices');
    }

    // Test 5: Check pricing consistency
    console.log('\n5. Checking pricing consistency...');
    const pricingCheck = await client.execute(`
      SELECT 
        p.strProductName,
        p.decBasePrice,
        AVG(pp.decPartnerPrice) as avgPartnerPrice,
        MIN(pp.decPartnerPrice) as minPartnerPrice,
        MAX(pp.decPartnerPrice) as maxPartnerPrice,
        COUNT(pp.strPartnerId) as partnerCount
      FROM tblProducts p
      LEFT JOIN tblPartnerPrices pp ON p.strProductId = pp.strProductId AND pp.bIsActive = 1
      WHERE p.bIsActive = 1
      GROUP BY p.strProductId, p.strProductName, p.decBasePrice
    `);

    pricingCheck.rows.forEach((row) => {
      console.log(`   ${row.strProductName}:`);
      console.log(`     Base Price: $${row.decBasePrice}`);
      console.log(`     Partner Prices: $${row.minPartnerPrice || 'N/A'} - $${row.maxPartnerPrice || 'N/A'} (Avg: $${row.avgPartnerPrice || 'N/A'})`);
      console.log(`     Partners: ${row.partnerCount}`);
    });

    console.log('\n✅ Partner pricing test completed successfully!');

  } catch (error) {
    console.error('❌ Partner pricing test failed:', error);
  }
}

// Run the test
testPartnerPricing()
  .then(() => {
    console.log('Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  }); 