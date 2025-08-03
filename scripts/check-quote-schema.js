const { createClient } = require('@libsql/client');
require('dotenv').config({ path: '.env.local' });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function checkQuoteSchema() {
  try {
    console.log('🔍 Checking quote table schema...\n');

    // Check if quotes table exists
    const tableExists = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='tblQuotes'");
    if (tableExists.rows.length === 0) {
      console.log('❌ tblQuotes table does not exist');
      return;
    }

    // Get table schema
    const schemaResult = await client.execute("PRAGMA table_info(tblQuotes)");
    console.log('📋 tblQuotes table schema:');
    schemaResult.rows.forEach(row => {
      console.log(`   - ${row.name}: ${row.type} ${row.notnull ? 'NOT NULL' : ''} ${row.pk ? 'PRIMARY KEY' : ''}`);
    });

    // Check if there are any quotes in the table
    const quotesCount = await client.execute("SELECT COUNT(*) as count FROM tblQuotes");
    console.log(`\n📊 Number of quotes: ${quotesCount.rows[0].count}`);

    if (parseInt(quotesCount.rows[0].count) > 0) {
      // Get a sample quote to see the actual data structure
      const sampleQuote = await client.execute("SELECT * FROM tblQuotes LIMIT 1");
      console.log('\n📄 Sample quote data:');
      Object.keys(sampleQuote.rows[0]).forEach(key => {
        console.log(`   - ${key}: ${sampleQuote.rows[0][key]}`);
      });
    }

    // Check quote items schema
    console.log('\n🔍 Checking quote items table schema...');
    const quoteItemsSchema = await client.execute("PRAGMA table_info(tblQuoteItems)");
    console.log('📋 tblQuoteItems table schema:');
    quoteItemsSchema.rows.forEach(row => {
      console.log(`   - ${row.name}: ${row.type} ${row.notnull ? 'NOT NULL' : ''} ${row.pk ? 'PRIMARY KEY' : ''}`);
    });

  } catch (error) {
    console.error('❌ Error checking quote schema:', error);
  } finally {
    await client.close();
  }
}

checkQuoteSchema(); 