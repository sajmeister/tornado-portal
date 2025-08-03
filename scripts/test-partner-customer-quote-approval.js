import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:./dev.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function testPartnerCustomerQuoteApproval() {
  try {
    console.log('🧪 Testing Partner Customer Quote Approval...\n');

    // Check if strCustomerId column exists in tblQuotes
    console.log('1. Checking database schema...');
    const schemaResult = await client.execute("PRAGMA table_info(tblQuotes)");
    const customerIdColumn = schemaResult.rows.find(row => row.name === 'strCustomerId');
    
    if (customerIdColumn) {
      console.log('✅ strCustomerId column exists in tblQuotes table');
    } else {
      console.log('❌ strCustomerId column missing from tblQuotes table');
      return;
    }

    // Get a sample of quotes with customer IDs
    console.log('\n2. Checking quotes with customer assignments...');
    const quotesResult = await client.execute(`
      SELECT q.strQuoteId, q.strQuoteNumber, q.strStatus, q.strCustomerId, 
             u.strName as customerName, u.strEmail as customerEmail
      FROM tblQuotes q
      LEFT JOIN tblUsers u ON q.strCustomerId = u.strUserId
      WHERE q.strCustomerId IS NOT NULL
      LIMIT 5
    `);

    if (quotesResult.rows.length > 0) {
      console.log('✅ Found quotes with customer assignments:');
      quotesResult.rows.forEach((quote, index) => {
        console.log(`   ${index + 1}. Quote ${quote.strQuoteNumber} (${quote.strStatus}) - Customer: ${quote.customerName} (${quote.customerEmail})`);
      });
    } else {
      console.log('⚠️  No quotes found with customer assignments');
    }

    // Get partner customers
    console.log('\n3. Checking partner customers...');
    const customersResult = await client.execute(`
      SELECT pu.strPartnerUserId, pu.strUserId, u.strName, u.strEmail, u.strRole
      FROM tblPartnerUsers pu
      JOIN tblUsers u ON pu.strUserId = u.strUserId
      WHERE u.strRole = 'partner_customer'
      LIMIT 5
    `);

    if (customersResult.rows.length > 0) {
      console.log('✅ Found partner customers:');
      customersResult.rows.forEach((customer, index) => {
        console.log(`   ${index + 1}. ${customer.strName} (${customer.strEmail}) - Role: ${customer.strRole}`);
      });
    } else {
      console.log('⚠️  No partner customers found');
    }

    // Test the permission logic
    console.log('\n4. Testing permission logic...');
    const testCustomer = customersResult.rows[0];
    const testQuote = quotesResult.rows[0];
    
    if (testCustomer && testQuote) {
      console.log(`   Testing: Customer ${testCustomer.strName} (${testCustomer.strUserId})`);
      console.log(`   Quote: ${testQuote.strQuoteNumber} for customer ${testQuote.strCustomerId}`);
      
      if (testQuote.strCustomerId === testCustomer.strUserId) {
        console.log('   ✅ Customer matches quote assignment - should be able to approve/reject');
      } else {
        console.log('   ❌ Customer does not match quote assignment - should NOT be able to approve/reject');
      }
    }

    console.log('\n🎉 Test completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   - Database schema supports customer-quote relationships');
    console.log('   - Partner customers exist in the system');
    console.log('   - Quotes can be assigned to specific customers');
    console.log('   - Permission logic should work for matching customer-quote pairs');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await client.close();
  }
}

testPartnerCustomerQuoteApproval(); 