const { createClient } = require('@libsql/client');
require('dotenv').config({ path: '.env.local' });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function testConvertAPI() {
  try {
    console.log('🧪 Testing convert API endpoint...\n');

    // Get an approved quote
    const quotesResult = await client.execute(`
      SELECT * FROM tblQuotes 
      WHERE strStatus = 'approved' AND bIsActive = 1 
      LIMIT 1
    `);

    if (quotesResult.rows.length === 0) {
      console.log('❌ No approved quotes found');
      return;
    }

    const quote = quotesResult.rows[0];
    console.log('📄 Found approved quote:');
    console.log(`   - Quote ID: ${quote.strQuoteId}`);
    console.log(`   - Quote Number: ${quote.strQuoteNumber}`);
    console.log(`   - Partner ID: ${quote.strPartnerId}`);
    console.log(`   - Created By: ${quote.strCreatedBy}`);

    // Get the user who created the quote
    const userResult = await client.execute(`
      SELECT * FROM tblUsers WHERE strUserId = ?
    `, [quote.strCreatedBy]);

    if (userResult.rows.length === 0) {
      console.log('❌ Quote creator not found');
      return;
    }

    const user = userResult.rows[0];
    console.log(`\n👤 Quote creator: ${user.strName} (${user.strRole})`);

    // Check if order already exists
    const existingOrderResult = await client.execute(`
      SELECT COUNT(*) as count FROM tblOrders WHERE strQuoteId = ?
    `, [quote.strQuoteId]);

    if (parseInt(existingOrderResult.rows[0].count) > 0) {
      console.log('\n⚠️  Order already exists for this quote');
      return;
    }

    console.log('\n✅ Quote is ready for conversion');
    console.log('📋 To test the API, you can:');
    console.log('   1. Log in as the partner admin');
    console.log('   2. Go to the Quotes page');
    console.log('   3. Find the approved quote');
    console.log('   4. Click "Convert to Order"');
    console.log('   5. The API should now work with the updated permissions');

  } catch (error) {
    console.error('❌ Error testing convert API:', error);
  } finally {
    await client.close();
  }
}

testConvertAPI(); 