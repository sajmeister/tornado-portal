#!/usr/bin/env node

import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function testCustomerQuotes() {
  try {
    console.log('🧪 Testing Customer Quotes functionality...\n');

    // Check if the strCustomerId column exists in tblQuotes
    console.log('1. Checking tblQuotes schema...');
    const schemaResult = await client.execute(`PRAGMA table_info(tblQuotes)`);
    const existingColumns = schemaResult.rows.map(row => row[1]);
    
    if (existingColumns.includes('strCustomerId')) {
      console.log('✅ strCustomerId column exists in tblQuotes table');
    } else {
      console.log('❌ strCustomerId column missing from tblQuotes table');
      return;
    }

    // Check existing quotes
    console.log('\n2. Checking existing quotes...');
    const quotesResult = await client.execute(`
      SELECT strQuoteId, strQuoteNumber, strCustomerId, strPartnerId 
      FROM tblQuotes 
      WHERE bIsActive = 1 
      LIMIT 5
    `);
    
    console.log(`Found ${quotesResult.rows.length} active quotes:`);
    quotesResult.rows.forEach(row => {
      console.log(`  - ${row[1]} (Customer: ${row[2] || 'None'})`);
    });

    // Check partner customers
    console.log('\n3. Checking partner customers...');
    const customersResult = await client.execute(`
      SELECT pu.strPartnerId, pu.strUserId, u.strName, u.strEmail
      FROM tblPartnerUsers pu
      JOIN tblUsers u ON pu.strUserId = u.strUserId
      WHERE pu.strRole = 'partner_customer' AND pu.bIsActive = 1
      LIMIT 5
    `);
    
    console.log(`Found ${customersResult.rows.length} partner customers:`);
    customersResult.rows.forEach(row => {
      console.log(`  - ${row[2]} (${row[3]}) - Partner: ${row[0]}`);
    });

    console.log('\n🎉 Customer Quotes functionality test completed!');
    console.log('\n📝 Next steps:');
    console.log('  1. Start the development server: npm run dev');
    console.log('  2. Login as a partner admin');
    console.log('  3. Go to the Quotes page');
    console.log('  4. Click "Create Quote"');
    console.log('  5. You should see a customer dropdown in the form');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testCustomerQuotes(); 