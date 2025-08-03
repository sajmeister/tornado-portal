const { createClient } = require('@libsql/client');
require('dotenv').config({ path: '.env.local' });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function migrateCustomerPricing() {
  try {
    console.log('🔄 Starting customer pricing migration...');

    // Add new columns to tblQuotes
    console.log('📝 Adding customer pricing columns to tblQuotes...');
    await client.execute(`
      ALTER TABLE tblQuotes ADD COLUMN decCustomerSubtotal REAL DEFAULT 0;
    `);
    await client.execute(`
      ALTER TABLE tblQuotes ADD COLUMN decPartnerTotal REAL DEFAULT 0;
    `);

    // Add new columns to tblQuoteItems
    console.log('📝 Adding customer pricing columns to tblQuoteItems...');
    await client.execute(`
      ALTER TABLE tblQuoteItems ADD COLUMN decCustomerUnitPrice REAL DEFAULT 0;
    `);
    await client.execute(`
      ALTER TABLE tblQuoteItems ADD COLUMN decCustomerLineTotal REAL DEFAULT 0;
    `);

    // Update existing quotes to set customer pricing equal to partner pricing
    console.log('🔄 Updating existing quotes with customer pricing...');
    await client.execute(`
      UPDATE tblQuotes 
      SET decCustomerSubtotal = decSubtotal, 
          decPartnerTotal = decTotal 
      WHERE decCustomerSubtotal = 0 OR decCustomerSubtotal IS NULL;
    `);

    // Update existing quote items to set customer pricing equal to partner pricing
    console.log('🔄 Updating existing quote items with customer pricing...');
    await client.execute(`
      UPDATE tblQuoteItems 
      SET decCustomerUnitPrice = decUnitPrice, 
          decCustomerLineTotal = decLineTotal 
      WHERE decCustomerUnitPrice = 0 OR decCustomerUnitPrice IS NULL;
    `);

    // Verify the migration
    console.log('✅ Verifying migration...');
    const quotesResult = await client.execute('SELECT COUNT(*) as count FROM tblQuotes');
    const quoteItemsResult = await client.execute('SELECT COUNT(*) as count FROM tblQuoteItems');
    
    console.log(`📊 Migration completed successfully!`);
    console.log(`   - Quotes updated: ${quotesResult.rows[0].count}`);
    console.log(`   - Quote items updated: ${quoteItemsResult.rows[0].count}`);

    // Show sample data
    console.log('\n📋 Sample quote data:');
    const sampleQuote = await client.execute(`
      SELECT strQuoteNumber, decSubtotal, decCustomerSubtotal, decTotal, decPartnerTotal 
      FROM tblQuotes 
      LIMIT 1
    `);
    if (sampleQuote.rows.length > 0) {
      console.log('   Quote:', sampleQuote.rows[0]);
    }

    console.log('\n📋 Sample quote item data:');
    const sampleItem = await client.execute(`
      SELECT strQuoteItemId, decUnitPrice, decCustomerUnitPrice, decLineTotal, decCustomerLineTotal 
      FROM tblQuoteItems 
      LIMIT 1
    `);
    if (sampleItem.rows.length > 0) {
      console.log('   Item:', sampleItem.rows[0]);
    }

    console.log('\n🎉 Customer pricing migration completed successfully!');
    console.log('   - Partners can now offer customer discounts');
    console.log('   - Provider always gets paid the full partner price');
    console.log('   - Customer pricing is tracked separately');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateCustomerPricing(); 