#!/usr/bin/env node

import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function checkSpecificQuote() {
  try {
    console.log('🔍 Checking for quote Q-20250803-8328...\n');

    // Check if quote exists
    const quoteResult = await client.execute(`
      SELECT * FROM tblQuotes 
      WHERE strQuoteNumber = 'Q-20250803-8328' AND bIsActive = 1
    `);

    if (quoteResult.rows.length === 0) {
      console.log('❌ Quote Q-20250803-8328 not found in database');
      
      // Show all available quotes
      const allQuotesResult = await client.execute(`
        SELECT strQuoteNumber, decSubtotal, decCustomerSubtotal, decTotal, decPartnerTotal, strStatus
        FROM tblQuotes 
        WHERE bIsActive = 1
        ORDER BY dtCreated DESC
      `);

      console.log('\n📋 Available quotes:');
      allQuotesResult.rows.forEach(row => {
        console.log(`  ${row[1]}:`);
        console.log(`    Partner Subtotal (Provider gets): $${row[2]}`);
        console.log(`    Customer Subtotal (Partner charges): $${row[3]}`);
        console.log(`    Customer Total (Customer pays): $${row[4]}`);
        console.log(`    Partner Total (Provider gets): $${row[5]}`);
        console.log(`    Status: ${row[6]}`);
        console.log('');
      });
      
      return;
    }

    const quote = quoteResult.rows[0];
    console.log('✅ Quote found!');
    console.log(`Quote Number: ${quote[1]}`);
    console.log(`Status: ${quote[4]}`);
    console.log(`Partner Subtotal (Provider gets): $${quote[5]}`);
    console.log(`Customer Subtotal (Partner charges): $${quote[13]}`);
    console.log(`Customer Total (Customer pays): $${quote[7]}`);
    console.log(`Partner Total (Provider gets): $${quote[14]}`);
    console.log(`Discount Amount: $${quote[6]}`);

    // Check if there's an order for this quote
    const orderResult = await client.execute(`
      SELECT * FROM tblOrders 
      WHERE strQuoteId = ? AND bIsActive = 1
    `, [quote[0]]);

    if (orderResult.rows.length > 0) {
      const order = orderResult.rows[0];
      console.log('\n📦 Related Order:');
      console.log(`Order Number: ${order[1]}`);
      console.log(`Order Subtotal: $${order[6]}`);
      console.log(`Order Total: $${order[8]}`);
      console.log(`Order Status: ${order[5]}`);
    } else {
      console.log('\n📦 No order found for this quote');
    }

    console.log('\n💡 For Provider Analytics:');
    console.log(`Revenue (Customer Total): $${quote[7]}`);
    console.log(`Partner Revenue (Partner Subtotal): $${quote[5]}`);

  } catch (error) {
    console.error('Error checking quote:', error);
  }
}

checkSpecificQuote(); 