const { createClient } = require('@libsql/client');
require('dotenv').config({ path: '.env.local' });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function testQuoteConversionWorkflow() {
  try {
    console.log('🧪 Testing complete quote conversion workflow...\n');

    // Get a partner admin user
    const partnerAdminResult = await client.execute(`
      SELECT u.* FROM tblUsers u
      JOIN tblPartnerUsers pu ON u.strUserId = pu.strUserId
      WHERE u.strRole = 'partner_admin' AND u.bIsActive = 1
      LIMIT 1
    `);

    if (partnerAdminResult.rows.length === 0) {
      console.log('❌ No partner admin users found');
      return;
    }

    const partnerAdmin = partnerAdminResult.rows[0];
    console.log('👤 Found partner admin:', partnerAdmin.strName);

    // Get partner ID
    const partnerResult = await client.execute(`
      SELECT strPartnerId FROM tblPartnerUsers 
      WHERE strUserId = ? AND bIsActive = 1
    `, [partnerAdmin.strUserId]);

    if (partnerResult.rows.length === 0) {
      console.log('❌ Partner admin not associated with any partner');
      return;
    }

    const partnerId = partnerResult.rows[0].strPartnerId;
    console.log('🏢 Partner ID:', partnerId);

    // Get a product
    const productResult = await client.execute(`
      SELECT * FROM tblProducts WHERE bIsActive = 1 LIMIT 1
    `);

    if (productResult.rows.length === 0) {
      console.log('❌ No products found');
      return;
    }

    const product = productResult.rows[0];
    console.log('📦 Found product:', product.strProductName);

    // Get partner pricing for this product
    const pricingResult = await client.execute(`
      SELECT * FROM tblPartnerPrices 
      WHERE strPartnerId = ? AND strProductId = ? AND bIsActive = 1
    `, [partnerId, product.strProductId]);

    if (pricingResult.rows.length === 0) {
      console.log('❌ No partner pricing found for this product');
      return;
    }

    const partnerPrice = pricingResult.rows[0].decPartnerPrice;
    console.log('💰 Partner price:', partnerPrice);

    // Create a quote
    console.log('\n📝 Creating quote...');
    const quoteId = `quote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const quoteNumber = `Q-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 10000)}`;
    const quantity = 10;
    const customerUnitPrice = partnerPrice * 1.2; // 20% markup
    const customerLineTotal = customerUnitPrice * quantity;
    const partnerLineTotal = partnerPrice * quantity;

    await client.execute(`
      INSERT INTO tblQuotes (
        strQuoteId, strQuoteNumber, strPartnerId, strCreatedBy, strStatus,
        decSubtotal, decCustomerSubtotal, decDiscountAmount, decTotal, decPartnerTotal,
        strNotes, dtCreated, dtUpdated, bIsActive
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      quoteId, quoteNumber, partnerId, partnerAdmin.strUserId, 'draft',
      partnerLineTotal, customerLineTotal, 0, customerLineTotal, partnerLineTotal,
      'Test quote for conversion', Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000), 1
    ]);

    console.log('✅ Quote created:', quoteNumber);

    // Create quote item
    const quoteItemId = `quoteitem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await client.execute(`
      INSERT INTO tblQuoteItems (
        strQuoteItemId, strQuoteId, strProductId, intQuantity,
        decUnitPrice, decCustomerUnitPrice, decLineTotal, decCustomerLineTotal,
        strNotes, dtCreated, bIsActive
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      quoteItemId, quoteId, product.strProductId, quantity,
      partnerPrice, customerUnitPrice, partnerLineTotal, customerLineTotal,
      'Test quote item', Math.floor(Date.now() / 1000), 1
    ]);

    console.log('✅ Quote item created');

    // Update quote status to approved
    await client.execute(`
      UPDATE tblQuotes SET strStatus = 'approved', dtUpdated = ? WHERE strQuoteId = ?
    `, [Math.floor(Date.now() / 1000), quoteId]);

    console.log('✅ Quote status updated to approved');

    // Test the conversion process
    console.log('\n🔄 Testing conversion process...');
    
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const orderNumber = `ORD-${Date.now()}`;

    // Create the order
    await client.execute(`
      INSERT INTO tblOrders (
        strOrderId, strOrderNumber, strQuoteId, strPartnerId, strCreatedBy, 
        strStatus, decSubtotal, decDiscountAmount, decTotal, strNotes, 
        dtCreated, dtUpdated, bIsActive
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      orderId, orderNumber, quoteId, partnerId, partnerAdmin.strUserId,
      'pending', customerLineTotal, 0, customerLineTotal, 'Order created from approved quote',
      Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000), 1
    ]);

    console.log('✅ Order created:', orderNumber);

    // Create order item
    const orderItemId = `orderitem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await client.execute(`
      INSERT INTO tblOrderItems (
        strOrderItemId, strOrderId, strProductId, intQuantity, 
        decUnitPrice, decLineTotal, strNotes, dtCreated, bIsActive
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      orderItemId, orderId, product.strProductId, quantity,
      customerUnitPrice, customerLineTotal, 'Order item from quote',
      Math.floor(Date.now() / 1000), 1
    ]);

    console.log('✅ Order item created');

    // Create status history
    const statusHistoryId = `status_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await client.execute(`
      INSERT INTO tblOrderStatusHistory (
        strStatusHistoryId, strOrderId, strStatus, strNotes, strUpdatedBy, dtCreated
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      statusHistoryId, orderId, 'pending', 'Order created from approved quote', 
      partnerAdmin.strUserId, Math.floor(Date.now() / 1000)
    ]);

    console.log('✅ Order status history created');

    console.log('\n🎉 Quote conversion workflow test completed successfully!');
    console.log('📋 Summary:');
    console.log(`   - Quote: ${quoteNumber} (${quoteId})`);
    console.log(`   - Order: ${orderNumber} (${orderId})`);
    console.log(`   - Product: ${product.strProductName}`);
    console.log(`   - Quantity: ${quantity}`);
    console.log(`   - Total: $${customerLineTotal}`);

  } catch (error) {
    console.error('❌ Error testing quote conversion workflow:', error);
  } finally {
    await client.close();
  }
}

testQuoteConversionWorkflow(); 