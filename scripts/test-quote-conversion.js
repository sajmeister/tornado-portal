const { createClient } = require('@libsql/client');
require('dotenv').config({ path: '.env.local' });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function testQuoteConversion() {
  try {
    console.log('🧪 Testing quote conversion process...\n');

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
    console.log(`   - Status: ${quote.strStatus}`);
    console.log(`   - Customer Subtotal: ${quote.decCustomerSubtotal}`);
    console.log(`   - Customer Total: ${quote.decTotal}`);
    console.log(`   - Partner Total: ${quote.decPartnerTotal}`);

    // Get quote items
    const quoteItemsResult = await client.execute(`
      SELECT * FROM tblQuoteItems 
      WHERE strQuoteId = ? AND bIsActive = 1
    `, [quote.strQuoteId]);

    console.log(`\n📦 Found ${quoteItemsResult.rows.length} quote items:`);
    quoteItemsResult.rows.forEach((item, index) => {
      console.log(`   ${index + 1}. Product: ${item.strProductId}`);
      console.log(`      - Quantity: ${item.intQuantity}`);
      console.log(`      - Customer Unit Price: ${item.decCustomerUnitPrice}`);
      console.log(`      - Customer Line Total: ${item.decCustomerLineTotal}`);
    });

    // Check if order already exists
    const existingOrderResult = await client.execute(`
      SELECT COUNT(*) as count FROM tblOrders WHERE strQuoteId = ?
    `, [quote.strQuoteId]);

    if (parseInt(existingOrderResult.rows[0].count) > 0) {
      console.log('\n⚠️  Order already exists for this quote');
      return;
    }

    // Test the order creation process
    console.log('\n🔧 Testing order creation...');
    
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const orderNumber = `ORD-${Date.now()}`;
    
    console.log(`   - Order ID: ${orderId}`);
    console.log(`   - Order Number: ${orderNumber}`);

    // Try to create the order
    try {
      const insertOrderResult = await client.execute(`
        INSERT INTO tblOrders (
          strOrderId, strOrderNumber, strQuoteId, strPartnerId, strCreatedBy, 
          strStatus, decSubtotal, decDiscountAmount, decTotal, strNotes, 
          dtCreated, dtUpdated, bIsActive
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        orderId, orderNumber, quote.strQuoteId, quote.strPartnerId, quote.strCreatedBy,
        'pending', quote.decCustomerSubtotal, quote.decDiscountAmount, quote.decTotal, quote.strNotes,
        Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000), 1
      ]);

      console.log('✅ Order created successfully');

      // Create order items
      for (const item of quoteItemsResult.rows) {
        const orderItemId = `orderitem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        await client.execute(`
          INSERT INTO tblOrderItems (
            strOrderItemId, strOrderId, strProductId, intQuantity, 
            decUnitPrice, decLineTotal, strNotes, dtCreated, bIsActive
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          orderItemId, orderId, item.strProductId, item.intQuantity,
          item.decCustomerUnitPrice, item.decCustomerLineTotal, item.strNotes,
          Math.floor(Date.now() / 1000), 1
        ]);
      }

      console.log(`✅ Created ${quoteItemsResult.rows.length} order items`);

      // Create status history
      const statusHistoryId = `status_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await client.execute(`
        INSERT INTO tblOrderStatusHistory (
          strStatusHistoryId, strOrderId, strStatus, strNotes, strUpdatedBy, dtCreated
        ) VALUES (?, ?, ?, ?, ?, ?)
      `, [
        statusHistoryId, orderId, 'pending', 'Order created from approved quote', 
        quote.strCreatedBy, Math.floor(Date.now() / 1000)
      ]);

      console.log('✅ Created order status history');

      console.log('\n🎉 Quote conversion test completed successfully!');

    } catch (error) {
      console.error('❌ Error during order creation:', error);
    }

  } catch (error) {
    console.error('❌ Error testing quote conversion:', error);
  } finally {
    await client.close();
  }
}

testQuoteConversion(); 