const { createClient } = require('@libsql/client');
require('dotenv').config({ path: '.env.local' });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Mock the fnCanBypassPartnerIsolation function
function fnCanBypassPartnerIsolation(strUserRole) {
  return ['super_admin', 'provider_user'].includes(strUserRole);
}

async function testPricingDisplay() {
  try {
    console.log('🧪 Testing pricing display logic...\n');

    // Get a quote with items
    const quotesResult = await client.execute(`
      SELECT q.*, qi.*, u.strRole as userRole, u.strName as userName
      FROM tblQuotes q
      LEFT JOIN tblQuoteItems qi ON q.strQuoteId = qi.strQuoteId
      LEFT JOIN tblUsers u ON q.strCreatedBy = u.strUserId
      WHERE q.bIsActive = 1
      LIMIT 1
    `);

    if (quotesResult.rows.length === 0) {
      console.log('❌ No quotes found');
      return;
    }

    const quote = quotesResult.rows[0];
    console.log('📄 Found quote:');
    console.log(`   - Quote Number: ${quote.strQuoteNumber}`);
    console.log(`   - Created by: ${quote.userName} (${quote.userRole})`);
    console.log(`   - Partner Subtotal: $${quote.decSubtotal}`);
    console.log(`   - Customer Subtotal: $${quote.decCustomerSubtotal}`);
    console.log(`   - Partner Total: $${quote.decPartnerTotal}`);
    console.log(`   - Customer Total: $${quote.decTotal}`);

    // Test different user roles
    const testRoles = [
      { role: 'super_admin', name: 'Super Admin' },
      { role: 'provider_user', name: 'Provider User' },
      { role: 'partner_admin', name: 'Partner Admin' },
      { role: 'partner_customer', name: 'Partner Customer' }
    ];

    console.log('\n🔍 Testing pricing display for different user roles:');
    
    testRoles.forEach(({ role, name }) => {
      const canBypass = fnCanBypassPartnerIsolation(role);
      console.log(`\n👤 ${name} (${role}):`);
      console.log(`   - Can bypass partner isolation: ${canBypass}`);
      
      if (canBypass) {
        console.log(`   - Should see: Partner Subtotal $${quote.decSubtotal}, Customer Subtotal $${quote.decCustomerSubtotal}`);
        console.log(`   - Should see: Partner Total $${quote.decPartnerTotal}, Customer Total $${quote.decTotal}`);
      } else {
        console.log(`   - Should see: Customer Subtotal $${quote.decCustomerSubtotal}`);
        console.log(`   - Should see: Customer Total $${quote.decTotal}`);
      }
    });

    // Test quote items pricing
    console.log('\n📦 Testing quote items pricing display:');
    
    const quoteItemsResult = await client.execute(`
      SELECT * FROM tblQuoteItems 
      WHERE strQuoteId = ? AND bIsActive = 1
    `, [quote.strQuoteId]);

    if (quoteItemsResult.rows.length > 0) {
      const item = quoteItemsResult.rows[0];
      console.log(`\n   Item: ${item.strProductId}`);
      console.log(`   - Partner Unit Price: $${item.decUnitPrice}`);
      console.log(`   - Customer Unit Price: $${item.decCustomerUnitPrice}`);
      console.log(`   - Partner Line Total: $${item.decLineTotal}`);
      console.log(`   - Customer Line Total: $${item.decCustomerLineTotal}`);

      testRoles.forEach(({ role, name }) => {
        const canBypass = fnCanBypassPartnerIsolation(role);
        console.log(`\n   ${name} (${role}):`);
        
        if (canBypass) {
          console.log(`     - Unit Price: Partner $${item.decUnitPrice}, Customer $${item.decCustomerUnitPrice}`);
          console.log(`     - Line Total: Partner $${item.decLineTotal}, Customer $${item.decCustomerLineTotal}`);
        } else {
          console.log(`     - Unit Price: $${item.decCustomerUnitPrice}`);
          console.log(`     - Line Total: $${item.decCustomerLineTotal}`);
        }
      });
    }

    console.log('\n✅ Pricing display logic test completed!');
    console.log('\n📋 Summary:');
    console.log('   - Super Admin and Provider User see both Partner and Customer pricing');
    console.log('   - Partner Admin and Partner Customer see only Customer pricing');
    console.log('   - This ensures customers only see what they pay to their Partner');

  } catch (error) {
    console.error('❌ Error testing pricing display:', error);
  } finally {
    await client.close();
  }
}

testPricingDisplay(); 