const { createClient } = require('@libsql/client');
require('dotenv').config({ path: '.env.local' });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function checkDatabaseTables() {
  try {
    console.log('🔍 Checking database tables...\n');

    // Get all tables
    const result = await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    
    if (result.rows.length === 0) {
      console.log('❌ No tables found in the database.');
      return;
    }

    console.log('📋 Existing tables:');
    for (const row of result.rows) {
      console.log(`   - ${row.name}`);
    }

    // Check for quote and order related tables specifically
    const quoteOrderTables = [
      'tblQuotes',
      'tblQuoteItems', 
      'tblOrders',
      'tblOrderItems',
      'tblOrderStatusHistory'
    ];

    console.log('\n🔍 Quote and Order tables status:');
    for (const table of quoteOrderTables) {
      const exists = result.rows.some(row => row.name === table);
      if (exists) {
        // Get count for existing tables
        const countResult = await client.execute(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`   ✅ ${table}: ${countResult.rows[0].count} records`);
      } else {
        console.log(`   ❌ ${table}: table does not exist`);
      }
    }

  } catch (error) {
    console.error('❌ Error checking database tables:', error);
  } finally {
    await client.close();
  }
}

checkDatabaseTables(); 