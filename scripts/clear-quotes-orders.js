const { createClient } = require('@libsql/client');
require('dotenv').config({ path: '.env.local' });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function tableExists(tableName) {
  try {
    const result = await client.execute(`SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`);
    return result.rows.length > 0;
  } catch (error) {
    return false;
  }
}

async function getTableCount(tableName) {
  try {
    const result = await client.execute(`SELECT COUNT(*) as count FROM ${tableName}`);
    return parseInt(result.rows[0].count);
  } catch (error) {
    return 0;
  }
}

async function clearQuotesAndOrders() {
  try {
    console.log('🗑️  Clearing all quotes and orders from database...\n');

    // First, let's check which tables exist
    console.log('1. Checking which tables exist...');
    
    const tables = [
      'tblOrderStatusHistory',
      'tblOrderItems', 
      'tblOrders',
      'tblQuoteItems',
      'tblQuotes'
    ];

    const existingTables = [];
    const tableCounts = {};

    for (const table of tables) {
      const exists = await tableExists(table);
      if (exists) {
        existingTables.push(table);
        const count = await getTableCount(table);
        tableCounts[table] = count;
        console.log(`   ✅ ${table}: ${count} records`);
      } else {
        console.log(`   ❌ ${table}: table does not exist`);
      }
    }

    if (existingTables.length === 0) {
      console.log('\n✅ No quote or order tables found to clear.');
      return;
    }

    const totalRecords = Object.values(tableCounts).reduce((sum, count) => sum + count, 0);
    console.log(`\n📊 Total records to delete: ${totalRecords}`);

    if (totalRecords === 0) {
      console.log('\n✅ No quotes or orders found to delete.');
      return;
    }

    // Delete in the correct order to avoid foreign key constraint issues
    console.log('\n2. Deleting data in order of dependencies...');

    // 1. Delete order status history (references orders)
    if (existingTables.includes('tblOrderStatusHistory')) {
      console.log('   - Deleting order status history...');
      const orderStatusHistoryResult = await client.execute('DELETE FROM tblOrderStatusHistory');
      console.log(`     ✅ Deleted ${orderStatusHistoryResult.rowsAffected} order status history records`);
    }

    // 2. Delete order items (references orders)
    if (existingTables.includes('tblOrderItems')) {
      console.log('   - Deleting order items...');
      const orderItemsResult = await client.execute('DELETE FROM tblOrderItems');
      console.log(`     ✅ Deleted ${orderItemsResult.rowsAffected} order item records`);
    }

    // 3. Delete orders
    if (existingTables.includes('tblOrders')) {
      console.log('   - Deleting orders...');
      const ordersResult = await client.execute('DELETE FROM tblOrders');
      console.log(`     ✅ Deleted ${ordersResult.rowsAffected} order records`);
    }

    // 4. Delete quote items (references quotes)
    if (existingTables.includes('tblQuoteItems')) {
      console.log('   - Deleting quote items...');
      const quoteItemsResult = await client.execute('DELETE FROM tblQuoteItems');
      console.log(`     ✅ Deleted ${quoteItemsResult.rowsAffected} quote item records`);
    }

    // 5. Delete quotes
    if (existingTables.includes('tblQuotes')) {
      console.log('   - Deleting quotes...');
      const quotesResult = await client.execute('DELETE FROM tblQuotes');
      console.log(`     ✅ Deleted ${quotesResult.rowsAffected} quote records`);
    }

    // Verify deletion
    console.log('\n3. Verifying deletion...');
    
    let finalTotal = 0;
    for (const table of existingTables) {
      const finalCount = await getTableCount(table);
      console.log(`   - ${table}: ${finalCount} records`);
      finalTotal += finalCount;
    }

    if (finalTotal === 0) {
      console.log('\n🎉 Successfully cleared all quotes and orders from the database!');
    } else {
      console.log(`\n⚠️  Warning: ${finalTotal} records still remain.`);
    }

  } catch (error) {
    console.error('❌ Error clearing quotes and orders:', error);
  } finally {
    await client.close();
  }
}

clearQuotesAndOrders(); 