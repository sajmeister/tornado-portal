const { createClient } = require('@libsql/client');
require('dotenv').config({ path: '.env.local' });

// Database connection
const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function fnClearTestAnalyticsData() {
  try {
    console.log('🧹 Clearing test analytics data...');

    // First, let's see what test data exists
    const arrTestQuotes = await client.execute("SELECT COUNT(*) as count FROM tblQuotes WHERE strQuoteNumber LIKE 'Q-%' AND strNotes LIKE '%Test quote%'");
    const arrTestOrders = await client.execute("SELECT COUNT(*) as count FROM tblOrders WHERE strOrderNumber LIKE 'O-%' AND strNotes LIKE '%Test order%'");
    
    console.log(`📊 Found ${arrTestQuotes.rows[0].count} test quotes and ${arrTestOrders.rows[0].count} test orders`);

    if (arrTestQuotes.rows[0].count === 0 && arrTestOrders.rows[0].count === 0) {
      console.log('✅ No test data found to clear');
      return;
    }

    // Clear test data in the correct order (due to foreign key constraints)
    
    // 1. Clear order status history for test orders
    console.log('🗑️ Clearing test order status history...');
    await client.execute(`
      DELETE FROM tblOrderStatusHistory 
      WHERE strOrderId IN (
        SELECT strOrderId FROM tblOrders 
        WHERE strOrderNumber LIKE 'O-%' AND strNotes LIKE '%Test order%'
      )
    `);

    // 2. Clear order items for test orders
    console.log('🗑️ Clearing test order items...');
    await client.execute(`
      DELETE FROM tblOrderItems 
      WHERE strOrderId IN (
        SELECT strOrderId FROM tblOrders 
        WHERE strOrderNumber LIKE 'O-%' AND strNotes LIKE '%Test order%'
      )
    `);

    // 3. Clear test orders
    console.log('🗑️ Clearing test orders...');
    await client.execute(`
      DELETE FROM tblOrders 
      WHERE strOrderNumber LIKE 'O-%' AND strNotes LIKE '%Test order%'
    `);

    // 4. Clear quote items for test quotes
    console.log('🗑️ Clearing test quote items...');
    await client.execute(`
      DELETE FROM tblQuoteItems 
      WHERE strQuoteId IN (
        SELECT strQuoteId FROM tblQuotes 
        WHERE strQuoteNumber LIKE 'Q-%' AND strNotes LIKE '%Test quote%'
      )
    `);

    // 5. Clear test quotes
    console.log('🗑️ Clearing test quotes...');
    await client.execute(`
      DELETE FROM tblQuotes 
      WHERE strQuoteNumber LIKE 'Q-%' AND strNotes LIKE '%Test quote%'
    `);

    // Verify cleanup
    const arrRemainingTestQuotes = await client.execute("SELECT COUNT(*) as count FROM tblQuotes WHERE strQuoteNumber LIKE 'Q-%' AND strNotes LIKE '%Test quote%'");
    const arrRemainingTestOrders = await client.execute("SELECT COUNT(*) as count FROM tblOrders WHERE strOrderNumber LIKE 'O-%' AND strNotes LIKE '%Test order%'");
    
    console.log(`✅ Cleanup complete! Remaining test data: ${arrRemainingTestQuotes.rows[0].count} quotes, ${arrRemainingTestOrders.rows[0].count} orders`);
    
    // Show remaining real data
    const arrRealQuotes = await client.execute("SELECT COUNT(*) as count FROM tblQuotes WHERE bIsActive = 1");
    const arrRealOrders = await client.execute("SELECT COUNT(*) as count FROM tblOrders WHERE bIsActive = 1");
    
    console.log(`📊 Remaining real data: ${arrRealQuotes.rows[0].count} quotes, ${arrRealOrders.rows[0].count} orders`);
    console.log('🎯 Analytics will now show only real business data');

  } catch (error) {
    console.error('❌ Error clearing test analytics data:', error);
  } finally {
    process.exit(0);
  }
}

// Run the script
fnClearTestAnalyticsData(); 